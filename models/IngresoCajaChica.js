const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const IngresoCajaChica = sequelize.define('IngresoCajaChica', {
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
    usuarioId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Usuarios',
            key: 'id'
        }
    },
    fecha: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    concepto: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    monto: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false
    },
    saldoResultante: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true
    }
}, {
    timestamps: true
});

module.exports = IngresoCajaChica;
