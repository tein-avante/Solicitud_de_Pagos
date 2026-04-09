const ArqueoCajaChica = require('./models/ArqueoCajaChica');
const sequelize = require('./config/database');

async function syncDB() {
    try {
        console.log('Iniciando sincronización de la tabla ArqueoCajaChica...');
        
        // Sincroniza solo el modelo de arqueos con alter:true para no borrar datos
        await ArqueoCajaChica.sync({ alter: true });
        
        console.log('----------------------------------------------------');
        console.log('¡ÉXITO! La tabla ArqueoCajaChica ha sido actualizada.');
        console.log('Se ha añadido el campo "comprobante" correctamente.');
        console.log('----------------------------------------------------');
        
        process.exit(0);
    } catch (error) {
        console.error('ERROR al sincronizar la base de datos:', error);
        process.exit(1);
    }
}

syncDB();
