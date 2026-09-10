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


def _message_service_indisponible(langue):
    """Message clair et actionnable si Elasticsearch/Ollama est indisponible."""
    if langue == 'en':
        return (
            "I couldn't access the document search engine.\n\n"
            "Possible causes:\n"
            "- The search service (Elasticsearch, port 9200) is not running\n"
            "- The AI service (Ollama, port 11434) is unavailable\n\n"
            "Meanwhile, you can still ask questions about metadata "
            "(lists, statistics, authors, dates, formats): these only use the database."
        )
    if langue == 'es':
        return (
            "No pude acceder al motor de búsqueda de documentos.\n\n"
            "Causas posibles:\n"
            "- El servicio de búsqueda (Elasticsearch, puerto 9200) no está iniciado\n"
            "- El servicio de IA (Ollama, puerto 11434) no está disponible\n\n"
            "Mientras tanto, puede hacer preguntas sobre metadatos "
            "(listas, estadísticas, autores, fechas, formatos): solo usan la base de datos."
        )
    return (
        "Je n'ai pas pu accéder au moteur de recherche des documents.\n\n"
        "Causes possibles :\n"
        "- Le service de recherche (Elasticsearch, port 9200) n'est pas démarré\n"
        "- Le service d'IA (Ollama, port 11434) n'est pas disponible\n\n"
        "En attendant, vous pouvez poser des questions sur les métadonnées "
        "(listes, statistiques, auteurs, dates, formats) : elles fonctionnent sans ces services."
    )


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


# ===========================================================================
# RECHERCHE SÉMANTIQUE PURE (onglet Recherche)
# ===========================================================================

class RechercheSemantiqueView(APIView):
    """Retourne les chunks les plus pertinents (sans génération LLM)."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        q = (request.data.get('question') or '').strip()
        if not q:
            return Response({"erreur": "Champ 'question' requis"}, status=400)
        try:
            chunks = rag.recherche_hybride(q, k=8, user=request.user)
        except Exception as e:
            print(f"[RAG] Erreur recherche sémantique : {e}")
            return Response({"erreur": "Service de recherche indisponible", "detail": str(e)}, status=503)
        return Response([{
            "document_id": c.get("document_id"),
            "titre": c.get("titre"),
            "score": c.get("score"),
            "extrait": c.get("texte", "")[:300],
        } for c in chunks])


# ===========================================================================
# POSE UNE QUESTION (résumé direct / routeur METADONNEES / RAG + streaming)
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
            langue = rag._detecter_langue(question)

            # --- 2bis. Mode RÉSUMÉ DIRECT (documents cochés, IDs fournis) ---
            doc_ids = data.get('document_ids') or []
            if isinstance(doc_ids, list) and doc_ids:
                reponse = rag.resumer_documents(doc_ids, request.user, prenom, question=question, model=model)
                from apps.documents.models import Document as DocModel
                sources = [{"document_id": d.id, "titre": d.titre}
                           for d in DocModel.objects.filter(id__in=doc_ids)]
                Message.objects.create(conversation=conv, role="assistant", contenu=reponse, sources=sources)
                return Response({"reponse": reponse, "sources": sources})

            # --- 3. ROUTEUR D'INTENTION : métadonnées (BDD) ou contenu (RAG) ---
            intention = rag.detecter_intention(question)
            print(f"\n[RAG] Intention détectée : {intention} → '{question[:60]}'")

            if intention == "METADONNEES":
                try:
                    donnees = rag.requete_metadata(question, request.user)
                    print(f"[RAG] Métadonnées : total={donnees['total']}, type={donnees.get('type')}, "
                          f"non_accessibles={donnees.get('non_accessibles')}, filtres={donnees['filtres']}")

                    # ✅ TOUJOURS répondre en métadonnées (même si total = 0 :
                    # "aucun document" est une réponse valide, pas une erreur)
                    reponse = rag.generer_depuis_donnees(question, donnees, prenom, model=model)
                    sources = []  # liens markdown déjà dans le texte
                    Message.objects.create(conversation=conv, role="assistant",
                                           contenu=reponse, sources=sources)
                    return Response({"reponse": reponse, "sources": sources})
                except Exception as e:
                    print(f"[RAG] Erreur métadonnées : {e}")
                    traceback.print_exc()
                    # Erreur technique uniquement → on tente le RAG en secours

            # --- 4. Chemin RAG classique (contenu des documents) ---
            try:
                chunks = rag.recherche_hybride(question, user=request.user)
                print(f"[RAG] {len(chunks)} chunks trouvés")
            except Exception as e:
                print(f"[RAG] Erreur recherche hybride : {e}")
                chunks = []

            if not chunks:
                reponse = _message_service_indisponible(langue)
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

            # --- 5. Mode STREAMING ---
            if stream:
                def generate():
                    full_response = ""
                    try:
                        for token in rag.generer_stream(question, chunks, prenom, model=model, temperature=temperature):
                            full_response += token
                            yield f"data: {json.dumps({'token': token})}\n\n"

                        sources_filtrees = [] if _est_un_refus(full_response) else sources
                        if not sources_filtrees:
                            print("[RAG] Stream : réponse = refus → sources masquées")

                        Message.objects.create(conversation=conv, role="assistant",
                                               contenu=full_response, sources=sources_filtrees)
                        yield f"data: {json.dumps({'done': True, 'sources': sources_filtrees})}\n\n"
                    except Exception as e:
                        yield f"data: {json.dumps({'error': str(e)})}\n\n"

                return StreamingHttpResponse(generate(), content_type='text/event-stream')

            # --- 6. Mode NORMAL (non streaming) ---
            reponse = rag.generer(question, chunks, prenom, model=model, temperature=temperature)

            if _est_un_refus(reponse):
                sources = []
                print("[RAG] Réponse = refus → sources masquées")

            Message.objects.create(conversation=conv, role="assistant", contenu=reponse, sources=sources)
            return Response({"reponse": reponse, "sources": sources})

        except Exception as e:
            print(f"\n{'!'*60}\nERREUR QuestionView :\n{'!'*60}")
            traceback.print_exc()
            print(f"{'!'*60}\n")
            return Response({"erreur": f"{type(e).__name__}: {str(e)}"}, status=500)