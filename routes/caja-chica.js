const express = require('express');
const router = express.Router();
const {
    getCajasChicas,
    createCajaChica,
    updateCajaChica,
    deleteCajaChica,
    registerGasto,
    deleteGasto,
    getGastos,
    getHistory,
    performArqueo,
    requestReposicion,
    getReposiciones,
    getArqueos,
    registerIngreso
} = require('../controllers/CajaChicaController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const sequelize = require('../config/database');

// Importamos solo los modelos necesarios para esquivar el bug de 64 keys
const CajaChica = require('../models/CajaChica');
const GastoCajaChica = require('../models/GastoCajaChica');
const PagoDirecto = require('../models/PagoDirecto');
const DistribucionGasto = require('../models/DistribucionGasto');
const ArqueoCajaChica = require('../models/ArqueoCajaChica');
const ReposicionCajaChica = require('../models/ReposicionCajaChica');
const IngresoCajaChica = require('../models/IngresoCajaChica');

router.get('/sync-db', async (req, res) => {
    try {
        await CajaChica.sync({ alter: true });
        await PagoDirecto.sync({ alter: true });
        await GastoCajaChica.sync({ alter: true });
        await DistribucionGasto.sync({ alter: true });
        await ArqueoCajaChica.sync({ alter: true });
        await ReposicionCajaChica.sync({ alter: true });
        await IngresoCajaChica.sync({ alter: true });
        
        res.json({ mensaje: 'Sincronización forzada exitosa. Tablas de finanzas creadas.' });
    } catch (error) {
        res.status(500).json({ error: 'Fallo al sincronizar DB', detalle: error.message, stack: error.stack });
    }
});

router.get('/', auth, getCajasChicas);
router.post('/', auth, createCajaChica);
router.put('/:id', auth, updateCajaChica);
router.delete('/:id', auth, deleteCajaChica);
router.post('/gasto', auth, upload.single('comprobante'), registerGasto);
router.delete('/gasto/:id', auth, deleteGasto);
router.get('/gastos', auth, getGastos);
router.get('/:id/historial', auth, getHistory);
router.post('/arqueo', auth, upload.single('comprobante'), performArqueo);
router.get('/arqueos', auth, getArqueos);
router.post('/reposicion', auth, requestReposicion);
router.get('/reposiciones', auth, getReposiciones);
router.post('/ingreso', auth, registerIngreso);

module.exports = router;
