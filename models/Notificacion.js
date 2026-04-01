/**
 * MODELO DE NOTIFICACIÓN
 * Registra los avisos que se muestran a los usuarios en tiempo real y por lista.
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notificacion = sequelize.define('Notificacion', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    // Identificador del usuario que debe ver la notificación
    usuario: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    // Categoría: Creación, Cambio de estatus, Comentario, etc.
    tipo: {
        type: DataTypes.STRING,
        allowNull: false
    },
    mensaje: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    leida: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    // ID de la solicitud a la que hace referencia
    relacionadoA: {
        type: DataTypes.INTEGER
    }
}, {
    timestamps: true
});

module.exports = Notificacion;
