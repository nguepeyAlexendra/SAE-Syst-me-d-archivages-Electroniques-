import apiClient from './client';
import type { Utilisateur as AuthUtilisateur } from './auth';
import type { Document } from './documents';
export type Utilisateur = AuthUtilisateur;

export interface UserStats {
  total_utilisateurs: number;
  actifs: number;
}

export interface SystemStats {
  total: number;
  confidentiels: number;
  en_cours: number;
  valide: number;
  rejete: number;
  par_departement: { departement__nom: string; departement__nom_en?: string; total: number; valide: number; rejete: number }[];
  par_categorie: { categorie__nom: string; count: number }[];
  top_causes_rejet: { cause: string; cause_en?: string; count: number }[];
  activite_hebdo: { date: string; count: number }[];
}

export interface DepartementType {
  id: number;
  nom: string;
  nom_en?: string;
  description?: string;
}

export interface SystemConfig {
  taille_max_fichier: number;
  formats_acceptes: string[];
  antivirus_actif: boolean;
  seuil_similarite: number;
  elasticsearch_actif: boolean;
  kafka_actif: boolean;
  nas_actif: boolean;
}

export async function listerDepartements(): Promise<DepartementType[]> {
  const reponse = await apiClient.get('/departements/');
  return reponse.data;
}

export async function creerDepartement(donnees: Partial<DepartementType>): Promise<DepartementType> {
  const reponse = await apiClient.post('/departements/', donnees);
  return reponse.data;
}

export async function modifierDepartement(id: number, donnees: Partial<DepartementType>): Promise<DepartementType> {
  const reponse = await apiClient.patch(`/departements/${id}/`, donnees);
  return reponse.data;
}

export async function supprimerDepartement(id: number) {
  await apiClient.delete(`/departements/${id}/`);
}

export async function listerMembresDepartement(id: number): Promise<Utilisateur[]> {
  const reponse = await apiClient.get(`/departements/${id}/utilisateurs/`);
  return reponse.data;
}

export async function assignerDepartement(userId: number, departementId: number) {
  const reponse = await apiClient.post(`/departements/${departementId}/assigner/`, {
    user_id: userId,
    action: 'assigner',
  });
  return reponse.data;
}

export async function retirerDepartement(userId: number, departementId: number) {
  const reponse = await apiClient.post(`/departements/${departementId}/assigner/`, {
    user_id: userId,
    action: 'retirer',
  });
  return reponse.data;
}

export interface Categorie {
  id: number;
  nom: string;
  description?: string;
}

export interface Tag {
  id: number;
  nom: string;
  couleur?: string;
}

export interface AdminDocument extends Document {
  confidentiel: boolean;
  personnes_autorisees: number[];
}

export interface Notification {
  id: number;
  type: string;
  titre: string;
  message: string;
  lu: boolean;
  date_creation: string;
}

// Dashboard Admin
export async function getSystemStats(params?: Record<string, string>): Promise<SystemStats> {
  const reponse = await apiClient.get('/admin/stats/', { params });
  return reponse.data;
}

// Utilisateurs
export async function listerUtilisateurs(): Promise<Utilisateur[]> {
  const reponse = await apiClient.get('/admin/utilisateurs/');
  return reponse.data;
}

export async function creerUtilisateur(donnees: { username: string; email: string; departement_id: number }): Promise<{ id: number; username: string; email: string; est_admin: boolean; est_actif: boolean; message: string }> {
  const reponse = await apiClient.post('/admin/utilisateurs/', donnees);
  return reponse.data;
}

export async function desactiverUtilisateur(id: number) {
  const reponse = await apiClient.post(`/admin/utilisateurs/${id}/desactiver/`);
  return reponse.data;
}

export async function modifierRoles(id: number, donnees: { est_admin: boolean; departement_id?: number }) {
  const reponse = await apiClient.patch(`/admin/utilisateurs/${id}/`, donnees);
  return reponse.data;
}

export async function reinitialiserMotDePasse(id: number, nouveauMotDePasse?: string): Promise<{ succes: boolean; message: string; mot_de_passe: string }> {
  const reponse = await apiClient.post(`/admin/utilisateurs/${id}/reset-password/`, {
    nouveau_mot_de_passe: nouveauMotDePasse || '',
  });
  return reponse.data;
}

// Catégories
export async function listerCategories(): Promise<Categorie[]> {
  const reponse = await apiClient.get('/categories/');
  return reponse.data;
}

