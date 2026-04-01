/**
 * RUTAS DE AUTENTICACIÓN
 * Define los endpoints para el acceso y registro de usuarios.
 */

const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const auth = require('../middleware/auth');

// Iniciar sesión (Público)
router.post('/login', AuthController.login);

// Registrar nuevo usuario (Público/Admin)
router.post('/registrar', AuthController.registrar);

// Cambiar contraseña (Protegido)
router.post('/cambiar-password', auth, AuthController.cambiarPassword);

module.exports = router;




