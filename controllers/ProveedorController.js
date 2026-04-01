const Proveedor = require('../models/Proveedor');

class ProveedorController {
    async listar(req, res) {
        try {
            const proveedores = await Proveedor.findAll({ where: { activo: true } });
            res.json(proveedores);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener proveedores' });
        }
    }

    async crear(req, res) {
        try {
            const nuevoProveedor = await Proveedor.create(req.body);
            res.status(201).json(nuevoProveedor);
        } catch (error) {
            console.error('[PROVEEDOR CREATE ERROR]:', error.message, error.errors ? error.errors.map(e => e.message) : '');
            res.status(500).json({ error: 'Error al crear proveedor: ' + (error.errors ? error.errors[0].message : error.message) });
        }
    }

    async actualizar(req, res) {
        try {
            const { id } = req.params;
            const proveedor = await Proveedor.findByPk(id);
            if (!proveedor) return res.status(404).json({ error: 'Proveedor no encontrado' });

            await proveedor.update(req.body);
            res.json(proveedor);
        } catch (error) {
            res.status(500).json({ error: 'Error al actualizar proveedor' });
        }
    }

    async obtenerPorId(req, res) {
        try {
            const { id } = req.params;
            const proveedor = await Proveedor.findByPk(id);
            if (!proveedor) return res.status(404).json({ error: 'Proveedor no encontrado' });
            res.json(proveedor);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener proveedor' });
        }
    }

    async eliminar(req, res) {
        try {
            const { id } = req.params;
            const proveedor = await Proveedor.findByPk(id);
            if (!proveedor) return res.status(404).json({ error: 'Proveedor no encontrado' });

            await proveedor.destroy();
            res.json({ mensaje: 'Proveedor eliminado' });
        } catch (error) {
            res.status(500).json({ error: 'Error al eliminar proveedor' });
        }
    }

    /**
     * Genera un archivo Excel de plantilla para la carga masiva
     */
    async generarPlantilla(req, res) {
        try {
            const XLSX = require('xlsx');
            // Definimos los encabezados exactos que espera el sistema por defecto
            const headers = ['Razón Social', 'RIF / C.I', 'Dirección Fiscal', 'Teléfono', 'Email', 'Banco', 'Número de Cuenta'];
            const data = [headers];

            const ws = XLSX.utils.aoa_to_sheet(data);
            
            // Ajustar ancho de columnas para que se vea bien
            ws['!cols'] = [
                { wch: 30 }, // Razón Social
                { wch: 15 }, // RIF
                { wch: 40 }, // Dirección
                { wch: 15 }, // Teléfono
                { wch: 25 }  // Email
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Proveedores");

            const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

            res.setHeader('Content-Disposition', 'attachment; filename="plantilla_proveedores.xlsx"');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.send(buffer);
        } catch (error) {
            console.error('[TEMPLATE ERROR]:', error);
            res.status(500).json({ error: 'Error al generar plantilla' });
        }
    }

    /**
     * Procesa un archivo Excel y carga los proveedores masivamente
     */
    async cargaMasiva(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No se subió ningún archivo' });
            }

            const XLSX = require('xlsx');
            const workbook = XLSX.readFile(req.file.path);
            const sheetName = workbook.SheetNames[0];
            const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

            const resultados = {
                creados: 0,
                actualizados: 0,
                errores: 0,
                detallesErrores: []
            };

            // Función para normalizar nombres de columnas (quitar acentos, espacios y pasar a minúsculas)
            const normalizar = (str) => {
                if (!str) return '';
                return str.toString().toLowerCase()
                    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar acentos
                    .trim();
            };

            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                const nFila = i + 2; // +2 porque el Excel empieza en 1 y la fila 1 son encabezados
                
                try {
                    // Mapeo flexible de columnas
                    let razonSocial, rif, direccionFiscal, telefono, email, banco, cuenta;

                    Object.keys(row).forEach(key => {
                        const kn = normalizar(key);
                        const val = row[key];

                        if (kn.includes('razon') || kn.includes('nombre') || kn.includes('empresa')) {
                            razonSocial = val;
                        } else if (kn.includes('rif') || kn.includes('cedula') || kn.includes('id') || kn.includes('ci')) {
                            rif = val?.toString();
                        } else if (kn.includes('direcion') || kn.includes('fiscal') || kn.includes('ubicacion')) {
                            direccionFiscal = val;
                        } else if (kn.includes('telefono') || kn.includes('celular')) {
                            telefono = val?.toString();
                        } else if (kn.includes('email') || kn.includes('correo')) {
                            email = val;
                        } else if (kn.includes('banco') || kn.includes('entidad')) {
                            banco = val?.toString();
                        } else if (kn.includes('cuenta') || kn.includes('numero') || kn.includes('iban')) {
                            cuenta = val?.toString();
                        }
                    });

                    if (!razonSocial || !rif) {
                        resultados.errores++;
                        resultados.detallesErrores.push(`Fila ${nFila}: Falta Razón Social o RIF.`);
                        continue;
                    }

                    // Limpiar RIF de cualquier carácter no alfanumérico para la búsqueda
                    const rifLimpio = rif.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

                    const [proveedor, created] = await Proveedor.findOrCreate({
                        where: { rif: rifLimpio },
                        defaults: { 
                            razonSocial, 
                            direccionFiscal: direccionFiscal || '', 
                            telefono: telefono || '', 
                            email: (email && email.toString().trim() !== '') ? email.toString().trim() : null,
                            banco: banco || null,
                            cuenta: cuenta || null
                        }
                    });

                    if (!created) {
                        await proveedor.update({ 
                            razonSocial, 
                            direccionFiscal: direccionFiscal || proveedor.direccionFiscal, 
                            telefono: telefono || proveedor.telefono, 
                            email: (email && email.toString().trim() !== '') ? email.toString().trim() : proveedor.email,
                            banco: banco || proveedor.banco,
                            cuenta: cuenta || proveedor.cuenta
                        });
                        resultados.actualizados++;
                    } else {
                        resultados.creados++;
                    }
                } catch (err) {
                    console.error(`[ROW ERROR Fila ${nFila}]:`, err.message);
                    resultados.errores++;
                    resultados.detallesErrores.push(`Fila ${nFila}: ${err.message}`);
                }
            }

            // Eliminar archivo temporal
            const fs = require('fs');
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

            res.json({
                mensaje: 'Carga masiva completada',
                detalles: resultados
            });
        } catch (error) {
            console.error('[CARGA ERROR]:', error);
            res.status(500).json({ error: 'Error crítico al procesar el archivo Excel' });
        }
    }
}

module.exports = new ProveedorController();
