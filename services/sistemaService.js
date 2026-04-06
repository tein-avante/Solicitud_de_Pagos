const SistemaConfig = require('../models/SistemaConfig');

/**
 * SERVICIO DE CONFIGURACIÓN DEL SISTEMA
 * Gestiona el contador de operaciones y la versión.
 */
class SistemaService {
    /**
     * Inicializa los valores por defecto si no existen
     */
    async inicializar() {
        try {
            const [version, versionCreated] = await SistemaConfig.findOrCreate({
                where: { clave: 'version' },
                defaults: { valor: '2.5' }
            });

            const [operaciones, opsCreated] = await SistemaConfig.findOrCreate({
                where: { clave: 'operaciones' },
                defaults: { valor: '250' }
            });

            console.log(`[SISTEMA] Versión: ${version.valor}, Operaciones: ${operaciones.valor}`);
        } catch (error) {
            console.error('[SISTEMA ERROR] Error al inicializar configuración:', error.message);
        }
    }

    /**
     * Incrementa el contador de operaciones en +1
     */
    async incrementarOperaciones() {
        try {
            const config = await SistemaConfig.findOne({ where: { clave: 'operaciones' } });
            if (config) {
                const nuevoValor = parseInt(config.valor) + 1;
                await config.update({ valor: nuevoValor.toString() });
                console.log(`[SISTEMA] Operación registrada. Total: ${nuevoValor}`);
            } else {
                await SistemaConfig.create({ clave: 'operaciones', valor: '251' });
            }
        } catch (error) {
            console.error('[SISTEMA ERROR] Error al incrementar operaciones:', error.message);
        }
    }

    /**
     * Obtiene la información actual del sistema
     */
    async obtenerInfo() {
        try {
            const configs = await SistemaConfig.findAll();
            const info = {};
            configs.forEach(c => {
                info[c.clave] = c.valor;
            });
            return info;
        } catch (error) {
            console.error('[SISTEMA ERROR] Error al obtener info:', error.message);
            return { version: '2.5', operaciones: '0' };
        }
    }
}

module.exports = new SistemaService();
