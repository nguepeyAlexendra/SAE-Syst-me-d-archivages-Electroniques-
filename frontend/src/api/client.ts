import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL as string,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

export default apiClient;
