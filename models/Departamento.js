/**
 * MODELO DE DEPARTAMENTO
 * Define las unidades organizativas de la empresa.
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Departamento = sequelize.define('Departamento', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    // Código identificador único del departamento (e.g. TEC, RH, ADM)
    codigo: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // Nombre descriptivo (e.g. Tecnología, Recursos Humanos)
    nombre: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // Indica si el departamento está activo
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    timestamps: true
});

module.exports = Departamento;
