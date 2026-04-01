/**
 * MIDDLEWARE DE AUTENTICACIÓN JWT
 * Este componente intercepta todas las peticiones protegidas para verificar que
 * el cliente proporcione un token válido en el encabezado 'Authorization'.
 */

const jwt = require('jsonwebtoken');

module.exports = async (req, res, next) => {
    // Obtener el token del encabezado de la petición
    const token = req.header('Authorization')?.replace('Bearer ', '');

    // Si no hay token, rechazar la entrada inmediatamente
    if (!token) {
        return res.status(401).json({ error: 'No hay token, autorización denegada' });
    }

    try {
        // Verificar la autenticidad del token usando la clave secreta
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');

        // Inyectar los datos del usuario decodificados en el objeto 'req'
        req.usuario = {
            id: decoded.userId,
            rol: decoded.rol,
            departamento: decoded.departamento,
            departamentosAutorizados: decoded.departamentosAutorizados
        };

        // FALLBACK: Si el token es viejo y no trae los departamentos autorizados, los buscamos en la DB
        if (req.usuario.rol?.toLowerCase() === 'gestor' && (!req.usuario.departamentosAutorizados || req.usuario.departamentosAutorizados.length === 0)) {
            const Usuario = require('../models/Usuario');
            const userDB = await Usuario.findByPk(req.usuario.id, { attributes: ['departamentosAutorizados'] });
            if (userDB) {
                let depts = userDB.departamentosAutorizados;
                // Parseo robusto por si en DB sigue como string
                while (typeof depts === 'string' && depts.trim().startsWith('[')) {
                    try { depts = JSON.parse(depts); } catch (e) { break; }
                }
                req.usuario.departamentosAutorizados = Array.isArray(depts) ? depts : [];
            }
        }


        next();

    } catch (error) {
        console.error('JWT Verification Error:', error.message);
        // El token expiró o es inválido (fue manipulado)
        res.status(401).json({ error: 'Token no es válido o ha expirado' });
    }
};
