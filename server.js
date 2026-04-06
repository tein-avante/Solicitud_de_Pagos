/**
 * ARCHIVO PRINCIPAL DEL SERVIDOR (BACKEND)
 * Este archivo inicializa la aplicación Express, configura middlewares,
 * define las rutas de la API e inicia la conexión con la base de datos MySQL.
 */

// Cargar variables de entorno desde el archivo .env
require('dotenv').config();

const express = require('express');
const sequelize = require('./config/database');
const cors = require('cors');
const path = require('path');
const { initSocket } = require('./socket');
const sistemaService = require('./services/sistemaService');


// Importación de Rutas de la API
const authRoutes = require('./routes/auth');
const solicitudRoutes = require('./routes/solicitudes');
const usuarioRoutes = require('./routes/usuarios');
const centroCostoRoutes = require('./routes/centros-costo');
const proveedorRoutes = require('./routes/proveedores');
const notificacionRoutes = require('./routes/notificaciones');
const bancoRoutes = require('./routes/bancos');
const departamentoRoutes = require('./routes/departamentos');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// CONFIGURACIÓN DE MIDDLEWARES GLOBALES
// ==========================================

// Habilitar CORS para permitir peticiones desde el frontend (React/Vite)
app.use(cors());

// Middleware para parsear cuerpos de peticiones JSON
app.use(express.json());

// Middleware para parsear cuerpos de peticiones serializados (formularios antiguos)
app.use(express.urlencoded({ extended: true }));

// Log simple de peticiones para monitorear el tráfico en consola
app.use((req, res, next) => {
    console.log(`${new Date().toLocaleString()} - ${req.method} ${req.url}`);
    next();
});

// ==========================================
// DEFINICIÓN DE RUTAS DE LA API
// ==========================================

// Endpoint de Salud (Health Check)
app.get('/health', async (req, res) => {
    try {
        await sequelize.authenticate();
        res.json({
            status: 'UP',
            database: 'CONNECTED',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({
            status: 'DOWN',
            database: 'DISCONNECTED',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});


app.use('/api/auth', authRoutes);               // Autenticación (Login/Registro)
app.use('/api/solicitudes', solicitudRoutes);    // Gestión de Solicitudes de Pago
app.use('/api/usuarios', usuarioRoutes);       // Administración de Usuarios
app.use('/api/centros-costo', centroCostoRoutes); // Centros de Costos
app.use('/api/proveedores', proveedorRoutes);   // Maestro de Proveedores
app.use('/api/notificaciones', notificacionRoutes); // Sistema de Notificaciones
app.use('/api/bancos', bancoRoutes);            // Entidades Bancarias
app.use('/api/departamentos', departamentoRoutes); // Maestro de Departamentos

// Servir archivos estáticos (documentos cargados/uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Servir la aplicación React (Frontend compilado) en la raíz '/'
app.use(express.static(path.join(__dirname, 'frontend/dist')));

// También permitir que resuelva la ruta antigua si existe el redireccionamiento
app.use('/frontend/dist', express.static(path.join(__dirname, 'frontend/dist')));

// Redirigir todas las demás peticiones que no sean API a la aplicación React (React Router)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});

// ==========================================
// MANEJO GLOBAL DE ERRORES
// ==========================================

app.use((err, req, res, next) => {
    console.error('[SERVER ERROR]:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
});

// Manejo de errores no capturados para evitar caídas silenciosas
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

/**
 * Función para iniciar el servidor de manera segura con re-intentos de conexión
 */
async function start(retries = 5) {
    while (retries > 0) {
        try {
            // Verificar conexión con MySQL
            await sequelize.authenticate();
            console.log('--- Conectado a MySQL exitosamente ---');

            // Sincronizar modelos con la base de datos
            await sequelize.sync({ alter: true });
            console.log('--- Modelos Sincronizados con la DB ---');

            // Iniciar escucha del servidor en el puerto configurado
            const server = app.listen(PORT, () => {
                console.log(`Servidor AVANTE listo y escuchando en puerto ${PORT}`);
            });

            // Inicializar WebSocket para notificaciones en tiempo real
            initSocket(server);

            // Inicializar configuración del sistema (Versión y Contador)
            await sistemaService.inicializar();


            // --- MECANISMO DE KEEP-ALIVE PARA LA BASE DE DATOS ---
            // Realiza un ping a la base de datos cada 10 minutos para evitar que MySQL 
            // cierre la conexión por inactividad (wait_timeout).
            setInterval(async () => {
                try {
                    await sequelize.query('SELECT 1');
                    console.log(`[DB KEEP-ALIVE] Ping exitoso a las ${new Date().toLocaleTimeString()}`);
                } catch (err) {
                    console.error('[DB KEEP-ALIVE ERROR]: Fallo al mantener la conexión:', err.message);
                }
            }, 10 * 60 * 1000); // 10 minutos

            // Salir del bucle si todo sale bien
            break;

        } catch (error) {
            retries -= 1;
            console.error(`Error al conectar a la DB (${retries} intentos restantes):`, error.message);

            if (retries === 0) {
                console.error('Fallo crítico al iniciar el servidor: Se agotaron los reintentos.');
                process.exit(1);
            }

            // Esperar 3 segundos antes del siguiente intento
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
}

// Arrancar el sistema
start();

module.exports = app;
