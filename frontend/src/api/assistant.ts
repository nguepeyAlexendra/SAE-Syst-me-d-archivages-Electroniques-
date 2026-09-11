import apiClient from './client';

export interface SourceRAG { document_id: number; titre: string; }
export interface MessageChat { id: number; role: 'user' | 'assistant'; contenu: string; sources?: SourceRAG[]; }
export interface Conversation { id: number; titre: string; est_favori: boolean; est_lu: boolean; cree_le?: string; }

export interface QuestionParams {
  question: string;
  stream?: boolean;
  model?: string;
  temperature?: number;
  document_ids?: number[];   // 🆕 IDs des documents cochés (mode Résumé)
}

export interface QuestionResponse {
  reponse: string;
  sources: SourceRAG[];
}

export const listerConversations = () => apiClient.get<Conversation[]>('/assistant/conversations/').then(r => r.data);
export const creerConversation = () => apiClient.post<Conversation>('/assistant/conversations/').then(r => r.data);
export const modifierConversation = (id: number, data: Partial<Conversation>) => apiClient.patch<Conversation>(`/assistant/conversations/${id}/`, data).then(r => r.data);
export const supprimerConversation = (id: number) => apiClient.delete(`/assistant/conversations/${id}/`).then(r => r.data);
export const rechercherConversations = (q: string) => apiClient.get<Conversation[]>(`/assistant/recherche/`, { params: { q } }).then(r => r.data);
export const listerMessages = (id: number) => apiClient.get<MessageChat[]>(`/assistant/conversations/${id}/messages/`).then(r => r.data);

export const poserQuestion = (id: number, params: QuestionParams, signal?: AbortSignal) =>
  apiClient.post<QuestionResponse>(`/assistant/conversations/${id}/question/`, params, { signal }).then(r => r.data);

export const rechercherSemantique = (question: string) =>
  apiClient.post<any[]>('/assistant/recherche-semantique/', { question }).then(r => r.data);


export const poserQuestionStream = (id: number, params: QuestionParams, onToken: (token: string) => void, onDone: (sources: SourceRAG[]) => void, signal?: AbortSignal) => {
  return fetch(`${apiClient.defaults.baseURL}/assistant/conversations/${id}/question/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
    },
    body: JSON.stringify({ ...params, stream: true }),
    signal,
  }).then(async (res) => {
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    if (!reader) return;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.token) onToken(data.token);
            if (data.done) onDone(data.sources || []);
          } catch {}
        }
      }
    }
  });
};