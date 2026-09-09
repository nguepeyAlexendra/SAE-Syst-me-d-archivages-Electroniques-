from django.db.models import Q
from django.http import StreamingHttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Conversation, Message
from . import rag
import json


def serialize_conv(c):
    """Sérialise une conversation pour l'API."""
    return {"id": c.id, "titre": c.titre, "est_favori": c.est_favori, "est_lu": c.est_lu, "cree_le": c.cree_le}


# ===========================================================================
# POST-FILTRAGE DES SOURCES (masque les sources parasites si le LLM refuse)
# ===========================================================================

MARQUEURS_REFUS = [
    "n'est pas mentionnée", "n'est pas mentionné", "n'est pas présente",
    "aucun document", "aucune information", "aucune donnée",
    "n'ai trouvé aucun", "ne contient pas", "ne contient aucune",
    "pas d'information", "pas de donnée",
    "not mentioned", "no relevant", "no information", "cannot find",
    "no se menciona", "ningún documento", "ninguna información",
]


def _est_un_refus(texte):
    """Détecte si le LLM avoue ne pas trouver la réponse dans le contexte."""
    t = texte.lower()
    return any(m in t for m in MARQUEURS_REFUS)


# ===========================================================================
# CRUD CONVERSATIONS
# ===========================================================================

class ConversationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response([serialize_conv(c) for c in Conversation.objects.filter(utilisateur=request.user)])

    def post(self, request):
        return Response(serialize_conv(Conversation.objects.create(utilisateur=request.user)))


class ConversationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_conv(self, request, pk):
        return Conversation.objects.filter(id=pk, utilisateur=request.user).first()

    def patch(self, request, pk):
        c = self.get_conv(request, pk)
        if not c:
            return Response({"erreur": "Introuvable"}, status=404)
        if "titre" in request.data:
            c.titre = request.data["titre"] or c.titre
        if "est_favori" in request.data:
            c.est_favori = bool(request.data["est_favori"])
        if "est_lu" in request.data:
            c.est_lu = bool(request.data["est_lu"])
        c.save()
        return Response(serialize_conv(c))

    def delete(self, request, pk):
        c = self.get_conv(request, pk)
        if c:
            c.delete()
        return Response({"ok": True})


# ===========================================================================
# RECHERCHE DANS LES CONVERSATIONS
# ===========================================================================

class RechercheView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        if not q:
            return Response([serialize_conv(c) for c in Conversation.objects.filter(utilisateur=request.user)])
        ids_titre = set(Conversation.objects.filter(utilisateur=request.user, titre__icontains=q).values_list('id', flat=True))
        ids_msg = set(Message.objects.filter(conversation__utilisateur=request.user, contenu__icontains=q).values_list('conversation_id', flat=True))
        convs = Conversation.objects.filter(id__in=(ids_titre | ids_msg)).order_by('-cree_le')
        return Response([serialize_conv(c) for c in convs])


# ===========================================================================
# HISTORIQUE DES MESSAGES D'UNE CONVERSATION
# ===========================================================================

class MessageListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, conv_id):
        msgs = Message.objects.filter(conversation__id=conv_id, conversation__utilisateur=request.user)
        return Response([{"id": m.id, "role": m.role, "contenu": m.contenu, "sources": m.sources} for m in msgs])

