import apiClient from './client';

export interface EtapePipeline {
  date: any;
  timestamp: any;
  etape: string;
  libelle: string;
  statut: string;
  horodatage?: string;
}

export interface Document {
  est_archive: any;
  id: number;
  titre: string;
  fichier: string;
  type_source: string;
  statut: string;
  date_depot: string;
  date_derniere_modification?: string;
  depose_par: number;
  depose_par_nom: string;
  categorie?: number;
  categorie_nom?: string;
  departement?: number;
  departement_nom?: string;
  departement_nom_en?: string;
  est_departement_origine?: boolean;
  tags?: any[];
  tags_detail?: { id: number; nom: string; couleur: string }[];
  groupe?: string;
  type_mime?: string;
  taille_fichier?: number;
  auteur_document?: string;
  largeur_px?: number;
  hauteur_px?: number;
  duree?: number;
  est_confidentiel?: boolean;
  utilisateurs_autorises?: number[];
  est_epingle?: boolean;
  favoris?: number[];
  tentative_count?: number;
  cause_rejet?: string;
  cause_rejet_en?: string;
  contenu_texte?: string;
  log_pipeline?: EtapePipeline[];
  est_supprime?: boolean;
  apercu_pdf?: string;
}

export interface LogAction {
  id: number;
  document: number;
  document_titre?: string;
  type_action: string;
  cause: string;
  cause_en?: string;
  effectue_par: number;
  effectue_par_nom?: string;
  date_action: string;
}

export interface ServerStats {
  platform: string;
  python_version: string;
  uptime: string;
  cpu_percent: number;
  cpu_count: number;
  memory_total: number;
  memory_used: number;
  memory_percent: number;
  disk_total: number;
  disk_used: number;
  disk_percent: number;
  connexions_24h: number;
  storage_history?: { date: string; disk_used_gb: number; disk_total_gb: number; minio_used_gb: number }[];
}

export async function listerDocuments(params?: Record<string, string>): Promise<Document[]> {
  const reponse = await apiClient.get('/documents/', { params });
  return reponse.data;
}
export async function deposerDocument(
  titre: string, 
  fichier: File, 
  typeSource: string, 
  departement?: number, 
  typeCible?: string, 
  tags?: string[], 
): Promise<any> {
  const formData = new FormData();
  formData.append('titre', titre);
  formData.append('fichier', fichier);
  formData.append('type_source', typeSource);
  formData.append('groupe_attendu', typeCible || 'documents');

  if (departement !== undefined && departement !== null) {
    formData.append('departement', String(departement));
  }

  // ✅ CORRECTION : Le champ DOIT s'appeler 'tags_input' pour correspondre au backend
  if (tags && tags.length > 0) {
    console.log("🚀 Envoi des tags au backend :", JSON.stringify(tags));
    formData.append('tags_input', JSON.stringify(tags));
  } else {
    console.log("⚠️ ATTENTION : Le tableau de tags est VIDE, rien n'est envoyé !");
  }

  // ✅ IMPORTANT : On laisse Axios gérer le Content-Type tout seul
  const reponse = await apiClient.post('/documents/', formData);
  return reponse.data;
}
const URL_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000';

export const obtenirDocument = recupererDocument;

export async function recupererDocument(id: number): Promise<Document> {
  const reponse = await apiClient.get(`/documents/${id}/`);
  return reponse.data;
}

export function getDocumentUrl(doc: Document): string {
  if (doc.fichier?.startsWith('http')) return doc.fichier;
  return `${URL_BASE}${doc.fichier}`;
}

export function getApercuUrl(doc: Document): string | null {
  if (!doc.apercu_pdf) return null;
  if (doc.apercu_pdf.startsWith('http')) return doc.apercu_pdf;
  return `${URL_BASE}${doc.apercu_pdf}`;
}

export async function basculerFavori(id: number): Promise<{ favori: boolean }> {
  const reponse = await apiClient.post(`/documents/${id}/favori/`);
  return reponse.data;
}

export async function archiverDocument(id: number) {
  const reponse = await apiClient.post(`/documents/${id}/archiver/`);
  return reponse.data;
}

export async function desarchiverDocument(id: number) {
  const reponse = await apiClient.post(`/documents/${id}/desarchiver/`);
  return reponse.data;
}

export async function extraireTexteDocument(id: number): Promise<{ texte: string; contenu_texte?: string }> {
  const reponse = await apiClient.post(`/documents/${id}/extraire-texte/`);
  return reponse.data;
}

export async function modifierDocument(id: number, donnees: Partial<Pick<Document, 'titre' | 'est_confidentiel' | 'est_epingle'>>) {
  const reponse = await apiClient.patch(`/documents/${id}/`, donnees);
  return reponse.data;
}

export async function basculerEpingle(id: number): Promise<{ est_epingle: boolean }> {
  const reponse = await apiClient.post(`/documents/${id}/epingle/`);
  return reponse.data;
}

export async function getLogs(params?: Record<string, string>): Promise<LogAction[]> {
  const reponse = await apiClient.get('/documents/logs/', { params });
  return reponse.data;
}

export async function getServerStats(): Promise<ServerStats> {
  const reponse = await apiClient.get('/documents/serveur/');
  return reponse.data;
}

export interface TagType {
  id: number;
  nom: string;
  couleur: string;
}

export async function listerTags(): Promise<TagType[]> {
  const reponse = await apiClient.get('/tags/');
  return reponse.data;
}