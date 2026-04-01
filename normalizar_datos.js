const sequelize = require('./config/database');
const Usuario = require('./models/Usuario');

async function fixData() {
  try {
    await sequelize.authenticate();
    const users = await Usuario.findAll();
    
    for (const user of users) {
      let depts = user.departamentosAutorizados;
      let changed = false;
      
      // Intentar parsear recursivamente si es un string
      while (typeof depts === 'string' && depts.trim().startsWith('[')) {
        try {
          depts = JSON.parse(depts);
          changed = true;
          console.log(`Corrigiendo usuario ${user.nombre}: ${typeof depts}`);
        } catch (e) {
          break;
        }
      }
      
      if (changed) {
        user.departamentosAutorizados = Array.isArray(depts) ? depts : [];
        await user.save();
        console.log(`Usuario ${user.nombre} ACTUALIZADO.`);
      }
    }
    console.log('--- NORMALIZACIÓN COMPLETADA ---');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

fixData();
