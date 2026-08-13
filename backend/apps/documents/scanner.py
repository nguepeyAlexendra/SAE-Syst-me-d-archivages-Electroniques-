import base64
import io

from PIL import Image, ImageDraw
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


class ScanDemoView(APIView):
    """Génère un scan simulé (mode démo sans imprimante)."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Image format A4 « 300 DPI » (assez grande pour passer le contrôle qualité)
        img = Image.new('RGB', (2480, 3508), 'white')
        draw = ImageDraw.Draw(img)

        # En-tête du faux document
        draw.rectangle([140, 140, 2340, 420], outline='#9a6b2f', width=6)
        draw.text((180, 220), 'DOCUMENT NUMERISE - MODE DEMO', fill='#1c1917')

        # Fausses lignes de texte
        y = 700
        for i in range(24):
            largeur = 2200 if i % 4 else 1500
            draw.rectangle([180, y, 180 + largeur, y + 28], fill='#c9c2b4')
            y += 90

        # Conversion en base64 pour l'envoyer au frontend
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=95)
        image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

        return Response({'image': image_base64, 'mime': 'image/jpeg'})