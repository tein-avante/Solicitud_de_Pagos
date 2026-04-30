/**
 * SCRIPT DE PREPARACIÓN DE MIGRACIÓN
 * Lee el archivo Excel y genera un JSON con la información necesaria para
 * actualizar los centros de costo en el servidor.
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

async function prepararMigracion() {
    try {
        const excelPath = path.join(__dirname, 'SP SIN CENTRO DE COSTO.xlsx');
        
        console.log('--- Iniciando lectura de Excel ---');
        
        if (!fs.existsSync(excelPath)) {
            console.error(`Error: No se encontró el archivo ${excelPath}`);
            return;
        }

        const workbook = XLSX.readFile(excelPath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convertir a JSON
        const rawData = XLSX.utils.sheet_to_json(worksheet);
        console.log(`Filas detectadas: ${rawData.length}`);

        const datosMapeados = rawData.map((fila, index) => {
            // Limpieza de datos
            const correlativo = fila['CÓDIGO'] ? fila['CÓDIGO'].toString().trim() : null;
            const centroCostoNombre = fila['CENTRO DE COSTO'] ? fila['CENTRO DE COSTO'].toString().trim() : null;

            if (!correlativo || !centroCostoNombre) {
                console.warn(`[Fila ${index + 2}] Datos incompletos: CÓDIGO=${correlativo}, CENTRO DE COSTO=${centroCostoNombre}`);
            }

            return {
                correlativo,
                centroCostoNombre
            };
        }).filter(item => item.correlativo && item.centroCostoNombre);

        console.log(`Datos procesados correctamente: ${datosMapeados.length}`);

        // Guardar en JSON
        const outputPath = path.join(__dirname, 'datos_para_migracion.json');
        fs.writeFileSync(outputPath, JSON.stringify(datosMapeados, null, 2), 'utf8');

        console.log(`--- Éxito ---`);
        console.log(`Archivo generado: ${outputPath}`);
        console.log(`Este archivo puede ser llevado al servidor para ejecutar la migración final.`);

    } catch (error) {
        console.error('Error procesando el Excel:', error.message);
    }
}

prepararMigracion();
