import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Helper to convert snake_case to camelCase
const toCamel = (s: string) => {
  return s.replace(/([-_][a-z])/ig, ($1) => {
    return $1.toUpperCase()
      .replace('-', '')
      .replace('_', '');
  });
};

const isObject = (o: any) => {
  return o === Object(o) && !Array.isArray(o) && typeof o !== 'function';
};

const keysToCamel = (o: any): any => {
  if (isObject(o)) {
    const n: any = {};
    Object.keys(o).forEach((k) => {
      n[toCamel(k)] = keysToCamel(o[k]);
    });
    return n;
  } else if (Array.isArray(o)) {
    return o.map((i) => {
      return keysToCamel(i);
    });
  }
  return o;
};

// Interceptor to add token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('subtracker_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor to transform responses
api.interceptors.response.use((response) => {
  if (response.data) {
     response.data = keysToCamel(response.data);
  }
  return response;
});

export const setToken = (token: string) => {
  localStorage.setItem('subtracker_token', token);
};

export const clearToken = () => {
  localStorage.removeItem('subtracker_token');
};

export default api;
