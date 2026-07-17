
import apiClient from './client';

export async function verifierEmail(email) {
  const reponse = await apiClient.post('/auth/verifier-email/', { email });
  return reponse.data.email_valide;
}

export async function connexion(email, password) {
  const reponse = await apiClient.post('/auth/connexion/', { email, password });
  return reponse.data;
}

export async function changerMotDePasse(ancienMotDePasse, nouveauMotDePasse) {
  const reponse = await apiClient.post('/auth/changer-mot-de-passe/', {
    ancien_mot_de_passe: ancienMotDePasse,
    nouveau_mot_de_passe: nouveauMotDePasse,
  });
  return reponse.data;
}

export async function recupererProfil() {
  const reponse = await apiClient.get('/auth/profil/');
  return reponse.data;
}

export async function mettreAJourPhotoProfil(fichier) {
  const formData = new FormData();
  formData.append('photo', fichier);

  const reponse = await apiClient.patch('/auth/profil/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return reponse.data;
}