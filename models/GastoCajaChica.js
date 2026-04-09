const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GastoCajaChica = sequelize.define('GastoCajaChica', {
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
    responsableId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Usuarios',
            key: 'id'
        }
    },
    registradoPorId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Usuarios',
            key: 'id'
        }
    },
    fecha: {
        type: DataTypes.DATE,
        allowNull: false
    },
    concepto: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    montoTotal: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false
    },
    comprobante: {
        type: DataTypes.STRING,
        allowNull: true
    },
    saldoResultante: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true // Se calcula al momento de registrar
    },
    estatus: {
        type: DataTypes.ENUM('Pendiente', 'Rendido', 'Repuesto', 'Anulado'),
        defaultValue: 'Pendiente'
    }
}, {
    timestamps: true
});

module.exports = GastoCajaChica;
