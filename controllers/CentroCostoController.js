const CentroCosto = require('../models/CentroCosto');

class CentroCostoController {
    async listar(req, res) {
        try {
            const centros = await CentroCosto.findAll({ where: { activo: true } });
            res.json(centros);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener centros de costo' });
        }
    }

    async crear(req, res) {
        try {
            const nuevoCentro = await CentroCosto.create(req.body);
            res.status(201).json(nuevoCentro);
        } catch (error) {
            res.status(500).json({ error: 'Error al crear centro de costo' });
        }
    }

    async actualizar(req, res) {
        try {
            const { id } = req.params;
            const centro = await CentroCosto.findByPk(id);
            if (!centro) return res.status(404).json({ error: 'Centro de costo no encontrado' });

            await centro.update(req.body);
            res.json(centro);
        } catch (error) {
            res.status(500).json({ error: 'Error al actualizar centro de costo' });
        }
    }

    async eliminar(req, res) {
        try {
            const { id } = req.params;
            const centro = await CentroCosto.findByPk(id);
            if (!centro) return res.status(404).json({ error: 'Centro de costo no encontrado' });

            await centro.destroy();
            res.json({ mensaje: 'Centro de costo eliminado' });
        } catch (error) {
            res.status(500).json({ error: 'Error al eliminar centro de costo' });
        }
    }
}

module.exports = new CentroCostoController();
