const Usuario = require('../models/Usuario');
const sistemaService = require('../services/sistemaService');
const bcrypt = require('bcrypt');


class UsuarioController {
    async listar(req, res) {
        try {
            const usuarios = await Usuario.findAll({
                attributes: { exclude: ['password'] }
            });
            res.json(usuarios);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener usuarios' });
        }
    }

    async obtenerPorId(req, res) {
        try {
            const usuario = await Usuario.findByPk(req.params.id, {
                attributes: { exclude: ['password'] }
            });
            if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
            res.json(usuario);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener usuario' });
        }
    }

    async actualizarPreferencias(req, res) {
        try {
            const { notificacionesEmail } = req.body;
            const usuario = await Usuario.findByPk(req.usuario.id);
            if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

            usuario.notificacionesEmail = notificacionesEmail;
            await usuario.save();

            res.json({ mensaje: 'Preferencias actualizadas', usuario });
        } catch (error) {
            res.status(500).json({ error: 'Error al actualizar preferencias' });
        }
    }

    async crear(req, res) {
        try {
            if (req.usuario.rol?.toLowerCase() !== 'administrador') {
                return res.status(403).json({ error: 'Acceso denegado' });
            }
            const { nombre, email, password, departamento, rol, cargo, departamentosAutorizados } = req.body;
 
             const existe = await Usuario.findOne({ where: { email } });
             if (existe) return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
 
             const salt = await bcrypt.genSalt(10);
             const passwordEnc = await bcrypt.hash(password, salt);
 
             const parseDepts = (val) => {
                 if (Array.isArray(val)) return val;
                 if (typeof val === 'string') {
                     try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch (e) { return []; }
                 }
                 return [];
             };

             const nuevoUsuario = await Usuario.create({
                 nombre, 
                 email, 
                 password: passwordEnc, 
                 departamento, 
                 rol, 
                 cargo,
                 departamentosAutorizados: (rol?.toLowerCase() === 'gestor') ? parseDepts(departamentosAutorizados) : [],
                 debeCambiarPassword: true
             });



            res.status(201).json({ mensaje: 'Usuario creado', id: nuevoUsuario.id });

            // Incrementar contador de operaciones
            await sistemaService.incrementarOperaciones();

        } catch (error) {
            console.error('[USUARIO CREATE ERROR]:', error);
            res.status(500).json({ error: 'Error al crear usuario: ' + error.message });
        }
    }

    async actualizar(req, res) {
        try {
            if (req.usuario.rol?.toLowerCase() !== 'administrador') {
                return res.status(403).json({ error: 'Acceso denegado' });
            }
            const { id } = req.params;
            const { nombre, email, departamento, rol, password, cargo, departamentosAutorizados } = req.body;
            const usuario = await Usuario.findByPk(id);
            if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
 
            const parseDepts = (val) => {
                if (Array.isArray(val)) return val;
                if (typeof val === 'string') {
                    try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch (e) { return []; }
                }
                return [];
            };

            const updates = { 
                nombre, 
                email, 
                departamento, 
                rol, 
                cargo,
                departamentosAutorizados: (rol?.toLowerCase() === 'gestor') ? parseDepts(departamentosAutorizados) : []
            };

 
            if (password && password.trim() !== '') {
                const salt = await bcrypt.genSalt(10);
                updates.password = await bcrypt.hash(password, salt);
            }
 
            await usuario.update(updates);

            res.json({ mensaje: 'Usuario actualizado', id: usuario.id });

            // Incrementar contador de operaciones
            await sistemaService.incrementarOperaciones();

        } catch (error) {
            res.status(500).json({ error: 'Error al actualizar usuario' });
        }
    }

    async eliminar(req, res) {
        try {
            if (req.usuario.rol?.toLowerCase() !== 'administrador') {
                return res.status(403).json({ error: 'Acceso denegado' });
            }
            const { id } = req.params;
            // Evitar que el administrador se borre a sí mismo accidentalmente
            if (parseInt(id) === req.usuario.id) {
                return res.status(400).json({ error: 'No puede eliminar su propia cuenta de administrador' });
            }

            const usuario = await Usuario.findByPk(id);
            if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

            await usuario.destroy();
            res.json({ mensaje: 'Usuario eliminado' });

            // Incrementar contador de operaciones
            await sistemaService.incrementarOperaciones();

        } catch (error) {
            res.status(500).json({ error: 'Error al eliminar usuario' });
        }
    }

    async resetPassword(req, res) {
        try {
            if (req.usuario.rol?.toLowerCase() !== 'administrador') {
                return res.status(403).json({ error: 'Acceso denegado' });
            }
            const { id } = req.params;
            const usuario = await Usuario.findByPk(id);
            if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

            const defaultPassword = 'password123';
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(defaultPassword, salt);

            await usuario.update({
                password: hashedPassword,
                debeCambiarPassword: true
            });

            res.json({
                mensaje: 'Contraseña reseteada exitosamente',
                nuevaClave: defaultPassword
            });
        } catch (error) {
            console.error('[USUARIO RESET PASSWORD ERROR]:', error);
            res.status(500).json({ error: 'Error al resetear la contraseña' });
        }
    }
}

module.exports = new UsuarioController();
