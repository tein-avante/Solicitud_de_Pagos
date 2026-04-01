/**
 * RUTAS DE USUARIOS
 * Administración de perfiles y permisos de usuario.
 */

const express = require('express');
const router = express.Router();
const UsuarioController = require('../controllers/UsuarioController');
const auth = require('../middleware/auth');

// Protegido por autenticación
router.use(auth);

router.post('/', UsuarioController.crear);
router.get('/', UsuarioController.listar);
router.get('/:id', UsuarioController.obtenerPorId);
router.put('/:id', UsuarioController.actualizar);
router.post('/:id/reset-password', UsuarioController.resetPassword);
router.delete('/:id', UsuarioController.eliminar);

module.exports = router;
