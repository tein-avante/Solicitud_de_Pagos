/**
 * RUTAS DE NOTIFICACIONES
 * Endpoints para obtener avisos en tiempo real para el usuario actual.
 */

const express = require('express');
const router = express.Router();
const NotificacionController = require('../controllers/NotificacionController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', NotificacionController.listar);
router.put('/:id/leida', NotificacionController.marcarLeida);

module.exports = router;
