const fs = require('fs');
const path = require('path');

async function check() {
  try {
    const id = 92;
    const Solicitud = require('./models/Solicitud');
    const s = await Solicitud.findByPk(id);
    if (!s) {
      console.log(`Solicitud ${id} no encontrada`);
      return;
    }
    console.log(`--- SOLICITUD ${id} ---`);
    console.log(`Correlativo: ${s.correlativo}`);
    console.log(`Estatus: ${s.estatus}`);
    console.log(`Comprobante: ${s.comprobantePago}`);
    console.log(`Soportes:`, JSON.stringify(s.soportes, null, 2));

    const logoPath = path.join(__dirname, 'frontend', 'src', 'assets', 'logo.png');
    console.log(`Logo path: ${logoPath}`);
    console.log(`Logo exists: ${fs.existsSync(logoPath)}`);
    
    process.exit(0);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
}

check();
