const sequelize = require('./config/database');
const Usuario = require('./models/Usuario');
const Solicitud = require('./models/Solicitud');

async function seedSolicitudes() {
    try {
        await sequelize.authenticate();
        console.log('Conexión a la base de datos establecida exitosamente.');

        await sequelize.sync();

        // Obtener las IDs de los usuarios nuevos
        const usuarioOperaciones = await Usuario.findOne({ where: { email: 'operaciones@avante.com' } });
        const usuarioRRHH = await Usuario.findOne({ where: { email: 'rrhh@avante.com' } });

        if (!usuarioOperaciones || !usuarioRRHH) {
            console.error('Faltan los usuarios de RRHH y Operaciones. Asegúrate de ejecutar seed_usuarios.js primero.');
            process.exit(1);
        }

        const proveedorFalso = {
            razonSocial: 'Distribuidora Ficticia C.A.',
            rif: 'J-12345678-9',
            direccionFiscal: 'Caracas',
            telefono: '0414-1234567',
            email: 'ventas@ficticia.com'
        };

        const datosBancariosFalsos = {
            nombreBanco: 'Banesco',
            numeroCuenta: '0134-xxxx-xxxx-xxxx-xxxx',
            tipoCuenta: 'Corriente'
        };

        let correlativo = 1000;

        // Generar 8 solicitudes para OPERACIONES
        for (let i = 1; i <= 8; i++) {
            await Solicitud.create({
                correlativo: `REQ-OPE-2026-${correlativo++}`,
                unidadSolicitante: usuarioOperaciones.departamento,
                fechaLimiteRequerida: new Date(Date.now() + 86400000 * (i + 5)),
                nivelPrioridad: i % 3 === 0 ? 'Urgente' : 'Planificada',
                conceptoPago: `Suministro de Materiales de Operación (Lote ${i})`,
                centroCosto: 'OP-100',
                proveedor: proveedorFalso,
                metodoPago: 'Transferencia Bancaria',
                datosBancarios: datosBancariosFalsos,
                tipoPago: 'Único Pago',
                montoTotal: (Math.random() * 500 + 100).toFixed(2),
                moneda: 'USD',
                estatus: i === 1 ? 'Anulado' : (i <= 3 ? 'Aprobado' : (i <= 5 ? 'Pendiente' : 'Creado')), // Variedad de estatus
                elaboradoPor: usuarioOperaciones.id,
                historial: [{ fecha: new Date(), usuario: usuarioOperaciones.id, accion: 'Creación inicial' }]
            });
        }
        console.log('8 Solicitudes para OPERACIONES creadas exitosamente.');

        // Generar 8 solicitudes para RECURSOS HUMANOS
        for (let i = 1; i <= 8; i++) {
            await Solicitud.create({
                correlativo: `REQ-RH-2026-${correlativo++}`,
                unidadSolicitante: usuarioRRHH.departamento,
                fechaLimiteRequerida: new Date(Date.now() + 86400000 * (i + 3)),
                nivelPrioridad: i % 4 === 0 ? 'Emergencia' : 'Planificada',
                conceptoPago: `Servicios Médicos / Uniformes Personal (Fase ${i})`,
                centroCosto: 'RH-200',
                proveedor: proveedorFalso,
                metodoPago: 'Pago Móvil',
                datosBancarios: datosBancariosFalsos,
                tipoPago: 'Único Pago',
                montoTotal: (Math.random() * 300 + 50).toFixed(2),
                moneda: 'USD',
                estatus: i === 1 ? 'Devuelto' : (i <= 3 ? 'Pagado' : (i <= 6 ? 'Pendiente' : 'Creado')), // Variedad de estatus
                elaboradoPor: usuarioRRHH.id,
                historial: [{ fecha: new Date(), usuario: usuarioRRHH.id, accion: 'Creación inicial' }]
            });
        }
        console.log('8 Solicitudes para RECURSOS HUMANOS creadas exitosamente.');

        console.log('Proceso de seeder finalizado.');
    } catch (error) {
        console.error('Error al crear solicitudes:', error);
    } finally {
        process.exit(0);
    }
}

seedSolicitudes();
