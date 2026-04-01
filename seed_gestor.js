/**
 * SCRIPT PARA CREAR USUARIO GESTOR DE PRUEBA
 */
const sequelize = require('./config/database');
const Usuario = require('./models/Usuario');
const bcrypt = require('bcrypt');

async function seedGestor() {
  try {
    await sequelize.authenticate();
    console.log('--- Conectado a la base de datos ---');

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    const [usuario, created] = await Usuario.findOrCreate({
      where: { email: 'gestor@avante.com' },
      defaults: {
        nombre: 'Usuario Gestor Prueba',
        password: hashedPassword,
        rol: 'Gestor',
        departamento: 'ADMINISTRACION',
        debeCambiarPassword: false // Para que entres directo a probar
      }
    });

    if (created) {
      console.log('✅ Usuario GESTOR creado con éxito.');
      console.log('📧 Email: gestor@avante.com');
      console.log('🔑 Clave: password123');
    } else {
      // Si ya existe, nos aseguramos de que sea Gestor y tenga la clave ok
      await usuario.update({ 
        rol: 'Gestor', 
        password: hashedPassword,
        debeCambiarPassword: false 
      });
      console.log('ℹ️ El usuario ya existía. Se han actualizado sus permisos a GESTOR y clave a password123.');
    }

  } catch (error) {
    console.error('❌ Error al crear el gestor:', error.message);
  } finally {
    await sequelize.close();
  }
}

seedGestor();
