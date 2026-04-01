const Notificacion = require('../models/Notificacion');

class NotificacionController {
    async crearNotificacion({ usuario, tipo, mensaje, relacionadoA }) {
        try {
            const nuevaNotificacion = await Notificacion.create({
                usuarioId: usuario,
                tipo,
                mensaje,
                relacionadoA
            });

            return nuevaNotificacion;
        } catch (error) {
            console.error('Error al crear notificación:', error);
        }
    }

    async listar(req, res) {
        try {
            const notificaciones = await Notificacion.findAll({
                where: { usuarioId: req.usuario.id },
                order: [['createdAt', 'DESC']],
                limit: 20
            });
            res.json(notificaciones);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener notificaciones' });
        }
    }

    async marcarLeida(req, res) {
        try {
            const { id } = req.params;
            const notificacion = await Notificacion.findByPk(id);
            if (notificacion) {
                notificacion.leida = true;
                await notificacion.save();
            }
            res.json({ mensaje: 'Notificación marcada como leída' });
        } catch (error) {
            res.status(500).json({ error: 'Error al actualizar notificación' });
        }
    }
}

module.exports = new NotificacionController();
