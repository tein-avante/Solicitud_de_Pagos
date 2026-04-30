const PagoDirecto = require('../models/PagoDirecto');
const DistribucionGasto = require('../models/DistribucionGasto');
const CentroCosto = require('../models/CentroCosto');
const Usuario = require('../models/Usuario');
const PDFDocument = require('pdfkit');
const sequelize = require('../config/database');
const sistemaService = require('../services/sistemaService');

exports.getPagosDirectos = async (req, res) => {
    try {
        const pagos = await PagoDirecto.findAll({
            include: [
                { model: DistribucionGasto, include: [CentroCosto] },
                { model: Usuario, as: 'elaboradoPor', attributes: ['nombre'] }
            ],
            order: [['fecha', 'DESC']]
        });
        await sistemaService.incrementarOperaciones();
        res.json(pagos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.registerPagoDirecto = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { fecha, concepto, montoTotal, moneda, monedaPago, tasaDelDia, beneficiario, metodoPago, distribucion, observaciones } = req.body;
        const elaboradoPorId = req.usuario.id;

        const correlativo = `PD-${Date.now()}`;

        // Calcular monto al cambio
        let montoAlCambio = null;
        const tasa = parseFloat(tasaDelDia);
        const monto = parseFloat(montoTotal);
        if (monedaPago && tasa && tasa > 0) {
            if (monedaPago === 'Bs') {
                // Pagó en Bs => equivalente en USD
                montoAlCambio = parseFloat((monto / tasa).toFixed(2));
            } else if (monedaPago === 'USD') {
                // Pagó en USD => equivalente en Bs
                montoAlCambio = parseFloat((monto * tasa).toFixed(2));
            }
        }

        const pago = await PagoDirecto.create({
            correlativo,
            fecha,
            concepto,
            montoTotal,
            moneda,
            monedaPago: monedaPago || null,
            tasaDelDia: tasa || null,
            montoAlCambio,
            beneficiario,
            metodoPago,
            elaboradoPorId,
            observaciones,
            comprobante: req.file ? req.file.path.replace(/\\/g, '/') : null
        }, { transaction: t });

        let distParsed = distribucion;
        if (typeof distribucion === 'string') {
            try { distParsed = JSON.parse(distribucion); } catch (e) { }
        }

        if (!distParsed || !Array.isArray(distParsed) || distParsed.length === 0) {
            throw new Error('Debe asignar al menos un Centro de Costo');
        }

        for (const d of distParsed) {
            if (!d.centroCostoId) {
                throw new Error('Cada registro de distribución debe tener un Centro de Costo asignado');
            }
            await DistribucionGasto.create({
                pagoDirectoId: pago.id,
                centroCostoId: d.centroCostoId,
                monto: d.monto,
                porcentaje: d.porcentaje,
                descripcion: d.descripcion
            }, { transaction: t });
        }

        await t.commit();
        await sistemaService.incrementarOperaciones();
        res.status(201).json(pago);
    } catch (error) {
        await t.rollback();
        res.status(500).json({ error: error.message });
    }
};

exports.deletePagoDirecto = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const pago = await PagoDirecto.findByPk(id, { transaction: t });

        if (!pago) throw new Error('El pago directo no existe');

        // Eliminar distribuciones asociadas
        await DistribucionGasto.destroy({
            where: { pagoDirectoId: id },
            transaction: t
        });

        // Eliminar el pago
        await pago.destroy({ transaction: t });

        await t.commit();
        await sistemaService.incrementarOperaciones();
        res.json({ mensaje: 'Pago Directo eliminado con éxito' });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ error: error.message });
    }
};


