const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: console.log
});

async function migrate() {
    try {
        const queryInterface = sequelize.getQueryInterface();
        const tableInfo = await queryInterface.describeTable('DistribucionGastos');
        
        if (!tableInfo.solicitudId) {
            console.log('Agregando columna solicitudId a DistribucionGastos...');
            await queryInterface.addColumn('DistribucionGastos', 'solicitudId', {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'Solicituds',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            });
            console.log('Columna solicitudId agregada exitosamente.');
        } else {
            console.log('La columna solicitudId ya existe.');
        }
    } catch (error) {
        console.error('Error durante la migración:', error);
    } finally {
        await sequelize.close();
    }
}

migrate();
