const express = require('express');
const router = express.Router();
const {
    getPagosDirectos,
    registerPagoDirecto,
    deletePagoDirecto,
    exportarReportePDF,
    exportarReporteExcel
} = require('../controllers/PagoDirectoController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', auth, getPagosDirectos);
router.get('/reporte/pdf', auth, exportarReportePDF);
router.get('/reporte/excel', auth, exportarReporteExcel);
router.post('/', auth, upload.single('comprobante'), registerPagoDirecto);
router.delete('/:id', auth, deletePagoDirecto);

module.exports = router;
