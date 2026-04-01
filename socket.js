/**
 * CONFIGURACIÓN DE WEBSOCKETS (Socket.io)
 * Este archivo gestiona las conexiones en tiempo real. 
 * Se utiliza para notificar a los usuarios sobre cambios de estado o nuevas solicitudes sin recargar la página.
 */

const socketIo = require('socket.io');

let io;

/**
 * Inicializa el servidor central de WebSockets
 * @param {Object} server Servidor HTTP de Express
 * @returns {Object} Instancia de Socket.io
 */
const initSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: "*", // Permite conexiones desde el frontend en cualquier puerto
      methods: ["GET", "POST"]
    }
  });

  // Evento que se dispara cuando un cliente (Frontend) se conecta
  io.on('connection', (socket) => {
    console.log('Usuario conectado via WebSocket:', socket.id);

    // El frontend pide unirse a una "sala" específica (room) basada en su ID de usuario
    // Esto permite enviar notificaciones privadas a un usuario específico.
    socket.on('join', (userId) => {
      socket.join(userId);
      console.log(`Usuario ${userId} se unió a su sala personal`);
    });

    // Manejar la salida o cierre de pestaña del usuario
    socket.on('disconnect', () => {
      console.log('Usuario desconectado:', socket.id);
    });
  });

  return io;
};

/**
 * Permite obtener la instancia de IO desde otros archivos (e.g. Controladores)
 * para emitir eventos globales o privados.
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.io no inicializado');
  }
  return io;
};

module.exports = {
  initSocket,
  getIO
};