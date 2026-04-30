/**
 * SCRIPT DE MIGRACIÓN PARA EL SERVIDOR (Versión Raíz)
 * Ejecución: node migracion_devolucion_compras.js
 */

const sequelize = require('./config/database'); // Cambiado de ../ a ./
const Solicitud = require('./models/Solicitud'); // Cambiado de ../ a ./

async function migrar() {
    try {
        console.log('--- INICIANDO MIGRACIÓN EN SERVIDOR ---');
        await sequelize.authenticate();
        console.log('Conexión a base de datos exitosa.');

        const tableName = Solicitud.getTableName();

        const queryEstatus = `
            ALTER TABLE ${tableName} 
            MODIFY COLUMN estatus ENUM(
                'Pendiente', 
                'Autorizado', 
                'Aprobado', 
                'En Trámite', 
                'Pagado', 
                'Cerrado', 
                'Rechazado', 
                'Devuelto', 
                'Anulado',
                'Devolución en compras'
            ) NOT NULL DEFAULT 'Pendiente';
        `;

        await sequelize.query(queryEstatus);
        console.log('¡Base de datos actualizada con "Devolución en compras"!');

    } catch (error) {
        console.error('ERROR EN SERVIDOR:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

migrar();
