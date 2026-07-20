import os
import environ
import boto3
from botocore.exceptions import ClientError

# Charge les variables du fichier .env
env = environ.Env()
environ.Env.read_env()

endpoint = env("MINIO_ENDPOINT_URL")
access_key = env("MINIO_ACCESS_KEY")
secret_key = env("MINIO_SECRET_KEY")
bucket = env("MINIO_BUCKET_NAME")

print(f"🔗 Endpoint : {endpoint}")
print(f"📦 Bucket : {bucket}")
print(f"🔑 Access Key : {access_key}")

try:
    # Configuration identique à celle que django-storages devrait utiliser
    client = boto3.client(
        's3',
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name='us-east-1',
        config=boto3.session.Config(
            signature_version='s3v4',
            s3={'addressing_style': 'path'} # Crucial pour MinIO local
        )
    )
    
    print("\n[Test 1] Vérification des identifiants (liste des buckets)...")
    buckets = client.list_buckets()
    print(f"✅ Succès ! Buckets trouvés : {[b['Name'] for b in buckets['Buckets']]}")
    
    print(f"\n[Test 2] Vérification de l'accès au bucket '{bucket}'...")
    client.head_bucket(Bucket=bucket)
    print(f"✅ Le bucket '{bucket}' est accessible.")
    
    print("\n[Test 3] Simulation d'upload (comme le fait Django)...")
    with open("test_file.txt", "w") as f:
        f.write("Test Django MinIO")
    
    client.upload_file("test_file.txt", bucket, "test/test_file.txt")
    print("✅ Upload réussi !")
    
    # Nettoyage
    client.delete_object(Bucket=bucket, Key="test/test_file.txt")
    os.remove("test_file.txt")
    print("✅ Nettoyage effectué.")

except ClientError as e:
    print(f"\n❌ ÉCHEC MINIO : {e}")
    print("👉 Le problème vient à 100% de vos identifiants, du nom du bucket ou des droits MinIO.")
except Exception as e:
    print(f"\n❌ ERREUR GÉNÉRALE : {e}")