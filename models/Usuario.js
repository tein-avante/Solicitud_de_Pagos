/**
 * MODELO DE USUARIO
 * Representa a los usuarios del sistema (Solicitantes y Administradores).
 * Utiliza Sequelize para definir la estructura de la tabla 'Usuarios' en MySQL.
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Usuario = sequelize.define('Usuario', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  // Nombre completo del usuario
  nombre: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // Correo institucional (usado para login y notificaciones)
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  // Contraseña encriptada con Bcrypt
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // Departamento al que pertenece (e.g. OPERACIONES, RRHH, ADMINISTRACION)
  departamento: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // Rol del usuario: determina sus permisos en la plataforma
  rol: {
    type: DataTypes.ENUM('Solicitante', 'Administrador', 'Gestor', 'Auditor'),
    defaultValue: 'Solicitante'
  },
  // Configuración de preferencias de notificación
  notificacionesEmail: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  // Indica si el usuario debe cambiar su contraseña (por defecto true para nuevos usuarios)
  debeCambiarPassword: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  // Título oficial del usuario (ej. Director de Operaciones)
  cargo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // Departamentos adicionales que puede autorizar (solo para Gestores)
  departamentosAutorizados: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  // Fecha y hora del último acceso exitoso
  ultimoLogin: {
    type: DataTypes.DATE
  }

}, {
  // Habilita campos createdAt y updatedAt automáticamente
  timestamps: true
});

module.exports = Usuario;