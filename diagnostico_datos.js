const sequelize = require('./config/database');
const Solicitud = require('./models/Solicitud');
const Usuario = require('./models/Usuario');
const { Op } = require('sequelize');

async function diagnose() {
  try {
    await sequelize.authenticate();
    console.log('--- DIAGNÓSTICO DE SISTEMA ---');

    const totalSolicitudes = await Solicitud.count();
    console.log(`Total de solicitudes en el sistema: ${totalSolicitudes}`);

    const solicitudesPorDepto = await Solicitud.findAll({
      attributes: ['unidadSolicitante', [sequelize.fn('COUNT', sequelize.col('id')), 'total']],
      group: ['unidadSolicitante']
    });

    console.log('\nSolicitudes por Departamento:');
    solicitudesPorDepto.forEach(d => {
      console.log(`- ${d.unidadSolicitante}: ${d.get('total')}`);
    });

    const usuariosSinDepto = await Usuario.count({
      where: {
        [Op.or]: [
          { departamento: null },
          { departamento: '' }
        ]
      }
    });
    console.log(`\nUsuarios con departamento vacío o nulo: ${usuariosSinDepto}`);

    const solicitudesMalformadas = await Solicitud.findAll({
        where: {
            [Op.or]: [
                { proveedor: null },
                { elaboradoPor: null }
            ]
        }
    });
    console.log(`Solicitudes sin proveedor o elaborador: ${solicitudesMalformadas.length}`);

    console.log('\n--- FIN DEL DIAGNÓSTICO ---');
  } catch (e) {
    console.error('Error durante el diagnóstico:', e);
  } finally {
    process.exit(0);
  }
}

diagnose();
