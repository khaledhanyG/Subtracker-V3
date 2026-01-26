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
  if (response.data && typeof response.data === 'object') {
     response.data = keysToCamel(response.data);
  }
  return response;
}, (error) => {
  // Handle network errors or 4xx/5xx responses
  console.error("API Error Full:", error);
  if (error.response) {
      console.error("API Error Response Data:", error.response.data);
      console.error("API Error Status:", error.response.status);
  }
  return Promise.reject(error);
});

export const setToken = (token: string) => {
  localStorage.setItem('subtracker_token', token);
};

export const clearToken = () => {
  localStorage.removeItem('subtracker_token');
};

// Assuming API_URL, getAuthHeaders, and handleResponse are defined elsewhere or need to be added.
// For the purpose of this edit, we'll define placeholders to make the code syntactically valid.
// In a real application, these would come from a configuration file or another utility.
const API_URL = '/api'; // Placeholder
const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('subtracker_token')}` // Placeholder
});
const handleResponse = async (response: Response) => { // Placeholder
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Something went wrong');
  }
  return response.json();
};

// Attach custom methods to the api instance
(api as any).updateProfile = async (data: { name: string; password?: string }) => {
  const response = await fetch(`${API_URL}/auth/update_profile`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export default api as any;
