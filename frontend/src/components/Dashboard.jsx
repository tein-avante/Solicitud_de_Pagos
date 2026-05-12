/**
 * PANEL DE CONTROL PRINCIPAL (Dashboard.jsx)
 * Esta es la vista principal para todos los usuarios.
 * - Los solicitantes ven sus solicitudes y estadísticas.
 * - Los administradores ven un resumen global y herramientas de gestión.
 */

import React, { useState, useEffect, useContext } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Space,
  message,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Upload,
  Tooltip,
  InputNumber,
  Typography,
  Popover
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  PrinterOutlined,
  CheckOutlined,
  CloseOutlined,
  TeamOutlined,
  ExportOutlined,
  UndoOutlined,
  DollarOutlined,
  LogoutOutlined,
  ExclamationCircleOutlined,
  UploadOutlined,
  SettingOutlined,
  BulbOutlined,
  BulbFilled,
  BarChartOutlined,
  FilterOutlined,
  WalletOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import api from '../services/api';
import logo from '../assets/logo.png';
import { ThemeContext } from '../context/ThemeContext';
import EstadisticasVisuales from './EstadisticasVisuales';

const { confirm } = Modal;
const { Text } = Typography;

/** Coincide con obtenerEstadisticas (pendientes del tablero). */
const ESTATUS_GRUPO_PENDIENTES_TABLERO = 'Pendiente,Autorizado,Devuelto,Anulado';

const normEstatus = (s) => String(s ?? '').trim().toLowerCase();

/** Refuerzo en cliente: si el API ignora `estatus`, la tabla igual refleja el filtro. */
const aplicarFiltroEstatusLista = (rows, estatusQuery) => {
  const list = Array.isArray(rows) ? rows : [];
  if (estatusQuery === undefined || estatusQuery === null || String(estatusQuery).trim() === '') {
    return list;
  }
  const raw = String(estatusQuery).trim();
  if (raw.includes(',')) {
    const allowed = new Set(raw.split(',').map((x) => normEstatus(x)).filter(Boolean));
    return list.filter((r) => allowed.has(normEstatus(r.estatus)));
  }
  const target = normEstatus(raw);
  return list.filter((r) => normEstatus(r.estatus) === target);
};

