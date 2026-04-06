const sequelize = require('./config/database');
const SistemaConfig = require('./models/SistemaConfig');
const sistemaService = require('./services/sistemaService');

async function syncDatabase() {
    try {
        console.log('--- Intentando conectar con la base de datos ---');
        await sequelize.authenticate();
        console.log('--- Conexión exitosa ---');

        console.log('--- Sincronizando modelo SistemaConfig ---');
        await SistemaConfig.sync({ alter: true });
        console.log('--- Modelo Sincronizado ---');

        console.log('--- Inicializando valores (Versión 2.5 y Operaciones 250) ---');
        await sistemaService.inicializar();
        
        console.log('\n--- ÉXITO: Base de datos preparada correctamente ---');
        process.exit(0);
    } catch (error) {
        console.error('\n--- ERROR durante la sincronización ---');
        console.error(error.message);
        process.exit(1);
    }
}

syncDatabase();
