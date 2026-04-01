/**
 * SCRIPT DE MIGRACIÓN: Agregar campo tasaBCV
 * Este script añade la columna 'tasaBCV' a la tabla 'Solicitudes'
 * para permitir el registro manual de la tasa de cambio al momento del pago.
 */

const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
require('dotenv').config();

// Configuración de la base de datos (basado en config/database.js)
const sequelize = require('./config/database');

async function migrar() {
    try {
        console.log('Iniciando migración: Agregando campo tasaBCV a Solicitudes...');

        const queryInterface = sequelize.getQueryInterface();
        const tableInfo = await queryInterface.describeTable('Solicituds'); // Sequelize pluraliza por defecto

        if (!tableInfo.tasaBCV) {
            await queryInterface.addColumn('Solicituds', 'tasaBCV', {
                type: DataTypes.DECIMAL(15, 4),
                allowNull: true
            });
            console.log('✅ Columna "tasaBCV" agregada exitosamente.');
        } else {
            console.log('ℹ️ La columna "tasaBCV" ya existe.');
        }

        console.log('Migración completada con éxito.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error durante la migración:', error);
        process.exit(1);
    }
}

migrar();
