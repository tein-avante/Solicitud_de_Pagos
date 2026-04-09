const PagoDirecto = require('../models/PagoDirecto');
const DistribucionGasto = require('../models/DistribucionGasto');
const CentroCosto = require('../models/CentroCosto');
const Usuario = require('../models/Usuario');
const sequelize = require('../config/database');
const sistemaService = require('../services/sistemaService');

exports.getPagosDirectos = async (req, res) => {
    try {
        const pagos = await PagoDirecto.findAll({
            include: [
                { model: DistribucionGasto, include: [CentroCosto] },
                { model: Usuario, as: 'elaboradoPor', attributes: ['nombre'] }
            ],
            order: [['fecha', 'DESC']]
        });
        await sistemaService.incrementarOperaciones();
        res.json(pagos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.registerPagoDirecto = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { fecha, concepto, montoTotal, moneda, beneficiario, metodoPago, distribucion, observaciones } = req.body;
        const elaboradoPorId = req.usuario.id;

        const correlativo = `PD-${Date.now()}`;

        const pago = await PagoDirecto.create({
            correlativo,
            fecha,
            concepto,
            montoTotal,
            moneda,
            beneficiario,
            metodoPago,
            elaboradoPorId,
            observaciones,
            comprobante: req.file ? req.file.path.replace(/\\/g, '/') : null
        }, { transaction: t });

        let distParsed = distribucion;
        if (typeof distribucion === 'string') {
            try { distParsed = JSON.parse(distribucion); } catch (e) { }
        }

        if (distParsed && Array.isArray(distParsed)) {
            for (const d of distParsed) {
                await DistribucionGasto.create({
                    pagoDirectoId: pago.id,
                    centroCostoId: d.centroCostoId,
                    monto: d.monto,
                    porcentaje: d.porcentaje,
                    descripcion: d.descripcion
                }, { transaction: t });
            }
        }

        await t.commit();
        await sistemaService.incrementarOperaciones();
        res.status(201).json(pago);
    } catch (error) {
        await t.rollback();
        res.status(500).json({ error: error.message });
    }
};
