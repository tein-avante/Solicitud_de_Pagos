const sequelize = require('./config/database');
const Usuario = require('./models/Usuario');

async function checkUser() {
  try {
    await sequelize.authenticate();
    const user = await Usuario.findOne({ where: { nombre: 'Gestor de prueba' } });
    if (!user) {
      console.log('Usuario "Gestor de prueba" no encontrado.');
      return;
    }
    console.log('--- DATOS DEL USUARIO ---');
    console.log(`Nombre: ${user.nombre}`);
    console.log(`Rol: ${user.rol}`);
    console.log(`Depto: "${user.departamento}"`);
    console.log(`Cargo: "${user.cargo}"`);
    console.log(`Autorizados:`, user.departamentosAutorizados);
    console.log('-------------------------');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

checkUser();
