const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ArqueoCajaChica = sequelize.define('ArqueoCajaChica', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    cajaChicaId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'CajaChicas',
            key: 'id'
        }
    },
    fecha: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    saldoTeorico: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false
    },
    saldoFisico: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false
    },
    diferencia: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    elaboradoPorId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Usuarios',
            key: 'id'
        }
    },
    observaciones: {
        type: DataTypes.TEXT
    },
    comprobante: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    timestamps: true
});

module.exports = ArqueoCajaChica;
