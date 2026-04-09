const express = require('express');
const router = express.Router();
const ReporteFinanzasController = require('../controllers/ReporteFinanzasController');
const auth = require('../middleware/auth');

router.get('/reporte', auth, ReporteFinanzasController.getReporteConsolidado);

module.exports = router;
