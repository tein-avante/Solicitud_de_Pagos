/**
 * CONTROLADOR DE SOLICITUDES DE PAGO
 * Este archivo contiene toda la lógica de negocio para la gestión de solicitudes,
 * incluyendo creación, aprobación, pago, generación de PDFs y exportación de datos.
 */

const { Op } = require('sequelize');
const Solicitud = require('../models/Solicitud');
const Usuario = require('../models/Usuario');
const Proveedor = require('../models/Proveedor');
const CentroCosto = require('../models/CentroCosto');
let Departamento = null;
try { Departamento = require('../models/Departamento'); } catch (e) { console.warn('[WARN] Modelo Departamento no encontrado, se usará nombre de departamento como respaldo'); }
const Notificacion = require('../models/Notificacion');
const PDFDocument = require('pdfkit');
const { PDFDocument: PDFLibDocument } = require('pdf-lib');
const fs = require('fs');

const sequelize = require('../config/database');
const path = require('path');
const bwipjs = require('bwip-js');
const sistemaService = require('../services/sistemaService');


const parseJsonArray = (val) => {
  let p = val;
  while (typeof p === 'string' && (p.trim().startsWith('[') || p.trim().startsWith('{'))) {
    try { p = JSON.parse(p); } catch (e) { break; }
  }
  return Array.isArray(p) ? p : [];
};

class SolicitudController {

  /**
   * Crea una nueva solicitud en el sistema
   */
  async crear(req, res) {
    try {
      const {
        unidadSolicitante,
        numeroRequerimiento,
        fechaLimiteRequerida,
        nivelPrioridad,
        conceptoPago,
        observaciones,
        soportes,
        centroCosto,
        proveedor,
        metodoPago,
        datosBancarios,
        montoTotal,
        moneda,
        tiposSoporte,
        tipoPago,
        numeroOrdenCompra
      } = req.body;

      // Validación: La fecha límite no puede ser anterior a hoy
      const fechaActual = new Date();
      fechaActual.setHours(0, 0, 0, 0); // Solo queremos comparar la fecha, no la hora

      const fechaLimite = new Date(fechaLimiteRequerida);
      fechaLimite.setHours(0, 0, 0, 0);

      if (fechaLimite < fechaActual) {
        return res.status(400).json({ error: 'La fecha límite no puede ser anterior a la fecha actual' });
      }

      // LÓGICA DE GENERACIÓN DE CORRELATIVO (CODIGO-001-24)
      const nombreDepto = req.usuario.departamento;
      const anioActual = new Date().getFullYear().toString().slice(-2);

      // Obtener el código del departamento (con respaldo si la tabla no existe)
      let codigoDepto = nombreDepto;
      try {
        if (Departamento) {
          const depto = await Departamento.findOne({ where: { nombre: nombreDepto } });
          if (depto && depto.codigo) {
            codigoDepto = depto.codigo;
          }
        }
        console.log(`[CORRELATIVO] Departamento: "${nombreDepto}" -> Código: "${codigoDepto}"`);
      } catch (deptoError) {
        console.error('[CORRELATIVO] Error al buscar departamento, usando nombre como respaldo:', deptoError.message);
      }

      // Buscar la última solicitud con el nuevo formato para incrementar el número
      const ultimaSolicitud = await Solicitud.findOne({
        where: {
          correlativo: { [Op.like]: `${codigoDepto}-%` }
        },
        order: [['id', 'DESC']]
      });

      let numeroSecuencial = 1;
      if (ultimaSolicitud) {
        const partes = ultimaSolicitud.correlativo.split('-');
        if (partes.length >= 3) {
          const anioParte = partes[partes.length - 1];
          const secParte = partes[partes.length - 2];

          if (anioParte === anioActual) {
            numeroSecuencial = parseInt(secParte) + 1;
          }
        }
      }

      const correlativo = `${codigoDepto}-${String(numeroSecuencial).padStart(3, '0')}-${anioActual}`;

      // --- TRATAMIENTO DE ARCHIVOS ADJUNTOS (Soportes) ---
      let archivosSoportes = [];
      if (req.files && req.files.length > 0) {
        archivosSoportes = req.files.map(file => ({
          nombre: file.originalname,
          ruta: file.path.replace(/\\/g, '/'),
          tipo: file.mimetype,
          fecha: new Date(),
          subidoPor: req.usuario.id,
          subidoPorRol: req.usuario.rol
        }));
      }

      // Crear el registro en la base de datos
      const nuevaSolicitud = await Solicitud.create({
        correlativo,
        fechaSolicitud: fechaActual,
        unidadSolicitante,
        numeroRequerimiento,
        fechaLimiteRequerida,
        nivelPrioridad,
        conceptoPago,
        observaciones,
        soportes: archivosSoportes, // Guardamos los archivos procesados
        centroCosto,
        proveedor: typeof proveedor === 'string' ? JSON.parse(proveedor) : proveedor,
        metodoPago,
        datosBancarios: typeof datosBancarios === 'string' ? JSON.parse(datosBancarios) : datosBancarios,
        tipoPago: tipoPago || 'Unico Pago',
        montoTotal,
        moneda,
        tiposSoporte: typeof tiposSoporte === 'string' ? JSON.parse(tiposSoporte) : (tiposSoporte || []),
        numeroOrdenCompra: numeroOrdenCompra || '',
        estatus: 'Pendiente',
        elaboradoPor: req.usuario.id,
        historial: [{
          fecha: fechaActual,
          usuario: req.usuario.id,
          accion: 'Creación de solicitud',
          comentario: 'Solicitud creada exitosamente'
        }]
      });

      // Crear notificación automática para los administradores
      const NotificacionController = require('./NotificacionController');
      await NotificacionController.crearNotificacion({
        usuario: req.usuario.id,
        tipo: 'Creación',
        mensaje: `Solicitud ${correlativo} creada exitosamente`,
        relacionadoA: nuevaSolicitud.id
      });

      res.status(201).json({
        mensaje: 'Solicitud creada exitosamente',
        solicitud: nuevaSolicitud
      });

      // Incrementar contador de operaciones
      await sistemaService.incrementarOperaciones();

    } catch (error) {
      console.error('[CREATION ERROR]:', error);
      res.status(500).json({ error: 'Error en el servidor', detalles: error.message });
    }
  }

  /**
   * Obtiene el detalle completo de una solicitud por su ID
   */
  async obtenerPorId(req, res) {
    try {
      const { id } = req.params;
      const solicitud = await Solicitud.findByPk(id);

      if (!solicitud) {
        return res.status(404).json({ error: 'Solicitud no encontrada' });
      }

      // CONTROL DE ACCESO: Un solicitante o gestor solo puede ver las de su departamento
      const esAdmin = req.usuario.rol?.toLowerCase() === 'administrador';
      const esAuditor = req.usuario.rol?.toLowerCase() === 'auditor';
      const esGestor = req.usuario.rol?.toLowerCase() === 'gestor';

      // Verificar si es un departamento autorizado para este gestor
      const deptsAutorizados = parseJsonArray(req.usuario.departamentosAutorizados);
      const esDeptoAutorizado = esGestor && deptsAutorizados.includes(solicitud.unidadSolicitante);

      if (
        !esAdmin && !esAuditor &&
        solicitud.unidadSolicitante !== req.usuario.departamento &&
        solicitud.elaboradoPor !== req.usuario.id &&
        !esDeptoAutorizado
      ) {
        return res.status(403).json({ error: 'No tiene permisos para ver esta solicitud' });
      }


      // Cargar información de los usuarios que han intervenido (Firmas) - Incluyendo Cargo
      const elaboradoPor = await Usuario.findByPk(solicitud.elaboradoPor, { attributes: ['id', 'nombre', 'email', 'cargo'] });
      const autorizadoPor = solicitud.autorizadoPor ? await Usuario.findByPk(solicitud.autorizadoPor, { attributes: ['id', 'nombre', 'email', 'cargo'] }) : null;
      const procesadoPor = solicitud.procesadoPor ? await Usuario.findByPk(solicitud.procesadoPor, { attributes: ['id', 'nombre', 'email', 'cargo'] }) : null;


      const parseJsonField = (field) => {
        let parsed = field;
        while (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); } catch (e) { break; }
        }
        return parsed;
      };

      const solicitudJson = solicitud.toJSON();

      solicitudJson.soportes = parseJsonArray(solicitudJson.soportes);
      solicitudJson.proveedor = parseJsonField(solicitudJson.proveedor);
      solicitudJson.datosBancarios = parseJsonField(solicitudJson.datosBancarios);
      solicitudJson.comentarios = parseJsonArray(solicitudJson.comentarios);
      solicitudJson.historial = parseJsonArray(solicitudJson.historial);
      solicitudJson.tiposSoporte = parseJsonArray(solicitudJson.tiposSoporte);

      if (Array.isArray(solicitudJson.historial)) {
        solicitudJson.historial = solicitudJson.historial.filter(h => typeof h === 'object' && h !== null && h.fecha);
        await Promise.all(solicitudJson.historial.map(async (h) => {
          if (h.usuario) {
            const user = await Usuario.findByPk(h.usuario, { attributes: ['nombre'] });
            h.usuarioNombre = user ? user.nombre : 'Sistema';
          } else {
            h.usuarioNombre = 'Sistema';
          }
        }));
      } else {
        solicitudJson.historial = [];
      }

      if (Array.isArray(solicitudJson.comentarios)) {
        solicitudJson.comentarios = solicitudJson.comentarios.filter(c => typeof c === 'object' && c !== null && c.fecha);
        await Promise.all(solicitudJson.comentarios.map(async (c) => {
          if (c.usuario) {
            const user = await Usuario.findByPk(c.usuario, { attributes: ['nombre'] });
            c.usuarioNombre = user ? user.nombre : 'Usuario Anónimo';
          } else {
            c.usuarioNombre = 'Usuario Anónimo';
          }
        }));
      } else {
        solicitudJson.comentarios = [];
      }

      solicitudJson.elaboradoPor = elaboradoPor;
      solicitudJson.autorizadoPor = autorizadoPor;
      solicitudJson.procesadoPor = procesadoPor;

      res.json(solicitudJson);

