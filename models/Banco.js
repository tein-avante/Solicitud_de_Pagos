/**
 * MODELO DE BANCO
 * Maestro de entidades bancarias nacionales e internacionales permitidas en el sistema.
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Banco = sequelize.define('Banco', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    // Nombre oficial del banco (e.g. Banco de Venezuela)
    nombre: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    // Código bancario (e.g. 0102)
    codigo: {
        type: DataTypes.STRING
    }
}, {
    timestamps: true
});

module.exports = Banco;
