import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 15000,
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const url = err.config?.url || '';
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/me');
    const isPublicEndpoint = url.includes('/public/share/');
    const isSharePage = window.location.pathname.startsWith('/share/');
    if (err.response?.status === 401 && !isAuthEndpoint && !isPublicEndpoint && !isSharePage) {
      window.location.href = '/login';
    }
    return Promise.reject(err.response?.data || err);
  }
);

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  updatePassword: (data) => api.put('/auth/password', data),
  updateSettings: (data) => api.put('/auth/settings', data),
};

export const todoApi = {
  list: (params) => api.get('/todos', { params }),
  get: (id) => api.get(`/todos/${id}`),
  create: (data) => api.post('/todos', data),
  update: (id, data) => api.put(`/todos/${id}`, data),
  updateStatus: (id, status) => api.patch(`/todos/${id}/status`, { status }),
  delete: (id) => api.delete(`/todos/${id}`),
};

export const categoryApi = {
  list: () => api.get('/categories'),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`),
};

export const tagApi = {
  list: () => api.get('/tags'),
  create: (data) => api.post('/tags', data),
  update: (id, data) => api.put(`/tags/${id}`, data),
  delete: (id) => api.delete(`/tags/${id}`),
};

export const statsApi = {
  dashboard: () => api.get('/stats/dashboard'),
  report: (params) => api.get('/stats/report', { params }),
  calendar: (params) => api.get('/stats/calendar', { params }),
};

export const uploadApi = {
  image: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/upload/image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const adminApi = {
  getUsers: () => api.get('/admin/users'),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  getRoles: () => api.get('/admin/roles'),
  createRole: (data) => api.post('/admin/roles', data),
  updateRole: (id, data) => api.put(`/admin/roles/${id}`, data),
  deleteRole: (id) => api.delete(`/admin/roles/${id}`),
};

export const bookmarkCategoryApi = {
  list: () => api.get('/bookmark-categories'),
  create: (data) => api.post('/bookmark-categories', data),
  update: (id, data) => api.put(`/bookmark-categories/${id}`, data),
  delete: (id) => api.delete(`/bookmark-categories/${id}`),
};

export const bookmarkApi = {
  list: (params) => api.get('/bookmarks', { params }),
  get: (id) => api.get(`/bookmarks/${id}`),
  create: (data) => api.post('/bookmarks', data),
  update: (id, data) => api.put(`/bookmarks/${id}`, data),
  delete: (id) => api.delete(`/bookmarks/${id}`),
};

export const notificationApi = {
  list: (params) => api.get('/notifications', { params }),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
};

export const shareApi = {
  list: () => api.get('/share'),
  create: (data) => api.post('/share', data),
  update: (id, data) => api.put(`/share/${id}`, data),
  delete: (id) => api.delete(`/share/${id}`),
  getPublic: (key) => api.get(`/public/share/${key}`),
};

export const shareRequestApi = {
  list: (params) => api.get('/share-requests', { params }),
  approve: (id, data) => api.post(`/share-requests/${id}/approve`, data),
  reject: (id) => api.post(`/share-requests/${id}/reject`),
};

export default api;
