import api from './api';

export async function loginRequest(credentials) {
  const response = await api.post('/api/auth/login', credentials);
  return response.data;
}

export async function signupRequest(payload) {
  const response = await api.post('/api/auth/signup', payload);
  return response.data;
}
