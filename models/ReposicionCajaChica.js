const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ReposicionCajaChica = sequelize.define('ReposicionCajaChica', {
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
    correlativo: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
    },
    fechaSolicitud: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    montoTotalReposicion: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false
    },
    estatus: {
        type: DataTypes.ENUM('Pendiente', 'Aprobada', 'Pagada', 'Rechazada'),
        defaultValue: 'Pendiente'
    },
    // Almacena un resumen o IDs de los gastos incluidos
    gastosConsolidados: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    solicitudPagoId: { // Link opcional a la solicitud de pago generada
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    timestamps: true
});

module.exports = ReposicionCajaChica;
