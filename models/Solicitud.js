/**
 * MODELO DE SOLICITUD DE PAGO
 * Este es el corazón del sistema. Define la estructura de cada solicitud,
 * incluyendo el correlativo, proveedores, montos, y el historial de cambios.
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Solicitud = sequelize.define('Solicitud', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    // Código único autogenerado (ej: ABS-SP-DEP-001/24)
    correlativo: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
    },
    fechaSolicitud: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    // Departamento que emite la solicitud
    unidadSolicitante: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // Número de documento de referencia externa
    numeroRequerimiento: {
        type: DataTypes.STRING
    },
    fechaLimiteRequerida: {
        type: DataTypes.DATE,
        allowNull: false
    },
    // Planificada, Urgente o Emergencia
    nivelPrioridad: {
        type: DataTypes.ENUM('Planificada', 'Urgente', 'Emergencia'),
        defaultValue: 'Planificada'
    },
    // Descripción breve del motivo del pago
    conceptoPago: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    observaciones: {
        type: DataTypes.TEXT
    },
    // Almacena enlaces a archivos PDF/imágenes adjuntos
    soportes: {
        type: DataTypes.JSON, // Se guarda como un arreglo serializado
        defaultValue: []
    },
    // Metadatos de soportes físicos (Factura, Nota de Entrega, etc.)
    tiposSoporte: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    numeroOrdenCompra: {
        type: DataTypes.STRING
    },
    // Datos completos del proveedor (se guardan como JSON para snapshot histórico)
    proveedor: {
        type: DataTypes.JSON,
        allowNull: false
    },
    // Transferencia, Pago Móvil, Efectivo, etc.
    metodoPago: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // Datos específicos del método (Cuentas, RIF, etc)
    datosBancarios: {
        type: DataTypes.JSON
    },
    // Gasto Corriente, Anticipo, Reembolso, etc.
    tipoPago: {
        type: DataTypes.STRING,
        allowNull: true
    },
    montoTotal: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false
    },
    // USD, BSV, etc.
    moneda: {
        type: DataTypes.STRING,
        defaultValue: 'USD'
    },
    // Flujo: Pendiente -> Autorizado -> Aprobado -> Pagado -> Cerrado
    estatus: {
        type: DataTypes.ENUM('Pendiente', 'Autorizado', 'Aprobado', 'En Trámite', 'Pagado', 'Cerrado', 'Rechazado', 'Devuelto', 'Anulado'),
        defaultValue: 'Pendiente'
    },
    // IDs de los usuarios involucrados en cada etapa
    elaboradoPor: { type: DataTypes.INTEGER },
    autorizadoPor: { type: DataTypes.INTEGER },
    procesadoPor: { type: DataTypes.INTEGER },

    fechaAprobacion: { type: DataTypes.DATE },
    fechaPago: { type: DataTypes.DATE },
    tasaBCV: { 
        type: DataTypes.DECIMAL(15, 4),
        allowNull: true
    },
    motivoRechazo: { type: DataTypes.TEXT },
    motivoDevolucion: { type: DataTypes.TEXT },
    comprobantePago: { type: DataTypes.STRING }, // Link al archivo de soporte de pago

    // Línea de tiempo de acciones (quién hizo qué y cuándo)
    historial: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    // Sección de chat o notas internas
    comentarios: {
        type: DataTypes.JSON,
        defaultValue: []
    }
}, {
    timestamps: true // Agrega createdAt y updatedAt automáticamente
});

module.exports = Solicitud;
