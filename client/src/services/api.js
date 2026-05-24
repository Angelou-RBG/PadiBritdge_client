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

export async function getPosts({ limit = 15, offset = 0, ...filters } = {}) {
    const params = { limit, offset }

    Object.keys(filters).forEach(key => {
        if (filters[key]) {
            params[key] = filters[key]
        }
    })

    const response = await api.get('/api/posts', { params })
    return response.data
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

// Rice Varieties
export async function getRiceVarieties() {
  const response = await api.get('/api/rice-varieties');
  return response.data;
}

export async function getRiceVariety(id) {
  const response = await api.get(`/api/rice-varieties/${id}`);
  return response.data;
}

export async function createRiceVariety(payload) {
  const response = await api.post('/api/rice-varieties', payload);
  return response.data;
}

export async function updateRiceVariety(id, payload) {
  const response = await api.put(`/api/rice-varieties/${id}`, payload);
  return response.data;
}

export async function deleteRiceVariety(id) {
  const response = await api.delete(`/api/rice-varieties/${id}`);
  return response.data;
}

// Stock Listings
export async function getStockListings(params) {
  const response = await api.get('/api/stock-listings', { params });
  return response.data;
}

export async function getStockListing(id) {
  const response = await api.get(`/api/stock-listings/${id}`);
  return response.data;
}

export async function createStockListing(payload) {
  const response = await api.post('/api/stock-listings', payload);
  return response.data;
}

export async function updateStockListing(id, payload) {
  const response = await api.put(`/api/stock-listings/${id}`, payload);
  return response.data;
}

export async function deleteStockListing(id) {
  const response = await api.delete(`/api/stock-listings/${id}`);
  return response.data;
}

// Production Batches
export async function getProductionBatches(params) {
  const response = await api.get('/api/production-batches', { params });
  return response.data;
}

export async function getProductionBatch(id) {
  const response = await api.get(`/api/production-batches/${id}`);
  return response.data;
}

export async function createProductionBatch(payload) {
  const response = await api.post('/api/production-batches', payload);
  return response.data;
}

export async function updateProductionBatch(id, payload) {
  const response = await api.put(`/api/production-batches/${id}`, payload);
  return response.data;
}

export async function deleteProductionBatch(id) {
  const response = await api.delete(`/api/production-batches/${id}`);
  return response.data;
}

// Order RFQs
export async function getOrderRfqs(params) {
  const response = await api.get('/api/order-rfqs', { params });
  return response.data;
}

export async function getOrderRfq(id) {
  const response = await api.get(`/api/order-rfqs/${id}`);
  return response.data;
}

export async function createOrderRfq(payload) {
  const response = await api.post('/api/order-rfqs', payload);
  return response.data;
}

export async function updateOrderRfq(id, payload) {
  const response = await api.put(`/api/order-rfqs/${id}`, payload);
  return response.data;
}

export async function deleteOrderRfq(id) {
  const response = await api.delete(`/api/order-rfqs/${id}`);
  return response.data;
}

// External RFQs
export async function getExternalRfqs(params) {
  const response = await api.get('/api/external-rfqs', { params });
  return response.data;
}

export async function getExternalRfq(id) {
  const response = await api.get(`/api/external-rfqs/${id}`);
  return response.data;
}

export async function createExternalRfq(payload) {
  const response = await api.post('/api/external-rfqs', payload);
  return response.data;
}

export async function updateExternalRfq(id, payload) {
  const response = await api.put(`/api/external-rfqs/${id}`, payload);
  return response.data;
}

export async function deleteExternalRfq(id) {
  const response = await api.delete(`/api/external-rfqs/${id}`);
  return response.data;
}

// Inventory Logs
export async function getInventoryLogs(params) {
  const response = await api.get('/api/inventory-logs', { params });
  return response.data;
}

export async function getInventoryLog(id) {
  const response = await api.get(`/api/inventory-logs/${id}`);
  return response.data;
}

export async function createInventoryLog(payload) {
  const response = await api.post('/api/inventory-logs', payload);
  return response.data;
}

export async function getTransactions(params) {
  const response = await api.get('/api/transactions', { params });
  return response.data;
}

// User Profile
export async function updateProfile(userId, payload) {
  const response = await api.put(`/api/users/${userId}`, payload);
  return response.data;
}

// Transaction Types
export async function getTransactionTypes() {
  const response = await api.get('/api/transaction-types');
  return response.data;
}

export default api;
