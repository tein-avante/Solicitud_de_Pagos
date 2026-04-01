const SolicitudController = require('./controllers/SolicitudController');
const Solicitud = require('./models/Solicitud');
const Usuario = require('./models/Usuario');
const fs = require('fs');

async function test() {
  try {
    const id = 92; // La que falló según tu captura
    console.log(`Buscando solicitud ${id}...`);
    const solicitud = await Solicitud.findByPk(id);
    
    if (!solicitud) {
      console.log('Solicitud no encontrada.');
      return;
    }

    console.log('Simulando generación de PDF...');
    const elaboradoPor = await Usuario.findByPk(solicitud.elaboradoPor);
    const autorizadoPor = solicitud.autorizadoPor ? await Usuario.findByPk(solicitud.autorizadoPor) : null;
    const procesadoPor = solicitud.procesadoPor ? await Usuario.findByPk(solicitud.procesadoPor) : null;

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    const writeStream = fs.createWriteStream('./test_output.pdf');
    doc.pipe(writeStream);

    console.log('Dibujando contenido...');
    await SolicitudController._dibujarContenidoPDF(doc, solicitud, elaboradoPor, autorizadoPor, procesadoPor);
    
    doc.end();
    
    writeStream.on('finish', () => {
      console.log('¡PDF generado correctamente en ./test_output.pdf!');
      process.exit(0);
    });

  } catch (error) {
    console.error('--- ERROR DETECTADO ---');
    console.error('Mensaje:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

test();
