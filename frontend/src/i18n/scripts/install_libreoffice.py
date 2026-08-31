"""
Installe LibreOffice (conversion DOCX/XLSX/PPTX -> PDF pour les miniatures).
A lancer UNE fois par machine. LibreOffice ne va PAS sur Git.
"""
import os
import shutil
import subprocess
import platform

CHEMINS_WINDOWS = [
    r"C:\Program Files\LibreOffice\program\soffice.exe",
    r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
]

def deja_installe():
    if shutil.which("soffice") or shutil.which("libreoffice"):
        return True
    return any(os.path.exists(p) for p in CHEMINS_WINDOWS)

def main():
    if deja_installe():
        print("✅ LibreOffice déjà installé")
        return

    systeme = platform.system()
    if systeme == "Linux":
        print("📦 Installation de LibreOffice (Linux)...")
        subprocess.run(["sudo", "apt-get", "update"])
        subprocess.run(["sudo", "apt-get", "install", "-y", "libreoffice"])
        print("✅ LibreOffice installé")
    elif systeme == "Windows":
        print("📦 Tentative d'installation via winget...")
        resultat = subprocess.run(
            ["winget", "install", "--id", "TheDocumentFoundation.LibreOffice",
             "-e", "--accept-package-agreements", "--accept-source-agreements"]
        )
        if resultat.returncode == 0:
            print("✅ LibreOffice installé via winget")
        else:
            print("⚠️ winget a échoué → télécharge manuellement :")
            print("   https://fr.libreoffice.org/download/telecharger-libreoffice/")
    else:
        print("macOS → télécharge depuis https://fr.libreoffice.org/download/")

if __name__ == "__main__":
    main()