export async function creerCategorie(donnees: Partial<Categorie>) {
  const reponse = await apiClient.post('/categories/', donnees);
  return reponse.data;
}

export async function modifierCategorie(id: number, donnees: Partial<Categorie>) {
  const reponse = await apiClient.patch(`/categories/${id}/`, donnees);
  return reponse.data;
}

export async function supprimerCategorie(id: number) {
  await apiClient.delete(`/categories/${id}/`);
}

// Tags
export async function listerTags(): Promise<Tag[]> {
  const reponse = await apiClient.get('/tags/');
  return reponse.data;
}

export async function creerTag(donnees: Partial<Tag>) {
  const reponse = await apiClient.post('/tags/', donnees);
  return reponse.data;
}

export async function modifierTag(id: number, donnees: Partial<Tag>): Promise<Tag> {
  const reponse = await apiClient.patch(`/tags/${id}/`, donnees);
  return reponse.data;
}

export async function supprimerTag(id: number) {
  await apiClient.delete(`/tags/${id}/`);
}

// Configuration
export async function getConfig(): Promise<SystemConfig> {
  const reponse = await apiClient.get('/admin/configuration/');
  return reponse.data;
}

export async function updateConfig(donnees: Partial<SystemConfig>) {
  const reponse = await apiClient.patch('/admin/configuration/', donnees);
  return reponse.data;
}

// Notifications
export async function listerNotifications(): Promise<Notification[]> {
  const reponse = await apiClient.get('/notifications/');
  return reponse.data;
}

export async function marquerLue(id: number) {
  await apiClient.post(`/notifications/${id}/lire/`);
}

export async function marquerToutLu() {
  await apiClient.post('/notifications/lire-tout/');
}

// Droits d'accès
export async function modifierAccesDocument(id: number, personnesAutorisees: number[]) {
  const reponse = await apiClient.patch(`/documents/${id}/`, { personnes_autorisees: personnesAutorisees });
  return reponse.data;
}

// Permissions par document
export interface UtilisateurAutoriseDocument {
  id: number;
  username: string;
  explicite?: boolean;
}
export interface DepartementAutoriseDocument {
  id: number;
  nom: string;
  nom_en?: string | null;
  explicite?: boolean;
}
export interface DocumentPermission {
  id: number;
  titre: string;
  departement_id: number | null;
  departement_nom: string | null;
  groupe: string | null;
  utilisateurs_autorises: UtilisateurAutoriseDocument[];
  departements_autorises: DepartementAutoriseDocument[];
}

export async function listerPermissionsDocument(): Promise<DocumentPermission[]> {
  const reponse = await apiClient.get('/admin/documents/permissions/');
  return reponse.data;
}

export async function mettreJourPermissionsDocument(
  documentIds: number[],
  payload: {
    ajouter_utilisateurs?: number[];
    retirer_utilisateurs?: number[];
    ajouter_departements?: number[];
    retirer_departements?: number[];
  }
): Promise<{ succes: boolean; message: string }> {
  const reponse = await apiClient.patch('/admin/documents/permissions/', {
    document_ids: documentIds,
    ...payload,
  });
  return reponse.data;
}

// Permissions inter-départements utilisateur
export async function getDepartementsAutorises(userId: number): Promise<{ departements_autorises: number[]; departements_autorises_noms: { id: number; nom: string; nom_en: string }[]; departement: number | null; departement_nom: string | null }> {
  const reponse = await apiClient.get(`/admin/utilisateurs/${userId}/departements-autorises/`);
  return reponse.data;
}

export async function mettreJourDepartementsAutorises(userId: number, departementIds: number[]) {
  const reponse = await apiClient.patch(`/admin/utilisateurs/${userId}/departements-autorises/`, { departements_autorises: departementIds });
  return reponse.data;
}

// Permissions inter-départements (par département)
export async function accorderAccesDepartement(sourceDeptId: number, targetDeptIds: number[]): Promise<{ succes: boolean; message: string; utilisateurs_affectes: number }> {
  const reponse = await apiClient.post('/departements/acces/', {
    source_departement_id: sourceDeptId,
    target_departement_ids: targetDeptIds,
  });
  return reponse.data;
}

export async function revoquerAccesDepartement(sourceDeptId: number, targetDeptIds: number[]): Promise<{ succes: boolean; message: string; utilisateurs_affectes: number }> {
  const reponse = await apiClient.delete('/departements/acces/', {
    data: { source_departement_id: sourceDeptId, target_departement_ids: targetDeptIds },
  });
  return reponse.data;
}
