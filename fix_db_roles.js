/**
 * SCRIPT DE REPARACIÓN DE BASE DE DATOS (fix_db_roles.js)
 * Ejecuta un ALTER TABLE directo para asegurar que MySQL acepte el rol 'Gestor'.
 */
const sequelize = require('./config/database');

async function fixRoles() {
  try {
    await sequelize.authenticate();
    console.log('--- Conectado a la base de datos ---');

    console.log('Intentando actualizar el ENUM de roles en la tabla Usuarios...');
    
    // Ejecutamos SQL puro para estar 100% seguros de que MySQL se actualiza
    // Este comando agrega 'Gestor' a las opciones permitidas
    await sequelize.query("ALTER TABLE Usuarios MODIFY COLUMN rol ENUM('Solicitante', 'Administrador', 'Gestor') DEFAULT 'Solicitante'");
    
    console.log('✅ Base de datos actualizada con éxito. El rol "Gestor" ahora es válido.');
    
    // Verificar si el usuario gestor existe y actualizarlo
    const [results] = await sequelize.query("UPDATE Usuarios SET rol = 'Gestor' WHERE email = 'gestor@avante.com'");
    console.log(`✅ Se actualizaron los permisos para el usuario gestor@avante.com`);

  } catch (error) {
    console.error('❌ Error al reparar la base de datos:', error.message);
    console.log('\nPosible solución: Si el error dice que la columna no existe, verifica el nombre de la tabla (usualmente es "Usuarios").');
  } finally {
    await sequelize.close();
  }
}

fixRoles();
