/**
 * CONTROLADOR DE AUTENTICACIÓN
 * Maneja el flujo de inicio de sesión y registro de usuarios.
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

class AuthController {

  /**
   * Procesa el inicio de sesión del usuario
   * @param {Object} req Petición (contiene email y password)
   * @param {Object} res Respuesta HTTP
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Buscar usuario por su correo electrónico
      console.log(`[AUTH] Intento de login para email: "${email}"`);
      const usuario = await Usuario.findOne({ where: { email } });

      if (!usuario) {
        console.log(`[AUTH] Usuario NO encontrado: "${email}"`);
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      console.log(`[AUTH] Usuario encontrado. Verificando contraseña...`);

      // Comparar contraseña plana con el hash guardado en la DB
      const passwordValido = await bcrypt.compare(password, usuario.password);

      if (!passwordValido) {
        console.log(`[AUTH] Contraseña INCORRECTA para: "${email}"`);
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      console.log(`[AUTH] Login exitoso para: "${email}". Rol en DB: "${usuario.rol}"`);

      // Generar token JWT para sesiones seguras (válido por 8 horas)
      console.log(`[AUTH] Generando token JWT...`);
      const token = jwt.sign(
        { 
          userId: usuario.id, 
          rol: usuario.rol, 
          departamento: usuario.departamento,
          departamentosAutorizados: usuario.departamentosAutorizados 
        },
        process.env.JWT_SECRET,
        { expiresIn: '365d' }
      );


      // Registrar la fecha y hora del acceso
      console.log(`[AUTH] Actualizando último login para usuario ID: ${usuario.id}`);
      usuario.ultimoLogin = new Date();
      await usuario.save();
      console.log(`[AUTH] Usuario actualizado en la DB.`);

      // Enviar respuesta al frontend con datos básicos del usuario
      console.log(`[AUTH] Enviando respuesta exitosa.`);
      res.json({
        mensaje: 'Autenticación exitosa',
        token,
        usuario: {
          id: usuario.id,
          nombre: usuario.nombre,
          email: usuario.email,
          departamento: usuario.departamento,
          rol: usuario.rol,
          departamentosAutorizados: usuario.departamentosAutorizados,
          notificacionesEmail: !!usuario.notificacionesEmail,
          debeCambiarPassword: !!usuario.debeCambiarPassword

        }
      });
    } catch (error) {
      console.error('[AUTH LOGIN ERROR]:', error.message, error.stack);
      res.status(500).json({ error: 'Error en el servidor' });
    }
  }

  /**
   * Registra un nuevo usuario en el sistema
   * @param {Object} req Petición (contiene datos del usuario)
   * @param {Object} res Respuesta HTTP
   */
  async registrar(req, res) {
    try {
      const { nombre, email, password, departamento, rol } = req.body;

      // Verificar que el correo no esté registrado previamente
      const usuarioExistente = await Usuario.findOne({ where: { email } });
      if (usuarioExistente) {
        return res.status(400).json({ error: 'El usuario ya existe' });
      }

      // Encriptar la contraseña antes de guardarla (Seguridad)
      const salt = await bcrypt.genSalt(10);
      const passwordEncriptado = await bcrypt.hash(password, salt);

      // Almacenar el nuevo usuario
      const nuevoUsuario = await Usuario.create({
        nombre,
        email,
        password: passwordEncriptado,
        departamento,
        rol,
        notificacionesEmail: true,
        debeCambiarPassword: true
      });

      res.status(201).json({
        mensaje: 'Usuario registrado exitosamente',
        usuario: {
          id: nuevoUsuario.id,
          nombre: nuevoUsuario.nombre,
          email: nuevoUsuario.email,
          departamento: nuevoUsuario.departamento,
          rol: nuevoUsuario.rol,
          debeCambiarPassword: !!nuevoUsuario.debeCambiarPassword
        }
      });
    } catch (error) {
      console.error('[REGISTRATION ERROR]:', error);
      res.status(500).json({ error: 'Error en el servidor' });
    }
  }

  /**
   * Cambia la contraseña del usuario autenticado
   */
  async cambiarPassword(req, res) {
    try {
      const { passwordActual, nuevaPassword } = req.body;
      const usuarioId = req.usuario.id; // Obtenido del token por el middleware de auth

      const usuario = await Usuario.findByPk(usuarioId);
      if (!usuario) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      // 1. Validar contraseña actual
      const passwordValido = await bcrypt.compare(passwordActual, usuario.password);
      if (!passwordValido) {
        return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
      }

      // 2. Encriptar nueva contraseña
      const salt = await bcrypt.genSalt(10);
      const passwordEncriptado = await bcrypt.hash(nuevaPassword, salt);

      // 3. Actualizar usuario
      usuario.password = passwordEncriptado;
      usuario.debeCambiarPassword = false;
      await usuario.save();

      res.json({ mensaje: 'Contraseña actualizada exitosamente' });
    } catch (error) {
      console.error('[CHANGE PASSWORD ERROR]:', error);
      res.status(500).json({ error: 'Error en el servidor' });
    }
  }
}

module.exports = new AuthController();