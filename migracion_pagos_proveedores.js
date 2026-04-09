const sequelize = require('./config/database');

async function up() {
    try {
        console.log('--- Iniciando migración de DB para Proveedores ---');
        
        console.log('Agregando columnas de Pago Móvil y e-pay...');
        await sequelize.query("ALTER TABLE Proveedors ADD COLUMN IF NOT EXISTS telefonoPago VARCHAR(255);");
        await sequelize.query("ALTER TABLE Proveedors ADD COLUMN IF NOT EXISTS rifPago VARCHAR(255);");
        await sequelize.query("ALTER TABLE Proveedors ADD COLUMN IF NOT EXISTS emailPago VARCHAR(255);");
        await sequelize.query("ALTER TABLE Proveedors ADD COLUMN IF NOT EXISTS bancoPago VARCHAR(255);");
        
        try {
            console.log('Intentando eliminar columna metodoPago...');
            await sequelize.query("ALTER TABLE Proveedors DROP COLUMN metodoPago;");
            console.log('Columna metodoPago eliminada con éxito.');
        } catch(e) {
            console.log('Aviso: Columna metodoPago no existe o no se pudo eliminar. Continuando...');
        }

        console.log('\n✅ Migración completada con éxito.');
        console.log('Los datos de la tabla Proveedores ahora cargarán correctamente en el Dashboard.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error en migración:', error);
        process.exit(1);
    }
}

up();
