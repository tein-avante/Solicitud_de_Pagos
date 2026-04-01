/**
 * SCRIPT DE MIGRACIÓN: CAMPOS NUEVOS
 * Agrega las columnas 'cargo' y 'departamentosAutorizados' a Usuarios,
 * y 'banco' y 'cuenta' a Proveedores.
 * Ejecución: node migracion_campos_nuevos.js
 */

const sequelize = require('./config/database');
const Usuario = require('./models/Usuario');
const Proveedor = require('./models/Proveedor');

async function migrar() {
    try {
        console.log('Conectando a la base de datos...');
        await sequelize.authenticate();
        console.log('Conexión establecida.');

        const queryInterface = sequelize.getQueryInterface();

        // 1. Usuarios
        console.log('Agregando campos a la tabla Usuarios...');
        const tableUsuarios = Usuario.getTableName();
        const columnsUsuarios = await queryInterface.describeTable(tableUsuarios);

        if (!columnsUsuarios.cargo) {
            await queryInterface.addColumn(tableUsuarios, 'cargo', {
                type: require('sequelize').DataTypes.STRING,
                allowNull: true
            });
            console.log('- Campo "cargo" agregado.');
        }

        if (!columnsUsuarios.departamentosAutorizados) {
            await queryInterface.addColumn(tableUsuarios, 'departamentosAutorizados', {
                type: require('sequelize').DataTypes.JSON,
                defaultValue: []
            });
            console.log('- Campo "departamentosAutorizados" agregado.');
        }

        // 2. Proveedores
        console.log('Agregando campos a la tabla Proveedores...');
        const tableProveedores = Proveedor.getTableName();
        const columnsProveedores = await queryInterface.describeTable(tableProveedores);

        if (!columnsProveedores.banco) {
            await queryInterface.addColumn(tableProveedores, 'banco', {
                type: require('sequelize').DataTypes.STRING,
                allowNull: true
            });
            console.log('- Campo "banco" agregado.');
        }

        if (!columnsProveedores.cuenta) {
            await queryInterface.addColumn(tableProveedores, 'cuenta', {
                type: require('sequelize').DataTypes.STRING,
                allowNull: true
            });
            console.log('- Campo "cuenta" agregado.');
        }

        console.log('¡Migración completada exitosamente!');

    } catch (error) {
        console.error('Error durante la migración:', error);
    } finally {
        await sequelize.close();
        console.log('Conexión cerrada.');
    }
}

migrar();
