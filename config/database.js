/**
 * CONFIGURACIÓN DE LA BASE DE DATOS
 * Utiliza Sequelize como ORM para interactuar con MySQL.
 * Las credenciales se leen desde el archivo .env para mayor seguridad.
 */

const { Sequelize } = require('sequelize');
require('dotenv').config();

// Inicialización de la instancia de Sequelize
const sequelize = new Sequelize(
    process.env.DB_NAME,    // Nombre de la base de datos (e.g., avante_db)
    process.env.DB_USER,    // Usuario de MySQL (e.g., root)
    process.env.DB_PASS,    // Contraseña
    {
        host: process.env.DB_HOST, // Host del servidor (e.g., localhost)
        dialect: 'mysql',          // Motor de base de datos
        logging: false,            // Deshabilitar logs de SQL en consola
        // Configuración del Pool de Conexiones para evitar desconexiones por inactividad
        pool: {
            max: 10,           // Máximo de conexiones abiertas
            min: 0,            // Mínimo de conexiones abiertas
            acquire: 30000,    // Tiempo máximo en ms para intentar conectar antes de lanzar error
            idle: 10000        // Tiempo máximo en ms que una conexión puede estar inactiva antes de ser liberada
        },
        dialectOptions: {
            // Ayuda a manejar tiempos de espera y reconexiones en entornos como XAMPP
            connectTimeout: 60000
        }
    }
);

module.exports = sequelize;
