/**
 * COMPONENTE PRINCIPAL (App.jsx)
 * Define la estructura de rutas la navegación global de la plataforma
 * utilizando React Router.
 */

import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import FormularioSolicitud from './components/FormularioSolicitud';
import Login from './components/Login';
import CambiarPassword from './components/CambiarPassword';
import Maestros from './components/Maestros';

/**
 * Componente Wrapper para rutas protegidas.
 * Si el usuario no tiene un token en localStorage, lo redirige al Login.
 */
const PrivateRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    const usuarioRaw = localStorage.getItem('usuario');
    const usuario = usuarioRaw ? JSON.parse(usuarioRaw) : null;
    
    console.log('[DEBUG APP] Verificando acceso para:', usuario?.email, 'Cambio obligatorio:', usuario?.debeCambiarPassword);

    if (!token) return <Navigate to="/login" />;

    // Si debe cambiar password y no está ya en la pantalla de cambio, lo forzamos
    if (usuario?.debeCambiarPassword && window.location.hash !== '#/cambiar-password') {
        return <Navigate to="/cambiar-password" />;
    }

    return children;
};

function App() {
    return (
        <Router>
            <Routes>
                {/* Ruta de acceso público */}
                <Route path="/login" element={<Login />} />
                <Route path="/cambiar-password" element={< CambiarPassword />} />

                {/* Rutas protegidas (Requieren inicio de sesión) */}
                <Route
                    path="/"
                    element={
                        <PrivateRoute>
                            <Dashboard />
                        </PrivateRoute>
                    }
                />

                {/* Formulario para nuevas solicitudes */}
                <Route
                    path="/solicitudes/nueva"
                    element={
                        <PrivateRoute>
                            <FormularioSolicitud />
                        </PrivateRoute>
                    }
                />

                {/* Formulario para edición o visualización de solicitudes existentes */}
                <Route
                    path="/solicitudes/:id"
                    element={
                        <PrivateRoute>
                            <FormularioSolicitud />
                        </PrivateRoute>
                    }
                />

                {/* Panel de administración de maestros (Usuarios, Bancos, etc.) */}
                <Route
                    path="/maestros"
                    element={
                        <PrivateRoute>
                            <Maestros />
                        </PrivateRoute>
                    }
                />

                {/* Redirección automática si se ingresa una URL inválida */}
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </Router>
    );
}

export default App;
