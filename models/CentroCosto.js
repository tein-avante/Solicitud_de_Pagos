/**
 * MODELO DE CENTRO DE COSTO
 * Define las diferentes unidades o proyectos a los que se puede asignar un gasto.
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CentroCosto = sequelize.define('CentroCosto', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    // Código contable o identificador único (e.g. ADM-001)
    codigo: {
        type: DataTypes.STRING,
        // unique: true,
        allowNull: false
    },
    // Nombre descriptivo (e.g. Administración Central)
    nombre: {
        type: DataTypes.STRING,
        allowNull: false
    },
    descripcion: {
        type: DataTypes.TEXT
    },
    // Indica si el centro está disponible para nuevas solicitudes
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    timestamps: true
});

module.exports = CentroCosto;