const Dashboard = () => {
  // Detectar URL base para archivos
  const isLocal = window.location.port === '5173' || window.location.hostname === 'localhost';
  const fileBaseURL = isLocal ? `http://${window.location.hostname}:3000` : window.location.origin;

  // ESTADOS PARA MANEJO DE DATOS Y UI (Persistidos en localStorage)
  const savedFilters = JSON.parse(localStorage.getItem('dashboard_filtros') || '{}');

  // Validar que los valores de paginación del localStorage sean números enteros positivos.
  // Si están corruptos (ej: un string como "M/N ANGEL FALLS"), se usan los valores por defecto.
  const safePage = Number.isInteger(Number(savedFilters.currentPage)) && Number(savedFilters.currentPage) > 0
    ? Number(savedFilters.currentPage) : 1;
  const safeSize = Number.isInteger(Number(savedFilters.pageSize)) && Number(savedFilters.pageSize) > 0
    ? Number(savedFilters.pageSize) : 10;

  const [loading, setLoading] = useState(false);
  const [solicitudes, setSolicitudes] = useState([]);
  const [estadisticas, setEstadisticas] = useState({});
  const [modalAprobar, setModalAprobar] = useState(false);
  const [modalRechazar, setModalRechazar] = useState(false);
  const [modalDevolver, setModalDevolver] = useState(false);
  const [modalPagar, setModalPagar] = useState(false);
  const [modalEstadisticas, setModalEstadisticas] = useState(false);
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState(null);
  const [fileListPagar, setFileListPagar] = useState([]);
  const [currentPage, setCurrentPage] = useState(safePage);
  const [pageSize, setPageSize] = useState(safeSize);
  const [totalItems, setTotalItems] = useState(0);

  // Estados para Reportes con Filtro de Fecha
  const [modalReporte, setModalReporte] = useState(false);
  const [tipoReporteActual, setTipoReporteActual] = useState(null); // 'relacion' | 'xlsx' | 'pdf'
  const [rangoFechas, setRangoFechas] = useState([null, null]);
  const [estatusReporte, setEstatusReporte] = useState(['Pendiente', 'Autorizado', 'Aprobado', 'En Trámite', 'Pagado', 'Cerrado', 'Devuelto', 'Rechazado', 'Anulado', 'Devolución en compras']);
  const [filtroProveedor, setFiltroProveedor] = useState(savedFilters.filtroProveedor || null);
  const [filtroDepartamento, setFiltroDepartamento] = useState(savedFilters.filtroDepartamento || null);
  const [filtroEstatus, setFiltroEstatus] = useState(savedFilters.filtroEstatus || '');
  const [filtroCentroCosto, setFiltroCentroCosto] = useState(savedFilters.filtroCentroCosto || null);
  const [proveedoresLista, setProveedoresLista] = useState([]);
  const [deptsLista, setDeptsLista] = useState([]);
  const [centrosCostoLista, setCentrosCostoLista] = useState([]);
  const [sistemaInfo, setSistemaInfo] = useState({ version: '', operaciones: null });
  const [puedeVerFinanzas, setPuedeVerFinanzas] = useState(false);


  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);

  // Obtener datos del usuario logueado
  const storedUser = localStorage.getItem('usuario');
  const usuario = storedUser ? JSON.parse(storedUser) : null;
  useEffect(() => {
    cargarSolicitudes(currentPage, pageSize);
    cargarEstadisticas();
    cargarAuxiliares();
    cargarSistemaInfo();
    cargarAccesoFinanzas();
  }, []);

  // Efecto para persistir filtros en localStorage cada vez que cambien
  useEffect(() => {
    localStorage.setItem('dashboard_filtros', JSON.stringify({
      currentPage,
      pageSize,
      filtroProveedor,
      filtroDepartamento,
      filtroEstatus,
      filtroCentroCosto
    }));
  }, [currentPage, pageSize, filtroProveedor, filtroDepartamento, filtroEstatus, filtroCentroCosto]);

  const cargarSistemaInfo = async () => {
    try {
      const res = await api.get('/solicitudes/sistema/info');
      setSistemaInfo(res.data);
    } catch (e) {
      console.warn('Error al cargar info del sistema');
    }
  };

  const cargarAccesoFinanzas = async () => {
    try {
      if (usuario?.rol?.toLowerCase() === 'administrador') {
        setPuedeVerFinanzas(true);
        return;
      }

      const res = await api.get('/caja-chica');
      setPuedeVerFinanzas(Array.isArray(res.data) && res.data.length > 0);
    } catch (e) {
      setPuedeVerFinanzas(false);
    }
  };


  const cargarAuxiliares = async () => {
    try {
      const [p, d, c] = await Promise.all([api.get('/proveedores'), api.get('/departamentos'), api.get('/centros-costo')]);
      setProveedoresLista(p.data);
      setDeptsLista(d.data);
      setCentrosCostoLista(Array.isArray(c.data) ? c.data : c.data?.centros || []);
    } catch (e) {
      console.warn('Error al cargar auxiliares para filtros');
    }
  };

  /**
   * Obtiene la lista de solicitudes desde el backend con paginación
   */
  const cargarSolicitudes = async (page = 1, limit = pageSize, extraFilters = {}) => {
    setLoading(true);
    try {
      const proveedorIdVal = ('proveedorId' in extraFilters) ? extraFilters.proveedorId : filtroProveedor;
      const unidadVal = ('unidadSolicitante' in extraFilters) ? extraFilters.unidadSolicitante : filtroDepartamento;
      const centroVal = ('centroCostoId' in extraFilters) ? extraFilters.centroCostoId : filtroCentroCosto;
      const estatusVal = ('estatus' in extraFilters) ? extraFilters.estatus : filtroEstatus;

      const params = { pagina: page, limite: limit };
      if (proveedorIdVal !== undefined && proveedorIdVal !== null && proveedorIdVal !== '') {
        params.proveedorId = proveedorIdVal;
      }
      if (unidadVal !== undefined && unidadVal !== null && unidadVal !== '') {
        params.unidadSolicitante = unidadVal;
      }
      if (centroVal !== undefined && centroVal !== null && centroVal !== '') {
        params.centroCostoId = centroVal;
      }
      if (estatusVal !== undefined && estatusVal !== null && String(estatusVal).trim() !== '') {
        params.estatus = String(estatusVal).trim();
      }

      const response = await api.get('/solicitudes', { params });
      const rawRows = Array.isArray(response.data?.solicitudes)
        ? response.data.solicitudes
        : [];
      const filteredRows = aplicarFiltroEstatusLista(rawRows, params.estatus);
      setSolicitudes(filteredRows);
      setTotalItems(filteredRows.length);
      setCurrentPage(page);
      setPageSize(limit);
    } catch (error) {
      message.error('Error al cargar las solicitudes');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Obtiene los contadores para los widgets superiores (Cards)
   */
  const cargarEstadisticas = async () => {
    try {
      const response = await api.get('/solicitudes/estadisticas');
      setEstadisticas(response.data);
    } catch (error) {
      message.error('Error al cargar las estadísticas');
    }
  };

  /** Qué tarjeta del tablero está alineada con el filtro por estatus actual. */
  const tarjetaDashboardActiva = (() => {
    if (!filtroEstatus) return 'total';
    if (filtroEstatus === ESTATUS_GRUPO_PENDIENTES_TABLERO) return 'pendientes';
    const porValor = { Aprobado: 'aprobadas', Pagado: 'pagadas', Cerrado: 'cerradas' };
    return porValor[filtroEstatus] || null;
  })();

  const etiquetaFiltroEstatusActivo = filtroEstatus === ESTATUS_GRUPO_PENDIENTES_TABLERO
    ? 'Pendientes (tablero)'
    : filtroEstatus;

  const handleClickTarjetaDashboard = (cardKey) => {
    if (cardKey === 'total') {
      setFiltroEstatus('');
      cargarSolicitudes(1, pageSize, { estatus: '' });
      return;
    }
    const estatusPorTarjeta = {
      pendientes: ESTATUS_GRUPO_PENDIENTES_TABLERO,
      aprobadas: 'Aprobado',
      pagadas: 'Pagado',
      cerradas: 'Cerrado'
    };
    const est = estatusPorTarjeta[cardKey];
    if (!est) return;
    setFiltroEstatus(est);
    cargarSolicitudes(1, pageSize, { estatus: est });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    navigate('/login');
  };

  // NAVEGACIÓN Y APERTURA DE MODALES DE FLUJO
  const handleVer = (id) => navigate(`/solicitudes/${id}`);
  const handleAprobar = (solicitud) => { setSolicitudSeleccionada(solicitud); setModalAprobar(true); };
  const handleRechazar = (solicitud) => { setSolicitudSeleccionada(solicitud); setModalRechazar(true); };
  const handleDevolver = (solicitud) => { setSolicitudSeleccionada(solicitud); setModalDevolver(true); };
  const handleAbrirPagar = (solicitud) => { setSolicitudSeleccionada(solicitud); setFileListPagar([]); setModalPagar(true); };
  const handleDevolverCompra = (solicitud) => {
    setSolicitudSeleccionada(solicitud);
    const refMotivo = { valor: '' };
    confirm({
      title: 'Registrar Devolución en Compras',
      icon: <UndoOutlined />,
      content: (
        <div style={{ marginTop: 15 }}>
          <Text type="secondary">Indique el motivo de la devolución del dinero por parte del proveedor:</Text>
          <Input.TextArea
            placeholder="Ej: El proveedor no dispone del material y devolverá el pago..."
            rows={4}
            style={{ marginTop: 10 }}
            onChange={(e) => { refMotivo.valor = e.target.value; }}
          />
        </div>
      ),
      okText: 'Confirmar Devolución',
      cancelText: 'Cancelar',
      onOk: async () => {
        if (!refMotivo.valor.trim()) {
          message.error('Debe ingresar un motivo para la devolución');
          return Promise.reject();
        }
        try {
          await api.patch(`/solicitudes/${solicitud.id}/estatus`, {
            estatus: 'Devolución en compras',
            motivo: refMotivo.valor,
            comentario: refMotivo.valor
          });
          message.success('Devolución registrada correctamente');
          cargarSolicitudes();
          cargarEstadisticas();
        } catch (e) {
          message.error('Error al registrar devolución');
        }
      }
    });
  };

  /**
   * ACCIÓN: Aprobar Solicitud
   */
  const confirmarAprobar = async () => {
    try {
      await api.put(`/solicitudes/${solicitudSeleccionada.id}/estatus`, { estatus: 'Aprobado' });
      message.success('Solicitud aprobada');
      setModalAprobar(false);
      cargarSolicitudes();
      cargarEstadisticas();
    } catch (error) {
      message.error('Error al aprobar');
    }
  };

  /**
   * ACCIÓN: Rechazar Solicitud
   */
  const confirmarRechazar = async (values) => {
    try {
      const { motivo } = values;
      await api.patch(`/solicitudes/${solicitudSeleccionada.id}/estatus`, {
        estatus: 'Rechazado',
        motivo: motivo,
        comentario: motivo
      });
      message.success('Solicitud rechazada');
      setModalRechazar(false);
      form.resetFields();
      cargarSolicitudes();
      cargarEstadisticas();
    } catch (error) {
      message.error('Error al rechazar');
    }
  };

  /**
   * ACCIÓN: Devolver Solicitud
   */
  const confirmarDevolver = async (values) => {
    try {
      const { motivo } = values;
      await api.patch(`/solicitudes/${solicitudSeleccionada.id}/estatus`, {
        estatus: 'Devuelto',
        motivo: motivo,
        comentario: motivo
      });
      message.success('Solicitud devuelta');
      setModalDevolver(false);
      form.resetFields();
      cargarSolicitudes();
      cargarEstadisticas();
    } catch (error) {
      message.error('Error al devolver');
    }
  };

  /**
   * ACCIÓN: Marcar como Pagada (Sube comprobante)
   */
  const confirmarPagar = async () => {
    try {
      // Validar campos antes de proceder (esto dispara los errores visuales)
      const values = await form.validateFields();

      const formData = new FormData();
      formData.append('estatus', 'Pagado');

      const { comentarioAccion, tasaBCV } = values;
      if (comentarioAccion) formData.append('comentario', comentarioAccion);
      if (tasaBCV) formData.append('tasaBCV', tasaBCV);

      if (fileListPagar.length > 0) {
        formData.append('comprobante', fileListPagar[0].originFileObj);
      }

      await api.put(`/solicitudes/${solicitudSeleccionada.id}/estatus`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      message.success('Pago procesado correctamente');
      setModalPagar(false);
      cargarSolicitudes();
      cargarEstadisticas();
    } catch (error) {
      message.error('Error al procesar el pago');
    }
  };

  /**
   * ACCIÓN: Cambio de estatus directo (Autorizar, Cerrar)
   */
  const handleAccionDirecta = async (id, nuevoEstatus) => {
    try {
      await api.patch(`/solicitudes/${id}/estatus`, { estatus: nuevoEstatus });
      message.success(`Solicitud ${nuevoEstatus === 'Autorizado' ? 'autorizada' : 'cerrada'} correctamente`);
      cargarSolicitudes();
      cargarEstadisticas();
    } catch (error) {
      message.error('Error al actualizar la solicitud');
    }
  };

  /**
   * ACCIÓN: Exportar datos (Admin)
   */
  const handleExportar = (formato) => {
    setTipoReporteActual(formato); // 'xlsx' o 'pdf'
    setModalReporte(true);
  };

  const ejecutarExportarMasivo = async (formato, desde, hasta) => {
    try {
      setLoading(true);
      console.log(`Iniciando exportación masiva (${formato}) con filtro...`, { desde, hasta });
      const res = await api.get(`/solicitudes/exportar/datos?formato=${formato}&desde=${desde}&hasta=${hasta}`, { responseType: 'blob' });
      const mimeType = formato === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';
      const url = window.URL.createObjectURL(new Blob([res.data], { type: mimeType }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Reporte_General_${desde}_a_${hasta}.${formato}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success(`Exportación ${formato.toUpperCase()} generada correctamente`);
    } catch (e) {
      console.error(`Error en ejecutarExportarMasivo (${formato}):`, e);
      message.error('Error al exportar');
    } finally {
      setLoading(false);
    }
  };

  /**
   * ACCIÓN: Generar reporte de Relación de Solicitudes (Unificado)
   */
  const handleReporteRelacion = () => {
    setTipoReporteActual('relacion');
    // Pre-seleccionar todos por defecto
    setEstatusReporte(['Pendiente', 'Autorizado', 'Aprobado', 'Pagado', 'Cerrado', 'Devuelto', 'Rechazado', 'Anulado', 'Devolución en compras']);
    setModalReporte(true);
  };

  const ejecutarReporteRelacion = async (desde, hasta) => {
    if (!estatusReporte || estatusReporte.length === 0) {
      return message.warning('Debe seleccionar al menos un estatus para el reporte');
    }
    try {
      setLoading(true);
      console.log('Iniciando descarga de reporte de relacion con filtro...', { desde, hasta, estatus: estatusReporte });

      const estatusQuery = estatusReporte.join(',');
      const res = await api.get(`/solicitudes/reporte/relacion?desde=${desde}&hasta=${hasta}&estatus=${estatusQuery}`, { responseType: 'blob' });

      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Relacion_Solicitudes_${desde}_a_${hasta}.pdf`);
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
      }, 100);

      message.success('Reporte generado correctamente');
    } catch (e) {
      console.error('Error en ejecutarReporteRelacion:', e);
      message.error(`Error al generar el reporte: ${e.message || 'Error de red'}`);
    } finally {
      setLoading(false);
    }
  };

  const generarReporteConFiltro = async () => {
    if (!rangoFechas || !rangoFechas[0] || !rangoFechas[1]) {
      return message.warning('Por favor seleccione un rango de fechas');
    }

    const desde = rangoFechas[0].format('YYYY-MM-DD');
    const hasta = rangoFechas[1].format('YYYY-MM-DD');

    setModalReporte(false);

    if (tipoReporteActual === 'relacion') {
      await ejecutarReporteRelacion(desde, hasta);
    } else {
      await ejecutarExportarMasivo(tipoReporteActual, desde, hasta);
    }

    setRangoFechas([null, null]); // Limpiar filtros después de generar
  };

  const handleImprimir = async (id) => {
    try {
      const res = await api.get(`/solicitudes/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url);
    } catch (e) { message.error('Error al generar PDF'); }
  };

  // CONFIGURACIÓN DE COLUMNAS DE LA TABLA
  const columns = [
    {
      title: 'Correlativo',
      dataIndex: 'correlativo',
      width: 130,
      ellipsis: true,
      render: (text, r) => <Button type="link" onClick={() => handleVer(r.id)} style={{ padding: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{text}</Button>
    },
    {
      title: 'Fecha',
      dataIndex: 'fechaSolicitud',
      width: 95,
      render: (text) => moment(text).format('DD/MM/YYYY')
    },
    {
      title: 'Departamento',
      dataIndex: 'unidadSolicitante',
      width: 170,
      ellipsis: true
    },
    {
      title: 'Concepto',
      dataIndex: 'conceptoPago',
      // Sin ancho fijo: se expande para ocupar el espacio disponible de forma flexible
      ellipsis: true
    },
    {
      title: 'Monto',
      dataIndex: 'montoTotal',
      width: 140,
      render: (text, r) => `${r.moneda} ${Number(text).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`
    },
    {
      title: 'Tasa BCV',
      dataIndex: 'tasaBCV',
      width: 100,
      render: (val) => val
        ? <Tooltip title="Tasa de cambio BCV al momento del pago"><span style={{ color: '#237804', fontWeight: 600 }}>Bs. {Number(val).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></Tooltip>
        : <span style={{ color: '#bbb' }}>—</span>
    },
    {
      title: 'Estatus',
      dataIndex: 'estatus',
      key: 'estatus',
      width: 140,
      render: (val) => {
        let color = 'blue';
        const s = val?.trim().toLowerCase();
        if (s === 'autorizado') color = 'purple';
        if (s === 'aprobado') color = 'green';
        if (s === 'en trámite') color = 'geekblue';
        if (s === 'pagado') color = 'cyan';
        if (s === 'cerrado') color = 'gold';
        if (s === 'rechazado') color = 'red';
        if (s === 'devuelto') color = 'orange';
        if (s === 'anulado') color = 'default';
        if (s === 'devolución en compras') {
          color = 'volcano';
          val = 'DEVOLUCIÓN';
        }
        return <Tag color={color}>{val?.toUpperCase() || ''}</Tag>;
      }

    },
    {
      title: 'Acciones',
      width: 200,
      render: (_, r) => (
        <Space size="small">
          <Tooltip title="Ver Detalle">
            <Button icon={<EyeOutlined />} size="small" onClick={() => handleVer(r.id)} />
          </Tooltip>
          <Tooltip title="Imprimir PDF">
            <Button icon={<PrinterOutlined />} size="small" onClick={() => handleImprimir(r.id)} />
          </Tooltip>

          {(usuario?.rol?.toLowerCase() === 'administrador' || usuario?.rol?.toLowerCase() === 'gestor' || usuario?.rol?.toLowerCase() === 'auditor') && (
            <>
              {/* ACCIONES DEL GESTOR (O ADMIN) - AUTORIZAR */}
              {/* ACCIONES DEL GESTOR (GERENTE) / ADMINISTRADOR */}
              {(usuario?.rol?.trim().toLowerCase().includes('gestor') ||
                usuario?.rol?.trim().toLowerCase().includes('administrador')) &&
                r.estatus?.trim().toLowerCase() === 'pendiente' && (
                  <Tooltip title={`Autorizar (Soy: ${usuario.rol}, Estatus: ${r.estatus})`}>
                    <Button
                      icon={<CheckOutlined />}
                      size="small"
                      style={{ backgroundColor: '#722ed1', color: 'white' }}
                      onClick={() => handleAccionDirecta(r.id, 'Autorizado')}
                    />
                  </Tooltip>
                )}




              {/* Aprobar / marcar pagada: solo Administrador. Post‑pago: Admin o Auditor. */}
              {(usuario?.rol?.toLowerCase() === 'administrador' || usuario?.rol?.toLowerCase() === 'auditor') && (
                <>
                  {r.estatus?.trim().toLowerCase() === 'autorizado' && usuario?.rol?.toLowerCase() === 'administrador' && (
                    <Tooltip title="Aprobar">
                      <Button icon={<CheckOutlined />} size="small" type="primary" onClick={() => handleAprobar(r)} />
                    </Tooltip>
                  )}
                  {r.estatus?.trim().toLowerCase() === 'aprobado' && usuario?.rol?.toLowerCase() === 'administrador' && (
                    <Tooltip title="Marcar como Pagada">
                      <Button icon={<DollarOutlined />} size="small" style={{ backgroundColor: '#52c41a', color: 'white' }} onClick={() => handleAbrirPagar(r)} />
                    </Tooltip>
                  )}
                  {r.estatus?.trim().toLowerCase() === 'pagado' && (usuario?.rol === 'Administrador' || usuario?.rol === 'Auditor') && (
                    <Space size="small">
                      <Tooltip title="Marcar En Trámite (Espera de Factura)">
                        <Button icon={<ClockCircleOutlined />} size="small" style={{ backgroundColor: '#2f54eb', color: 'white' }} onClick={() => handleAccionDirecta(r.id, 'En Trámite')} />
                      </Tooltip>
                      <Tooltip title="Devolución en compras">
                        <Button icon={<UndoOutlined />} size="small" style={{ backgroundColor: '#fa8c16', color: 'white' }} onClick={() => handleDevolverCompra(r)} />
                      </Tooltip>
                      <Tooltip title="Cerrar Solicitud">
                        <Button icon={<CheckOutlined />} size="small" style={{ backgroundColor: '#faad14', color: 'white' }} onClick={() => handleAccionDirecta(r.id, 'Cerrado')} />
                      </Tooltip>
                    </Space>
                  )}
                  {r.estatus?.trim().toLowerCase() === 'en trámite' && (usuario?.rol === 'Administrador' || usuario?.rol === 'Auditor') && (
                    <Space size="small">
                      <Tooltip title="Cerrar Solicitud">
                        <Button icon={<CheckOutlined />} size="small" style={{ backgroundColor: '#faad14', color: 'white' }} onClick={() => handleAccionDirecta(r.id, 'Cerrado')} />
                      </Tooltip>
                      <Tooltip title="Devolución en compras (Reversar)">
                        <Button icon={<UndoOutlined />} size="small" style={{ backgroundColor: '#fa8c16', color: 'white' }} onClick={() => handleDevolverCompra(r)} />
                      </Tooltip>
                    </Space>
                  )}
                  {r.estatus?.trim().toLowerCase() === 'devolución en compras' && (usuario?.rol === 'Administrador' || usuario?.rol === 'Auditor') && (
                    <Space size="small">
                      <Tooltip title="Marcar En Trámite">
                        <Button icon={<ClockCircleOutlined />} size="small" style={{ backgroundColor: '#2f54eb', color: 'white' }} onClick={() => handleAccionDirecta(r.id, 'En Trámite')} />
                      </Tooltip>
                      <Tooltip title="Cerrar Solicitud">
                        <Button icon={<CheckOutlined />} size="small" style={{ backgroundColor: '#faad14', color: 'white' }} onClick={() => handleAccionDirecta(r.id, 'Cerrado')} />
                      </Tooltip>
                    </Space>
                  )}

                </>
              )}

              {/* DEVOLVER Y RECHAZAR (Común para Admin, Gestor y ahora Auditor) */}
              {(r.estatus?.trim().toLowerCase() === 'pendiente' ||
                r.estatus?.trim().toLowerCase() === 'autorizado' ||
                r.estatus?.trim().toLowerCase() === 'aprobado') && (
                  <>
                    <Tooltip title="Devolver">
                      <Button icon={<UndoOutlined />} size="small" onClick={() => handleDevolver(r)} />
                    </Tooltip>
                    {usuario?.rol?.trim().toLowerCase() === 'administrador' && (
                      <Tooltip title="Rechazar">
                        <Button icon={<CloseOutlined />} size="small" danger onClick={() => handleRechazar(r)} />
                      </Tooltip>
                    )}
                  </>
                )}

            </>
          )}

          {/* ACCIÓN DE ANULAR PARA EL SOLICITANTE */}
          {r.estatus === 'Pendiente' && (usuario?.id === r.elaboradoPor || usuario?.departamento === r.unidadSolicitante) && (
            <Tooltip title="Anular Solicitud">
              <Button icon={<CloseOutlined />} size="small" danger onClick={() => {
                confirm({
                  title: '¿Está seguro de anular esta solicitud?',
                  content: 'Podrá editarla y enviarla de nuevo más tarde.',
                  okText: 'Sí, Anular',
                  okType: 'danger',
                  cancelText: 'No',
                  onOk: async () => {
                    try {
                      await api.patch(`/solicitudes/${r.id}/estatus`, { estatus: 'Anulado', motivo: 'Anulado por el solicitante' });
                      message.success('Solicitud anulada');
                      cargarSolicitudes();
                      cargarEstadisticas();
                    } catch (e) {
                      message.error('Error al anular');
                    }
                  }
                });
              }} />
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '16px', maxWidth: '100%', overflowX: 'hidden' }}>
      {/* HEADER: Logo y Usuario */}
      <div className="dashboard-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        {/* Logo */}
        <img src={logo} alt="Logo" style={{ height: 50, objectFit: 'contain', flexShrink: 0 }} />

        {/* Info usuario + botones */}
        <div className="dashboard-header-info" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end', flex: '1 1 auto' }}>
          {/* Nombre y rol */}
          <div className="user-info" style={{ textAlign: 'right', lineHeight: '1.4', flex: '1 1 auto' }}>
            <Text strong style={{ fontSize: '13px', display: 'block' }}>{usuario?.nombre}</Text>
            <Text type="secondary" style={{ fontSize: '11px', display: 'block', wordBreak: 'break-word' }}>
              {usuario?.rol ? (
                `[${usuario.rol}] - ${usuario.departamento}`
              ) : (
                <span style={{ color: 'red', fontWeight: 'bold' }}>¡ROL VACÍO!</span>
              )}
            </Text>
          </div>

          {/* Botones de acción */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <Tooltip title="Cambiar Tema">
              <Button shape="circle" size="small" icon={isDarkMode ? <BulbFilled /> : <BulbOutlined />} onClick={toggleTheme} />
            </Tooltip>
            <Space size="small">
              {puedeVerFinanzas && (
                <Tooltip title="Módulo de Finanzas (Caja Chica / Pagos Directos)">
                  <Button shape="circle" size="small" style={{ backgroundColor: '#ffdf00', color: '#1890ff', borderColor: '#ffdf00' }} icon={<DollarOutlined />} onClick={() => navigate('/finanzas')} />
                </Tooltip>
              )}
              {(usuario?.rol?.toLowerCase() === 'administrador' || usuario?.rol?.toLowerCase() === 'gestor' || usuario?.rol?.toLowerCase() === 'auditor') && (
                <Tooltip title="Gestión de Maestros">
                  <Button shape="circle" size="small" icon={<SettingOutlined />} onClick={() => navigate('/maestros')} />
                </Tooltip>
              )}
            </Space>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Button type="primary" danger size="small" icon={<LogoutOutlined />} onClick={handleLogout}>Salir</Button>
              <Text type="secondary" style={{ fontSize: '10px', marginTop: 2 }}>v{sistemaInfo.version}</Text>
              {usuario?.rol?.toLowerCase() === 'administrador' && sistemaInfo.operaciones && (
                <Text type="secondary" style={{ fontSize: '10px', color: '#888' }}>
                  🔢 {Number(sistemaInfo.operaciones).toLocaleString()} ops
                </Text>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CARDS DE ESTADÍSTICAS — Divs puros (sin antd Card) para garantizar que el onClick funcione */}
      <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
        {[
          { label: 'Total', key: 'total', icon: <TeamOutlined />, color: '#1890ff' },
          { label: 'Pendientes', key: 'pendientes', icon: <ExclamationCircleOutlined />, color: '#faad14' },
          { label: 'Aprobadas', key: 'aprobadas', icon: <CheckOutlined />, color: '#52c41a' },
          { label: 'Pagadas', key: 'pagadas', icon: <DollarOutlined />, color: '#13c2c2' },
          { label: 'Cerradas', key: 'cerradas', icon: <CheckOutlined />, color: '#fa8c16' }
        ].map(item => {
          const isActive = tarjetaDashboardActiva === item.key;
          return (
            <Col key={item.key} xs={12} sm={12} md={8} lg={{ flex: '20%' }} xl={{ flex: '20%' }}>
              <div
                role="button"
                tabIndex={0}
                className="dashboard-stat-card"
                aria-label={`Filtrar solicitudes: ${item.label}`}
                aria-pressed={isActive}
                onClick={() => handleClickTarjetaDashboard(item.key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleClickTarjetaDashboard(item.key);
                  }
                }}
                style={{
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: isActive ? `2px solid ${item.color}` : '2px solid transparent',
                  background: isDarkMode ? '#1f1f1f' : '#fff',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  userSelect: 'none',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              >
                <Statistic
                  title={item.label}
                  value={estadisticas[item.key] || 0}
                  prefix={item.icon}
                  valueStyle={{ color: item.color, fontSize: '20px' }}
                />
              </div>
            </Col>
          );
        })}
      </Row>

      {/* CUERPO: Tabla de Solicitudes */}
      <Card
        title={
          <Space align="start" wrap size="small">
            <span>Historial de Solicitudes</span>
            {filtroEstatus ? (
              <Tag
                closable
                color="processing"
                onClose={(e) => {
                  e.preventDefault();
                  setFiltroEstatus('');
                  cargarSolicitudes(1, pageSize, { estatus: '' });
                }}
              >
                Filtrando: {etiquetaFiltroEstatusActivo}
              </Tag>
            ) : (
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
                Pulse una tarjeta arriba para filtrar por estatus
              </Text>
            )}
          </Space>
        }
        extra={
          <Space wrap className="desktop-filters">
            <Popover
              placement="bottomLeft"
              title="Filtros de Búsqueda"
              trigger="click"
              content={
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '250px' }}>
                  <Select
                    showSearch
                    placeholder="Filtrar Proveedor"
                    style={{ width: '100%' }}
                    allowClear
                    optionFilterProp="children"
                    value={filtroProveedor}
                    onChange={(val) => {
                      setFiltroProveedor(val);
                      cargarSolicitudes(1, pageSize, { proveedorId: val });
                    }}
                  >
                    {proveedoresLista.map(p => <Select.Option key={p.id} value={p.id}>{p.razonSocial}</Select.Option>)}
                  </Select>

                  <Select
                    showSearch
                    placeholder="Filtrar Departamento"
                    style={{ width: '100%' }}
                    allowClear
                    optionFilterProp="children"
                    value={filtroDepartamento}
                    onChange={(val) => {
                      setFiltroDepartamento(val);
                      cargarSolicitudes(1, pageSize, { unidadSolicitante: val });
                    }}
                  >
                    {deptsLista.map(d => <Select.Option key={d.id} value={d.nombre}>{d.nombre}</Select.Option>)}
                  </Select>

                  <Select
                    showSearch
                    placeholder="Filtrar Centro de Costo"
                    style={{ width: '100%' }}
                    allowClear
                    optionFilterProp="children"
                    value={filtroCentroCosto}
                    onChange={(val) => {
                      setFiltroCentroCosto(val);
                      cargarSolicitudes(1, pageSize, { centroCostoId: val });
                    }}
                  >
                    {centrosCostoLista.map(c => <Select.Option key={c.id} value={c.id}>{c.nombre}</Select.Option>)}
                  </Select>

                  <Select
                    placeholder="Filtrar por Estatus"
                    style={{ width: '100%' }}
                    allowClear
                    value={filtroEstatus || undefined}
                    onChange={(val) => {
                      const est = val || '';
                      setFiltroEstatus(est);
                      cargarSolicitudes(1, pageSize, { estatus: est });
                    }}
                  >
                    <Select.Option value={ESTATUS_GRUPO_PENDIENTES_TABLERO}>PENDIENTES (TABLERO)</Select.Option>
                    <Select.Option value="Pendiente">PENDIENTE</Select.Option>
                    <Select.Option value="Autorizado">AUTORIZADO</Select.Option>
                    <Select.Option value="Aprobado">APROBADO</Select.Option>
                    <Select.Option value="En Trámite">EN TRÁMITE</Select.Option>
                    <Select.Option value="Pagado">PAGADO</Select.Option>
                    <Select.Option value="Cerrado">CERRADO</Select.Option>
                    <Select.Option value="Devuelto">DEVUELTO</Select.Option>
                    <Select.Option value="Rechazado">RECHAZADO</Select.Option>
                    <Select.Option value="Anulado">ANULADO</Select.Option>
                    <Select.Option value="Devolución en compras">DEVOLUCIÓN</Select.Option>
                  </Select>
                </div>
              }
            >
              <Button icon={<FilterOutlined />}>Filtros</Button>
            </Popover>
            <Button
              icon={<BarChartOutlined />}
              onClick={() => setModalEstadisticas(true)}
            >
              Estadísticas Visuales
            </Button>
            {(usuario?.rol?.toLowerCase() === 'administrador' || usuario?.rol?.toLowerCase() === 'gestor' || usuario?.rol?.toLowerCase() === 'auditor') && (
              <Space>
                <Button icon={<PrinterOutlined />} onClick={handleReporteRelacion} style={{ backgroundColor: '#1b4f72', color: 'white' }}>
                  Relación de Solicitudes
                </Button>
                <Button icon={<ExportOutlined />} onClick={() => handleExportar('xlsx')}>Excel</Button>
                <Button icon={<ExportOutlined />} onClick={() => handleExportar('pdf')}>PDF</Button>
              </Space>
            )}
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/solicitudes/nueva')}
            >
              Nueva Solicitud
            </Button>
          </Space>
        }
      >
        {/* FILTROS VERSIÓN MÓVIL (dentro del body del Card) */}
        <div className="mobile-filters" style={{ display: 'none' }}>
          {/* El botón de Filtros reemplaza todos los selects individuales también aquí */}
          <Popover
            placement="bottomLeft"
            title="Filtros de Búsqueda"
            trigger="click"
            content={
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '250px' }}>
                <Select
                  showSearch
                  placeholder="Filtrar Proveedor"
                  style={{ width: '100%' }}
                  allowClear
                  optionFilterProp="children"
                  value={filtroProveedor}
                  onChange={(val) => {
                    setFiltroProveedor(val);
                    cargarSolicitudes(1, pageSize, { proveedorId: val });
                  }}
                >
                  {proveedoresLista.map(p => <Select.Option key={p.id} value={p.id}>{p.razonSocial}</Select.Option>)}
                </Select>

                <Select
                  showSearch
                  placeholder="Filtrar Departamento"
                  style={{ width: '100%' }}
                  allowClear
                  optionFilterProp="children"
                  value={filtroDepartamento}
                  onChange={(val) => {
                    setFiltroDepartamento(val);
                    cargarSolicitudes(1, pageSize, { unidadSolicitante: val });
                  }}
                >
                  {deptsLista.map(d => <Select.Option key={d.id} value={d.nombre}>{d.nombre}</Select.Option>)}
                </Select>

                <Select
                  showSearch
                  placeholder="Filtrar Centro de Costo"
                  style={{ width: '100%' }}
                  allowClear
                  optionFilterProp="children"
                  value={filtroCentroCosto}
                  onChange={(val) => {
                    setFiltroCentroCosto(val);
                    cargarSolicitudes(1, pageSize, { centroCostoId: val });
                  }}
                >
                  {centrosCostoLista.map(c => <Select.Option key={c.id} value={c.id}>{c.nombre}</Select.Option>)}
                </Select>

                <Select
                  placeholder="Filtrar por Estatus"
                  style={{ width: '100%' }}
                  allowClear
                  value={filtroEstatus || undefined}
                  onChange={(val) => {
                    const est = val || '';
                    setFiltroEstatus(est);
                    cargarSolicitudes(1, pageSize, { estatus: est });
                  }}
                >
                  <Select.Option value={ESTATUS_GRUPO_PENDIENTES_TABLERO}>PENDIENTES (TABLERO)</Select.Option>
                  <Select.Option value="Pendiente">PENDIENTE</Select.Option>
                  <Select.Option value="Autorizado">AUTORIZADO</Select.Option>
                  <Select.Option value="Aprobado">APROBADO</Select.Option>
                  <Select.Option value="En Trámite">EN TRÁMITE</Select.Option>
                  <Select.Option value="Pagado">PAGADO</Select.Option>
                  <Select.Option value="Cerrado">CERRADO</Select.Option>
                  <Select.Option value="Devuelto">DEVUELTO</Select.Option>
                  <Select.Option value="Rechazado">RECHAZADO</Select.Option>
                  <Select.Option value="Anulado">ANULADO</Select.Option>
                </Select>
              </div>
            }
          >
            <Button icon={<FilterOutlined />} style={{ width: '100%' }}>Filtros</Button>
          </Popover>

          <div className="filter-buttons-row">
            <Button icon={<BarChartOutlined />} onClick={() => setModalEstadisticas(true)}>
              Estadísticas
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/solicitudes/nueva')}>
              Nueva
            </Button>
            {(usuario?.rol?.toLowerCase() === 'administrador' || usuario?.rol?.toLowerCase() === 'gestor' || usuario?.rol?.toLowerCase() === 'auditor') && (
              <>
                <Button icon={<PrinterOutlined />} onClick={handleReporteRelacion} style={{ backgroundColor: '#1b4f72', color: 'white' }} className="btn-full">
                  Relación de Solicitudes
                </Button>
                <Button icon={<ExportOutlined />} onClick={() => handleExportar('xlsx')}>Excel</Button>
                <Button icon={<ExportOutlined />} onClick={() => handleExportar('pdf')}>PDF</Button>
              </>
            )}
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={solicitudes}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1100 }}
          tableLayout="fixed"
          size="small"
          pagination={false}
        />
      </Card>

      {/* MODAL: Aprobación */}
      <Modal
        title="Aprobar Solicitud"
        visible={modalAprobar}
        onOk={confirmarAprobar}
        onCancel={() => setModalAprobar(false)}
        okText="Confirmar"
        cancelText="Cancelar"
      >
        <p>¿Confirma la aprobación de la solicitud <strong>{solicitudSeleccionada?.correlativo}</strong>?</p>
        <p>Esta acción notificará al área de administración para proceder con el pago.</p>
      </Modal>

      {/* MODAL: Rechazo */}
      <Modal
        title="Rechazar Solicitud"
        visible={modalRechazar}
        onCancel={() => setModalRechazar(false)}
        footer={null}
      >
        <Form onFinish={confirmarRechazar} layout="vertical">
          <Form.Item name="motivo" label="Motivo del Rechazo" rules={[{ required: true }]}>
            <Input.TextArea rows={4} placeholder="Indique la razón por la cual rechaza esta solicitud..." />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setModalRechazar(false)}>Cancelar</Button>
              <Button type="primary" danger htmlType="submit">Rechazar Permanentemente</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL: Devolución */}
      <Modal
        title="Devolver Solicitud"
        visible={modalDevolver}
        onCancel={() => setModalDevolver(false)}
        footer={null}
      >
        <Form onFinish={confirmarDevolver} layout="vertical">
          <Form.Item name="motivo" label="Observaciones de Devolución" rules={[{ required: true }]}>
            <Input.TextArea rows={4} placeholder="Indique qué correcciones debe realizar el solicitante..." />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setModalDevolver(false)}>Cancelar</Button>
              <Button type="primary" htmlType="submit">Devolver para Corrección</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL: Pago */}
      <Modal
        title="Procesar Pago"
        visible={modalPagar}
        onOk={confirmarPagar}
        onCancel={() => { setModalPagar(false); form.resetFields(); }}
        okText="Registrar Pago"
        cancelText="Cancelar"
      >
        <p>Adjunte el comprobante de pago e indique la tasa BCV para la solicitud <strong>{solicitudSeleccionada?.correlativo}</strong></p>

        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="tasaBCV" label="Tasa de Cambio BCV del día" rules={[{ required: true, message: 'Indique la tasa BCV' }]}>
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="Ej: 36.45"
                  step={0.01}
                  min={0.01}
                  precision={4}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Comprobante de Pago">
                <Upload
                  beforeUpload={() => false}
                  fileList={fileListPagar}
                  onChange={({ fileList }) => setFileListPagar(fileList)}
                  maxCount={1}
                >
                  <Button icon={<UploadOutlined />}>Seleccionar Archivo</Button>
                </Upload>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* MODAL: Estadísticas Visuales */}
      <Modal
        title="Análisis Estadístico de Solicitudes"
        visible={modalEstadisticas}
        onCancel={() => setModalEstadisticas(false)}
        footer={null}
        width={1000}
      >
        <EstadisticasVisuales
          dataEstatus={estadisticas.porEstatus || []}
          dataDept={estadisticas.porDepartamento || []}
        />
      </Modal>
      {/* MODAL: Selección de Rango para Reportes */}
      <Modal
        title={tipoReporteActual === 'relacion' ? 'Relación de Solicitudes' : `Seleccionar Rango de Fechas - Reporte General (${tipoReporteActual?.toUpperCase()})`}
        open={modalReporte}
        onOk={generarReporteConFiltro}
        onCancel={() => {
          setModalReporte(false);
          setRangoFechas([null, null]);
        }}
        okText="Generar Reporte"
        cancelText="Cancelar"
        destroyOnClose
      >
        <div style={{ padding: '20px 0' }}>
          {tipoReporteActual === 'relacion' && (
            <div style={{ marginBottom: 20 }}>
              <p>Filtrar por Estatus (puede seleccionar varios o eliminarlos):</p>
              <Select
                mode="multiple"
                allowClear
                style={{ width: '100%' }}
                placeholder="Seleccione los estatus que desea incluir en el reporte"
                value={estatusReporte}
                onChange={(values) => setEstatusReporte(values)}
              >
                <Select.Option value="Pendiente">Pendiente</Select.Option>
                <Select.Option value="Autorizado">Autorizado</Select.Option>
                <Select.Option value="Aprobado">Aprobado</Select.Option>
                <Select.Option value="En Trámite">En Trámite</Select.Option>
                <Select.Option value="Pagado">Pagado</Select.Option>
                <Select.Option value="Cerrado">Cerrado</Select.Option>
                <Select.Option value="Devuelto">Devuelto</Select.Option>
                <Select.Option value="Rechazado">Rechazado</Select.Option>
                <Select.Option value="Anulado">Anulado</Select.Option>
              </Select>
            </div>
          )}
          <p>Indique el rango de fechas para filtrar el reporte:</p>
          <DatePicker.RangePicker
            style={{ width: '100%' }}
            value={rangoFechas}
            onChange={(dates) => setRangoFechas(dates)}
            format="DD/MM/YYYY"
            placeholder={['Fecha Inicial', 'Fecha Final']}
          />
          <p style={{ marginTop: 10, fontSize: '0.85em', color: '#666' }}>
            * El reporte incluirá las solicitudes desde el inicio del primer día hasta el final del último día seleccionado.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default Dashboard;