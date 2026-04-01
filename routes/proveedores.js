/**
 * RUTAS DE PROVEEDORES
 * Maestro de beneficiarios y sus datos fiscales/bancarios.
 */

const express = require('express');
const router = express.Router();
const ProveedorController = require('../controllers/ProveedorController');
const auth = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

router.use(auth);

router.get('/', ProveedorController.listar);
router.get('/plantilla', ProveedorController.generarPlantilla);
router.post('/carga-masiva', upload.single('archivo'), ProveedorController.cargaMasiva);
router.post('/', ProveedorController.crear);
router.get('/:id', ProveedorController.obtenerPorId);
router.put('/:id', ProveedorController.actualizar);
router.delete('/:id', ProveedorController.eliminar);

module.exports = router;
