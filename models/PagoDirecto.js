const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PagoDirecto = sequelize.define('PagoDirecto', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    correlativo: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
    },
    fecha: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    concepto: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    montoTotal: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false
    },
    moneda: {
        type: DataTypes.STRING,
        defaultValue: 'USD'
    },
    monedaPago: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Moneda en que se realiza el pago: USD o Bs'
    },
    tasaDelDia: {
        type: DataTypes.DECIMAL(15, 4),
        allowNull: true,
        comment: 'Tasa de cambio BCV del día al momento del pago'
    },
    montoAlCambio: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Equivalente del monto en la otra moneda (si paga en Bs => montoAlCambio en USD, y viceversa)'
    },
    beneficiario: {
        type: DataTypes.STRING,
        allowNull: false
    },
    metodoPago: {
        type: DataTypes.STRING,
        allowNull: false
    },
    comprobante: {
        type: DataTypes.STRING,
        allowNull: true
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
    }
}, {
    timestamps: true
});

module.exports = PagoDirecto;