exports.exportarReportePDF = async (req, res) => {
    try {
        const pagos = await PagoDirecto.findAll({
            include: [
                { model: Usuario, as: 'elaboradoPor', attributes: ['nombre'] }
            ],
            order: [['fecha', 'DESC']]
        });

        const doc = new PDFDocument({
            size: 'A4',
            layout: 'landscape',
            margins: { top: 30, bottom: 30, left: 30, right: 30 }
        });
        
        const filename = `Reporte_PagosDirectos_GAF_${Date.now()}.pdf`;

        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-Type', 'application/pdf');
        
        doc.pipe(res);

        // --- CONSTANTES DE DISEÑO ---
        const FONT_SZ = 7;
        const ROW_H = 20;
        const HEADER_H = 25;
        const MX = 30;
        const MY = 30;
        const PAGE_H = 595.28;   // alto de A4 landscape en puntos
        const PAD = 3;            // padding interno de celda
        const BLUE = '#1b4f72';
        const BORDER = '#CCCCCC';
        const TABLE_W = 780;

        const cols = [
            { label: 'CORRELATIVO', key: 'Correlativo', width: 90 },
            { label: 'FECHA', key: 'Fecha', width: 60 },
            { label: 'BENEFICIARIO', key: 'Beneficiario', width: 140 },
            { label: 'CONCEPTO / MOTIVO', key: 'Concepto', width: 220 },
            { label: 'MÉTODO PAGO', key: 'Método', width: 80 },
            { label: 'MONEDA', key: 'Moneda', width: 50 },
            { label: 'MONTO', key: 'Monto', width: 60, align: 'right' },
            { label: 'ELAB. POR', key: 'Elab', width: 80 }
        ];

        // --- FUNCIÓN: dibujar encabezado de columnas ---
        const drawTableHeader = (y) => {
            doc.rect(MX, y, TABLE_W, HEADER_H).fill(BLUE);
            let x = MX;
            doc.fontSize(FONT_SZ).font('Helvetica-Bold').fillColor('#FFFFFF');
            cols.forEach(col => {
                doc.text(col.label, x + PAD, y + 6, {
                    width: col.width - PAD * 2,
                    align: col.align || 'left',
                    lineBreak: false,
                    ellipsis: true
                });
                x += col.width;
            });
            return y + HEADER_H;
        };

        // --- FUNCIÓN: dibujar una fila de datos (SIN COLORES DE FONDO) ---
        const drawDataRow = (rowValues, y, rowH) => {
            const finalH = Math.max(rowH, ROW_H);
            // Fondo de la fila: Siempre BLANCO, "sin colores dentro"
            doc.rect(MX, y, TABLE_W, finalH).fill('#FFFFFF');
            // Borde de la fila
            doc.rect(MX, y, TABLE_W, finalH).stroke(BORDER);
            // Texto de cada celda
            let x = MX;
            doc.fontSize(FONT_SZ).font('Helvetica').fillColor('#000000');
            rowValues.forEach((cellText, i) => {
                const col = cols[i];
                const cleanText = String(cellText != null ? cellText : '').replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
                
                doc.text(cleanText, x + PAD, y + 5, {
                    width: col.width - PAD * 2,
                    align: col.align || 'left',
                    lineBreak: true
                });
                x += col.width;
            });
            return y + finalH;
        };

        // --- BRANDING Y TÍTULO ---
        const fs = require('fs');
        const path = require('path');
        const logoPath = path.join(__dirname, '../frontend/src/assets/logo.png');
        try {
            if (fs.existsSync(logoPath)) doc.image(logoPath, MX, MY, { width: 80 });
        } catch (e) { }

        doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000')
            .text('REPORTE GENERAL DE PAGOS DIRECTOS GAF', 0, MY + 10, { align: 'center' });

        let subheader = `Generado el: ${new Date().toLocaleDateString('es-VE')}`;
        doc.fontSize(8).font('Helvetica').fillColor('#000000').text(subheader, { align: 'right' });
        doc.moveDown(0.5);

        // --- TABLA ---
        let currentY = doc.y;
        currentY = drawTableHeader(currentY);

        pagos.forEach((pago) => {
            const fechaStr = new Date(pago.fecha).toLocaleDateString('es-VE');
            const montoStr = Number(pago.montoTotal).toLocaleString('es-VE', {minimumFractionDigits:2});
            
            const rowValues = [
                pago.correlativo || '',
                fechaStr,
                pago.beneficiario || '',
                pago.concepto || '',
                pago.metodoPago || '',
                pago.monedaPago || pago.moneda || '',
                montoStr,
                pago.elaboradoPor?.nombre || ''
            ];

            // Cálculo de altura necesaria para esta fila
            let maxH = ROW_H;
            rowValues.forEach((text, idx) => {
                const colW = cols[idx].width - (PAD * 2);
                const h = doc.heightOfString(text, { width: colW, lineBreak: true });
                if (h + 10 > maxH) maxH = h + 10;
            });

            if (currentY + maxH > PAGE_H - 45) {
                doc.addPage();
                currentY = MY;
                doc.fontSize(8).font('Helvetica-Oblique').fillColor('#666666')
                    .text('REPORTE DE PAGOS DIRECTOS (continuación)', MX, currentY);
                currentY += 13;
                currentY = drawTableHeader(currentY);
            }

            currentY = drawDataRow(rowValues, currentY, maxH);
        });

        doc.end();
        await sistemaService.incrementarOperaciones();
    } catch (error) {
        console.error('[PDF EXPORT ERROR]:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error al generar PDF' });
        } else {
            res.end();
        }
    }
};

exports.exportarReporteExcel = async (req, res) => {
    try {
        const pagos = await PagoDirecto.findAll({
            include: [
                { model: Usuario, as: 'elaboradoPor', attributes: ['nombre'] }
            ],
            order: [['fecha', 'DESC']]
        });

        const XLSX = require('xlsx');
        const wb = XLSX.utils.book_new();

        const excelData = pagos.map(pago => ({
            'Correlativo': pago.correlativo || 'N/A',
            'Fecha': new Date(pago.fecha).toLocaleDateString('es-VE'),
            'Beneficiario': pago.beneficiario,
            'Concepto': pago.concepto,
            'Método de Pago': pago.metodoPago || 'N/A',
            'Moneda': pago.monedaPago || pago.moneda || 'N/A',
            'Monto': Number(pago.montoTotal),
            'Elaborado Por': pago.elaboradoPor?.nombre || 'N/A'
        }));

        const ws = XLSX.utils.json_to_sheet(excelData);

        // Adjust column widths
        ws['!cols'] = [
            { wch: 15 }, // Correlativo
            { wch: 12 }, // Fecha
            { wch: 30 }, // Beneficiario
            { wch: 45 }, // Concepto
            { wch: 15 }, // Método de Pago
            { wch: 10 }, // Moneda
            { wch: 15 }, // Monto
            { wch: 20 }  // Elaborado Por
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Pagos Directos GAF');
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', `attachment; filename=Reporte_PagosDirectos_GAF_${Date.now()}.xlsx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

        await sistemaService.incrementarOperaciones();
    } catch (error) {
        console.error('[EXCEL EXPORT ERROR]:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error al generar Excel' });
        } else {
            res.end();
        }
    }
};
