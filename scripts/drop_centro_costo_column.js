const sequelize = require('./config/database');
const { QueryTypes } = require('sequelize');

async function migrate() {
    console.log('--- Iniciando eliminación de columna centroCosto ---');
    try {
        // 1. Eliminar la columna de la tabla Solicituds
        // Nota: En SQLite/MySQL el comando es similar
        await sequelize.query('ALTER TABLE Solicituds DROP COLUMN centroCosto;');
        console.log('✅ Columna centroCosto eliminada exitosamente de la tabla Solicituds.');
    } catch (error) {
        if (error.message.includes('no such column') || error.message.includes('check that column/key exists')) {
            console.log('⚠️ La columna ya no existe o ya fue eliminada.');
        } else {
            console.error('❌ Error al eliminar la columna:', error.message);
        }
    } finally {
        await sequelize.close();
        process.exit();
    }
}

migrate();
