/**
 * RUTAS DE SOLICITUDES DE PAGO
 * Gestión del ciclo de vida de las solicitudes, permisos protegidos por JWT.
 */

const express = require('express');
const router = express.Router();
const SolicitudController = require('../controllers/SolicitudController');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Configuración de Multer para carga de archivos con nombre y extensión original
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ storage: storage });

// Todas las rutas requieren autenticación
router.use(auth);

// Operaciones CRUD y flujos de negocio
router.post('/', upload.array('soportes'), SolicitudController.crear);
router.get('/', SolicitudController.listar);
router.get('/estadisticas', SolicitudController.obtenerEstadisticas);
router.get('/:id', SolicitudController.obtenerPorId);
router.put('/:id', SolicitudController.actualizar);
router.put('/:id/estatus', upload.single('comprobante'), SolicitudController.cambiarEstatus);
router.patch('/:id/estatus', upload.single('comprobante'), SolicitudController.cambiarEstatus);
router.get('/:id/pdf', (req, res) => SolicitudController.generarPDF(req, res));
router.post('/:id/comentarios', SolicitudController.agregarComentario);
router.delete('/:id/soportes/:index', SolicitudController.eliminarSoporte);
router.get('/reporte/pendientes', SolicitudController.reporteRelacionPendientes);
router.get('/reporte/pagados', SolicitudController.reporteRelacionPagados);
router.get('/exportar/datos', SolicitudController.exportarDatos);
router.get('/sistema/info', SolicitudController.obtenerSistemaInfo);

module.exports = router;

