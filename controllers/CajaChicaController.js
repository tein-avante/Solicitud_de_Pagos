const CajaChica = require('../models/CajaChica');
const GastoCajaChica = require('../models/GastoCajaChica');
const DistribucionGasto = require('../models/DistribucionGasto');
const ArqueoCajaChica = require('../models/ArqueoCajaChica');
const ReposicionCajaChica = require('../models/ReposicionCajaChica');
const Usuario = require('../models/Usuario');
const CentroCosto = require('../models/CentroCosto');
const Solicitud = require('../models/Solicitud');
const sequelize = require('../config/database');
const sistemaService = require('../services/sistemaService');

exports.getCajasChicas = async (req, res) => {
    try {
        const cajas = await CajaChica.findAll({
            include: [{ model: Usuario, as: 'responsable', attributes: ['nombre', 'email'] }]
        });
        res.json(cajas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createCajaChica = async (req, res) => {
    try {
        const { nombre, responsableId, montoInicial, moneda } = req.body;
        const caja = await CajaChica.create({
            nombre,
            responsableId,
            montoInicial,
            saldoActual: montoInicial,
            moneda
        });
        await sistemaService.incrementarOperaciones();
        res.status(201).json(caja);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateCajaChica = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, responsableId, montoInicial, moneda, activo } = req.body;
        const caja = await CajaChica.findByPk(id);
        if (!caja) return res.status(404).json({ error: 'No existe la Caja Chica' });

        await caja.update({
            nombre,
            responsableId,
            montoInicial,
            moneda,
            activo
        });
        res.json(caja);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteCajaChica = async (req, res) => {
    try {
        const { id } = req.params;
        const caja = await CajaChica.findByPk(id);
        if (!caja) return res.status(404).json({ error: 'No existe la Caja Chica' });
        
        await caja.destroy();
        res.json({ mensaje: 'Caja Chica eliminada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.registerGasto = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { cajaChicaId, fecha, concepto, montoTotal, distribucion } = req.body;
        const responsableId = req.usuario.id;

        const caja = await CajaChica.findByPk(cajaChicaId, { transaction: t });
        if (!caja) throw new Error('Caja Chica no encontrada');
        
        // Validación de Seguridad: Solo el responsable puede registrar gastos
        if (caja.responsableId !== responsableId && req.usuario.rol !== 'Administrador') {
            throw new Error('No tienes permiso para registrar gastos en esta caja');
        }

        if (Number(caja.saldoActual) < Number(montoTotal)) {
            throw new Error('Saldo insuficiente en Caja Chica');
        }

        const nuevoSaldo = Number(caja.saldoActual) - Number(montoTotal);
        
        const gasto = await GastoCajaChica.create({
            cajaChicaId,
            responsableId: caja.responsableId, // El responsable de la caja es el responsable legal del gasto
            registradoPorId: req.usuario.id,   // El usuario en sesión es quien registra físicamente
            fecha,
            concepto,
            montoTotal,
            saldoResultante: nuevoSaldo,
            comprobante: req.file ? req.file.path.replace(/\\/g, '/') : null
        }, { transaction: t });

        // Registrar distribución por centros de costo
        let distParsed = distribucion;
        if (typeof distribucion === 'string') {
            try { distParsed = JSON.parse(distribucion); } catch (e) { }
        }

        if (distParsed && Array.isArray(distParsed)) {
            for (const d of distParsed) {
                await DistribucionGasto.create({
                    gastoCajaChicaId: gasto.id,
                    centroCostoId: d.centroCostoId,
                    monto: d.monto,
                    porcentaje: d.porcentaje,
                    descripcion: d.descripcion
                }, { transaction: t });
            }
        }

        await caja.update({ saldoActual: nuevoSaldo }, { transaction: t });

        await t.commit();
        await sistemaService.incrementarOperaciones();
        res.status(201).json(gasto);
    } catch (error) {
        await t.rollback();
        res.status(500).json({ error: error.message });
    }
};

exports.getGastos = async (req, res) => {
    try {
        const { cajaChicaId } = req.query;
        const where = cajaChicaId ? { cajaChicaId } : {};
        const gastos = await GastoCajaChica.findAll({
            where,
            include: [
                { model: DistribucionGasto, include: [CentroCosto] },
                { model: Usuario, as: 'responsable', attributes: ['nombre'] },
                { model: Usuario, as: 'registrador', attributes: ['nombre'] }
            ],
            order: [['fecha', 'DESC']]
        });
        res.json(gastos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getHistory = async (req, res) => {
    try {
        const { id: cajaChicaId } = req.params;
        if (!cajaChicaId) return res.status(400).json({ error: 'ID de caja chica requerido' });

        const [gastos, reposiciones, arqueos] = await Promise.all([
            GastoCajaChica.findAll({ 
                where: { cajaChicaId }, 
                include: [
                    { model: Usuario, as: 'responsable', attributes: ['nombre'] },
                    { model: Usuario, as: 'registrador', attributes: ['nombre'] },
                    { model: DistribucionGasto, include: [CentroCosto] }
                ] 
            }),
            ReposicionCajaChica.findAll({ where: { cajaChicaId } }),
            ArqueoCajaChica.findAll({ where: { cajaChicaId }, include: [{ model: Usuario, as: 'elaboradoPor', attributes: ['nombre'] }] })
        ]);

        const historial = [
            ...gastos.map(g => ({ ...g.toJSON(), _tipoItem: 'Gasto', _fechaTimestamp: new Date(g.fecha).getTime() })),
            ...reposiciones.map(r => ({ ...r.toJSON(), _tipoItem: 'Reposicion', _fechaTimestamp: new Date(r.fechaSolicitud).getTime() })),
            ...arqueos.map(a => ({ ...a.toJSON(), _tipoItem: 'Arqueo', _fechaTimestamp: new Date(a.fecha).getTime() }))
        ].sort((a, b) => b._fechaTimestamp - a._fechaTimestamp); // Descendente

        await sistemaService.incrementarOperaciones();
        res.json(historial);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getArqueos = async (req, res) => {
    try {
        const { cajaChicaId } = req.query;
        const where = cajaChicaId ? { cajaChicaId } : {};
        const arqueos = await ArqueoCajaChica.findAll({
            where,
            include: [{ model: Usuario, as: 'elaboradoPor', attributes: ['nombre'] }],
            order: [['fecha', 'DESC']]
        });
        await sistemaService.incrementarOperaciones();
        res.json(arqueos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.performArqueo = async (req, res) => {
    try {
        const { cajaChicaId, saldoFisico, observaciones } = req.body;
        const caja = await CajaChica.findByPk(cajaChicaId);
        const diferencia = Number(saldoFisico) - Number(caja.saldoActual);

        const arqueo = await ArqueoCajaChica.create({
            cajaChicaId,
            saldoTeorico: caja.saldoActual,
            saldoFisico,
            diferencia,
            elaboradoPorId: req.usuario.id,
            observaciones,
            comprobante: req.file ? req.file.path.replace(/\\/g, '/') : null
        });

        await sistemaService.incrementarOperaciones();
        res.status(201).json(arqueo);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.requestReposicion = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { cajaChicaId } = req.body;
        const gastos = await GastoCajaChica.findAll({
            where: { cajaChicaId, estatus: 'Pendiente' },
            transaction: t
        });

        if (gastos.length === 0) throw new Error('No hay gastos pendientes para reposición');

        const montoTotal = gastos.reduce((sum, g) => sum + Number(g.montoTotal), 0);
        const correlativo = `REP-CCH-${cajaChicaId}-${Date.now()}`;

        const reposicion = await ReposicionCajaChica.create({
            cajaChicaId,
            correlativo,
            montoTotalReposicion: montoTotal,
            gastosConsolidados: gastos.map(g => g.id)
        }, { transaction: t });

        // Marcar gastos como 'Rendido' (en proceso de reposición)
        await GastoCajaChica.update(
            { estatus: 'Rendido' },
            { where: { id: gastos.map(g => g.id) }, transaction: t }
        );

        // --- CREAR SOLICITUD DE PAGO FORMAL ---
        const caja = await CajaChica.findByPk(cajaChicaId, { 
            include: [{ model: Usuario, as: 'responsable' }],
            transaction: t 
        });

        const correlativoSolicitud = `ABS-SP-CCH-${cajaChicaId}-${Date.now().toString().slice(-4)}`;
        
        const nuevaSolicitud = await Solicitud.create({
            correlativo: correlativoSolicitud,
            fechaSolicitud: new Date(),
            unidadSolicitante: 'ADMINISTRACION Y FINANZAS',
            fechaLimiteRequerida: new Date(Date.now() + 72 * 60 * 60 * 1000), // +3 días
            conceptoPago: `REPOSICIÓN DE CAJA CHICA: ${caja.nombre} (Ref: ${correlativo})`,
            montoTotal: montoTotal,
            moneda: caja.moneda,
            centroCosto: 'ADMINISTRACIÓN', // Valor referencial
            metodoPago: 'Transferencia',
            tipoPago: 'Reposición Caja Chica',
            estatus: 'Pendiente',
            elaboradoPor: req.usuario.id,
            proveedor: {
                id: 0,
                razonSocial: `RESPONSABLE: ${caja.responsable.nombre}`,
                rif: 'N/A'
            },
            historial: [{
                fecha: new Date(),
                accion: 'Solicitud Creada automáticamente por Reposición de Caja Chica',
                usuarioId: req.usuario.id,
                usuarioNombre: caja.responsable.nombre // Usamos el nombre del responsable para el log
            }]
        }, { transaction: t });

        // Vincular la solicitud con la reposición
        await reposicion.update({ solicitudPagoId: nuevaSolicitud.id }, { transaction: t });

        await t.commit();
        await sistemaService.incrementarOperaciones();
        res.status(201).json({
            reposicion,
            solicitudId: nuevaSolicitud.id,
            correlativoSolicitud: nuevaSolicitud.correlativo
        });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ error: error.message });
    }
};

exports.getReposiciones = async (req, res) => {
    try {
        const { cajaChicaId } = req.query;
        const where = cajaChicaId ? { cajaChicaId } : {};
        const reps = await ReposicionCajaChica.findAll({ where, order: [['createdAt', 'DESC']] });
        res.json(reps);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
