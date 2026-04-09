/**
 * MODELO DE PROVEEDOR
 * Almacena los datos de las empresas o personas a las que se les realiza pagos.
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Proveedor = sequelize.define('Proveedor', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    // RIF o Cédula del proveedor
    rif: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
        set(val) {
            if (val) {
                // Elimina cualquier carácter que no sea letra o número y pasa a mayúsculas
                this.setDataValue('rif', val.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase());
            }
        }
    },
    // Nombre legal o razón social
    razonSocial: {
        type: DataTypes.STRING,
        allowNull: false
    },
    direccionFiscal: {
        type: DataTypes.TEXT
    },
    telefono: {
        type: DataTypes.STRING
    },
    email: {
        type: DataTypes.STRING,
        validate: { isEmail: true }
    },
    // Datos bancarios predeterminados para este proveedor
    datosBancarios: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    banco: {
        type: DataTypes.STRING,
        allowNull: true
    },
    cuenta: {
        type: DataTypes.STRING,
        allowNull: true
    },
    bancoPago: {
        type: DataTypes.STRING,
        allowNull: true
    },
    telefonoPago: {
        type: DataTypes.STRING,
        allowNull: true
    },
    rifPago: {
        type: DataTypes.STRING,
        allowNull: true
    },
    emailPago: {
        type: DataTypes.STRING,
        allowNull: true
    },

    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    timestamps: true
});

module.exports = Proveedor;
