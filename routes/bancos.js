/**
 * RUTAS DE BANCOS
 * Provee la lista de bancos disponibles para registrar datos bancarios.
 */

const express = require('express');
const router = express.Router();
const BancoController = require('../controllers/BancoController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', BancoController.listar);

module.exports = router;
