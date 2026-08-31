import apiClient from './client';
import type { Document } from './documents';

export interface RechercheParams {
  q?: string;
  categorie?: number;
  tag?: number;
  type_source?: string;
  statut?: string;
  date_debut?: string;
  date_fin?: string;
  tri?: string;
  page?: number;
}

export interface RechercheResultat {
  count: number;
  results: Document[];
  next: string | null;
  previous: string | null;
}

export async function rechercherDocuments(params: RechercheParams): Promise<RechercheResultat> {
  const reponse = await apiClient.get('/documents/recherche/', { params });
  return reponse.data;
}
