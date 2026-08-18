from django.db import models
from django.conf import settings

class Conversation(models.Model):
    utilisateur = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='conversations')
    titre = models.CharField(max_length=200, default='Nouvelle conversation')
    est_favori = models.BooleanField(default=False)
    est_lu = models.BooleanField(default=True)
    cree_le = models.DateTimeField(auto_now_add=True)
    class Meta: ordering = ['-cree_le']

class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=20, choices=[('user','user'),('assistant','assistant')])
    contenu = models.TextField()
    sources = models.JSONField(default=list, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)
    class Meta: ordering = ['cree_le']