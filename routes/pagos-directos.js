const express = require('express');
const router = express.Router();
const {
    getPagosDirectos,
    registerPagoDirecto,
} = require('../controllers/PagoDirectoController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', auth, getPagosDirectos);
router.post('/', auth, upload.single('comprobante'), registerPagoDirecto);

module.exports = router;
