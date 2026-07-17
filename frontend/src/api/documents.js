import apiClient from './client';

export async function listerDocuments() {
  const reponse = await apiClient.get('/documents/');
  return reponse.data;
}

export async function deposerDocument(titre, fichier, typeSource) {
  const formData = new FormData();
  formData.append('titre', titre);
  formData.append('fichier', fichier);
  formData.append('type_source', typeSource);

  const reponse = await apiClient.post('/documents/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return reponse.data;
}

export async function recupererDocument(id) {
  const reponse = await apiClient.get(`/documents/${id}/`);
  return reponse.data;
}