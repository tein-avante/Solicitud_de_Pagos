const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DistribucionGasto = sequelize.define('DistribucionGasto', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    // Referencias opcionales
    gastoCajaChicaId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'GastoCajaChicas',
            key: 'id'
        }
    },
    pagoDirectoId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'PagoDirectos',
            key: 'id'
        }
    },
    solicitudId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'Solicituds',
            key: 'id'
        }
    },
    centroCostoId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'CentroCostos',
            key: 'id'
        }
    },
    monto: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false
    },
    porcentaje: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false
    },
    descripcion: {
        type: DataTypes.STRING
    }
}, {
    timestamps: true
});

module.exports = DistribucionGasto;
