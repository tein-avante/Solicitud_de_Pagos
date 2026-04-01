const sequelize = require('./config/database');
const bcrypt = require('bcrypt');
const Usuario = require('./models/Usuario');
const Banco = require('./models/Banco');
const CentroCosto = require('./models/CentroCosto');
const Proveedor = require('./models/Proveedor');

async function seed() {
    try {
        // Sincronizar modelos (crear tablas si no existen)
        await sequelize.sync({ force: false });
        console.log('Tablas sincronizadas');

        // Seed Usuarios
        const adminEmail = 'admin@avante.com';
        const existingUser = await Usuario.findOne({ where: { email: adminEmail } });

        if (existingUser) {
            console.log('El usuario administrador ya existe en MySQL');
        } else {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);

            await Usuario.create({
                nombre: 'Administrador Sistema',
                email: adminEmail,
                password: hashedPassword,
                departamento: 'TECNOLOGIA',
                rol: 'Administrador',
                notificacionesEmail: true
            });

            console.log('Usuario administrador creado exitosamente');
        }

        // Seed Bancos
        const bancosDefault = [
            { nombre: 'Banco de Venezuela', codigo: '0102' },
            { nombre: 'Banesco', codigo: '0134' },
            { nombre: 'BBVA Provincial', codigo: '0108' },
            { nombre: 'Mercantil', codigo: '0105' },
            { nombre: 'BNC (Banco Nacional de Crédito)', codigo: '0191' },
            { nombre: 'Bancaribe', codigo: '0114' },
            { nombre: 'Banco Exterior', codigo: '0115' },
            { nombre: 'Banco del Tesoro', codigo: '0163' },
            { nombre: 'Banco Bicentenario', codigo: '0175' },
            { nombre: 'BFC (Banco Fondo Común)', codigo: '0151' }
        ];

        for (const banco of bancosDefault) {
            const existingBanco = await Banco.findOne({ where: { nombre: banco.nombre } });
            if (!existingBanco) {
                await Banco.create(banco);
                console.log(`Banco creado: ${banco.nombre}`);
            }
        }

        // Seed Centros de Costo
        const centrosCostoDefault = [
            { nombre: 'ADMINISTRACION' },
            { nombre: 'OPERACIONES' },
            { nombre: 'TECNOLOGIA' },
            { nombre: 'MANTENIMIENTO' },
            { nombre: 'TALENTO HUMANO' }
        ];

        for (const cc of centrosCostoDefault) {
            const existingCC = await CentroCosto.findOne({ where: { nombre: cc.nombre } });
            if (!existingCC) {
                await CentroCosto.create(cc);
                console.log(`Centro de Costo creado: ${cc.nombre}`);
            }
        }

        // Seed Proveedores
        const proveedoresDefault = [
            {
                razonSocial: 'Suministros Globales C.A.',
                rif: 'J-12345678-9',
                direccionFiscal: 'Caracas, Venezuela',
                telefono: '0212-1234567',
                email: 'ventas@suministros.com'
            },
            {
                razonSocial: 'Tecnología Avanzada S.A.',
                rif: 'J-98765432-1',
                direccionFiscal: 'Maracaibo, Venezuela',
                telefono: '0261-7654321',
                email: 'soporte@tecavanzada.com'
            }
        ];

        for (const prov of proveedoresDefault) {
            const existingProv = await Proveedor.findOne({ where: { razonSocial: prov.razonSocial } });
            if (!existingProv) {
                await Proveedor.create(prov);
                console.log(`Proveedor creado: ${prov.razonSocial}`);
            }
        }

    } catch (err) {
        console.error('Error durante el seeding:', err);
    } finally {
        await sequelize.close();
    }
}

seed();
