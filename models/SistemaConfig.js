const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * MODELO DE CONFIGURACIÓN DEL SISTEMA
 * Almacena parámetros globales como el contador de operaciones y la versión.
 */
const SistemaConfig = sequelize.define('SistemaConfig', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    clave: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    valor: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    tableName: 'sistema_config',
    timestamps: true
});

module.exports = SistemaConfig;
