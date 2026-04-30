/**
 * SCRIPT DE MIGRACIÓN FINAL (VERSION INDESTRUCTIBLE)
 * Ahora busca por coincidencia exacta y por coincidencia normalizada (sin espacios ni símbolos).
 */

const Solicitud = require('./models/Solicitud');
const CentroCosto = require('./models/CentroCosto');
const DistribucionGasto = require('./models/DistribucionGasto');
const sequelize = require('./config/database');
const fs = require('fs');
const path = require('path');

async function ejecutarMigracion() {
    const t = await sequelize.transaction();
    try {
        const jsonPath = path.join(__dirname, 'datos_para_migracion.json');
        if (!fs.existsSync(jsonPath)) {
            console.error('No se encontró datos_para_migracion.json');
            return;
        }

        const datos = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        console.log(`Iniciando migración de ${datos.length} registros...`);

        // Cargar todos los centros de costo una vez para búsqueda rápida
        const todosLosCentros = await CentroCosto.findAll();
        const normalizar = (s) => s.replace(/[\/\s.-]/g, '').toUpperCase();

        let exitos = 0;
        let fallidos = 0;

        for (const item of datos) {
            let { correlativo, centroCostoNombre } = item;
            let nombreLimpioExcel = normalizar(centroCostoNombre);

            // 1. Intento de búsqueda inteligente
            let centro = todosLosCentros.find(c => {
                const nombreDB = c.nombre;
                // Coincidencia exacta
                if (nombreDB === centroCostoNombre.trim()) return true;
                // Coincidencia normalizada (ej: ET BOCA... == E/T BOCA...)
                if (normalizar(nombreDB) === nombreLimpioExcel) return true;
                return false;
            });

            if (!centro) {
                console.warn(`[!] No encontrado: "${centroCostoNombre}"`);
                fallidos++;
                continue;
            }

            // 2. Buscar Solicitud
            const solicitud = await Solicitud.findOne({ where: { correlativo } });
            if (!solicitud) {
                console.warn(`[!] Solicitud no encontrada: ${correlativo}`);
                fallidos++;
                continue;
            }

            // 3. Crear o actualizar DistribucionGasto
            const montoDB = solicitud.montoTotal;
            const existeDistribucion = await DistribucionGasto.findOne({ where: { solicitudId: solicitud.id } });

            if (existeDistribucion) {
                await existeDistribucion.update({ centroCostoId: centro.id, monto: montoDB, porcentaje: 100 }, { transaction: t });
            } else {
                await DistribucionGasto.create({
                    solicitudId: solicitud.id,
                    centroCostoId: centro.id,
                    monto: montoDB,
                    porcentaje: 100,
                    descripcion: 'Migración masiva desde Excel'
                }, { transaction: t });
            }

            await solicitud.update({ centrosCostoIds: [centro.id] }, { transaction: t });

            exitos++;
            console.log(`[OK] ${correlativo} -> ${centro.nombre}`);
        }

        await t.commit();
        console.log('\n--- RESUMEN FINAL ---');
        console.log(`Exitosos: ${exitos}`);
        console.log(`Fallidos: ${fallidos}`);
        console.log('---------------------');

    } catch (error) {
        if (t) await t.rollback();
        console.error('Error crítico:', error);
    }
}

ejecutarMigracion();
