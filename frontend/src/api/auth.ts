import apiClient from './client';

export interface Appareil {
  ip_address: string;
  user_agent: string;
  date_connexion: string;
}

export interface Utilisateur {
  id: number;
  username: string;
  email: string;
  est_admin: boolean;
  est_actif?: boolean;
  photo?: string | null;
  appareils?: Appareil[];
  departement?: { id: number; nom: string } | null;
}

// ✅ MODIFIÉ : On sépare les deux types de réponses possibles
export interface ConnexionSuccessResponse {
  token: string;
  changement_mdp_obligatoire?: boolean;
  utilisateur: Utilisateur;
}

export interface Connexion2FARequiredResponse {
  status: '2fa_required';
  temp_token: string;
}

// Le type de retour peut maintenant être l'un ou l'autre
export type ConnexionResponse = ConnexionSuccessResponse | Connexion2FARequiredResponse;
export interface ProfilResponse extends Utilisateur {
  photo: string | null;
  departement?: { 
    id: number; 
    nom: string;
    nom_en?: string;  // ✅ AJOUTÉ ICI
  } | null;
  departement_nom?: string | null;
  departement_nom_en?: string | null;  // ✅ AJOUTÉ ICI
  two_fa_active?: boolean;  // ✅ AJOUTÉ ICI aussi pour le 2FA
}


export async function verifierEmail(email: string): Promise<boolean> {
  const reponse = await apiClient.post('/auth/verifier-email/', { email });
  return reponse.data.email_valide;
}

// Modifier la fonction connexion pour envoyer le trusted_device_token
export async function connexion(
  email: string, 
  password: string, 
  trustedDeviceToken?: string
): Promise<ConnexionResponse> {
  const body: any = { email, password };
  if (trustedDeviceToken) {
    body.trusted_device_token = trustedDeviceToken;
  }
  const reponse = await apiClient.post('/auth/connexion/', body);
  return reponse.data;
}

// Modifier la fonction verifier2FA pour envoyer la case "se souvenir"
export async function verifier2FA(
  tempToken: string, 
  code: string, 
  seSouvenirAppareil: boolean = false
): Promise<ConnexionSuccessResponse & { trusted_device_token?: string }> {
  const reponse = await apiClient.post('/auth/verify-2fa/', {
    temp_token: tempToken,
    code: code,
    se_souvenir_appareil: seSouvenirAppareil,
  });
  return reponse.data;
}

export async function changerMotDePasse(ancienMotDePasse: string, nouveauMotDePasse: string) {
  const reponse = await apiClient.post('/auth/changer-mot-de-passe/', {
    ancien_mot_de_passe: ancienMotDePasse,
    nouveau_mot_de_passe: nouveauMotDePasse,
  });
  return reponse.data;
}

export async function recupererProfil(): Promise<ProfilResponse> {
  const reponse = await apiClient.get('/auth/profil/');
  return reponse.data;
}

export async function motDePasseOublie(email: string): Promise<{ succes: boolean; message: string }> {
  const reponse = await apiClient.post('/auth/mot-de-passe-oublie/', { email });
  return reponse.data;
}

export async function confirmerMotDePasseOublie(email: string, code: string, nouveauMotDePasse: string): Promise<{ succes: boolean }> {
  const reponse = await apiClient.post('/auth/confirmer-mot-de-passe-oublie/', {
    email, code, nouveau_mot_de_passe: nouveauMotDePasse,
  });
  return reponse.data;
}

export async function mettreAJourPhotoProfil(fichier: File): Promise<ProfilResponse> {
  const formData = new FormData();
  formData.append('photo', fichier);
  const reponse = await apiClient.patch('/auth/profil/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return reponse.data;
}

// ✅ NOUVEAU : Récupérer la configuration globale de connexion
export interface ConfigurationConnexion {
  domaine_email_autorise: string;
  two_fa_obligatoire: boolean;
  modifie_par: number | null;
  derniere_modification: string;
}

export async function getConfigurationConnexion(): Promise<ConfigurationConnexion> {
  const reponse = await apiClient.get('/auth/configuration/');
  return reponse.data;
}

export async function updateConfigurationConnexion(data: Partial<ConfigurationConnexion>): Promise<ConfigurationConnexion> {
  const reponse = await apiClient.patch('/auth/configuration/', data);
  return reponse.data;
}

// ✅ NOUVEAU : Activer/Désactiver le 2FA pour l'utilisateur connecté
export async function activerTwoFA(actif: boolean): Promise<ProfilResponse> {
  const reponse = await apiClient.patch('/auth/profil/', { two_fa_active: actif });
  return reponse.data;
}