const sequelize = require('./config/database');
const { Op } = require('sequelize');
const Solicitud = require('./models/Solicitud');
const Usuario = require('./models/Usuario');
const Banco = require('./models/Banco');
const CentroCosto = require('./models/CentroCosto');
const Proveedor = require('./models/Proveedor');

async function sedRequests() {
    try {
        await sequelize.authenticate();
        console.log('Database connected for mass seeding...');

        // Load available reference data
        const usuarios = await Usuario.findAll();
        const admin = usuarios.find(u => u.rol === 'Administrador') || usuarios[0];
        const bancos = await Banco.findAll();
        const centros = await CentroCosto.findAll();
        const proveedores = await Proveedor.findAll();

        if (!admin || bancos.length === 0 || centros.length === 0 || proveedores.length === 0) {
            console.error('Missing prerequisite data. Please run seed_mysql.js first.');
            process.exit(1);
        }

        const requestsToCreate = [];
        const anioActual = new Date().getFullYear().toString().slice(-2);

        // Calculate the starting sequence number
        const ultimaSolicitud = await Solicitud.findOne({
            where: {
                correlativo: { [Op.like]: `ABS-SP-${admin.departamento}-%` }
            },
            order: [['createdAt', 'DESC']]
        });

        let currentSequenceNumber = 1;
        if (ultimaSolicitud) {
            const partes = ultimaSolicitud.correlativo.split('-');
            const numeroStr = partes[partes.length - 1].split('/')[0];
            currentSequenceNumber = parseInt(numeroStr) + 1;
        }

        const conceptos = [
            'Compra de material de oficina', 'Mantenimiento preventivo A/A', 'Renovación licencias software',
            'Pago servicios de internet', 'Viáticos por viaje de negocios', 'Compra repuestos flota vehicular',
            'Catering evento mensual', 'Honorarios profesionales consultoría', 'Suministros de limpieza',
            'Renovación póliza de seguros'
        ];

        console.log('Generando 20 solicitudes de prueba...');

        for (let i = 0; i < 20; i++) {
            const isUSD = Math.random() > 0.5;
            const banco = bancos[Math.floor(Math.random() * bancos.length)];
            const centro = centros[Math.floor(Math.random() * centros.length)];
            const proveedor = proveedores[Math.floor(Math.random() * proveedores.length)];

            const fechaActual = new Date();
            const fechaLimite = new Date();
            fechaLimite.setDate(fechaLimite.getDate() + Math.floor(Math.random() * 14) + 1);

            const correlativo = `ABS-SP-${admin.departamento}-${String(currentSequenceNumber++).padStart(3, '0')}/${anioActual}`;

            requestsToCreate.push({
                correlativo,
                fechaSolicitud: fechaActual,
                unidadSolicitante: admin.departamento,
                numeroRequerimiento: `REQ-${Math.floor(Math.random() * 9000) + 1000}`,
                fechaLimiteRequerida: fechaLimite,
                nivelPrioridad: Math.random() > 0.7 ? 'Urgente' : 'Planificada',
                conceptoPago: conceptos[Math.floor(Math.random() * conceptos.length)],
                observaciones: 'Generado automáticamente para pruebas',
                soportes: [],
                centroCosto: centro.nombre,
                proveedor: JSON.stringify({ // Stringify JSON to bypass Sequelize buggy getter mapping on bulkCreates
                    razonSocial: proveedor.razonSocial,
                    rif: proveedor.rif,
                    direccionFiscal: proveedor.direccionFiscal,
                    telefono: proveedor.telefono,
                    email: proveedor.email
                }),
                metodoPago: 'Transferencia Bancaria',
                datosBancarios: JSON.stringify({ // Stringify JSON
                    nombreBanco: banco.nombre,
                    numeroCuenta: '01' + Math.floor(Math.random() * 900000000000000000).toString().padStart(18, '0')
                }),
                tipoPago: 'Único Pago',
                montoTotal: (Math.random() * 5000 + 100).toFixed(2),
                moneda: isUSD ? 'USD' : 'Bs',
                estatus: 'Creado',
                elaboradoPor: admin.id,
                historial: JSON.stringify([{ // Stringify JSON
                    fecha: fechaActual,
                    usuario: admin.id,
                    accion: 'Creación de solicitud (MOCK)',
                    comentario: 'Solicitud creada a través del script de pruebas'
                }])
            });
        }

        // Bulk create bypassing validations for speed, or one by one
        for (const req of requestsToCreate) {
            await Solicitud.create(req);
        }

        console.log('✅ 20 Solicitudes creadas exitosamente.');
        process.exit(0);

    } catch (error) {
        console.error('Error generating requests:', error);
        process.exit(1);
    }
}

sedRequests();
