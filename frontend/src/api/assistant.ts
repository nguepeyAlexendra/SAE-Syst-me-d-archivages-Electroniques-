import apiClient from './client';

export interface SourceRAG { document_id: number; titre: string; }
export interface MessageChat { id: number; role: 'user' | 'assistant'; contenu: string; sources?: SourceRAG[]; }
export interface Conversation { id: number; titre: string; est_favori: boolean; est_lu: boolean; cree_le?: string; }

export const listerConversations = () => apiClient.get<Conversation[]>('/assistant/conversations/').then(r => r.data);
export const creerConversation = () => apiClient.post<Conversation>('/assistant/conversations/').then(r => r.data);
export const modifierConversation = (id: number, data: Partial<Conversation>) => apiClient.patch<Conversation>(`/assistant/conversations/${id}/`, data).then(r => r.data);
export const supprimerConversation = (id: number) => apiClient.delete(`/assistant/conversations/${id}/`).then(r => r.data);
export const rechercherConversations = (q: string) => apiClient.get<Conversation[]>(`/assistant/recherche/`, { params: { q } }).then(r => r.data);
export const listerMessages = (id: number) => apiClient.get<MessageChat[]>(`/assistant/conversations/${id}/messages/`).then(r => r.data);
export const poserQuestion = (id: number, question: string, signal?: AbortSignal) =>
  apiClient.post<{ reponse: string; sources: SourceRAG[] }>(`/assistant/conversations/${id}/question/`, { question }, { signal }).then(r => r.data);