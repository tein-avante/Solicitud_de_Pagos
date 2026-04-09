const express = require('express');
const router = express.Router();
const Departamento = require('../models/Departamento');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
    try {
        const depts = await Departamento.findAll();
        res.json(depts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
