const PagoDirecto = require('../models/PagoDirecto');
const GastoCajaChica = require('../models/GastoCajaChica');
const DistribucionGasto = require('../models/DistribucionGasto');
const CentroCosto = require('../models/CentroCosto');
const Usuario = require('../models/Usuario');
const CajaChica = require('../models/CajaChica');
const { Op } = require('sequelize');
const sistemaService = require('../services/sistemaService');

exports.getReporteConsolidado = async (req, res) => {
    try {
        const { fechaInicio, fechaFin, centroCostoId } = req.query;

        // Construir condiciones
        const dateWhere = {};
        if (fechaInicio && fechaFin) {
            dateWhere.fecha = { [Op.between]: [new Date(fechaInicio), new Date(fechaFin)] };
        }

        const centroCostoInclude = { model: CentroCosto };
        if (centroCostoId) {
            centroCostoInclude.where = { id: centroCostoId };
        }

        // Obtener pagos directos
        const pagos = await PagoDirecto.findAll({
            where: dateWhere,
            include: [
                { model: DistribucionGasto, include: [centroCostoInclude] },
                { model: Usuario, as: 'elaboradoPor', attributes: ['nombre'] }
            ]
        });

        // Obtener gastos de caja chica
        const gastos = await GastoCajaChica.findAll({
            where: dateWhere,
            include: [
                { model: DistribucionGasto, include: [centroCostoInclude] },
                { model: Usuario, as: 'responsable', attributes: ['nombre'] },
                { model: CajaChica, attributes: ['nombre', 'moneda'] }
            ]
        });

        // Consolidar
        const reporte = [];
        
        pagos.forEach(p => {
            // Filtrar si filtramos por centro de costo desde el join y no tiene distribuciones
            if (centroCostoId && p.DistribucionGastos.length === 0) return;
            
            reporte.push({
                _tipoItem: 'Pago Directo',
                id: `PD-${p.id}`,
                fecha: p.fecha,
                concepto: p.concepto,
                montoTotal: Number(p.montoTotal),
                moneda: p.moneda,
                Responsable: p.elaboradoPor?.nombre,
                DistribucionGastos: p.DistribucionGastos,
                estatus: 'Pagado'
            });
        });

        gastos.forEach(g => {
            if (centroCostoId && g.DistribucionGastos.length === 0) return;

            reporte.push({
                _tipoItem: 'Gasto Caja Chica',
                id: `GC-${g.id}`,
                fecha: g.fecha,
                concepto: g.concepto,
                montoTotal: Number(g.montoTotal),
                moneda: g.CajaChica?.moneda || 'USD',
                Responsable: g.responsable?.nombre,
                DistribucionGastos: g.DistribucionGastos,
                estatus: g.estatus,
                cajaChicaNombre: g.CajaChica?.nombre
            });
        });

        // Ordenar cronológicamente descendente
        reporte.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        await sistemaService.incrementarOperaciones();
        res.json(reporte);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
