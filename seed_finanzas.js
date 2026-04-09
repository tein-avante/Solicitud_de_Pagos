const CajaChica = require('./models/CajaChica');
const CentroCosto = require('./models/CentroCosto');
const Usuario = require('./models/Usuario');

const seedFinanzas = async () => {
    try {
        // Buscar un usuario administrativo
        const admin = await Usuario.findOne({ where: { rol: 'Administrador' } });
        if (!admin) {
            console.log('No se encontró un administrador para asignar la caja chica.');
            return;
        }

        // Crear una Caja Chica de prueba if not exists
        const [caja, created] = await CajaChica.findOrCreate({
            where: { nombre: 'Caja Chica Administración' },
            defaults: {
                responsableId: admin.id,
                montoInicial: 1000.00,
                saldoActual: 1000.00,
                moneda: 'USD'
            }
        });

        if (created) console.log('Caja Chica de prueba creada.');
        else console.log('Caja Chica ya existe.');

    } catch (error) {
        console.error('Error seeding finanzas:', error);
    }
};

module.exports = seedFinanzas;
