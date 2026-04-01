const sequelize = require('./config/database');
const Solicitud = require('./models/Solicitud');

async function checkDepts() {
  try {
    await sequelize.authenticate();
    const depts = await Solicitud.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('unidadSolicitante')), 'depto']]
    });
    console.log('--- DEPARTAMENTOS EN SOLICITUDES ---');
    depts.forEach(d => console.log(`- "${d.getDataValue('depto')}"`));
    console.log('------------------------------------');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

checkDepts();
