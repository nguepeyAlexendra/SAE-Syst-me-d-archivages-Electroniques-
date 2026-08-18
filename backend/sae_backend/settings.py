"""
Django settings for sae_backend project.
"""

from pathlib import Path
import environ

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# --- Variables d'environnement (django-environ) ---
env = environ.Env(
    DEBUG=(bool, False),
)
environ.Env.read_env(BASE_DIR / '.env')

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env('SECRET_KEY')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env('DEBUG')

ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['localhost', '127.0.0.1'])

# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # --- Apps tierces ---
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'storages',
    # --- Nos apps ---
    'apps.accounts',
    'apps.documents',
    'apps.assistant',
    'apps.notifications',
    'django_filters',

]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'sae_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'sae_backend.wsgi.application'


# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
        'OPTIONS': {
            'timeout': 20,  # ✅ Attendre jusqu'à 20 secondes au lieu de 5 par défaut
        }
    }
}


# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# Internationalization
LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'Europe/Paris'
USE_I18N = True
USE_TZ = True


# Static files
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# --- Fichiers uploadés (documents du SAE) ---
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# --- CORS : autorise React à parler à Django ---
CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=[
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
])

# --- Django REST Framework ---
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

STORAGES = {
    "default": {
        "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}

AWS_ACCESS_KEY_ID = env("MINIO_ACCESS_KEY")
AWS_SECRET_ACCESS_KEY = env("MINIO_SECRET_KEY")
AWS_STORAGE_BUCKET_NAME = env("MINIO_BUCKET_NAME")
AWS_S3_ENDPOINT_URL = env("MINIO_ENDPOINT_URL")

AWS_S3_USE_SSL = env.bool("MINIO_USE_SSL", default=False)
AWS_S3_SIGNATURE_VERSION = "s3v4"       # Obligatoire pour MinIO
AWS_S3_ADDRESSING_STYLE = "path"        # ⚠️ C'EST CETTE LIGNE QUI CORRIGE LE 403 EN LOCAL


AWS_S3_USE_SSL = env.bool("MINIO_USE_SSL", default=False)
AWS_S3_FILE_OVERWRITE = False
AWS_DEFAULT_ACL = None
AWS_QUERYSTRING_AUTH = True

# ==========================================
# CONFIGURATION OCR (Tesseract)
# ==========================================
# TESSERACT_CMD : chemin du binaire tesseract (Windows : "C:\\Program Files\\Tesseract-OCR\\tesseract.exe")
# Laissez vide si tesseract est dans le PATH.
TESSERACT_CMD = env("TESSERACT_CMD", default=None)
# Langues Tesseract séparées par '+'. 'fra+eng' nécessite les données linguistiques fra + eng.
TESSERACT_LANGS = env("TESSERACT_LANGS", default="fra+eng")

# Envoi réel d'emails via SMTP (Gmail)
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'emmanuellenjomo07@gmail.com'  # <-- Mettez VOTRE adresse Gmail ici
EMAIL_HOST_PASSWORD = 'k q g v d m z d d v h h q d j j'  # <-- Voir explication ci-dessous ⚠️
DEFAULT_FROM_EMAIL = 'emmanuellenjomo07@gmail.com'
SITE_URL = 'http://localhost:5173'

# ⚠️ Pour voir les erreurs détaillées dans le terminal
DEBUG = True

# ==========================================
# CONFIGURATION MINIO
# ==========================================
MINIO_ENDPOINT = 'localhost:9000'      # L'adresse de votre serveur MinIO
MINIO_ACCESS_KEY = 'minioadmin'        # Votre Access Key MinIO
MINIO_SECRET_KEY = 'minioadmin'     # Votre Secret Key MinIO