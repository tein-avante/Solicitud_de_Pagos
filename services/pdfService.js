// services/pdfService.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PDFService {
  static async generarSolicitudPDF(solicitud) {
    return new Promise((resolve, reject) => {
      try {
        // Crear documento PDF
        const doc = new PDFDocument({ margin: 50 });
        const filename = `Solicitud_${solicitud.correlativo}.pdf`;
        const filepath = path.join(__dirname, '../temp', filename);
        
        // Asegurar que el directorio temp existe
        if (!fs.existsSync(path.dirname(filepath))) {
          fs.mkdirSync(path.dirname(filepath), { recursive: true });
        }
        
        // Pipe PDF a un archivo
        const stream = fs.createWriteStream(filepath);
        doc.pipe(stream);
        
        // Encabezado
        doc.fontSize(20).text('Solicitud de Pago', { align: 'center' });
        doc.moveDown(0.5);

        // Fila con borde para la Gerencia
        const margin = 50;
        const width = doc.page.width - (margin * 2);
        const startY = doc.y;
        const height = 25;

        doc.rect(margin, startY, width, height).stroke();
        doc.fontSize(14).text('GERENCIA DE ADMINISTRACIÓN Y FINANZAS', margin, startY + 6, {
          width: width,
          align: 'center'
        });
        
        doc.y = startY + height;
        doc.moveDown();
        
        // Información general
        doc.fontSize(12);
        doc.text(`Correlativo: ${solicitud.correlativo}`);
        doc.text(`Fecha de Solicitud: ${new Date(solicitud.fechaSolicitud).toLocaleDateString()}`);
        doc.text(`Unidad Solicitante: ${solicitud.unidadSolicitante}`);
        doc.text(`N° de Requerimiento: ${solicitud.numeroRequerimiento || 'N/A'}`);
        doc.text(`Fecha Límite Requerida: ${new Date(solicitud.fechaLimiteRequerida).toLocaleDateString()}`);
        doc.text(`Nivel de Prioridad: ${solicitud.nivelPrioridad}`);
        doc.text(`Estatus: ${solicitud.estatus}`);
        doc.moveDown();
        
        // Detalles del pago
        doc.text('Concepto del Pago:');
        doc.text(solicitud.conceptoPago);
        doc.moveDown();
        
        if (solicitud.observaciones) {
          doc.text('Observaciones:');
          doc.text(solicitud.observaciones);
          doc.moveDown();
        }
        
        // Información del proveedor
        doc.text('Datos del Proveedor:');
        doc.text(`Razón Social: ${solicitud.proveedor.razonSocial}`);
        doc.text(`RIF: ${solicitud.proveedor.rif}`);
        if (solicitud.proveedor.direccionFiscal) {
          doc.text(`Dirección Fiscal: ${solicitud.proveedor.direccionFiscal}`);
        }
        if (solicitud.proveedor.telefono) {
          doc.text(`Teléfono: ${solicitud.proveedor.telefono}`);
        }
        if (solicitud.proveedor.email) {
          doc.text(`Email: ${solicitud.proveedor.email}`);
        }
        doc.moveDown();
        
        // Información de pago
        doc.text('Información de Pago:');
        doc.text(`Método de Pago: ${solicitud.metodoPago}`);
        doc.text(`Tipo de Pago: ${solicitud.tipoPago}`);
        doc.text(`Monto Total: ${solicitud.moneda} ${solicitud.montoTotal.toFixed(2)}`);
        doc.moveDown();
        
        // Datos bancarios según método de pago
        if (solicitud.metodoPago === 'Transferencia Bancaria') {
          doc.text(`Banco: ${solicitud.datosBancarios.nombreBanco}`);
          doc.text(`N° de Cuenta: ${solicitud.datosBancarios.numeroCuenta}`);
        } else if (solicitud.metodoPago === 'Pago Móvil') {
          doc.text(`Banco: ${solicitud.datosBancarios.nombreBanco}`);
          doc.text(`Teléfono: ${solicitud.datosBancarios.telefonoPagoMovil}`);
          doc.text(`RIF: ${solicitud.proveedor.rif}`);
        } else if (solicitud.metodoPago === 'Binance') {
          doc.text(`Tipo: ${solicitud.datosBancarios.tipoPagoBinance}`);
        }
        doc.moveDown();
        
        // Centro de costo
        doc.text(`Centro de Costo: ${solicitud.centroCosto}`);
        doc.moveDown();
        
        // Firmas
        doc.text('Elaborado por:');
        doc.text(`${solicitud.elaboradoPor.nombre}`);
        doc.text(`Fecha: ${new Date(solicitud.fechaSolicitud).toLocaleDateString()}`);
        doc.moveDown();
        
        if (solicitud.autorizadoPor) {
          doc.text('Autorizado por:');
          doc.text(`${solicitud.autorizadoPor.nombre}`);
          doc.text(`Fecha: ${new Date(solicitud.fechaAprobacion).toLocaleDateString()}`);
          doc.moveDown();
        }
        
        if (solicitud.procesadoPor) {
          doc.text('Procesado por:');
          doc.text(`${solicitud.procesadoPor.nombre}`);
          doc.text(`Fecha: ${new Date(solicitud.fechaPago).toLocaleDateString()}`);
        }
        
        // Adjuntar soportes si existen
        if (solicitud.soportes && solicitud.soportes.length > 0) {
          doc.addPage();
          doc.fontSize(16).text('Soportes Adjuntos', { align: 'center' });
          doc.moveDown();
          
          for (const soporte of solicitud.soportes) {
            doc.fontSize(12).text(`Tipo: ${soporte.tipo}`);
            doc.text(`Archivo: ${soporte.nombre || 'N/A'}`);
            
            // Si hay una ruta de archivo, intentar adjuntar la imagen
            if (soporte.ruta && fs.existsSync(soporte.ruta)) {
              try {
                doc.image(soporte.ruta, {
                  fit: [500, 400],
                  align: 'center',
                  valign: 'center'
                });
                doc.moveDown();
              } catch (error) {
                console.error('Error al adjuntar imagen:', error);
                doc.text('[Error al adjuntar imagen]');
                doc.moveDown();
              }
            }
            
            doc.moveDown();
          }
        }
        
        // Finalizar PDF
        doc.end();
        
        // Cuando el stream termina, resolver la promesa
        stream.on('finish', () => {
          resolve(filepath);
        });
        
        // Manejar errores
        stream.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = PDFService;