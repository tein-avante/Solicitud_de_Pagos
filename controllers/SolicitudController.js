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
const DistribucionGasto = require('../models/DistribucionGasto');
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
        proveedor,
        metodoPago,
        datosBancarios,
        montoTotal,
        moneda,
        tiposSoporte,
        tipoPago,
        numeroOrdenCompra,
        distribucionCentros  // Array de distribución de centros de costo
      } = req.body;

      // Validación: La fecha límite no puede ser anterior a hoy
      const fechaActual = new Date();
      
      const fechaParaComparar = new Date(fechaActual);
      fechaParaComparar.setHours(0, 0, 0, 0); // Solo queremos comparar la fecha, no la hora

      const fechaLimite = new Date(fechaLimiteRequerida);
      fechaLimite.setHours(0, 0, 0, 0);

      if (fechaLimite < fechaParaComparar) {
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

      // Crear el registro en la base de datos (usando transacción para garantizar integridad)
      const t = await sequelize.transaction();
      try {
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
        }, { transaction: t });

        // Guardar distribución de centros de costo si se envió
        let distribucionParsed = [];
        if (distribucionCentros) {
          try {
            distribucionParsed = typeof distribucionCentros === 'string'
              ? JSON.parse(distribucionCentros)
              : distribucionCentros;
          } catch (e) { 
            console.error('[PARSE ERROR] Fallo al parsear distribucionCentros:', e.message);
            distribucionParsed = []; 
          }
        }

        // Validación obligatoria de Centros de Costo
        if (!Array.isArray(distribucionParsed) || distribucionParsed.length === 0) {
          await t.rollback();
          return res.status(400).json({ error: 'Debe asignar al menos un Centro de Costo a la solicitud' });
        }

        // VALIDACIÓN DE MONTO TOTAL VS DISTRIBUCIÓN
        const sumaDistribucion = distribucionParsed.reduce((acc, curr) => acc + (parseFloat(curr.monto) || 0), 0);
        const montoTotalNum = parseFloat(montoTotal) || 0;

        if (Math.abs(sumaDistribucion - montoTotalNum) > 0.01) {
          await t.rollback();
          return res.status(400).json({ 
            error: `La suma de los Centros de Costo (${sumaDistribucion.toFixed(2)}) no coincide con el Monto Total (${montoTotalNum.toFixed(2)})` 
          });
        }

        for (const linea of distribucionParsed) {
          if (!linea.centroCostoId) {
            await t.rollback();
            return res.status(400).json({ error: 'Cada línea de distribución debe tener un Centro de Costo asignado' });
          }
          await DistribucionGasto.create({
            solicitudId: nuevaSolicitud.id,
            centroCostoId: linea.centroCostoId,
            monto: parseFloat(linea.monto) || 0,
            porcentaje: parseFloat(linea.porcentaje) || 0,
            descripcion: linea.descripcion || ''
          }, { transaction: t });
        }

        // Actualizar la solicitud con los IDs de Centros de Costo (Sincronización)
        const ids = [...new Set(distribucionParsed.map(d => d.centroCostoId))];
        await nuevaSolicitud.update({ centrosCostoIds: ids }, { transaction: t });

        await t.commit();

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

      } catch (innerError) {
        await t.rollback();
        throw innerError;
      }

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

      // Cargar distribución de centros de costo
      try {
        const distribuciones = await DistribucionGasto.findAll({
          where: { solicitudId: solicitud.id },
          include: [{ model: CentroCosto, foreignKey: 'centroCostoId' }]
        });
        solicitudJson.distribucionCentros = distribuciones.map(d => ({
          id: d.id,
          centroCostoId: d.centroCostoId,
          centroCostoNombre: d.CentroCosto ? d.CentroCosto.nombre : 'N/A',
          monto: parseFloat(d.monto),
          porcentaje: parseFloat(d.porcentaje),
          descripcion: d.descripcion || ''
        }));
      } catch (distErr) {
        console.error('[DISTRIBUCION ERROR] No se pudo cargar distribución:', distErr.message);
        solicitudJson.distribucionCentros = [];
      }

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
      // 1. Validar y normalizar parámetros de paginación
      let { pagina = 1, limite = 10, estatus, proveedorId, unidadSolicitante, centroCostoId } = req.query;
      
      const page = Math.max(1, parseInt(pagina) || 1);
      const limit = Math.max(1, parseInt(limite) || 10);
      const offset = (page - 1) * limit;

      const where = {};
      const esAdmin = req.usuario.rol?.toLowerCase() === 'administrador';
      const esAuditor = req.usuario.rol?.toLowerCase() === 'auditor';

      // 2. Filtros de seguridad por rol
      if (!esAdmin && !esAuditor) {
        const esGestor = req.usuario.rol?.toLowerCase() === 'gestor';
        let departamentosParaFiltrar = [req.usuario.departamento];

        if (esGestor && req.usuario.departamentosAutorizados) {
          const extras = parseJsonArray(req.usuario.departamentosAutorizados);
          departamentosParaFiltrar = [...new Set([...departamentosParaFiltrar, ...extras])];
        }

        where.unidadSolicitante = { [Op.in]: departamentosParaFiltrar };
      }

      // 3. Aplicar filtros de búsqueda con limpieza (.trim())
      // Varias etiquetas separadas por coma → Op.in (misma convención que reportes)
      if (estatus !== undefined && estatus !== null && estatus !== '') {
        const raw = Array.isArray(estatus) ? estatus[0] : estatus;
        const trimmed = String(raw).trim();
        if (trimmed) {
          if (trimmed.includes(',')) {
            const arr = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
            where.estatus = arr.length === 1 ? arr[0] : { [Op.in]: arr };
          } else {
            where.estatus = trimmed;
          }
        }
      }

      if (proveedorId) {
        where[Op.and] = where[Op.and] || [];
        where[Op.and].push(
          sequelize.where(
            sequelize.fn('JSON_EXTRACT', sequelize.col('proveedor'), sequelize.literal(`'$.id'`)),
            proveedorId.toString().trim()
          )
        );
      }

      if (unidadSolicitante) {
        where.unidadSolicitante = unidadSolicitante.trim();
      }

      // 4. Configurar Eager Loading (Include) para optimizar rendimiento
      const include = [
        { model: Usuario, as: 'elaborador', attributes: ['nombre'] },
        { model: Usuario, as: 'autorizador', attributes: ['nombre'] },
        { model: Usuario, as: 'procesador', attributes: ['nombre'] }
      ];

      // Filtro por Centro de Costo (Buscando en la nueva columna JSON centrosCostoIds)
      if (centroCostoId) {
        const parsedId = parseInt(centroCostoId);
        if (!isNaN(parsedId)) {
          // Usamos JSON_CONTAINS para verificar si el ID está en el arreglo guardado en la tabla Solicitudes
          where[Op.and] = where[Op.and] || [];
          where[Op.and].push(
            sequelize.fn('JSON_CONTAINS', sequelize.col('centrosCostoIds'), JSON.stringify(parsedId))
          );
        }
      }

      // 5. Ejecutar consulta (Sin límite por página a petición del usuario)
      const { rows: solicitudesRows, count: total } = await Solicitud.findAndCountAll({
        where,
        include,
        distinct: true, 
        order: [['createdAt', 'DESC']]
      });

      // 6. Mapear resultados (los nombres ya vienen en el include)
      const solicitudes = solicitudesRows.map(sol => {
        const solJson = sol.toJSON();
        return {
          ...solJson,
          elaboradoPorNombre: sol.elaborador ? sol.elaborador.nombre : 'N/A',
          autorizadoPorNombre: sol.autorizador ? sol.autorizador.nombre : null,
          procesadoPorNombre: sol.procesador ? sol.procesador.nombre : null,
          // Limpiar objetos de inclusión para reducir tamaño del JSON si no se necesitan
          elaborador: undefined,
          autorizador: undefined,
          procesador: undefined
        };
      });

      res.json({
        solicitudes,
        totalPaginas: 1,
        paginaActual: 1,
        total
      });
    } catch (error) {
      console.error('[LIST ERROR]:', error);
      res.status(500).json({ error: 'Error en el servidor', detalles: error.message });
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
      const enTramite = await Solicitud.count({
        where: { ...where, estatus: 'En Trámite' }
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
        enTramite,
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
        // El Auditor PUEDE DEVOLVER cualquier solicitud o marcar Devolución en compras
        if (esAuditor && (estatus === 'Devuelto' || estatus === 'Devolución en compras')) {
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
        'Pagado': ['En Trámite', 'Cerrado', 'Devolución en compras'],
        'En Trámite': ['Cerrado', 'Devuelto', 'Devolución en compras'],
        'Cerrado': [],
        'Rechazado': [],
        'Devuelto': ['Pendiente'],
        'Anulado': ['Pendiente'],
        'Devolución en compras': ['En Trámite', 'Cerrado']
      };

      const currentStatus = solicitud.estatus?.trim();
      const targetStatus = estatus?.trim();

      if (!transicionesValidas[currentStatus] || !transicionesValidas[currentStatus].includes(targetStatus)) {
        return res.status(400).json({
          error: `No se puede cambiar de ${currentStatus} a ${targetStatus}`
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
        // Validación de seguridad: no permitir pago sin Tasa BCV
        if (!req.body.tasaBCV) {
          return res.status(400).json({ error: 'La Tasa BCV es obligatoria para marcar la solicitud como Pagada' });
        }
        
        solicitud.fechaPago = new Date();
        solicitud.tasaBCV = req.body.tasaBCV;
        
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

      // Cargar distribuciones de centros de costo para la solicitud
      let distribuciones = [];
      try {
        distribuciones = await DistribucionGasto.findAll({
          where: { solicitudId: solicitud.id },
          include: [{ model: CentroCosto, foreignKey: 'centroCostoId' }]
        });
      } catch (e) { distribuciones = []; }

      const tieneDistribucion = distribuciones.length > 0;
      // Altura dinámica: más espacio si hay distribución múltiple
      const ccHeight = tieneDistribucion && distribuciones.length > 1 ? Math.max(50, 20 + distribuciones.length * 12) : 50;

      doc.rect(30, ccY, 535, ccHeight).stroke();
      doc.moveTo(210, ccY).lineTo(210, ccY + ccHeight).stroke(); // Vertical Centro Costo
      doc.moveTo(210, ccY + 20).lineTo(565, ccY + 20).stroke(); // Horizontal Pago/Monto
      doc.moveTo(400, ccY + 20).lineTo(400, ccY + ccHeight).stroke(); // Vertical Método/Tipo

      doc.font('Helvetica-Bold').fontSize(7).text('CENTRO DE COSTO ASIGNADO:', 35, ccY + 5);

      if (tieneDistribucion) {
        // Mostrar listado de centros de costo con su monto (Altura dinámica por cada línea)
        let dyCC = ccY + 12;
        distribuciones.forEach(d => {
          const nombreCC = d.CentroCosto ? d.CentroCosto.nombre.toUpperCase() : 'N/A';
          const montoStr = `${solicitud.moneda} ${parseFloat(d.monto || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
          const pctCC = parseFloat(d.porcentaje || 0).toFixed(1);
          
          const textoLinea = `• ${nombreCC}: ${montoStr} (${pctCC}%)`;
          const altoLinea = doc.heightOfString(textoLinea, { width: 175 });
          
          doc.font('Helvetica').fontSize(6).text(textoLinea, 35, dyCC, { width: 175, align: 'left' });
          dyCC += altoLinea + 2; // Salto dinámico + 2px de margen
        });
      } else {
        doc.font('Helvetica').fontSize(8).text('SIN CENTRO DE COSTO ASIGNADO', 35, ccY + 18);
      }

      // Calcular posición central vertical derecha (para Método/Monto relativo al bloque)
      const ccMidRight = ccY + Math.floor(ccHeight / 2);

      doc.font('Helvetica-Bold').fontSize(7).text('MÉTODO DE PAGO:', 215, ccY + 4);
      doc.font('Helvetica').fontSize(8).text(solicitud.metodoPago, 320, ccY + 4);

      doc.font('Helvetica-Bold').fontSize(7).text('MONTO TOTAL A PAGAR:', 215, ccY + 22);
      doc.font('Helvetica').fontSize(11).text(`${solicitud.moneda} ${parseFloat(solicitud.montoTotal || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`, 215, ccY + 35);

      // Tipo de pago (checkboxes) — posicionados en la parte inferior derecha
      const tipoY = ccY + ccHeight - 18;
      doc.font('Helvetica-Bold').fontSize(6).text('TIPO DE PAGO:', 405, ccY + 4);
      doc.rect(405, tipoY, 7, 7).stroke();
      doc.font('Helvetica').fontSize(6).text('ÚNICO PAGO', 414, tipoY + 1);
      doc.rect(460, tipoY, 7, 7).stroke();
      doc.text('ANTICIPO', 469, tipoY + 1);
      doc.rect(510, tipoY, 7, 7).stroke();
      doc.text('FONDO FIJO', 519, tipoY + 1);

      const tipoPagoStr = (solicitud.tipoPago || '').toUpperCase();
      if (tipoPagoStr === 'ANTICIPO') doc.font('Helvetica-Bold').text('X', 461, tipoY + 1, { width: 6, align: 'center', fontSize: 6 });
      else if (tipoPagoStr === 'ÚNICO PAGO' || tipoPagoStr === 'UNICO PAGO') doc.font('Helvetica-Bold').text('X', 406, tipoY + 1, { width: 6, align: 'center', fontSize: 6 });
      else if (tipoPagoStr === 'FONDO FIJO') doc.font('Helvetica-Bold').text('X', 511, tipoY + 1, { width: 6, align: 'center', fontSize: 6 });

      // --- DATOS DEL PROVEEDOR ---
      // provY usa ccHeight dinámico para no solaparse con distribución múltiple
      const provY = ccY + ccHeight + 5;
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

      // Lógica flexible para datos bancarios estructurados (Pago Móvil, e-pay, Transferencia)
      let infoPago = '';
      const metodo = (solicitud.metodoPago || '').toUpperCase();
      const db = datosBancarios || {};

      if (metodo === 'PAGO MOVIL' || metodo === 'PAGO MÓVIL') {
        infoPago = `PAGO MÓVIL: ${db.bancoPago || db.banco || ''} | Telf: ${db.telefonoPago || ''} | RIF/C.I: ${db.rifPago || ''}`;
      } else if (metodo === 'E-PAY') {
        infoPago = `e-pay: ${db.emailPago || ''}`;
      } else if (metodo === 'TRANSFERENCIA') {
        infoPago = `BANCO: ${db.banco || ''} | CUENTA: ${db.cuenta || ''}`;
      } else if (metodo === 'EFECTIVO') {
        infoPago = 'PAGO EN EFECTIVO';
      } else {
        // Respaldo para datos antiguos en texto plano o campos de proveedor
        if (db.coordenadas) {
          infoPago = db.coordenadas;
        } else if (db.banco || db.cuenta) {
          infoPago = `${db.banco || ''} - ${db.cuenta || ''}`.trim();
        } else if (proveedor.banco || proveedor.cuenta) {
          infoPago = `${proveedor.banco || ''} - ${proveedor.cuenta || ''}`.trim();
        }
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
      doc.font('Helvetica-Bold').text('DATOS PARA EL PAGO (BANCO/CUENTA/COORDENADAS):', 35, currentY + 4, { width: 220 });
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

      // 2. Agregar Comprobante de Pago (PDF o Imagen)
      if (solicitud.comprobantePago) {
        try {
          const cleanVoucherPath = solicitud.comprobantePago.startsWith('/') ? solicitud.comprobantePago.substring(1) : solicitud.comprobantePago;
          const voucherPath = path.resolve(process.cwd(), cleanVoucherPath);
          
          if (fs.existsSync(voucherPath)) {
            const voucherBuffer = fs.readFileSync(voucherPath);
            const voucherLower = voucherPath.toLowerCase();

            if (voucherLower.endsWith('.pdf')) {
              const voucherPdf = await PDFLibDocument.load(voucherBuffer);
              const voucherPages = await mergedPdf.copyPages(voucherPdf, voucherPdf.getPageIndices());
              voucherPages.forEach(p => mergedPdf.addPage(p));
            } else if (voucherLower.endsWith('.jpg') || voucherLower.endsWith('.jpeg')) {
              const img = await mergedPdf.embedJpg(voucherBuffer);
              const page = mergedPdf.addPage();
              const { width, height } = page.getSize();
              const sc = img.scaleToFit(width - 40, height - 40);
              page.drawImage(img, { x: (width - sc.width) / 2, y: (height - sc.height) / 2, width: sc.width, height: sc.height });
            } else if (voucherLower.endsWith('.png') || voucherLower.endsWith('.webp')) {
              const img = await mergedPdf.embedPng(voucherBuffer);
              const page = mergedPdf.addPage();
              const { width, height } = page.getSize();
              const sc = img.scaleToFit(width - 40, height - 40);
              page.drawImage(img, { x: (width - sc.width) / 2, y: (height - sc.height) / 2, width: sc.width, height: sc.height });
            }
          }
        } catch (e) {
          console.error('[MERGE] Error al agregar Comprobante:', e.message);
        }
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
      if (req.usuario.rol?.toLowerCase() !== 'administrador' &&
          req.usuario.rol?.toLowerCase() !== 'gestor' &&
          req.usuario.rol?.toLowerCase() !== 'auditor') {
        return res.status(403).json({ error: 'No tiene permisos para exportar datos' });
      }

      const { formato = 'xlsx', estatus, desde, hasta } = req.query;
      const where = {};

      // Restricción por departamento (Gestores y otros roles no admin/auditor)
      if (req.usuario.rol?.toLowerCase() !== 'administrador' &&
          req.usuario.rol?.toLowerCase() !== 'auditor') {
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

      // Obtener todas las solicitudes filtradas incluyendo su distribución
      const solicitudes = await Solicitud.findAll({ 
        where, 
        include: [{ model: DistribucionGasto, as: 'distribucionCentros', include: [CentroCosto] }],
        order: [['createdAt', 'DESC']] 
      });

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
        if (sol.estatus === 'Anulado') {
          visualStatus = 'ANULADO';
          colorHex = '#CCE5FF'; // Azul claro
        } else if (sol.estatus === 'Creado' || sol.estatus === 'Pendiente') {
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
        } else if (sol.estatus === 'Rechazado') {
          visualStatus = 'CERRADO';
          colorHex = '#CCE5FF'; // Azul claro
        } else if (sol.estatus === 'Devolución en compras') {
          visualStatus = 'DEVOLUCIÓN';
          colorHex = '#FFB366'; // Naranja/Ámbar suave
        }

        return {
          'OBSERVAC.': sol.observaciones || sol.conceptoPago,
          'CÓDIGO': sol.correlativo,
          'FECHA': sol.fechaSolicitud ? new Date(sol.fechaSolicitud).toLocaleDateString() : '',
          'DEPARTAMENTO': sol.unidadSolicitante,
          'CENTRO DE COSTO': sol.distribucionCentros?.map(d => d.CentroCosto?.nombre || 'S/C').join(' / ') || 'N/A',
          'ORDEN DE COMPRA': sol.numeroRequerimiento || '',
          'PROVEEDOR': proveedor.razonSocial || '',
          'MONTO ($)': (moneda === 'USD') ? monto : null,
          'MONTO (BS)': (moneda === 'Bs') ? monto : null,
          'MONTO (EUROS)': (moneda === 'EUR') ? monto : null,
          'METODO DE PAGO': sol.metodoPago,
          'FECHA PAGO': sol.fechaPago ? new Date(sol.fechaPago).toLocaleDateString() : '',
          'TASA BCV': sol.tasaBCV ? parseFloat(sol.tasaBCV) : null,
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
          { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 15 }
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
        const TABLE_W = 800;

        const cols = [
          { label: 'OBSERV.', key: 'OBSERVAC.', width: 98 },
          { label: 'CÓDIGO', key: 'CÓDIGO', width: 75 },
          { label: 'FECHA', key: 'FECHA', width: 45 },
          { label: 'DEP.', key: 'DEPARTAMENTO', width: 70 },
          { label: 'C.COSTO', key: 'UNIDAD SOLICITANTE / CENTRO DE COSTO', width: 85 },
          { label: 'O/C', key: 'ORDEN DE COMPRA', width: 45 },
          { label: 'PROVEEDOR', key: 'PROVEEDOR', width: 85 },
          { label: '($)', key: 'MONTO ($)', width: 50, align: 'right' },
          { label: '(BS)', key: 'MONTO (BS)', width: 50, align: 'right' },
          { label: '(€)', key: 'MONTO (EUROS)', width: 42, align: 'right' },
          { label: 'TASA BCV', key: 'TASA BCV', width: 55, align: 'right' },
          { label: 'PAGO', key: 'FECHA PAGO', width: 45 },
          { label: 'STATUS', key: 'STATUS', width: 55 }
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
        const drawDataRow = (rowValues, rowColor, y, rowH) => {
          const finalH = Math.max(rowH, ROW_H);
          // Fondo de la fila
          doc.rect(MX, y, TABLE_W, finalH).fill(rowColor || '#FFFFFF');
          // Borde de la fila
          doc.rect(MX, y, TABLE_W, finalH).stroke(BORDER);
          // Texto de cada celda
          let x = MX;
          doc.fontSize(FONT_SZ).font('Helvetica').fillColor('#000000');
          rowValues.forEach((cellText, i) => {
            const col = cols[i];
            const cleanText = String(cellText != null ? cellText : '').replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
            
            // Calculamos posición vertical para centrar un poco el texto si la fila es muy alta
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
        const logoPath = path.join(__dirname, '../frontend/src/assets/logo.png');
        try {
          if (fs.existsSync(logoPath)) doc.image(logoPath, MX, MY, { width: 80 });
        } catch (e) { }

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

          const rowValues = [
            d['OBSERVAC.'] || '',
            d['CÓDIGO'] || '',
            d['FECHA'] || '',
            d['DEPARTAMENTO'] || '',
            d['UNIDAD SOLICITANTE / CENTRO DE COSTO'] || '',
            d['ORDEN DE COMPRA'] || '',
            d['PROVEEDOR'] || '',
            d['MONTO ($)'] != null ? d['MONTO ($)'].toFixed(2) : '',
            d['MONTO (BS)'] != null ? d['MONTO (BS)'].toFixed(2) : '',
            d['MONTO (EUROS)'] != null ? d['MONTO (EUROS)'].toFixed(2) : '',
            d['TASA BCV'] != null ? d['TASA BCV'].toFixed(2) : '',
            d['FECHA PAGO'] || '',
            d['STATUS'] || ''
          ];

          // Cálculo de altura necesaria para esta fila
          let maxH = ROW_H;
          rowValues.forEach((text, idx) => {
            const colW = cols[idx].width - (PAD * 2);
            const h = doc.heightOfString(text, { width: colW, lineBreak: true });
            if (h + 10 > maxH) maxH = h + 10; // +10 por padding superior/inferior
          });

          // Si la fila no cabe en la página actual, saltar a la siguiente
          if (currentY + maxH > PAGE_H - 45) {
            doc.addPage();
            currentY = MY;
            doc.fontSize(8).font('Helvetica-Oblique').fillColor('#666666')
              .text('REPORTE GENERAL DE SOLICITUDES (continuación)', MX, currentY);
            currentY += 13;
            currentY = drawTableHeader(currentY);
          }

          currentY = drawDataRow(rowValues, d._color, currentY, maxH);
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
        // Usar timeZone UTC para evitar desfase de -1 día por diferencia horaria local
        const fmtUTC = (d) => new Date(d).toLocaleDateString('es-VE', { timeZone: 'UTC' });
        subheader = `Periodo: ${fmtUTC(desde)} al ${fmtUTC(hasta)} | ${subheader}`;
      }
      doc.fontSize(8).font('Helvetica').text(subheader, { align: 'right' });
      doc.moveDown(2);

      // --- CONSTRUCCIÓN DE TABLAS POR GRUPO ---
      const blueHeader = '#1b4f72';
      let isFirstUnidad = true;

      // Altura de página A4 landscape en puntos: 595.28 (Antes estaba en 841.89 que es portrait)
      const PAGE_HEIGHT_REL = 595.28;
      const MARGIN_BOTTOM = 60; // margen inferior de seguridad aumentado de 40 a 60
      const MIN_ROW_H = 20;    // altura mínima por fila
      const SUBTOTAL_H = 30;   // espacio fijo para fila de subtotal
      const HEADER_H_REL = 30; // altura de encabezado de tabla
      const TITLE_H = 30;      // altura del título de departamento

      for (const unidad in grupos) {
        console.log(`[REPORTE DEBUG] Procesando unidad: ${unidad}`);
        const items = grupos[unidad];
        let subtotalFila = 0;

        try {
          // Calcular espacio necesario estimado para el grupo completo
          const spaceNeeded = TITLE_H + HEADER_H_REL + (items.length * MIN_ROW_H) + SUBTOTAL_H;
          const spaceAvailable = PAGE_HEIGHT_REL - doc.y - MARGIN_BOTTOM;

          if (!isFirstUnidad) {
            // Si el grupo entero no cabe, saltar a nueva página
            if (spaceNeeded > spaceAvailable) {
              doc.addPage();
            } else {
              doc.moveDown(1.5);
            }
          }
          isFirstUnidad = false;

          doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text(`DEPARTAMENTO: ${unidad.toUpperCase()}`, 20);
          doc.moveDown(0.3);

          // Pre-calcular filas para poder calcular el subtotal ANTES de dibujar
          const rows = await Promise.all(items.map(async sol => {
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
              (sol.conceptoPago || '').trim(),
              // Departamento eliminado: ya aparece en el encabezado del grupo
              sol.numeroRequerimiento || sol.correlativo || 'N/A',
              monto.toLocaleString('es-VE', { minimumFractionDigits: 2 }),
              sol.metodoPago || 'N/A',
              sol.moneda === 'Bs' ? 'BOLIVARES' : (sol.moneda === 'USD' ? 'DIVISAS' : (sol.moneda || 'N/A')),
              sol.tasaBCV ? parseFloat(sol.tasaBCV).toLocaleString('es-VE', { minimumFractionDigits: 2 }) : '—',
              (prov.razonSocial || 'N/A').trim(),
              sol.fechaSolicitud ? new Date(sol.fechaSolicitud).toLocaleDateString() : 'N/A',
              elaborado ? elaborado.nombre.toUpperCase() : 'N/A',
              (sol.estatus || 'N/A').toUpperCase()
            ];
          }));

          const table = {
            headers: [
              // Departamento eliminado: ya aparece en el encabezado del grupo (ahorra ~100pts)
              // Ancho total = 775 pts (A4 Landscape con margenes)
              { label: 'Descripción',   property: 'descripcion', width: 170, headerColor: blueHeader, headerOpacity: 1 },
              { label: 'Código O/C',    property: 'oc',          width: 65,  headerColor: blueHeader, headerOpacity: 1 },
              { label: 'Monto',          property: 'monto',       width: 65,  align: 'right', headerColor: blueHeader, headerOpacity: 1 },
              { label: 'Método pago',   property: 'metodo',      width: 65,  headerColor: blueHeader, headerOpacity: 1 },
              { label: 'Moneda',         property: 'moneda',      width: 55,  headerColor: blueHeader, headerOpacity: 1 },
              { label: 'Tasa BCV',       property: 'tasa',        width: 50,  align: 'right', headerColor: blueHeader, headerOpacity: 1 },
              { label: 'Proveedor',      property: 'proveedor',   width: 130, headerColor: blueHeader, headerOpacity: 1 },
              { label: 'Fecha inc.',     property: 'fecha',       width: 50,  headerColor: blueHeader, headerOpacity: 1 },
              { label: 'Comprador',      property: 'comprador',   width: 60,  headerColor: blueHeader, headerOpacity: 1 },
              { label: 'Estatus',        property: 'estatus',     width: 65,  headerColor: blueHeader, headerOpacity: 1 }
            ],
            rows
          };

          await doc.table(table, {
            prepareHeader: () => doc.font('Helvetica-Bold').fontSize(6).fillColor('#FFFFFF'),
            prepareRow: () => { doc.font('Helvetica').fontSize(6).fillColor('#000000'); },
            padding: 2,
            hideHeader: false,
            minRowHeight: 14,
            columnSpacing: 2,
            divider: {
              header: { disabled: false, width: 0.5, opacity: 1 },
              horizontal: { disabled: false, width: 0.1, opacity: 0.1 }
            }
          });

          // --- FILA DE SUBTOTAL POR UNIDAD (Dinámica por largo de texto) ---
          const subtotalText = `Subtotal ${unidad}: ${subtotalFila.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
          const hTextSubtotal = doc.heightOfString(subtotalText, { width: 765 });
          const barHeight = Math.max(20, hTextSubtotal + 10);

          if (doc.y + barHeight + 5 > PAGE_HEIGHT_REL - MARGIN_BOTTOM) {
            doc.addPage();
          }

          const currentY = doc.y + 2;
          doc.rect(20, currentY, 775, barHeight).fill(blueHeader).stroke();
          doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
          doc.text(subtotalText, 25, currentY + Math.floor((barHeight - hTextSubtotal) / 2) + 2, {
            width: 765,
            align: 'left'
          });
          doc.moveDown(1.5);
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
      const safeParse = (val) => {
        if (!val || val === 'undefined' || val === 'null') return null;
        if (typeof val !== 'string') return val;
        try { return JSON.parse(val); } catch (e) { return null; }
      };

      if (data.proveedor) data.proveedor = safeParse(data.proveedor);
      if (data.datosBancarios) data.datosBancarios = safeParse(data.datosBancarios);
      if (data.tiposSoporte) data.tiposSoporte = safeParse(data.tiposSoporte) || [];

      // Campos permitidos para actualizar (Eliminamos centroCosto de la lista)
      const camposPermitidos = [
        'numeroRequerimiento', 'fechaLimiteRequerida', 'nivelPrioridad',
        'conceptoPago', 'observaciones', 'proveedor',
        'metodoPago', 'datosBancarios', 'tipoPago', 'montoTotal', 'moneda',
        'tiposSoporte', 'numeroOrdenCompra'
      ];

      const t = await sequelize.transaction();
      try {
        camposPermitidos.forEach(campo => {
          if (data[campo] !== undefined) {
            solicitud[campo] = data[campo];
          }
        });

        if (solicitud.estatus === 'Devuelto' || solicitud.estatus === 'Anulado') {
          solicitud.estatus = 'Pendiente';
        }

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
          comentario: 'Se modificaron los campos de la solicitud y distribución'
        });
        solicitud.historial = historial;

        await solicitud.save({ transaction: t });

        // --- ACTUALIZAR DISTRIBUCIÓN DE CENTROS DE COSTO ---
        let distribucionParsed = [];
        if (data.distribucionCentros) {
          try {
            distribucionParsed = typeof data.distribucionCentros === 'string'
              ? JSON.parse(data.distribucionCentros)
              : data.distribucionCentros;
          } catch (e) { distribucionParsed = []; }
        }

        // Si se envió una distribución, actualizamos (limpiar y re-insertar)
        if (Array.isArray(distribucionParsed)) {
          // VALIDACIÓN DE MONTO TOTAL VS DISTRIBUCIÓN EN ACTUALIZACIÓN
          const sumaDistribucion = distribucionParsed.reduce((acc, curr) => acc + (parseFloat(curr.monto) || 0), 0);
          const totalAValidar = data.montoTotal !== undefined ? parseFloat(data.montoTotal) : parseFloat(solicitud.montoTotal);

          if (Math.abs(sumaDistribucion - totalAValidar) > 0.01) {
            await t.rollback();
            return res.status(400).json({ 
              error: `La suma de los Centros de Costo (${sumaDistribucion.toFixed(2)}) no coincide con el Monto Total (${totalAValidar.toFixed(2)})` 
            });
          }

          // 1. Eliminar anteriores
          await DistribucionGasto.destroy({
            where: { solicitudId: id },
            transaction: t
          });

          // 2. Insertar nuevas
          for (const linea of distribucionParsed) {
            if (linea.centroCostoId) {
              await DistribucionGasto.create({
                solicitudId: id,
                centroCostoId: linea.centroCostoId,
                monto: parseFloat(linea.monto) || 0,
                porcentaje: parseFloat(linea.porcentaje) || 0,
                descripcion: linea.descripcion || ''
              }, { transaction: t });
            }
          }

          // 3. Sincronizar columna centrosCostoIds en la tabla principal
          const ids = [...new Set(distribucionParsed.map(d => d.centroCostoId))].filter(Boolean);
          await solicitud.update({ centrosCostoIds: ids }, { transaction: t });
        }

        await t.commit();
        res.json({ mensaje: 'Solicitud actualizada exitosamente', solicitud });
      } catch (innerError) {
        await t.rollback();
        throw innerError;
      }

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
        version: info.version || '',
        operaciones: esAdmin ? (info.operaciones || '0') : null
      };

      res.json(data);
    } catch (error) {
      console.error('[SISTEMA INFO ERROR]:', error);
      res.status(500).json({ error: 'Error al obtener información del sistema' });
    }
  }
}


module.exports = new SolicitudController();
