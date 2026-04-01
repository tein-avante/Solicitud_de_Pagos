const Banco = require('../models/Banco');

class BancoController {
    async listar(req, res) {
        try {
            const bancos = await Banco.findAll({
                order: [['nombre', 'ASC']]
            });
            res.json(bancos);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al obtener los bancos' });
        }
    }

    async crear(req, res) {
        try {
            const { nombre, codigo } = req.body;
            const nuevoBanco = await Banco.create({ nombre, codigo });
            res.status(201).json(nuevoBanco);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al crear el banco' });
        }
    }
}

module.exports = new BancoController();
