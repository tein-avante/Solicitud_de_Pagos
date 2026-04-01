const sequelize = require('./config/database');
const Banco = require('./models/Banco');
const Proveedor = require('./models/Proveedor');
const CentroCosto = require('./models/CentroCosto');

async function seedDataInicial() {
    try {
        await sequelize.authenticate();
        console.log('--- Conectado a la base de datos ---');

        await sequelize.sync();

        // Crear 3 Bancos
        const bancos = [
            { nombre: 'Banco de Venezuela', codigo: '0102' },
            { nombre: 'Banesco', codigo: '0134' },
            { nombre: 'Mercantil', codigo: '0105' }
        ];

        for (const banco of bancos) {
            const existe = await Banco.findOne({ where: { nombre: banco.nombre } });
            if (!existe) {
                await Banco.create(banco);
                console.log(`Banco ${banco.nombre} creado.`);
            }
        }

        // Crear 3 Proveedores
        const proveedores = [
            { rif: 'J-12345678-9', razonSocial: 'Suministros Globales C.A.', direccionFiscal: 'Caracas, Zona Industrial', telefono: '0212-5550011', email: 'ventas@globales.com' },
            { rif: 'J-98765432-1', razonSocial: 'Transportes Rápidos', direccionFiscal: 'Valencia, Av. Bolívar', telefono: '0241-5552233', email: 'logistica@rapidos.com' },
            { rif: 'V-11223344-5', razonSocial: 'Mantenimiento y Servicios Pérez', direccionFiscal: 'Maracay, Centro', telefono: '0414-5554444', email: 'servicios.perez@gmail.com' }
        ];

        for (const prov of proveedores) {
            const existe = await Proveedor.findOne({ where: { rif: prov.rif } });
            if (!existe) {
                await Proveedor.create(prov);
                console.log(`Proveedor ${prov.razonSocial} creado.`);
            }
        }

        // Crear 3 Centros de Costo
        const centros = [
            { codigo: 'ADM-001', nombre: 'Administración Central', descripcion: 'Gastos de la sede administrativa principal' },
            { codigo: 'OP-002', nombre: 'Operaciones de Campo', descripcion: 'Costos correspondientes a los técnicos y trabajos en campo' },
            { codigo: 'VTA-003', nombre: 'Departamento de Ventas', descripcion: 'Viáticos y gastos del equipo comercial' }
        ];

        for (const centro of centros) {
            const existe = await CentroCosto.findOne({ where: { codigo: centro.codigo } });
            if (!existe) {
                await CentroCosto.create(centro);
                console.log(`Centro de Costo ${centro.nombre} creado.`);
            }
        }

        console.log('--- Proceso de seeder finalizado con éxito ---');

    } catch (error) {
        console.error('Error durante la inserción de datos:', error);
    } finally {
        process.exit(0);
    }
}

seedDataInicial();
