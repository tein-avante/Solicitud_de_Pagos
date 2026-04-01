/**
 * SCRIPT DE MIGRACIÓN: AGREGAR ROL AUDITOR
 * Este script actualiza el ENUM de roles en la tabla de Usuarios.
 * Ejecución: node migrar_roles.js
 */

const sequelize = require('./config/database');
const Usuario = require('./models/Usuario');

async function migrar() {
    try {
        console.log('Conectando a la base de datos...');
        await sequelize.authenticate();
        console.log('Conexión establecida correctamente.');

        const tableName = Usuario.getTableName();
        console.log(`Actualizando tabla: ${tableName}...`);

        // SQL para modificar el ENUM de rol
        // IMPORTANTE: Se deben incluir todos los roles existentes más el nuevo
        const queryRol = `
            ALTER TABLE ${tableName} 
            MODIFY COLUMN rol ENUM('Solicitante', 'Administrador', 'Gestor', 'Auditor') 
            NOT NULL DEFAULT 'Solicitante';
        `;
        
        await sequelize.query(queryRol);
        console.log('¡Columna rol actualizada exitosamente para incluir "Auditor"!');

    } catch (error) {
        console.error('Error durante la migración de roles:', error);
    } finally {
        await sequelize.close();
        console.log('Conexión cerrada.');
    }
}

migrar();
