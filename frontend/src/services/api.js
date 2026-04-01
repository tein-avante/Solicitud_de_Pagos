/**
 * SERVICIO DE API (Axios)
 * Este archivo configura la comunicación centralizada con el servidor backend.
 * Incluye un interceptor para añadir automáticamente el token JWT en cada petición.
 */

import axios from 'axios';

// Detectar si estamos en local (puerto 5173 de Vite) o en producción
const isLocal = window.location.port === '5173' || window.location.hostname === 'localhost';
const baseURL = isLocal ? `http://${window.location.hostname}:3000/api` : '/api';

const api = axios.create({
    baseURL,
});

// INTERCEPTOR DE PETICIONES
// Se ejecuta antes de cada petición al servidor
api.interceptors.request.use(
    (config) => {
        // Recuperar el token guardado en el navegador tras el login
        const token = localStorage.getItem('token');
        if (token) {
            // Adjuntar token en los encabezados para saltar el middleware auth del backend
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        // Manejar errores antes de enviar la petición (poco común)
        return Promise.reject(error);
    }
);

// INTERCEPTOR DE RESPUESTAS
// Se ejecuta después de recibir una respuesta del servidor
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // El token expiró o es inválido, redirigir al login
            localStorage.removeItem('token');
            localStorage.removeItem('usuario');
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