      // Incrementar contador de operaciones al visualizar una solicitud
      await sistemaService.incrementarOperaciones();
    } catch (error) {
      console.error('[FETCH ERROR]:', error);
      res.status(500).json({ error: 'Error en el servidor' });
    }
  }

  /**
   * Obtiene la lista paginada de solicitudes con filtros opcionales
   */
  async listar(req, res) {
    try {
      const { estatus, pagina = 1, limite = 10 } = req.query;
      const where = {};

      const esAdmin = req.usuario.rol?.toLowerCase() === 'administrador';

      const esAuditor = req.usuario.rol?.toLowerCase() === 'auditor';

      if (!esAdmin && !esAuditor) {
        const esGestor = req.usuario.rol?.toLowerCase() === 'gestor';
        let departamentosParaFiltrar = [req.usuario.departamento];

        const parseJsonArray = (val) => {
          let parsed = val;
          while (typeof parsed === 'string' && parsed.trim().startsWith('[')) {
            try { parsed = JSON.parse(parsed); } catch (e) { break; }
          }
          return Array.isArray(parsed) ? parsed : [];
        };

        if (esGestor && req.usuario.departamentosAutorizados) {
          const extras = parseJsonArray(req.usuario.departamentosAutorizados);
          departamentosParaFiltrar = [...new Set([...departamentosParaFiltrar, ...extras])];
        }

        where.unidadSolicitante = { [Op.in]: departamentosParaFiltrar };
      }


      else {
      }



      if (estatus) {
        where.estatus = estatus;
      }

      if (req.query.proveedorId) {
        // Como proveedor es un JSON, buscamos el ID dentro del string/objeto
        // Sequelize maneja mejor la búsqueda en JSON si se define correctamente, 
        // pero aquí el campo es DataTypes.JSON, así que usamos Op.like en el stringify si fuera necesario,
        // o mejor filtramos por el campo unidadSolicitante si es departamento.
        // Para proveedor, como es un objeto guardado, buscaremos el ID.
        where.proveedor = { [Op.like]: `%"id":${req.query.proveedorId}%` };
      }

      if (req.query.unidadSolicitante) {
        where.unidadSolicitante = req.query.unidadSolicitante;
      }

      const offset = (pagina - 1) * limite;
      const { rows: solicitudesRows, count: total } = await Solicitud.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: parseInt(limite),
        offset: parseInt(offset)
      });

      // Mapear resultados para incluir nombres de usuarios
      const solicitudes = await Promise.all(solicitudesRows.map(async sol => {
        const elaborado = sol.elaboradoPor ? await Usuario.findByPk(sol.elaboradoPor, { attributes: ['nombre'] }) : null;
        const autorizado = sol.autorizadoPor ? await Usuario.findByPk(sol.autorizadoPor, { attributes: ['nombre'] }) : null;
        const procesado = sol.procesadoPor ? await Usuario.findByPk(sol.procesadoPor, { attributes: ['nombre'] }) : null;

        return {
          ...sol.toJSON(),
          elaboradoPorNombre: elaborado ? elaborado.nombre : 'N/A',
          autorizadoPorNombre: autorizado ? autorizado.nombre : null,
          procesadoPorNombre: procesado ? procesado.nombre : null
        };
      }));

      res.json({
        solicitudes,
        totalPaginas: Math.ceil(total / limite),
        paginaActual: parseInt(pagina),
        total
      });
    } catch (error) {
      console.error('[LIST ERROR]:', error);
      res.status(500).json({ error: 'Error en el servidor' });
    }
  }

  /**
   * Obtiene conteos totales y distribuciones para el dashboard y gráficos
   */
  async obtenerEstadisticas(req, res) {
    try {
      const where = {};

      // Aplicar filtro por departamento para usuarios que no sean Administradores ni Auditores
      const esAdmin = req.usuario.rol?.toLowerCase() === 'administrador';
      const esAuditor = req.usuario.rol?.toLowerCase() === 'auditor';

      if (!esAdmin && !esAuditor) {
        const esGestor = req.usuario.rol?.toLowerCase() === 'gestor';
        let departamentosParaFiltrar = [req.usuario.departamento];

        const parseJsonArray = (val) => {
          let parsed = val;
          while (typeof parsed === 'string' && parsed.trim().startsWith('[')) {
            try { parsed = JSON.parse(parsed); } catch (e) { break; }
          }
          return Array.isArray(parsed) ? parsed : [];
        };

        if (esGestor && req.usuario.departamentosAutorizados) {
          const extras = parseJsonArray(req.usuario.departamentosAutorizados);
          departamentosParaFiltrar = [...new Set([...departamentosParaFiltrar, ...extras])];
        }

        where.unidadSolicitante = { [Op.in]: departamentosParaFiltrar };
      }




      else {
      }


      // Conteos para los widgets (totales)
      const total = await Solicitud.count({ where });
      // Pendientes: Pendiente + Autorizado + Devuelto
      const pendientes = await Solicitud.count({
        where: { ...where, estatus: { [Op.or]: ['Pendiente', 'Autorizado', 'Devuelto', 'Anulado'] } }
      });
      const aprobadas = await Solicitud.count({
        where: { ...where, estatus: 'Aprobado' }
      });
      const pagadas = await Solicitud.count({
        where: { ...where, estatus: 'Pagado' }
      });
      const cerradas = await Solicitud.count({
        where: { ...where, estatus: 'Cerrado' }
      });

      // Datos para Gráfico de Torta (Distribución por Estatus)
      const statusCounts = await Solicitud.findAll({
        where,
        attributes: [
          'estatus',
          [sequelize.fn('COUNT', sequelize.col('estatus')), 'count']
        ],
        group: ['estatus']
      });

      // Datos para Gráfico de Barras (Distribución por Departamento)
      const deptCounts = await Solicitud.findAll({
        where,
        attributes: [
          'unidadSolicitante',
          [sequelize.fn('COUNT', sequelize.col('unidadSolicitante')), 'count']
        ],
        group: ['unidadSolicitante']
      });

      const responseData = {
        total,
        pendientes,
        aprobadas,
        pagadas,
        cerradas,
        porEstatus: statusCounts.map(s => ({
          name: (s.get('estatus') || 'Sin Estado').toUpperCase(),
          value: parseInt(s.get('count'))
        })),
        porDepartamento: deptCounts.map(d => ({
          name: (d.get('unidadSolicitante') || 'N/A').toUpperCase(),
          value: parseInt(d.get('count'))
        }))
      };

      console.log('[STATS DEBUG] Response:', JSON.stringify(responseData, null, 2));
      res.json(responseData);
    } catch (error) {
      console.error('[STATS ERROR]:', error);
      res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
  }

  /**
   * Maneja el flujo de estados (Aprobación, Rechazo, Pago, etc)
   */
  async cambiarEstatus(req, res) {
    try {
      const { id } = req.params;
      const { estatus, motivo, comentario } = req.body;

      const solicitud = await Solicitud.findByPk(id);
      if (!solicitud) {
        return res.status(404).json({ error: 'Solicitud no encontrada' });
      }

      // Si no se envía estatus, asumimos que es una operación de solo adjuntar archivo/comentario
      if (!estatus) {
        if (solicitud.estatus === 'Cerrado') {
          return res.status(403).json({ error: 'No se pueden agregar soportes a una solicitud cerrada' });
        }

        if (req.file) {
          const histsoportes = parseJsonArray(solicitud.soportes);
          histsoportes.push({
            nombre: req.file.originalname,
            ruta: req.file.path.replace(/\\/g, '/'),
            tipo: req.file.mimetype,
            fecha: new Date(),
            subidoPor: req.usuario.id,
            subidoPorRol: req.usuario.rol
          });
          solicitud.soportes = histsoportes;

          const historialParsed = parseJsonArray(solicitud.historial);
          historialParsed.push({
            fecha: new Date(),
            usuario: req.usuario.id,
            accion: 'Soporte Adicional Adjuntado',
            comentario: req.file.originalname
          });
          solicitud.historial = historialParsed;

          await solicitud.save();
          return res.json({ mensaje: 'Soporte agregado correctamente', solicitud });
        }
        return res.status(400).json({ error: 'No se proporcionó estatus ni archivo para actualizar' });
      }

      // VALIDACIÓN DE PERMISOS PARA CAMBIO DE ESTADO (Flujo original)
      const esAdmin = req.usuario.rol?.toLowerCase() === 'administrador';
      const esAuditor = req.usuario.rol?.toLowerCase() === 'auditor';
      const esGestor = req.usuario.rol?.toLowerCase() === 'gestor';

      if (!esAdmin) {
        // El Auditor PUEDE DEVOLVER cualquier solicitud
        if (esAuditor && estatus === 'Devuelto') {
          // Acceso concedido globalmente para Devolver
        }
        // El Gerente (Gestor) PUEDE AUTORIZAR solicitudes de su departamento o departamentos asignados
        else if (esGestor && (estatus?.toLowerCase() === 'autorizado' || estatus?.toLowerCase() === 'aprobado')) {
          const deptoUsuario = req.usuario.departamento?.trim().toLowerCase();
          const deptoSolicitud = solicitud.unidadSolicitante?.trim().toLowerCase();
          const deptsAutorizados = parseJsonArray(req.usuario.departamentosAutorizados);
          const autorizados = deptsAutorizados.map(d => d?.trim().toLowerCase());

          const esDeptoPropio = deptoUsuario === deptoSolicitud;
          const esDeptoExtra = autorizados.includes(deptoSolicitud);

          if (!esDeptoPropio && !esDeptoExtra) {
            return res.status(403).json({ error: 'Solo puede autorizar solicitudes de su propio departamento o departamentos asignados' });
          }
          // Acceso concedido para Autorizar
        }
        // El Gestor PUEDE DEVOLVER solicitudes de su departamento o departamentos asignados
        else if (esGestor && estatus?.toLowerCase() === 'devuelto') {
          const deptoUsuario = req.usuario.departamento?.trim().toLowerCase();
          const deptoSolicitud = solicitud.unidadSolicitante?.trim().toLowerCase();
          const deptsAutorizados = parseJsonArray(req.usuario.departamentosAutorizados);
          const autorizados = deptsAutorizados.map(d => d?.trim().toLowerCase());

          const esDeptoPropio = deptoUsuario === deptoSolicitud;
          const esDeptoExtra = autorizados.includes(deptoSolicitud);

          if (!esDeptoPropio && !esDeptoExtra) {
            return res.status(403).json({ error: 'Solo puede devolver solicitudes de su propio departamento o departamentos asignados' });
          }
          // Acceso concedido para Devolver
        }




        // El SOLICITANTE puede ANULAR su propia solicitud si está Pendiente
        else if (estatus === 'Anulado') {
          const esDueño = solicitud.elaboradoPor === req.usuario.id || solicitud.unidadSolicitante === req.usuario.departamento;
          if (!esDueño) {
            return res.status(403).json({ error: 'Solo el solicitante o su departamento pueden anular esta solicitud' });
          }
          if (solicitud.estatus !== 'Pendiente') {
            return res.status(400).json({ error: 'Solo se pueden anular solicitudes en estado Pendiente' });
          }
          // Acceso concedido para Anular
        }
        else {
          return res.status(403).json({ error: 'No tiene permisos para cambiar el estatus de esta solicitud' });
        }
      }

      // TRANSICIONES DE ESTADO VÁLIDAS (Máquina de estados)
      const transicionesValidas = {
        'Pendiente': ['Autorizado', 'Rechazado', 'Devuelto', 'Anulado'],
        'Autorizado': ['Aprobado', 'Rechazado', 'Devuelto'],
        'Aprobado': ['Pagado', 'Rechazado', 'Devuelto'],
        'Pagado': ['Cerrado'],
        'Cerrado': [],
        'Rechazado': [],
        'Devuelto': ['Pendiente'],
        'Anulado': ['Pendiente']
      };

      if (!transicionesValidas[solicitud.estatus].includes(estatus)) {
        return res.status(400).json({
          error: `No se puede cambiar de ${solicitud.estatus} a ${estatus}`
        });
      }

      const estatusAnterior = solicitud.estatus;
      solicitud.estatus = estatus;

      // LÓGICA ESPECÍFICA POR ESTADO
      if (estatus === 'Autorizado') {
        solicitud.autorizadoPor = req.usuario.id;
      } else if (estatus === 'Aprobado') {
        solicitud.procesadoPor = req.usuario.id; // En el flujo anterior se llamaba autorizadoPor, pero aquí es la segunda firma (Admin)
        solicitud.fechaAprobacion = new Date();
      } else if (estatus === 'Pagado') {
        // Al pagar, el admin firma como procesado o podemos usar un nuevo campo si fuera necesario, 
        // pero seguiremos la lógica de adjuntar el comprobante.
        solicitud.fechaPago = new Date();
        if (req.body.tasaBCV) {
          solicitud.tasaBCV = req.body.tasaBCV;
        }
        if (req.file) {
          solicitud.comprobantePago = req.file.path.replace(/\\/g, '/');
        }
      } else if (estatus === 'Cerrado') {
        // Estado final
      } else if (estatus === 'Rechazado') {
        solicitud.motivoRechazo = motivo;
      } else if (estatus === 'Devuelto') {
        solicitud.motivoDevolucion = motivo;
      }

      // Soporte para subir archivos en cualquier momento antes de cerrar
      if (req.file && estatus !== 'Pagado' && estatus !== 'Cerrado') {
        const histsoportes = Array.isArray(solicitud.soportes) ? solicitud.soportes : [];
        histsoportes.push({
          nombre: req.file.originalname,
          ruta: req.file.path.replace(/\\/g, '/'),
          tipo: req.file.mimetype,
          fecha: new Date(),
          subidoPor: req.usuario.id,
          subidoPorRol: req.usuario.rol
        });
        solicitud.soportes = histsoportes;
      }

      // Registrar acción en el historial
      const historialParsed = parseJsonArray(solicitud.historial);
      const nuevoHistorial = [...historialParsed];
      nuevoHistorial.push({
        fecha: new Date(),
        usuario: req.usuario.id,
        accion: `Cambio de estatus: ${estatusAnterior} → ${estatus}`,
        comentario: comentario || motivo || ''
      });
      solicitud.historial = nuevoHistorial;

      await solicitud.save();

      // Notificar al dueño de la solicitud sobre el cambio (con protección)
      try {
        if (solicitud.elaboradoPor) {
          const NotificacionController = require('./NotificacionController');
          await NotificacionController.crearNotificacion({
            usuario: solicitud.elaboradoPor,
            tipo: 'Cambio de estatus',
            mensaje: `Su solicitud ${solicitud.correlativo} ha cambiado a estatus: ${estatus}`,
            relacionadoA: solicitud.id
          });
        }
      } catch (notifError) {
        console.error('[NOTIFICATION SEND ERROR]:', notifError.message);
      }

      res.json({
        mensaje: `Estatus cambiado a ${estatus} exitosamente`,
        solicitud,
        debug_recibido: { estatus, motivo, comentario }
      });

      // Incrementar contador de operaciones
      await sistemaService.incrementarOperaciones();

    } catch (error) {
      console.error('[STATUS UPDATE ERROR]:', error);
      res.status(500).json({ error: 'Error en el servidor' });
    }
  }

  /**
   * Genera el archivo PDF formal de la solicitud siguiendo el formato corporativo
   */
  async generarPDF(req, res) {
    try {
      const { id } = req.params;
      const solicitud = await Solicitud.findByPk(id);

      if (!solicitud) {
        return res.status(404).json({ error: 'Solicitud no encontrada' });
      }

      const elaboradoPor = await Usuario.findByPk(solicitud.elaboradoPor);
      const autorizadoPor = solicitud.autorizadoPor ? await Usuario.findByPk(solicitud.autorizadoPor) : null;
      const procesadoPor = solicitud.procesadoPor ? await Usuario.findByPk(solicitud.procesadoPor) : null;

      // Proveedor parseado
      let proveedor = solicitud.proveedor || {};
      if (typeof proveedor === 'string') {
        try { proveedor = JSON.parse(proveedor); } catch (e) { proveedor = {}; }
      }

      // Datos Bancarios parseados
      let datosBancarios = solicitud.datosBancarios || {};
      if (typeof datosBancarios === 'string') {
        try { datosBancarios = JSON.parse(datosBancarios); } catch (e) { datosBancarios = {}; }
      }

      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const filename = `Solicitud_${solicitud.correlativo}.pdf`;

      // Manejar errores en el stream del PDF para evitar caídas del servidor
      doc.on('error', (err) => {
        console.error('[PDF STREAM ERROR]:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error al generar el flujo de PDF' });
        } else {
          res.end();
        }
      });

      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.setHeader('Content-Type', 'application/pdf');

      // Si la solicitud está cerrada, devolvemos el PDF consolidado (Mergueado)
      if (solicitud.estatus === 'Cerrado') {
        console.log(`[PDF CONSOLIDADO] Generando PDF unido para solicitud: ${solicitud.correlativo}`);
        try {
          const bufferUnido = await this.generarBufferConsolidado(solicitud);
          return res.send(Buffer.from(bufferUnido));
        } catch (mergeError) {
          console.error('[MERGE ERROR] Falló la consolidación, enviando solo formulario:', mergeError);
          // Si falla la unión, continuamos con la generación del formulario simple
        }
      }

      // Generar a Buffer en lugar de directamente a res para evitar cortes prematuros
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const result = Buffer.concat(chunks);
        res.setHeader('Content-Length', result.length);
        res.send(result);
      });

      await this._dibujarContenidoPDF(doc, solicitud, elaboradoPor, autorizadoPor, procesadoPor);
      doc.end();
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error al generar PDF', details: error.message });
      }
    } finally {
      // Incrementar contador de operaciones (Cualquier descarga de PDF cuenta como operación)
      await sistemaService.incrementarOperaciones();
    }
  }


  /**
   * Dibuja el contenido del formulario en un documento PDFKit (Reutilizable)
   */
  async _dibujarContenidoPDF(doc, solicitud, elaboradoPor, autorizadoPor, procesadoPor) {
    try {
      // Proveedor parseado
      let proveedor = solicitud.proveedor || {};
      if (typeof proveedor === 'string') {
        try { proveedor = JSON.parse(proveedor); } catch (e) { proveedor = {}; }
      }

      // Datos Bancarios parseados
      let datosBancarios = solicitud.datosBancarios || {};
      if (typeof datosBancarios === 'string') {
        try { datosBancarios = JSON.parse(datosBancarios); } catch (e) { datosBancarios = {}; }
      }

      // --- CONFIGURACIÓN DE COLORES Y FUENTES ---

      const borderColor = '#000000';
      const headerBg = '#F2F2F2';
      const logoPath = path.join(__dirname, '../frontend/src/assets/logo.png');

      // --- ENCABEZADO SUPERIOR (TABLA DE 3 COLUMNAS) ---
      const headY = 30;
      doc.rect(30, headY, 535, 60).stroke(); // Recuadro externo del header
      doc.moveTo(130, headY).lineTo(130, headY + 60).stroke(); // Línea logo
      // doc.moveTo(465, headY).lineTo(465, headY + 60).stroke(); // Línea metadata

      // Logo
      try {
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 35, headY + 5, { width: 90 });
        } else {
          doc.fontSize(14).font('Helvetica-Bold').text('AVANTE', 40, headY + 20);
        }
      } catch (e) {
        doc.fontSize(14).font('Helvetica-Bold').text('AVANTE', 40, headY + 20);
      }

      // Título y Gerencia
      doc.fontSize(14).font('Helvetica-Bold').text('SOLICITUD DE PAGO', 130, headY + 12, { width: 435, align: 'center' });
      doc.moveTo(130, headY + 30).lineTo(565, headY + 30).stroke(); // Línea horizontal divisora
      doc.fontSize(10).font('Helvetica-Bold').text('GERENCIA DE ADMINISTRACIÓN Y FINANZAS', 130, headY + 41, { width: 435, align: 'center' });

      /*
      // Metadata Header
      doc.fontSize(7).font('Helvetica-Bold');
      doc.text('Código:', 470, headY + 5);
      doc.font('Helvetica').text('ABS-UG-FM-007/24', 470, headY + 13);
      doc.moveTo(465, headY + 22).lineTo(565, headY + 22).stroke();
      doc.font('Helvetica-Bold').text('Fecha de Vigencia:', 470, headY + 27);
      doc.font('Helvetica').text('16/02/2026', 470, headY + 35);
      doc.moveTo(465, headY + 44).lineTo(565, headY + 44).stroke();
      doc.font('Helvetica-Bold').text('Página N°:', 470, headY + 49);
      doc.font('Helvetica').text('1 DE 1', 520, headY + 49);
      */

      // --- CORRELATIVO (FORMATO: CODIGO-SEC-AÑO) ---
      const corrY = headY + 70;
      doc.rect(335, corrY, 230, 20).stroke();
      doc.fontSize(8).font('Helvetica-Bold').text('CORRELATIVO:', 340, corrY + 6);
      doc.font('Helvetica').text(solicitud.correlativo, 410, corrY + 6);

      // --- SECCIÓN 1: FECHAS Y UNIDAD ---
      const s1Y = corrY + 30;
      doc.rect(30, s1Y, 535, 30).stroke();
      doc.moveTo(230, s1Y).lineTo(230, s1Y + 30).stroke();

      doc.fillColor('#000000').fontSize(7).font('Helvetica-Bold');
      doc.text('FECHA DE SOLICITUD', 35, s1Y + 5);
      doc.text('UNIDAD SOLICITANTE', 235, s1Y + 5);

      doc.font('Helvetica').fontSize(9);
      doc.text(solicitud.fechaSolicitud ? new Date(solicitud.fechaSolicitud).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '', 35, s1Y + 16);
      doc.text(solicitud.unidadSolicitante, 235, s1Y + 16);

      // --- N° REQUERIMIENTO ---
      const s2Y = s1Y + 30;
      doc.rect(30, s2Y, 535, 15).stroke();
      doc.fontSize(7).font('Helvetica-Bold').text('N° DE REQUERIMIENTO ASOCIADO:', 35, s2Y + 4);
      doc.font('Helvetica').text(solicitud.numeroRequerimiento || 'N/A', 170, s2Y + 4);

      // --- FECHA LÍMITE Y PRIORIDAD ---
      const s3Y = s2Y + 15;
      doc.rect(30, s3Y, 535, 30).stroke();
      doc.moveTo(230, s3Y).lineTo(230, s3Y + 30).stroke();

      doc.font('Helvetica-Bold').text('FECHA LÍMITE REQUERIDA', 35, s3Y + 5);
      doc.text('NIVEL DE PRIORIDAD', 235, s3Y + 5);

      doc.font('Helvetica').fontSize(9);
      doc.text(solicitud.fechaLimiteRequerida ? new Date(solicitud.fechaLimiteRequerida).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '', 35, s3Y + 16);

      // PRIORIDAD CHECKBOXES
      const pY = s3Y + 16;
      const priorities = ['PLANIFICADA', 'URGENTE', 'EMERGENCIA'];
      const currentP = (solicitud.nivelPrioridad || '').toUpperCase();

      let pX = 235;
      priorities.forEach(p => {
        doc.rect(pX, pY, 8, 8).stroke();
        if (p === currentP) {
          doc.fontSize(8).font('Helvetica-Bold').text('X', pX + 1, pY + 1, { width: 8, align: 'center' });
        }
        doc.fontSize(7).font('Helvetica-Bold').text(p, pX + 12, pY + 1);
        pX += 80;
      });

      // --- DESCRIPCIÓN DEL BIEN T/O SERVICIO ---
      const descY = s3Y + 35;
      doc.rect(30, descY, 535, 12).fill('#F2F2F2').stroke();
      doc.fillColor('#000000').font('Helvetica-Bold').text('DESCRIPCIÓN DEL BIEN Y/O SERVICIO REQUERIDO', 30, descY + 3, { width: 535, align: 'center' });

      const conceptoY = descY + 12;
      doc.rect(30, conceptoY, 535, 90).stroke(); // Altura aumentada de 60 a 90
      doc.moveTo(180, conceptoY).lineTo(180, conceptoY + 90).stroke();
      doc.moveTo(30, conceptoY + 45).lineTo(565, conceptoY + 45).stroke(); // División a la mitad (45px cada fila)

      doc.fontSize(7).text('CONCEPTO DEL PAGO', 35, conceptoY + 18);
      doc.text('OBSERVACIONES DEL BIEN Y/O SERVICIO REQUERIDO', 35, conceptoY + 55, { width: 140 });

      doc.font('Helvetica').fontSize(8);
      const conceptoLimpio = (solicitud.conceptoPago || '').replace(/[\r\n]+/g, ' ').trim();
      const obsLimpio = (solicitud.observaciones || '').replace(/[\r\n]+/g, ' ').trim();

      doc.text(conceptoLimpio, 185, conceptoY + 5, { width: 370, height: 38 });
      doc.text(obsLimpio, 185, conceptoY + 50, { width: 370, height: 38 });

      // --- SOPORTE (CHECKBOXES) ---
      const sopY = conceptoY + 95; // Desplazado 30px hacia abajo (antes +65)
      doc.rect(30, sopY, 535, 12).fill('#F2F2F2').stroke();
      doc.fillColor('#000000').font('Helvetica-Bold').text('SOPORTE DEL BIEN Y/O SERVICIO REQUERIDO (ADJUNTAR SOPORTE)', 30, sopY + 3, { width: 535, align: 'center' });

      const sopBoxY = sopY + 12;
      doc.rect(30, sopBoxY, 535, 45).stroke();
      doc.moveTo(180, sopBoxY).lineTo(180, sopBoxY + 45).stroke(); // Línea vertical Factura/OC
      doc.moveTo(180, sopBoxY + 15).lineTo(565, sopBoxY + 15).stroke(); // Línea horizontal OC Titulo

      // Columna 1: Factura, Presupuesto, Otros
      const sopList = ['FACTURA', 'PRESUPUESTO', 'OTROS', 'NOTA DE ENTREGA', 'OBLIGACIONES'];

      let tiposSoporteActivos = solicitud.tiposSoporte || [];
      if (typeof tiposSoporteActivos === 'string') {
        try {
          tiposSoporteActivos = JSON.parse(tiposSoporteActivos);
        } catch (e) {
          tiposSoporteActivos = [tiposSoporteActivos];
        }
      }

      let sy = sopBoxY + 5;
      sopList.slice(0, 3).forEach(s => {
        doc.rect(35, sy, 8, 8).stroke();
        let checked = false;
        if (Array.isArray(tiposSoporteActivos)) {
          checked = tiposSoporteActivos.some(val => val.toUpperCase() === s.toUpperCase());
        } else if (typeof tiposSoporteActivos === 'string') {
          checked = tiposSoporteActivos.toUpperCase() === s.toUpperCase();
        }

        if (checked) {
          doc.fontSize(8).font('Helvetica-Bold').text('X', 36, sy + 1, { width: 8, align: 'center' });
        }
        doc.fontSize(7).font('Helvetica-Bold').text(s, 48, sy + 1);
        sy += 13;
      });
      // Columna 2: Nota entrega, Obligaciones
      sy = sopBoxY + 5;
      sopList.slice(3, 5).forEach(s => {
        doc.rect(100, sy, 8, 8).stroke();
        let checked = false;
        if (Array.isArray(tiposSoporteActivos)) {
          checked = tiposSoporteActivos.some(val => val.toUpperCase() === s.toUpperCase());
        } else if (typeof tiposSoporteActivos === 'string') {
          checked = tiposSoporteActivos.toUpperCase() === s.toUpperCase();
        }

        if (checked) {
          doc.fontSize(8).font('Helvetica-Bold').text('X', 101, sy + 1, { width: 8, align: 'center' });
        }
        doc.fontSize(7).font('Helvetica-Bold').text(s, 113, sy + 1);
        sy += 13;
      });

      // Orden de Compra
      doc.font('Helvetica-Bold').fontSize(7).text('ORDEN DE COMPRA', 185, sopBoxY + 4, { width: 375, align: 'center' });
      doc.rect(200, sopBoxY + 22, 110, 15).stroke();
      doc.text('N° ORDEN DE COMPRA', 205, sopBoxY + 26);
      doc.rect(310, sopBoxY + 22, 245, 15).stroke();
      doc.font('Helvetica').text(solicitud.numeroOrdenCompra || '', 315, sopBoxY + 26);

      // --- CENTRO DE COSTO Y METODO PAGO ---
      const ccY = sopBoxY + 50;
      doc.rect(30, ccY, 535, 50).stroke();
      doc.moveTo(210, ccY).lineTo(210, ccY + 50).stroke(); // Vertical Centro Costo
      doc.moveTo(210, ccY + 20).lineTo(565, ccY + 20).stroke(); // Horizontal Pago/Monto
      doc.moveTo(400, ccY + 20).lineTo(400, ccY + 50).stroke(); // Vertical Método/Tipo

      doc.font('Helvetica-Bold').text('CENTRO DE COSTO ASIGNADO:', 35, ccY + 15);
      doc.font('Helvetica').text(solicitud.centroCosto, 35, ccY + 28);

      doc.font('Helvetica-Bold').text('MÉTODO DE PAGO:', 215, ccY + 4);
      doc.font('Helvetica').text(solicitud.metodoPago, 320, ccY + 4);

      doc.font('Helvetica-Bold').text('MONTO TOTAL A PAGAR:', 215, ccY + 28);
      doc.font('Helvetica').fontSize(10).text(`${solicitud.moneda} ${parseFloat(solicitud.montoTotal || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, 215, ccY + 38);

      doc.font('Helvetica-Bold').fontSize(6).text('TIPO DE PAGO:', 405, ccY + 24);
      doc.rect(405, ccY + 33, 7, 7).stroke();
      doc.font('Helvetica').fontSize(6).text('ÚNICO PAGO', 414, ccY + 34);
      doc.rect(460, ccY + 33, 7, 7).stroke();
      doc.text('ANTICIPO', 469, ccY + 34);
      doc.rect(510, ccY + 33, 7, 7).stroke();
      doc.text('FONDO FIJO', 519, ccY + 34);

      const tipoPagoStr = (solicitud.tipoPago || '').toUpperCase();
      if (tipoPagoStr === 'ANTICIPO') doc.font('Helvetica-Bold').text('X', 461, ccY + 34, { width: 6, align: 'center', fontSize: 6 });
      else if (tipoPagoStr === 'ÚNICO PAGO' || tipoPagoStr === 'UNICO PAGO') doc.font('Helvetica-Bold').text('X', 406, ccY + 34, { width: 6, align: 'center', fontSize: 6 });
      else if (tipoPagoStr === 'FONDO FIJO') doc.font('Helvetica-Bold').text('X', 511, ccY + 34, { width: 6, align: 'center', fontSize: 6 });

      // --- DATOS DEL PROVEEDOR ---
      const provY = ccY + 55;
      doc.rect(30, provY, 535, 12).fill('#F2F2F2').stroke();
      doc.fillColor('#000000').font('Helvetica-Bold').text('DATOS DEL PROVEEDOR', 30, provY + 3, { width: 535, align: 'center' });

      const provBoxYInitial = provY + 12;
      let currentY = provBoxYInitial;
      doc.fontSize(7); // Consistencia en tamaño de fuente

      // Determinar altura de campos dinámicos
      const infoPagoWidth = 310;
      const dirWidth = 425;

      const dirText = proveedor.direccionFiscal || proveedor.direccion || '';
      const hDir = Math.max(15, doc.heightOfString(dirText, { width: dirWidth }) + 5);

      // Lógica flexible para datos bancarios
      let infoPago = '';
      if (solicitud.metodoPago.toUpperCase() !== 'EFECTIVO') {
        if (datosBancarios.coordenadas) {
          infoPago = datosBancarios.coordenadas;
        } else if (datosBancarios.banco || datosBancarios.cuenta) {
          infoPago = `${datosBancarios.banco || ''} - ${datosBancarios.cuenta || ''}`;
        } else if (proveedor.banco || proveedor.cuenta) {
          infoPago = `${proveedor.banco || ''} - ${proveedor.cuenta || ''}`;
        }
      } else {
        infoPago = 'PAGO EN EFECTIVO';
      }
      const hPago = Math.max(15, doc.heightOfString(infoPago, { width: infoPagoWidth }) + 5);

      // Dibujar Filas con alturas ajustadas
      // Fila 1: Razón Social
      doc.font('Helvetica-Bold').text('RAZÓN SOCIAL (PERSONA NATURAL O JURÍDICA):', 35, currentY + 4);
      doc.font('Helvetica').text(proveedor.razonSocial || '', 250, currentY + 4);
      currentY += 15;
      doc.moveTo(30, currentY).lineTo(565, currentY).stroke();

      // Fila 2: RIF
      doc.font('Helvetica-Bold').text('RIF / C.I:', 35, currentY + 4);
      doc.font('Helvetica').text(proveedor.rif || '', 100, currentY + 4);
      currentY += 15;
      doc.moveTo(30, currentY).lineTo(565, currentY).stroke();

      // Fila 3: Dirección Fiscal (DYNAMICA)
      doc.font('Helvetica-Bold').text('DIRECCIÓN FISCAL:', 35, currentY + 4);
      doc.font('Helvetica').text(dirText, 140, currentY + 4, { width: dirWidth });
      currentY += hDir;
      doc.moveTo(30, currentY).lineTo(565, currentY).stroke();

      // Fila 4: Teléfono y Correo
      doc.font('Helvetica-Bold').text('TELÉFONO:', 35, currentY + 4);
      doc.font('Helvetica').text(proveedor.telefono || '', 100, currentY + 4);
      doc.font('Helvetica-Bold').text('CORREO ELECTRÓNICO:', 250, currentY + 4);
      doc.font('Helvetica').text(proveedor.email || '', 360, currentY + 4);
      currentY += 15;
      doc.moveTo(30, currentY).lineTo(565, currentY).stroke();

      // Fila 5: Datos de Pago (DYNAMICA)
      doc.font('Helvetica-Bold').text('DATOS PARA EL PAGO (BANCO/CUENTA/COORDINADAS):', 35, currentY + 4, { width: 220 });
      doc.font('Helvetica').text(infoPago, 255, currentY + 4, { width: infoPagoWidth });
      currentY += hPago;

      // Dibujar el recuadro exterior usando la altura final calculada
      doc.rect(30, provBoxYInitial, 535, currentY - provBoxYInitial).stroke();

      // --- SECCIÓN DE AUTORIZACIÓN ---
      const autY = currentY + 5;
      doc.rect(30, autY, 535, 12).fill('#F2F2F2').stroke();
      doc.fillColor('#000000').font('Helvetica-Bold').text('AUTORIZACIÓN', 30, autY + 3, { width: 535, align: 'center' });

      const autBoxY = autY + 12;
      doc.rect(30, autBoxY, 535, 150).stroke(); // Altura aumentada a 150
      doc.moveTo(208, autBoxY).lineTo(208, autBoxY + 150).stroke();
      doc.moveTo(386, autBoxY).lineTo(386, autBoxY + 150).stroke();
      // Líneas horizontales: más espacio para Unidad de adscripción (55 a 105 = 50px)
      [30, 55, 105].forEach(h => doc.moveTo(30, autBoxY + h).lineTo(565, autBoxY + h).stroke());

      doc.text('Elaborado por:', 35, autBoxY + 10);
      doc.text('Autorizado por:', 213, autBoxY + 10);
      doc.text('Aprobado por:', 391, autBoxY + 10);

      doc.text('Cargo:', 35, autBoxY + 35);
      doc.text('Cargo:', 213, autBoxY + 35);
      doc.text('Cargo:', 391, autBoxY + 35);

      doc.text('Unidad de adscripción:', 35, autBoxY + 60);
      doc.text('Unidad de adscripción:', 213, autBoxY + 60);
      doc.text('Unidad de adscripción:', 391, autBoxY + 60);

      doc.text('Firma y sello:', 35, autBoxY + 110);
      doc.text('Firma y sello:', 213, autBoxY + 110);
      doc.text('Firma y sello:', 391, autBoxY + 110);

      // Datos de las firmas con límites de ancho para evitar solapamiento
      doc.font('Helvetica').fontSize(7);
      const colWidth = 105; // Ancho máximo por columna

      if (elaboradoPor) {
        doc.text(elaboradoPor.nombre || '', 100, autBoxY + 10, { width: colWidth });
        doc.text(elaboradoPor.cargo || elaboradoPor.rol || '', 75, autBoxY + 35, { width: 125 });
        doc.text(elaboradoPor.departamento || '', 35, autBoxY + 70, { width: 165 });
      }

      if (autorizadoPor) {
        doc.text(autorizadoPor.nombre || '', 280, autBoxY + 10, { width: colWidth });
        doc.text(autorizadoPor.cargo || autorizadoPor.rol || '', 250, autBoxY + 35, { width: 125 });
        doc.text(autorizadoPor.departamento || '', 213, autBoxY + 70, { width: 165 });
      }

      if (procesadoPor) {
        doc.text(procesadoPor.nombre || '', 450, autBoxY + 10, { width: colWidth });
        doc.text(procesadoPor.cargo || procesadoPor.rol || '', 430, autBoxY + 35, { width: 125 });
        doc.text(procesadoPor.departamento || '', 391, autBoxY + 70, { width: 165 });
      }


      // --- CÓDIGO DE BARRAS (CENTRADOS DESPUÉS DE LA ÚLTIMA LÍNEA) ---
      try {
        const barcodeBuffer = await new Promise((resolve, xreject) => {
          bwipjs.toBuffer({
            bcid: 'code128',
            text: solicitud.correlativo || 'N/A',
            scale: 3,
            height: 10,
            includetext: false,
            textxalign: 'center',
          }, (err, buffer) => {
            if (err) xreject(err);
            else resolve(buffer);
          });
        });

        const barcodeWidth = 140;
        const barcodeX = (595 - barcodeWidth) / 2; // Centrado en A4 (595px)
        const barcodeY = autBoxY + 160; // Ajustado para dar espacio al cuadro de 150 de alto

        doc.image(barcodeBuffer, barcodeX, barcodeY, { width: barcodeWidth });

        // Texto del correlativo debajo del código de barras
        doc.fontSize(8).font('Helvetica').text(solicitud.correlativo, 0, barcodeY + 35, {
          align: 'center',
          width: 595
        });

      } catch (err) {
        console.error('[BARCODE PDF ERROR]:', err);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Genera un buffer con el PDF consolidado (Formulario + Comprobante + Soportes)
   */
  async generarBufferConsolidado(solicitud) {
    try {
      const mergedPdf = await PDFLibDocument.create();

      // 1. Generar el Formulario Base (como Buffer)
      const formBuffer = await this.generarFormularioBuffer(solicitud);
      const formPdf = await PDFLibDocument.load(formBuffer);
      const formPages = await mergedPdf.copyPages(formPdf, formPdf.getPageIndices());
      formPages.forEach(p => mergedPdf.addPage(p));

      // 2. Agregar Comprobante de Pago (si existe y es PDF)
      if (solicitud.comprobantePago && solicitud.comprobantePago.toLowerCase().endsWith('.pdf')) {
        try {
          const voucherPath = path.resolve(process.cwd(), solicitud.comprobantePago);
          if (fs.existsSync(voucherPath)) {
            const voucherBuffer = fs.readFileSync(voucherPath);
            const voucherPdf = await PDFLibDocument.load(voucherBuffer);
            const voucherPages = await mergedPdf.copyPages(voucherPdf, voucherPdf.getPageIndices());
            voucherPages.forEach(p => mergedPdf.addPage(p));
          }
        } catch (e) { console.error('[MERGE] Error al agregar Comprobante:', e.message); }
      }

      // 3. Agregar Soportes - parsear por si viene como string doble-codificado
      let soportes = solicitud.soportes;
      while (typeof soportes === 'string') {
        try { soportes = JSON.parse(soportes); } catch (e) { soportes = []; break; }
      }
      if (!Array.isArray(soportes)) soportes = [];

      for (const sop of soportes) {
        if (!sop.ruta) continue;
        const rutaLower = sop.ruta.toLowerCase();
        const cleanPath = sop.ruta.startsWith('/') ? sop.ruta.substring(1) : sop.ruta;
        const sopPath = path.resolve(process.cwd(), cleanPath);
        if (!fs.existsSync(sopPath)) { console.warn(`[MERGE] No encontrado: ${sopPath}`); continue; }
        try {
          const sopBuffer = fs.readFileSync(sopPath);
          if (rutaLower.endsWith('.pdf') || sop.tipo === 'application/pdf') {
            const sopPdf = await PDFLibDocument.load(sopBuffer);
            const sopPages = await mergedPdf.copyPages(sopPdf, sopPdf.getPageIndices());
            sopPages.forEach(p => mergedPdf.addPage(p));
          } else if (rutaLower.endsWith('.jpg') || rutaLower.endsWith('.jpeg') || sop.tipo === 'image/jpeg') {
            const img = await mergedPdf.embedJpg(sopBuffer);
            const page = mergedPdf.addPage();
            const { width, height } = page.getSize();
            const sc = img.scaleToFit(width - 40, height - 40);
            page.drawImage(img, { x: (width - sc.width) / 2, y: (height - sc.height) / 2, width: sc.width, height: sc.height });
          } else if (rutaLower.endsWith('.png') || rutaLower.endsWith('.webp') || sop.tipo === 'image/png' || sop.tipo === 'image/webp') {
            const img = await mergedPdf.embedPng(sopBuffer);
            const page = mergedPdf.addPage();
            const { width, height } = page.getSize();
            const sc = img.scaleToFit(width - 40, height - 40);
            page.drawImage(img, { x: (width - sc.width) / 2, y: (height - sc.height) / 2, width: sc.width, height: sc.height });
          }
        } catch (errSop) { console.error(`[MERGE] Error en ${sop.nombre || sop.ruta}: ${errSop.message}`); }
      }

      return await mergedPdf.save();
    } catch (error) {
      console.error('[CONSOLIDADO ERROR CRÍTICO]:', error);
      throw error;
    }
  }

  /**
   * Versión buffer de generarPDF (Sin respuesta HTTP)
   */
  async generarFormularioBuffer(solicitud) {
    return new Promise(async (resolve, reject) => {
      try {
        const elaboradoPor = await Usuario.findByPk(solicitud.elaboradoPor, { attributes: ['id', 'nombre', 'email', 'cargo', 'departamento'] });
        const autorizadoPor = solicitud.autorizadoPor ? await Usuario.findByPk(solicitud.autorizadoPor, { attributes: ['id', 'nombre', 'email', 'cargo', 'departamento'] }) : null;
        const procesadoPor = solicitud.procesadoPor ? await Usuario.findByPk(solicitud.procesadoPor, { attributes: ['id', 'nombre', 'email', 'cargo', 'departamento'] }) : null;

        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        const buffers = [];

        doc.on('data', b => buffers.push(b));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        await this._dibujarContenidoPDF(doc, solicitud, elaboradoPor, autorizadoPor, procesadoPor);
        doc.end();
      } catch (e) { reject(e); }
    });
  }


  /**
   * Exporta masivamente las solicitudes a Excel, CSV o PDF
   */
  /**
   * Exporta masivamente las solicitudes a Excel, CSV o PDF
   * Adaptado al formato solicitado: OBSERVAC., CÓDIGO, FECHA, DEPARTAMENTO, 
   * UNIDAD/CENTRO, O/C, PROVEEDOR, MONTO ($, BS, EUROS), MÉTODO, PAGO, STATUS.
   * Incluye colores según leyenda de imagen.
   */
  async exportarDatos(req, res) {
    try {
      if (req.usuario.rol?.toLowerCase() !== 'administrador' && req.usuario.rol?.toLowerCase() !== 'gestor') {
        return res.status(403).json({ error: 'No tiene permisos para exportar datos' });
      }

      const { formato = 'xlsx', estatus, desde, hasta } = req.query;
      const where = {};

      // Restricción por departamento (Gestores y otros roles no admin)
      if (req.usuario.rol?.toLowerCase() !== 'administrador') {
        const esGestor = req.usuario.rol?.toLowerCase() === 'gestor';
        let departamentosParaFiltrar = [req.usuario.departamento];

        const parseJsonArray = (val) => {
          let parsed = val;
          while (typeof parsed === 'string' && parsed.trim().startsWith('[')) {
            try { parsed = JSON.parse(parsed); } catch (e) { break; }
          }
          return Array.isArray(parsed) ? parsed : [];
        };

        if (esGestor && req.usuario.departamentosAutorizados) {
          const extras = parseJsonArray(req.usuario.departamentosAutorizados);
          departamentosParaFiltrar = [...new Set([...departamentosParaFiltrar, ...extras])];
        }
        where.unidadSolicitante = { [Op.in]: departamentosParaFiltrar };
      }



      if (estatus) where.estatus = estatus;

      if (desde && hasta) {
        where.createdAt = {
          [Op.between]: [new Date(desde), new Date(`${hasta}T23:59:59.999Z`)]
        };
      }

      // Obtener todas las solicitudes filtradas
      const solicitudes = await Solicitud.findAll({ where, order: [['createdAt', 'DESC']] });

      // Preparar los datos mapeados al nuevo formato con colores
      const datosExportacion = await Promise.all(solicitudes.map(async sol => {
        let proveedor = sol.proveedor || {};
        if (typeof proveedor === 'string') {
          try { proveedor = JSON.parse(proveedor); } catch (e) { proveedor = {}; }
        }

        const monto = parseFloat(sol.montoTotal);
        const moneda = sol.moneda;

        // Mapeo de Estatus y Colores según la imagen proporcionada
        let visualStatus = sol.estatus.toUpperCase();
        let colorHex = null; // No color by default

        // Lógica de mapeo a leyenda
        if (sol.estatus === 'Creado' || sol.estatus === 'Pendiente') {
          visualStatus = 'PENDIENTE';
          colorHex = '#FFCCCC'; // Rosa/Rojo claro
        } else if (sol.estatus === 'Aprobado') {
          visualStatus = 'EN PROCESO';
          colorHex = '#CCFFFF'; // Cyan claro
        } else if (sol.estatus === 'Pagado') {
          visualStatus = 'PAGADO';
          colorHex = '#CCFFCC'; // Verde claro
        } else if (sol.tipoPago === 'Anticipo') {
          visualStatus = 'ANTICIPO';
          colorHex = '#FFFFCC'; // Amarillo claro
        } else if (sol.estatus === 'Rechazado' || sol.estatus === 'Anulado') {
          visualStatus = 'CERRADO';
          colorHex = '#CCE5FF'; // Azul claro
        }

        return {
          'OBSERVAC.': sol.observaciones || sol.conceptoPago,
          'CÓDIGO': sol.correlativo,
          'FECHA': sol.fechaSolicitud ? new Date(sol.fechaSolicitud).toLocaleDateString() : '',
          'DEPARTAMENTO': sol.unidadSolicitante,
          'UNIDAD SOLICITANTE / CENTRO DE COSTO': sol.centroCosto,
          'ORDEN DE COMPRA': sol.numeroRequerimiento || '',
          'PROVEEDOR': proveedor.razonSocial || '',
          'MONTO ($)': (moneda === 'USD') ? monto : null,
          'MONTO (BS)': (moneda === 'Bs') ? monto : null,
          'MONTO (EUROS)': (moneda === 'EUR') ? monto : null,
          'METODO DE PAGO': sol.metodoPago,
          'FECHA PAGO': sol.fechaPago ? new Date(sol.fechaPago).toLocaleDateString() : '',
          'STATUS': visualStatus,
          '_color': colorHex
        };
      }));

      // EXPORTACIÓN A EXCEL
      if (formato === 'xlsx') {
        const XLSX = require('xlsx');
        const wb = XLSX.utils.book_new();
        // Quitamos la propiedad _color para que no salga en el Excel
        const excelData = datosExportacion.map(({ _color, ...rest }) => rest);
        const ws = XLSX.utils.json_to_sheet(excelData);

        ws['!cols'] = [
          { wch: 35 }, { wch: 22 }, { wch: 12 }, { wch: 20 }, { wch: 25 },
          { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
          { wch: 20 }, { wch: 12 }, { wch: 15 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Reporte de Pagos');
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', `attachment; filename=Reporte_AVANTE_${new Date().getTime()}.xlsx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        return res.send(buffer);

      }

      // EXPORTACIÓN A PDF (DIBUJO MANUAL - MANEJO CORRECTO DE PAGINACIÓN)
      else if (formato === 'pdf') {
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ margin: 20, size: 'A4', layout: 'landscape', autoFirstPage: true });

        doc.on('error', (err) => {
          console.error('[EXPORT PDF STREAM ERROR]:', err);
          if (!res.headersSent) res.status(500).json({ error: 'Error en flujo PDF' });
          else res.end();
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Reporte_AVANTE_${new Date().getTime()}.pdf`);
        doc.pipe(res);

        // --- CONSTANTES DE LAYOUT ---
        const MX = 20;           // margen horizontal
        const MY = 20;           // margen vertical
        const FONT_SZ = 6.5;     // tamaño de fuente
        const ROW_H = 18;        // altura fija de cada fila de datos
        const HEADER_H = 20;     // altura del encabezado de columnas
        const PAGE_H = 595.28;   // alto de A4 landscape en puntos
        const PAD = 3;            // padding interno de celda
        const BLUE = '#1b4f72';
        const BORDER = '#CCCCCC';
        const TABLE_W = 775;

        const cols = [
          { label: 'OBSERV.',  key: 'OBSERVAC.',                                    width: 100 },
          { label: 'CÓDIGO',   key: 'CÓDIGO',                                        width: 75  },
          { label: 'FECHA',    key: 'FECHA',                                          width: 48  },
          { label: 'DEP.',     key: 'DEPARTAMENTO',                                   width: 75  },
          { label: 'C.COSTO',  key: 'UNIDAD SOLICITANTE / CENTRO DE COSTO',           width: 90  },
          { label: 'O/C',      key: 'ORDEN DE COMPRA',                                width: 48  },
          { label: 'PROVEEDOR',key: 'PROVEEDOR',                                      width: 90  },
          { label: '($)',      key: 'MONTO ($)',    width: 50, align: 'right' },
          { label: '(BS)',     key: 'MONTO (BS)',   width: 50, align: 'right' },
          { label: '(€)',      key: 'MONTO (EUROS)',width: 45, align: 'right' },
          { label: 'PAGO',     key: 'FECHA PAGO',                                     width: 48  },
          { label: 'STATUS',   key: 'STATUS',                                          width: 56  }
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

        // --- FUNCIÓN: dibujar una fila de datos ---
        const drawDataRow = (rowValues, rowColor, y) => {
          // Fondo de la fila
          doc.rect(MX, y, TABLE_W, ROW_H).fill(rowColor || '#FFFFFF');
          // Borde de la fila
          doc.rect(MX, y, TABLE_W, ROW_H).stroke(BORDER);
          // Texto de cada celda
          let x = MX;
          doc.fontSize(FONT_SZ).font('Helvetica').fillColor('#000000');
          rowValues.forEach((cellText, i) => {
            const col = cols[i];
            // Limpiar saltos de línea y caracteres de control del texto
            const cleanText = String(cellText != null ? cellText : '').replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
            doc.text(cleanText, x + PAD, y + 5, {
              width: col.width - PAD * 2,
              align: col.align || 'left',
              lineBreak: false,
              ellipsis: true
            });
            x += col.width;
          });
          return y + ROW_H;
        };

        // --- BRANDING Y TÍTULO ---
        const logoPath = path.join(__dirname, '../frontend/src/assets/logo.png');
        try {
          if (fs.existsSync(logoPath)) doc.image(logoPath, MX, MY, { width: 80 });
        } catch (e) {}

        doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000')
           .text('REPORTE GENERAL DE SOLICITUDES', 0, MY + 10, { align: 'center' });

        let subheader = `Generado el: ${new Date().toLocaleDateString()}`;
        if (desde && hasta) {
          subheader = `Periodo: ${new Date(desde).toLocaleDateString()} al ${new Date(hasta).toLocaleDateString()} | ${subheader}`;
        }
        doc.fontSize(8).font('Helvetica').fillColor('#000000').text(subheader, { align: 'right' });
        doc.moveDown(0.5);

        // --- TABLA ---
        let currentY = doc.y;
        currentY = drawTableHeader(currentY);

        for (let i = 0; i < datosExportacion.length; i++) {
          const d = datosExportacion[i];

          // Si la fila no cabe en la página actual, saltar a la siguiente
          if (currentY + ROW_H > PAGE_H - 45) {
            doc.addPage();
            currentY = MY;
            doc.fontSize(8).font('Helvetica-Oblique').fillColor('#666666')
               .text('REPORTE GENERAL DE SOLICITUDES (continuación)', MX, currentY);
            currentY += 13;
            currentY = drawTableHeader(currentY);
          }

          const rowValues = [
            d['OBSERVAC.']                                    || '',
            d['CÓDIGO']                                        || '',
            d['FECHA']                                         || '',
            d['DEPARTAMENTO']                                  || '',
            d['UNIDAD SOLICITANTE / CENTRO DE COSTO']          || '',
            d['ORDEN DE COMPRA']                               || '',
            d['PROVEEDOR']                                     || '',
            d['MONTO ($)']     != null ? d['MONTO ($)'].toFixed(2)     : '',
            d['MONTO (BS)']    != null ? d['MONTO (BS)'].toFixed(2)    : '',
            d['MONTO (EUROS)'] != null ? d['MONTO (EUROS)'].toFixed(2) : '',
            d['FECHA PAGO']                                    || '',
            d['STATUS']                                        || ''
          ];

          currentY = drawDataRow(rowValues, d._color, currentY);
        }

        doc.end();
      } else {
        res.status(400).json({ error: 'Formato no soportado' });
      }
    } catch (error) {
      console.error('[EXPORT ERROR]:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error al exportar datos' });
      }
    } finally {
      // Incrementar contador de operaciones
      await sistemaService.incrementarOperaciones();
    }
  }


  /**
   * Agrega un comentario (Chat interno) a una solicitud
   */
  async agregarComentario(req, res) {
    try {
      const { id } = req.params;
      const { mensaje } = req.body;

      const solicitud = await Solicitud.findByPk(id);
      if (!solicitud) return res.status(404).json({ error: 'No existe la solicitud' });

      const parseJsonArray = (val) => {
        let parsed = val;
        while (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); } catch (e) { break; }
        }
        return Array.isArray(parsed) ? parsed : [];
      };

      const comentariosParsed = parseJsonArray(solicitud.comentarios);
      const nuevosComentarios = [...comentariosParsed];
      nuevosComentarios.push({
        usuario: req.usuario.id,
        fecha: new Date(),
        mensaje
      });
      solicitud.comentarios = nuevosComentarios;
      await solicitud.save();

      res.json({ mensaje: 'Comentario agregado' });

      // Incrementar contador de operaciones
      await sistemaService.incrementarOperaciones();

    } catch (error) {
      res.status(500).json({ error: 'Error al comentar' });
    }
  }

  /**
   * Genera el reporte especial "RELACIÓN DE SOLICITUDES" (Personalizado)
   * Agrupado por Unidad/Buque con subtotales, según formato solicitado.
   */
  async reporteRelacionPersonalizada(req, res) {
    try {
      if (req.usuario.rol?.toLowerCase() !== 'administrador' && req.usuario.rol?.toLowerCase() !== 'gestor') {
        return res.status(403).json({ error: 'No tiene permisos para este reporte' });
      }

      console.log('[REPORTE DEBUG] Iniciando búsqueda de solicitudes...');
      const { desde, hasta, estatus } = req.query;
      
      const where = {};
      
      if (estatus) {
        const estatusArray = estatus.split(',').map(s => s.trim());
        where.estatus = { [Op.in]: estatusArray };
      }

      // Restricción por departamento (Gestores y otros roles no admin)
      if (req.usuario.rol?.toLowerCase() !== 'administrador') {
        const esGestor = req.usuario.rol?.toLowerCase() === 'gestor';
        let departamentosParaFiltrar = [req.usuario.departamento];

        const parseJsonArray = (val) => {
          let parsed = val;
          while (typeof parsed === 'string' && parsed.trim().startsWith('[')) {
            try { parsed = JSON.parse(parsed); } catch (e) { break; }
          }
          return Array.isArray(parsed) ? parsed : [];
        };

        if (esGestor && req.usuario.departamentosAutorizados) {
          const extras = parseJsonArray(req.usuario.departamentosAutorizados);
          departamentosParaFiltrar = [...new Set([...departamentosParaFiltrar, ...extras])];
        }
        where.unidadSolicitante = { [Op.in]: departamentosParaFiltrar };
      }

      if (desde && hasta) {
        // Asumimos createdAt para la fecha de cruce
        where.createdAt = {
          [Op.between]: [new Date(desde), new Date(`${hasta}T23:59:59.999Z`)]
        };
      }

      const solicitudes = await Solicitud.findAll({
        where,
        order: [['unidadSolicitante', 'ASC'], ['createdAt', 'ASC']]
      });
      console.log(`[REPORTE DEBUG] Solicitudes encontradas: ${solicitudes.length}`);

      // 2. Agrupar por Unidad/Buque
      const grupos = {};
      solicitudes.forEach(sol => {
        const unidad = sol.unidadSolicitante || 'SIN UNIDAD';
        if (!grupos[unidad]) grupos[unidad] = [];
        grupos[unidad].push(sol);
      });
      console.log(`[REPORTE DEBUG] Grupos generados: ${Object.keys(grupos).length}`);

      const PDFTable = require('pdfkit-table');
      console.log('[REPORTE DEBUG] PDFTable cargado');
      const doc = new PDFTable({ margin: 20, size: 'A4', layout: 'landscape' });

      doc.on('error', (err) => {
        console.error('[REPORT STREAM ERROR]:', err);
        if (!res.headersSent) res.status(500).json({ error: 'Error en flujo PDF' });
        else res.end();
      });

      const filename = `Relacion_Solicitudes_${new Date().getTime()}.pdf`;
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.setHeader('Content-Type', 'application/pdf');
      doc.pipe(res);

      // --- BRANDING Y TÍTULO ---
      const logoPath = path.join(__dirname, '../frontend/src/assets/logo.png');
      try {
        if (fs.existsSync(logoPath)) doc.image(logoPath, 20, 20, { width: 70 });
      } catch (e) { }

      doc.fontSize(14).font('Helvetica-Bold').text('RELACIÓN DE SOLICITUDES', 0, 30, { align: 'center' });

      let subheader = `Fecha de Corte: ${new Date().toLocaleDateString()}`;
      if (desde && hasta) {
        subheader = `Periodo: ${new Date(desde).toLocaleDateString()} al ${new Date(hasta).toLocaleDateString()} | ${subheader}`;
      }
      doc.fontSize(8).font('Helvetica').text(subheader, { align: 'right' });
      doc.moveDown(2);

      // --- CONSTRUCCIÓN DE TABLAS POR GRUPO ---
      const blueHeader = '#1b4f72';
      let isFirstUnidad = true;

      for (const unidad in grupos) {
        console.log(`[REPORTE DEBUG] Procesando unidad: ${unidad}`);
        const items = grupos[unidad];
        let subtotalFila = 0;

        try {
          if (!isFirstUnidad && doc.y > 450) {
            doc.addPage();
          } else if (!isFirstUnidad) {
            doc.moveDown(2);
          }
          isFirstUnidad = false;

          doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text(`BUQUE/UNIDAD: ${unidad.toUpperCase()}`, 20);
          doc.moveDown(0.5);

          const table = {
            headers: [
              { label: 'Descripción', property: 'descripcion', width: 145, headerColor: blueHeader, headerOpacity: 1 },
              { label: 'Buque/Unidad', property: 'unidad', width: 70, headerColor: blueHeader, headerOpacity: 1 },
              { label: 'Código O/C', property: 'oc', width: 70, headerColor: blueHeader, headerOpacity: 1 },
              { label: 'Monto en $', property: 'monto', width: 60, align: 'right', headerColor: blueHeader, headerOpacity: 1 },
              { label: 'Método de pago', property: 'metodo', width: 70, headerColor: blueHeader, headerOpacity: 1 },
              { label: 'Transferencia', property: 'moneda', width: 65, headerColor: blueHeader, headerOpacity: 1 },
              { label: 'Proveedor', property: 'proveedor', width: 80, headerColor: blueHeader, headerOpacity: 1 },
              { label: 'Fecha inc.', property: 'fecha', width: 55, headerColor: blueHeader, headerOpacity: 1 },
              { label: 'Comprador', property: 'comprador', width: 65, headerColor: blueHeader, headerOpacity: 1 },
              { label: 'Estatus', property: 'estatus', width: 70, headerColor: blueHeader, headerOpacity: 1 }
            ],
            rows: await Promise.all(items.map(async sol => {
              const monto = parseFloat(sol.montoTotal);
              subtotalFila += monto;

              let prov = {};
              try {
                prov = typeof sol.proveedor === 'string' ? JSON.parse(sol.proveedor) : (sol.proveedor || {});
              } catch (e) {
                console.error(`[REPORTE ERROR] Error parseando proveedor en solicitud ${sol.id}`);
              }

              const elaborado = await Usuario.findByPk(sol.elaboradoPor, { attributes: ['nombre'] });

              return [
                (sol.conceptoPago || '').substring(0, 100),
                sol.unidadSolicitante || 'N/A',
                sol.numeroRequerimiento || sol.correlativo || 'N/A',
                monto.toLocaleString('es-VE', { minimumFractionDigits: 2 }),
                sol.metodoPago || 'N/A',
                sol.moneda === 'Bs' ? 'BOLIVARES' : (sol.moneda === 'USD' ? 'DIVISAS' : (sol.moneda || 'N/A')),
                prov.razonSocial ? prov.razonSocial.substring(0, 30) : 'N/A',
                sol.fechaSolicitud ? new Date(sol.fechaSolicitud).toLocaleDateString() : 'N/A',
                elaborado ? elaborado.nombre.toUpperCase() : 'N/A',
                (sol.estatus || 'N/A').toUpperCase()
              ];
            }))
          };

          await doc.table(table, {
            prepareHeader: () => doc.font('Helvetica-Bold').fontSize(7).fillColor('#FFFFFF'),
            prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
              doc.font('Helvetica').fontSize(7).fillColor('#000000');
            },
            padding: 5,
            hideHeader: false,
            minRowHeight: 15
          });

          // --- FILA DE SUBTOTAL POR UNIDAD ---
          if (doc.y > 500) doc.addPage();

          const currentY = doc.y;
          doc.rect(20, currentY, 775, 18).fill(blueHeader).stroke();
          doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
          doc.text(`Subtotal ${unidad}: ${subtotalFila.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, 25, currentY + 5);
          doc.moveDown(2);
          console.log(`[REPORTE DEBUG] Unidad ${unidad} finalizada`);
        } catch (e) {
          console.error(`[REPORTE ERROR] Error procesando tabla de unidad ${unidad}:`, e.message);
          throw e;
        }
      }

      doc.end();
      console.log('[REPORTE DEBUG] PDF finalizado exitosamente');

    } catch (error) {
      console.error('[REPORTE ERROR]:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error al generar reporte de relacion' });
      }
    } finally {
      // Incrementar contador de operaciones
      await sistemaService.incrementarOperaciones();
    }
  }

  /**
   * Actualiza los datos de una solicitud existente (Solo si está en estado editable)
   */
  async actualizar(req, res) {
    try {
      const { id } = req.params;
      const data = req.body;

      const solicitud = await Solicitud.findByPk(id);
      if (!solicitud) {
        return res.status(404).json({ error: 'Solicitud no encontrada' });
      }

      // Solo se puede editar si está en 'Pendiente', 'Devuelto' o 'Anulado'
      if (solicitud.estatus !== 'Pendiente' && solicitud.estatus !== 'Devuelto' && solicitud.estatus !== 'Anulado') {
        return res.status(400).json({
          error: 'No se puede editar una solicitud que ya está en proceso o finalizada'
        });
      }

      // Permisos: Solo el dueño, un Administrador o un Gestor
      const esAdminOGestor = ['administrador', 'gestor'].includes(req.usuario.rol?.toLowerCase());
      const esPropietario = Number(solicitud.elaboradoPor) === Number(req.usuario.id);

      if (!esAdminOGestor && !esPropietario) {
        return res.status(403).json({ error: 'No tiene permisos para editar esta solicitud' });
      }

      // Procesar campos JSON si vienen como string (como en la creación)
      if (data.proveedor && typeof data.proveedor === 'string') data.proveedor = JSON.parse(data.proveedor);
      if (data.datosBancarios && typeof data.datosBancarios === 'string') data.datosBancarios = JSON.parse(data.datosBancarios);
      if (data.tiposSoporte && typeof data.tiposSoporte === 'string') {
        try {
          data.tiposSoporte = JSON.parse(data.tiposSoporte);
        } catch (e) {
          // Si no es un JSON válido, lo guardamos como un arreglo con ese valor único
          data.tiposSoporte = [data.tiposSoporte];
        }
      }

      // Campos permitidos para actualizar
      const camposPermitidos = [
        'numeroRequerimiento', 'fechaLimiteRequerida', 'nivelPrioridad',
        'conceptoPago', 'observaciones', 'centroCosto', 'proveedor',
        'metodoPago', 'datosBancarios', 'tipoPago', 'montoTotal', 'moneda',
        'tiposSoporte', 'numeroOrdenCompra'
      ];

      camposPermitidos.forEach(campo => {
        if (data[campo] !== undefined) {
          solicitud[campo] = data[campo];
        }
      });

      // Si estaba en 'Devuelto' o 'Anulado', al guardar vuelve a 'Pendiente' para re-procesar
      if (solicitud.estatus === 'Devuelto' || solicitud.estatus === 'Anulado') {
        solicitud.estatus = 'Pendiente';
      }

      // Registrar en el historial
      const parseJsonArray = (val) => {
        let p = val;
        while (typeof p === 'string') {
          try { p = JSON.parse(p); } catch (e) { break; }
        }
        return Array.isArray(p) ? p : [];
      };

      const historial = parseJsonArray(solicitud.historial);
      historial.push({
        fecha: new Date(),
        usuario: req.usuario.id,
        accion: 'Actualización de datos',
        comentario: 'Se modificaron los campos de la solicitud'
      });
      solicitud.historial = historial;

      await solicitud.save();

      res.json({ mensaje: 'Solicitud actualizada exitosamente', solicitud });

      // Incrementar contador de operaciones
      await sistemaService.incrementarOperaciones();

    } catch (error) {
      console.error('[UPDATE ERROR]:', error);
      res.status(500).json({ error: 'Error al actualizar la solicitud', detalles: error.message });
    }
  }

  /**
   * Elimina un soporte específico de la solicitud.
   * - Admin/Auditor: pueden eliminar cualquier soporte en cualquier estado (menos Cerrado)
   * - Solicitante (dueño): puede eliminar sus propios soportes si la solicitud está en Devuelto o Anulado
   */
  async eliminarSoporte(req, res) {
    try {
      const { id, index } = req.params;
      const solicitud = await Solicitud.findByPk(id);

      if (!solicitud) {
        return res.status(404).json({ error: 'Solicitud no encontrada' });
      }

      if (solicitud.estatus === 'Cerrado') {
        return res.status(403).json({ error: 'No se pueden eliminar soportes de una solicitud cerrada' });
      }

      const esAdmin = req.usuario.rol?.toLowerCase() === 'administrador';
      const esAuditor = req.usuario.rol?.toLowerCase() === 'auditor';
      const esDueño = Number(solicitud.elaboradoPor) === Number(req.usuario.id) ||
                      solicitud.unidadSolicitante === req.usuario.departamento;
      const estatusPermitidoParaSolicitante = ['Devuelto', 'Anulado'].includes(solicitud.estatus);

      // Verificar permisos de acceso
      if (!esAdmin && !esAuditor) {
        if (!esDueño) {
          return res.status(403).json({ error: 'No tiene permisos para eliminar soportes de esta solicitud' });
        }
        if (!estatusPermitidoParaSolicitante) {
          return res.status(403).json({ error: 'Solo puede eliminar soportes cuando la solicitud esté Devuelta o Anulada' });
        }
      }

      const parseJsonArray = (val) => {
        let p = val;
        while (typeof p === 'string') {
          try { p = JSON.parse(p); } catch (e) { break; }
        }
        return Array.isArray(p) ? p : [];
      };

      let soportes = parseJsonArray(solicitud.soportes);
      const idx = parseInt(index);

      if (isNaN(idx) || idx < 0 || idx >= soportes.length) {
        return res.status(400).json({ error: 'Índice de soporte inválido' });
      }

      const soporte = soportes[idx];

      // Eliminar archivo físico del servidor
      try {
        const rutaCompleta = path.resolve(soporte.ruta);
        if (fs.existsSync(rutaCompleta)) {
          fs.unlinkSync(rutaCompleta);
        }
      } catch (fsError) {
        console.error('[FS ERROR] No se pudo borrar el archivo físicamente:', fsError.message);
      }

      // Actualizar array e historial
      const nombreArchivo = soporte.nombre;
      soportes.splice(idx, 1);
      solicitud.soportes = soportes;

      const historial = parseJsonArray(solicitud.historial);
      historial.push({
        fecha: new Date(),
        usuario: req.usuario.id,
        accion: 'Soporte Eliminado',
        comentario: `Se eliminó el archivo: ${nombreArchivo}`
      });
      solicitud.historial = historial;

      await solicitud.save();

      res.json({ mensaje: 'Soporte eliminado correctamente', solicitud });

      // Incrementar contador de operaciones
      await sistemaService.incrementarOperaciones();
    } catch (error) {
      console.error('[DELETE SUPPORT ERROR]:', error);
      res.status(500).json({ error: 'Error al eliminar el soporte' });
    }
  }

  /**
   * Obtiene la información de configuración del sistema (Versión y Contador)
   */
  async obtenerSistemaInfo(req, res) {
    try {
      const info = await sistemaService.obtenerInfo();
      const esAdmin = req.usuario.rol?.toLowerCase() === 'administrador';
      
      // Solo el administrador puede ver las operaciones
      const data = {
        version: info.version || '2.5',
        operaciones: esAdmin ? (info.operaciones || '250') : null
      };
      
      res.json(data);
    } catch (error) {
      console.error('[SISTEMA INFO ERROR]:', error);
      res.status(500).json({ error: 'Error al obtener información del sistema' });
    }
  }
}


module.exports = new SolicitudController();
