/**
 * SCRIPT DE ACTUALIZACIÓN DE BASE DE DATOS
 * Este script actualiza los estados (ENUM) de la tabla de solicitudes.
 * Ejecución: node actualizar_db.js
 */

const sequelize = require('./config/database');
const Solicitud = require('./models/Solicitud');

async function actualizar() {
    try {
        console.log('Conectando a la base de datos...');
        await sequelize.authenticate();
        console.log('Conexión establecida correctamente.');

        const tableName = Solicitud.getTableName();
        console.log(`Actualizando tabla: ${tableName}...`);

        // SQL para modificar el ENUM de estatus
        const queryEstatus = `
            ALTER TABLE ${tableName} 
            MODIFY COLUMN estatus ENUM('Pendiente', 'Autorizado', 'Aprobado', 'En Trámite', 'Pagado', 'Cerrado', 'Rechazado', 'Devuelto', 'Anulado') 
            NOT NULL DEFAULT 'Pendiente';
        `;
        await sequelize.query(queryEstatus);
        console.log('¡Columna estatus actualizada exitosamente!');

        // SQL para modificar el ENUM de nivelPrioridad
        const queryPrioridad = `
            ALTER TABLE ${tableName} 
            MODIFY COLUMN nivelPrioridad ENUM('Planificada', 'Urgente', 'Emergencia') 
            NOT NULL DEFAULT 'Planificada';
        `;
        await sequelize.query(queryPrioridad);
        console.log('¡Columna nivelPrioridad actualizada exitosamente!');

        // Migración de datos existentes para estatus
        console.log('Migrando registros antiguos de estatus...');
        const updateEstatusQuery = `UPDATE ${tableName} SET estatus = 'Pendiente' WHERE estatus = 'Creado'`;
        await sequelize.query(updateEstatusQuery);

        // Migración de datos existentes para nivelPrioridad
        console.log('Migrando registros antiguos de nivelPrioridad...');
        const updatePrioridadQuery = `
            UPDATE ${tableName} 
            SET nivelPrioridad = CASE 
                WHEN nivelPrioridad IN ('Baja', 'Media') THEN 'Planificada'
                WHEN nivelPrioridad = 'Alta' THEN 'Urgente'
                WHEN nivelPrioridad = 'Urgente' THEN 'Emergencia'
                ELSE 'Planificada'
            END
        `;
        await sequelize.query(updatePrioridadQuery);
        console.log(`Registros actualizados.`);

    } catch (error) {
        console.error('Error durante la actualización:', error);
    } finally {
        await sequelize.close();
        console.log('Conexión cerrada.');
    }
}

actualizar();
