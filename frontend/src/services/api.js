/**
 * SERVICIO DE API (Axios)
 * Este archivo configura la comunicación centralizada con el servidor backend.
 * Incluye un interceptor para añadir automáticamente el token JWT en cada petición.
 */

import axios from 'axios';

/**
 * Siempre `/api`: en `vite dev` el proxy reenvía a Node (:3000); en producción Express sirve API en el mismo origen.
 * Evita fallos si el front corre en otro puerto de Vite o el hostname no es `localhost`.
 */
const baseURL = '/api';

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
