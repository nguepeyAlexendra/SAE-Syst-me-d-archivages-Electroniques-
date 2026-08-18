from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Conversation, Message
from . import rag

def serialize_conv(c):
    return {"id": c.id, "titre": c.titre, "est_favori": c.est_favori, "est_lu": c.est_lu, "cree_le": c.cree_le}

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
        if not c: return Response({"erreur": "Introuvable"}, status=404)
        if "titre" in request.data: c.titre = request.data["titre"] or c.titre
        if "est_favori" in request.data: c.est_favori = bool(request.data["est_favori"])
        if "est_lu" in request.data: c.est_lu = bool(request.data["est_lu"])
        c.save()
        return Response(serialize_conv(c))
    def delete(self, request, pk):
        c = self.get_conv(request, pk)
        if c: c.delete()
        return Response({"ok": True})

class RechercheView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        q = request.query_params.get('q', '').strip()
        if not q: return Response([serialize_conv(c) for c in Conversation.objects.filter(utilisateur=request.user)])
        ids_titre = set(Conversation.objects.filter(utilisateur=request.user, titre__icontains=q).values_list('id', flat=True))
        ids_msg = set(Message.objects.filter(conversation__utilisateur=request.user, contenu__icontains=q).values_list('conversation_id', flat=True))
        convs = Conversation.objects.filter(id__in=(ids_titre | ids_msg)).order_by('-cree_le')
        return Response([serialize_conv(c) for c in convs])

class MessageListView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, conv_id):
        msgs = Message.objects.filter(conversation__id=conv_id, conversation__utilisateur=request.user)
        return Response([{"id": m.id, "role": m.role, "contenu": m.contenu, "sources": m.sources} for m in msgs])

class QuestionView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, conv_id):
        question = request.data.get("question", "").strip()
        if not question: return Response({"erreur": "Question vide"}, status=400)
        conv = Conversation.objects.get(id=conv_id, utilisateur=request.user)
        Message.objects.create(conversation=conv, role="user", contenu=question)
        if conv.titre == 'Nouvelle conversation':
            conv.titre = question[:50]; conv.save()
        chunks = rag.recherche(question)
        prenom = getattr(request.user, 'first_name', '') or request.user.username
        reponse = rag.generer(question, chunks, prenom) if chunks else "Je n'ai trouvé aucun document pertinent pour cette question."
        sources = [{"document_id": c["document_id"], "titre": c["titre"]} for c in chunks]
        Message.objects.create(conversation=conv, role="assistant", contenu=reponse, sources=sources)
        return Response({"reponse": reponse, "sources": sources})