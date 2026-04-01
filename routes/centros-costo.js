/**
 * RUTAS DE CENTROS DE COSTO
 * Endpoints para gestionar las unidades de asignación de gastos.
 */

const express = require('express');
const router = express.Router();
const CentroCostoController = require('../controllers/CentroCostoController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', CentroCostoController.listar);
router.post('/', CentroCostoController.crear);
router.put('/:id', CentroCostoController.actualizar);
router.delete('/:id', CentroCostoController.eliminar);

module.exports = router;
