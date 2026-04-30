/**
 * Migración: Agregar columnas de tasa del día y moneda de pago a PagoDirectos
 * Fecha: 2026-04-14
 */
const sequelize = require('./config/database');

async function migrar() {
    const qi = sequelize.getQueryInterface();
    const { DataTypes } = require('sequelize');

    try {
        await qi.addColumn('PagoDirectos', 'monedaPago', {
            type: DataTypes.STRING,
            allowNull: true,
            after: 'moneda'
        });
        console.log('✅ Columna monedaPago agregada');
    } catch (e) {
        if (e.original?.code === 'ER_DUP_FIELDNAME') {
            console.log('⚠️  monedaPago ya existe, se omite');
        } else throw e;
    }

    try {
        await qi.addColumn('PagoDirectos', 'tasaDelDia', {
            type: DataTypes.DECIMAL(15, 4),
            allowNull: true,
            after: 'monedaPago'
        });
        console.log('✅ Columna tasaDelDia agregada');
    } catch (e) {
        if (e.original?.code === 'ER_DUP_FIELDNAME') {
            console.log('⚠️  tasaDelDia ya existe, se omite');
        } else throw e;
    }

    try {
        await qi.addColumn('PagoDirectos', 'montoAlCambio', {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: true,
            after: 'tasaDelDia'
        });
        console.log('✅ Columna montoAlCambio agregada');
    } catch (e) {
        if (e.original?.code === 'ER_DUP_FIELDNAME') {
            console.log('⚠️  montoAlCambio ya existe, se omite');
        } else throw e;
    }

    console.log('\n✅ Migración completada exitosamente');
    process.exit(0);
}

migrar().catch(err => {
    console.error('❌ Error en migración:', err.message);
    process.exit(1);
});
