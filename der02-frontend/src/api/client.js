import axios from 'axios';

// Relative baseURL: requests go to the same origin as the dev server and are
// forwarded to the backend by Vite's proxy (see vite.config.js).
export const apiClient = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
});