class RechercheSemantiqueView(APIView):
    """Retourne les chunks les plus pertinents (sans génération LLM)."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        q = (request.data.get('question') or '').strip()
        if not q:
            return Response({"erreur": "Champ 'question' requis"}, status=400)
        chunks = rag.recherche_hybride(q, k=8, user=request.user)
        return Response([{
            "document_id": c.get("document_id"),
            "titre": c.get("titre"),
            "score": c.get("score"),
            "extrait": c.get("texte", "")[:300],
        } for c in chunks])

# ===========================================================================
# 🧠 POSE UNE QUESTION (routeur METADONNEES / RAG + streaming + post-filtrage)
# ===========================================================================

class QuestionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, conv_id):
        import traceback

        try:
            # --- 1. Validation du body ---
            data = request.data
            if not data:
                return Response({"erreur": "Body requis (JSON)"}, status=400)

            question = data.get("question") or data.get("content") or ""
            if isinstance(question, str):
                question = question.strip()
            if not question:
                return Response({"erreur": "Champ 'question' requis"}, status=400)

            stream = data.get("stream", False)
            model = data.get("model", None)
            temperature = float(data.get("temperature", 0.2))

            # --- 2. Récupération de la conversation ---
            try:
                conv = Conversation.objects.get(id=conv_id, utilisateur=request.user)
            except Conversation.DoesNotExist:
                return Response({"erreur": "Conversation introuvable"}, status=404)

            Message.objects.create(conversation=conv, role="user", contenu=question)
            if conv.titre == 'Nouvelle conversation':
                conv.titre = question[:50]
                conv.save()

            prenom = getattr(request.user, 'first_name', '') or request.user.username

            # --- 3. 🧭 ROUTEUR D'INTENTION : métadonnées (BDD) ou contenu (RAG) ---
            intention = rag.detecter_intention(question)
            print(f"\n[RAG] Intention détectée : {intention} → '{question[:60]}'")

            if intention == "METADONNEES":
                donnees = rag.requete_metadata(question, request.user)
                print(f"[RAG] Métadonnées : {donnees['total']} docs, filtres={donnees['filtres']}")
                if donnees['total'] > 0:
                    reponse = rag.generer_depuis_donnees(question, donnees, prenom, model=model)

                    # 🆕 Les liens markdown [titre](/documents/X) sont DÉJÀ dans le texte
                    # → pas besoin de badges sources en bas (ça ferait doublon)
                    sources = []

                    Message.objects.create(conversation=conv, role="assistant",
                                           contenu=reponse, sources=sources)
                    return Response({"reponse": reponse, "sources": sources})
                # Si 0 résultat → on retombe sur le RAG classique

            # --- 4. 📚 Chemin RAG classique (contenu des documents) ---
            chunks = rag.recherche_hybride(question, user=request.user)
            print(f"[RAG] {len(chunks)} chunks trouvés")

            if not chunks:
                reponse = "Je n'ai trouvé aucun document pertinent pour cette question."
                Message.objects.create(conversation=conv, role="assistant", contenu=reponse, sources=[])
                return Response({"reponse": reponse, "sources": []})

            # Sources dédupliquées par document (pour le RAG)
            sources_uniques = {}
            for c in chunks:
                doc_id = c.get("document_id")
                if doc_id and doc_id not in sources_uniques:
                    sources_uniques[doc_id] = {
                        "document_id": doc_id,
                        "titre": c.get("titre", ""),
                        "extrait": c.get("texte", "")[:200],
                    }
            sources = list(sources_uniques.values())

            # --- 5. 🌊 Mode STREAMING ---
            if stream:
                def generate():
                    full_response = ""
                    try:
                        for token in rag.generer_stream(question, chunks, prenom, model=model, temperature=temperature):
                            full_response += token
                            yield f"data: {json.dumps({'token': token})}\n\n"

                        # Post-filtrage : refus → pas de sources
                        sources_filtrees = [] if _est_un_refus(full_response) else sources
                        if not sources_filtrees:
                            print("[RAG] Stream : réponse = refus → sources masquées")

                        Message.objects.create(conversation=conv, role="assistant",
                                               contenu=full_response, sources=sources_filtrees)
                        yield f"data: {json.dumps({'done': True, 'sources': sources_filtrees})}\n\n"
                    except Exception as e:
                        yield f"data: {json.dumps({'error': str(e)})}\n\n"

                return StreamingHttpResponse(generate(), content_type='text/event-stream')

            # --- 6. 💬 Mode NORMAL (non streaming) ---
            reponse = rag.generer(question, chunks, prenom, model=model, temperature=temperature)

            # Post-filtrage : si le LLM avoue ne pas trouver, on masque les sources parasites
            if _est_un_refus(reponse):
                sources = []
                print("[RAG] Réponse = refus → sources masquées")

            Message.objects.create(conversation=conv, role="assistant", contenu=reponse, sources=sources)
            return Response({"reponse": reponse, "sources": sources})

        except Exception as e:
            print(f"\n{'!'*60}\n🔥 ERREUR QuestionView :\n{'!'*60}")
            traceback.print_exc()
            print(f"{'!'*60}\n")
            return Response({"erreur": f"{type(e).__name__}: {str(e)}"}, status=500)