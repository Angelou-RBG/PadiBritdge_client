import axios from 'axios';

const baseURL = process.env.REACT_APP_API_BASE_URL || '';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function getLatestPost() {
  const response = await api.get('/api/posts/latest');
  return response.data;
}

export async function getPosts({ limit = 15, offset = 0 } = {}) {
  const response = await api.get('/api/posts', {
    params: { limit, offset },
  });

  return response.data;
}

export async function getPost(postId) {
  const response = await api.get(`/api/posts/${postId}`);
  return response.data;
}

export async function deletePost(postId) {
  const response = await api.delete(`/api/posts/${postId}`);
  return response.data;
}

export async function updatePost(postId, payload) {
  const response = await api.put(`/api/posts/${postId}`, payload);
  return response.data;
}

export async function getPostTypes() {
  const response = await api.get('/api/post-types');
  return response.data;
}

export async function getTags() {
  const response = await api.get('/api/tags');
  return response.data;
}

export async function createPost(payload) {
  const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
  const response = await api.post('/api/posts', payload, isFormData
    ? { headers: { 'Content-Type': 'multipart/form-data' } }
    : undefined);
  return response.data;
}

export async function getComments(postId) {
  const response = await api.get(`/api/posts/${postId}/comments`);
  return response.data;
}

export async function addComment(postId, commentData) {
  const response = await api.post(`/api/posts/${postId}/comments`, commentData);
  return response.data;
}

export default api;
