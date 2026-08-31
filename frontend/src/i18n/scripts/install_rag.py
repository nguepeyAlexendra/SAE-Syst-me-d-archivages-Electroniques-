import subprocess
import shutil
import platform
import sys

def installer_ollama():
    systeme = platform.system()

    # Vérifier si Ollama est déjà installé
    if shutil.which('ollama'):
        print("✅ Ollama déjà installé")
    else:
        print(f"📦 Installation d'Ollama sur {systeme}...")
        if systeme == "Windows":
            print("⚠️ Télécharge manuellement Ollama depuis https://ollama.com/download")
            print("   puis relance ce script.")
            sys.exit(0)
        elif systeme == "Linux":
            subprocess.run(["bash", "-c", "curl -fsSL https://ollama.com/install.sh | sh"])
        elif systeme == "Darwin":
            subprocess.run(["brew", "install", "ollama"])

    # Télécharger les modèles
    print("📥 Téléchargement du modèle d'embeddings (~270 Mo)...")
    subprocess.run(["ollama", "pull", "nomic-embed-text"])

    print("📥 Téléchargement du modèle LLM (~2 Go, patientez)...")
    subprocess.run(["ollama", "pull", "llama3.2:3b"])

    print("🎉 RAG prêt !")

if __name__ == "__main__":
    installer_ollama()