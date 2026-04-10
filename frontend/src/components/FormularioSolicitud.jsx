/**
 * FORMULARIO DE SOLICITUD (FormularioSolicitud.jsx)
 * Componente dinámico utilizado tanto para crear nuevas solicitudes
 * como para ver el detalle de las existentes (modo lectura/edición).
 */

import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Select,
  DatePicker,
  Radio,
  Upload,
  Checkbox,
  message,
  Divider,
  Row,
  Col,
  InputNumber,
  Card,
  Space,
  Tag,
  List,
  Typography,
  Timeline,
  Modal,
  Alert,
  Popconfirm
} from 'antd';
import {
  SaveOutlined,
  PrinterOutlined,
  ArrowLeftOutlined,
  UploadOutlined,
  CheckOutlined,
  CloseOutlined,
  UndoOutlined,
  DollarOutlined,
  SendOutlined,
  BulbOutlined,
  DeleteOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import moment from 'moment';
import api from '../services/api';
import logo from '../assets/logo.png';
import { ThemeContext } from '../context/ThemeContext';
import DistribucionCentrosCosto from './DistribucionCentrosCosto';

const { Text, Title, Paragraph } = Typography;

const FormularioSolicitud = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [esEdicion, setEsEdicion] = useState(false);
  const [solicitud, setSolicitud] = useState(null);
  const [centros, setCentros] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [comentario, setComentario] = useState('');
  const [fileList, setFileList] = useState([]);
  const [distribucion, setDistribucion] = useState([]);
  const [montoActual, setMontoActual] = useState(0);
  const [monedaActual, setMonedaActual] = useState('USD');
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDarkMode } = useContext(ThemeContext);

  // Detectar URL base para archivos
  const isLocal = window.location.port === '5173' || window.location.hostname === 'localhost';
  const fileBaseURL = isLocal ? `http://${window.location.hostname}:3000` : window.location.origin;

  // Cargamos datos del usuario para el autocompletado del encabezado
  const usuario = JSON.parse(localStorage.getItem('usuario'));

  useEffect(() => {
    fetchAuxiliares();
    if (id) {
      setEsEdicion(true);
      cargarDetalleSolicitud(id);
    } else {
      // Valores por defecto para nueva solicitud
      form.setFieldsValue({
        fechaSolicitud: moment(),
        unidadSolicitante: usuario.departamento,
        elaboradoPorNombre: usuario.nombre,
        estatus: 'Creado'
      });
    }
  }, [id]);

  /**
   * Carga listas de maestros (Proveedores, Centros de Costo)
   */
  const fetchAuxiliares = async () => {
    try {
      const [c, p] = await Promise.all([api.get('/centros-costo'), api.get('/proveedores')]);
      setCentros(c.data);
      setProveedores(p.data);
    } catch (e) { message.error('Error al cargar datos auxiliares'); }
  };

  /**
   * Carga una solicitud específica para verla o editarla
   */
  const cargarDetalleSolicitud = async (solId) => {
    try {
      setLoading(true);
      const res = await api.get(`/solicitudes/${solId}`);
      const data = res.data;
      setSolicitud(data);

      // Mapeo de datos para que Ant Design los entienda (moment para fechas, JSON para objetos)
      form.setFieldsValue({
        ...data,
        fechaSolicitud: moment(data.fechaSolicitud),
        fechaLimiteRequerida: moment(data.fechaLimiteRequerida),
        proveedorId: data.proveedor?.id,
        montoTotal: Number(data.montoTotal),
        elaboradoPorNombre: data.elaboradoPor?.nombre || 'N/A',
        tiposSoporte: Array.isArray(data.tiposSoporte) ? data.tiposSoporte : (data.tiposSoporte ? [data.tiposSoporte] : []),
        tasaBCV: data.tasaBCV ? Number(data.tasaBCV) : undefined
      });
      setMontoActual(Number(data.montoTotal));
      setMonedaActual(data.moneda || 'USD');
      // Cargar distribución de centros de costo si existe
      if (Array.isArray(data.distribucionCentros) && data.distribucionCentros.length > 0) {
        const dist = data.distribucionCentros.map((d, i) => ({
          key: d.id || Date.now() + i,
          centroCostoId: d.centroCostoId,
          monto: d.monto,
          porcentaje: d.porcentaje,
          descripcion: d.descripcion || ''
        }));
        setDistribucion(dist);
      }
      setFileList([]); // Reset file list for new uploads
    } catch (e) { message.error('Error al cargar detalle'); }
    finally { setLoading(false); }
  };

  /**
   * ACCIÓN: Carga archivo adicional (Factura/Soporte) sin cambiar estado obligatoriamente
   */
  const handleSubirSoporteAdicional = async () => {
    if (fileList.length === 0) return message.warning('Seleccione un archivo primero');
    setLoading(true);
    try {
      const formData = new FormData();
      fileList.forEach(file => formData.append('comprobante', file.originFileObj)); // Reusamos el campo 'comprobante' del backend que procesa archivos unitarios en PUT

      await api.patch(`/solicitudes/${id}/estatus`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      message.success('Soporte adjuntado correctamente');
      setFileList([]);
      cargarDetalleSolicitud(id);
    } catch (e) {
      message.error('Error al subir soporte');
    } finally {
      setLoading(false);
    }
  };

  const handleCambioProveedor = (id) => {
    const prov = proveedores.find(p => p.id === id);
    if (prov) {
      form.setFieldsValue({
        datosBancarios: {
          banco: prov.banco,
          bancoPago: prov.bancoPago,
          cuenta: prov.cuenta,
          telefonoPago: prov.telefonoPago,
          rifPago: prov.rifPago,
          emailPago: prov.emailPago
        }
      });
    }
  };

  /**
   * Guarda o actualiza la solicitud

  */
  const onFinish = async (values) => {
    setLoading(true);
    try {
      const provCompleto = proveedores.find(p => p.id === values.proveedorId);

      const formData = new FormData();

      // Procesar valores del formulario
      Object.keys(values).forEach(key => {
        if (values[key] !== undefined && values[key] !== null) {
          if (key === 'fechaSolicitud' || key === 'fechaLimiteRequerida') {
            formData.append(key, values[key].toISOString());
          } else if (key === 'proveedorId') {
            formData.append('proveedor', JSON.stringify(provCompleto));
          } else if (key === 'tiposSoporte') {
            formData.append('tiposSoporte', JSON.stringify(values[key] || []));
          } else if (key === 'datosBancarios') {
            formData.append('datosBancarios', JSON.stringify(values[key] || {}));
          } else {
            formData.append(key, values[key]);
          }
        }
      });

      // Agregar distribución de centros de costo (Vital para persistencia)
      if (distribucion && distribucion.length > 0) {
        formData.append('distribucionCentros', JSON.stringify(distribucion));
      }

      // Agregar archivos nuevos si los hay
      fileList.forEach(file => {
        if (file.originFileObj) {
          formData.append('soportes', file.originFileObj);
        }
      });

      if (esEdicion) {
        await api.put(`/solicitudes/${id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        message.success('Solicitud actualizada correctamente');
        if (typeof cargarDetalleSolicitud === 'function') cargarDetalleSolicitud(id);
      } else {
        const res = await api.post('/solicitudes', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        message.success('Solicitud creada con éxito');
        navigate(`/solicitudes/${res.data.solicitud.id}`);
      }
    } catch (e) {
      console.error('[ON_FINISH ERROR]', e);
      message.error(e.response?.data?.error || 'No se pudo guardar la solicitud');
    }
    setLoading(false);
  };

  /**
   * FUNCIÓN DE PRUEBA: Autocompleta el formulario con datos ficticios
   */
  const handleLlenarPrueba = () => {
    const randomMonto = (Math.random() * 500 + 100).toFixed(2);
    const fechaFutura = moment().add(5, 'days');

    // Seleccionamos el primer proveedor y centro de costo si existen
    const primerPv = proveedores.length > 0 ? proveedores[0].id : undefined;
    const primerCc = centros.length > 0 ? centros[0].nombre : undefined;

    form.setFieldsValue({
      fechaLimiteRequerida: fechaFutura,
      nivelPrioridad: 'Planificada',
      conceptoPago: `Adquisición de Insumos de Oficina - Lote ${Math.floor(Math.random() * 100)}`,
      observaciones: 'Esta es una solicitud de prueba generada automáticamente.',
      proveedorId: primerPv,
      centroCosto: primerCc,
      montoTotal: Number(randomMonto),
      moneda: 'USD',
      metodoPago: 'Transferencia',
      datosBancarios: {
        coordenadas: 'BANCO MERCANTIL - CUENTA CORRIENTE: 0105-0000-00-0000000000'
      },
      tiposSoporte: 'FACTURA',
      tipoPago: 'Unico Pago'
    });

    message.info('Formulario autocompletado para pruebas 🪄');
  };

  const agregarComentario = async () => {
    if (!comentario.trim()) return;
    try {
      await api.post(`/solicitudes/${id}/comentarios`, { mensaje: comentario });
      setComentario('');
      cargarDetalleSolicitud(id);
      message.success('Comentario agregado');
    } catch (e) { message.error('Error al comentar'); }
  };

  const handleDeleteSoporte = async (index) => {
    try {
      setLoading(true);
      await api.delete(`/solicitudes/${id}/soportes/${index}`);
      message.success('Soporte eliminado');
      cargarDetalleSolicitud(id);
    } catch (e) {
      console.error(e);
      message.error(e.response?.data?.error || 'Error al eliminar soporte');
    } finally {
      setLoading(false);
    }
  };

  const handleImprimir = async () => {
    try {
      const res = await api.get(`/solicitudes/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url);
    } catch (e) { message.error('Error al generar PDF'); }
  };

  // BOTONES DE ACCIÓN RÁPIDA (Solo para Admin en modo lectura)
  const handleAccion = async (nuevoEstatus) => {
    if (nuevoEstatus === 'Devuelto' || nuevoEstatus === 'Rechazado') {
      const refMotivo = { valor: '' };
      Modal.confirm({
        title: `Motivo de ${nuevoEstatus === 'Devuelto' ? 'Devolución' : 'Rechazo'}`,
        content: (
          <Input.TextArea
            placeholder="Escriba aquí el motivo detallado..."
            onChange={(e) => { refMotivo.valor = e.target.value; }}
            rows={4}
            style={{ marginTop: 10 }}
          />
        ),
        onOk: async () => {
          if (!refMotivo.valor.trim()) {
            message.error('Debe ingresar un motivo');
            return Promise.reject();
          }
          try {
            await api.patch(`/solicitudes/${id}/estatus`, {
              estatus: nuevoEstatus,
              motivo: refMotivo.valor,
              comentario: refMotivo.valor
            });
            message.success(`Estado actualizado a ${nuevoEstatus}`);
            cargarDetalleSolicitud(id);
          } catch (e) {
            console.error('[DEBUG ERROR] Error al actualizar estado:', e);
            message.error('Error al actualizar estado');
          }
        }
      });
    } else {
      try {
        await api.patch(`/solicitudes/${id}/estatus`, { estatus: nuevoEstatus });
        message.success(`Estado actualizado a ${nuevoEstatus}`);
        cargarDetalleSolicitud(id);
      } catch (e) { message.error('Error al actualizar estado'); }
    }
  };

  const puedeEditar = !esEdicion || (['Creado', 'Devuelto', 'Anulado', 'Pendiente'].includes(solicitud?.estatus));

  return (
    <div className="formulario-solicitud" style={{ padding: 24, maxWidth: 1200, margin: '0 auto', overflowX: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>Volver</Button>
        <img src={logo} style={{ height: 60 }} alt="Logo" />
        <Space>
          {esEdicion && <Button icon={<PrinterOutlined />} onClick={handleImprimir}>Imprimir PDF</Button>}
          <Tag color={
            solicitud?.estatus === 'Autorizado' ? 'purple' :
              (solicitud?.estatus === 'Aprobado' ? 'green' :
                (solicitud?.estatus === 'En Trámite' ? 'geekblue' :
                  (solicitud?.estatus === 'Pagado' ? 'cyan' :
                    (solicitud?.estatus === 'Cerrado' ? 'gold' :
                      (solicitud?.estatus === 'Devuelto' ? 'orange' :
                        (solicitud?.estatus === 'Anulado' ? 'default' : 'blue'))))))
          } style={{ fontSize: 14, padding: '4px 10px' }}>
            {solicitud?.estatus || 'NUEVA'}
          </Tag>
        </Space>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={esEdicion ? 16 : 24}>
          <Card loading={loading}>
            <Form form={form} layout="vertical" onFinish={onFinish} disabled={!puedeEditar}>
              {solicitud?.estatus === 'Devuelto' && (
                <Alert
                  message="Solicitud Devuelta para Corrección"
                  description={solicitud.motivoDevolucion}
                  type="warning"
                  showIcon
                  style={{ marginBottom: 20 }}
                />
              )}
              {solicitud?.estatus === 'Anulado' && (
                <Alert
                  message="Solicitud Anulada por el Solicitante"
                  description="Puede realizar las correcciones necesarias y guardar los cambios para enviarla de nuevo a revisión."
                  type="info"
                  showIcon
                  style={{ marginBottom: 20 }}
                />
              )}
              {solicitud?.estatus === 'Rechazado' && (
                <Alert
                  message="Solicitud Rechazada"
                  description={solicitud.motivoRechazo}
                  type="error"
                  showIcon
                  style={{ marginBottom: 20 }}
                />
              )}
              <Divider orientation="left">1. Información de la Unidad</Divider>
              <Row gutter={16}>
                <Col xs={24} md={8}><Form.Item label="Correlativo" name="correlativo"><Input disabled placeholder="Auto-generado" /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item label="Fecha de Solicitud" name="fechaSolicitud"><DatePicker disabled style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item label="Elaborado por" name="elaboradoPorNombre"><Input disabled /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24} md={12}><Form.Item label="Unidad Solicitante" name="unidadSolicitante"><Input disabled /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item label="N° de Requerimiento Asociado" name="numeroRequerimiento"><Input /></Form.Item></Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item label="Fecha Límite Requerida" name="fechaLimiteRequerida" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Nivel de Prioridad" name="nivelPrioridad" rules={[{ required: true }]}>
                    <Select>
                      <Select.Option value="Planificada">Planificada</Select.Option>
                      <Select.Option value="Urgente">Urgente</Select.Option>
                      <Select.Option value="Emergencia">Emergencia</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Divider orientation="left">2. Descripción del Bien / Servicio</Divider>
              <Form.Item label="Concepto del Pago" name="conceptoPago" rules={[{ required: true }]}>
                <Input.TextArea rows={2} />
              </Form.Item>
              <Form.Item label="Observaciones adicionales" name="observaciones">
                <Input.TextArea rows={2} />
              </Form.Item>

              <Divider orientation="left">3. Datos del Proveedor y Monto</Divider>
              <Row gutter={16}>
                <Col xs={24} md={24}>
                  <Form.Item label="Proveedor" name="proveedorId" rules={[{ required: true }]}>
                    <Select showSearch optionFilterProp="children" onChange={handleCambioProveedor}>
                      {(() => {
                        const opts = [...(Array.isArray(proveedores) ? proveedores : [])];
                        // Si la solicitud tiene un proveedor guardado y este no está en la lista de activos, lo agregamos para visualización
                        if (solicitud?.proveedor?.id && !opts.find(p => p.id === solicitud.proveedor.id)) {
                          opts.push(solicitud.proveedor);
                        }
                        return opts.map(p => (
                          <Select.Option key={p.id} value={p.id}>{p.razonSocial} ({p.rif})</Select.Option>
                        ));
                      })()}
                    </Select>
                  </Form.Item>

                </Col>
              </Row>

              {/* Distribución de Centros de Costo */}
              <Form.Item
                noStyle
                shouldUpdate={(prev, curr) => prev.montoTotal !== curr.montoTotal || prev.moneda !== curr.moneda}
              >
                {({ getFieldValue }) => {
                  const monto = getFieldValue('montoTotal') || 0;
                  const moneda = getFieldValue('moneda') || 'USD';
                  return (
                    centros.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <DistribucionCentrosCosto
                          total={monto}
                          centros={centros}
                          onChange={setDistribucion}
                          moneda={moneda}
                          initialLines={distribucion}
                        />
                      </div>
                    )
                  );
                }}
              </Form.Item>

              <Row gutter={16}>
                <Col xs={24} sm={12} md={8}><Form.Item label="Monto Total" name="montoTotal" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} precision={2} min={0} /></Form.Item></Col>
                <Col xs={24} sm={12} md={4}><Form.Item label="Moneda" name="moneda" rules={[{ required: true }]}><Select><Select.Option value="USD">USD</Select.Option><Select.Option value="Bs">Bs</Select.Option><Select.Option value="EUR">EUR</Select.Option></Select></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item label="Método de Pago" name="metodoPago" rules={[{ required: true }]}><Select><Select.Option value="Transferencia">Transferencia</Select.Option><Select.Option value="Pago Movil">Pago Móvil</Select.Option><Select.Option value="Efectivo">Efectivo</Select.Option><Select.Option value="e-pay">e-pay</Select.Option></Select></Form.Item></Col>
              </Row>
              <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.metodoPago !== currentValues.metodoPago}>
                {({ getFieldValue }) => {
                  const metodo = getFieldValue('metodoPago');
                  if (metodo === 'Transferencia') {
                    return (
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item label="Banco" name={['datosBancarios', 'banco']} rules={[{ required: true }]}>
                            <Input placeholder="Ej: Mercantil" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item label="Número de Cuenta" name={['datosBancarios', 'cuenta']} rules={[{ required: true }]}>
                            <Input placeholder="0105..." />
                          </Form.Item>
                        </Col>
                      </Row>
                    );
                  }
                  if (metodo === 'Pago Movil') {
                    return (
                      <Row gutter={16}>
                        <Col span={8}>
                          <Form.Item label="Banco" name={['datosBancarios', 'bancoPago']} rules={[{ required: true }]}>
                            <Input placeholder="Ej: Mercantil" />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item label="Teléfono" name={['datosBancarios', 'telefonoPago']} rules={[{ required: true }]}>
                            <Input placeholder="0412..." />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item label="RIF/Cédula" name={['datosBancarios', 'rifPago']} rules={[{ required: true }]}>
                            <Input placeholder="V..." />
                          </Form.Item>
                        </Col>
                      </Row>
                    );
                  }
                  if (metodo === 'e-pay') {
                    return (
                      <Row gutter={16}>
                        <Col span={24}>
                          <Form.Item label="Correo e-pay" name={['datosBancarios', 'emailPago']} rules={[{ required: true, type: 'email' }]}>
                            <Input placeholder="pago@e-pay.com" />
                          </Form.Item>
                        </Col>
                      </Row>
                    );
                  }
                  return null;
                }}
              </Form.Item>

              {solicitud?.tasaBCV && (
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <div style={{
                      background: 'linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%)',
                      border: '1px solid #52c41a',
                      borderRadius: 8,
                      padding: '12px 16px',
                      marginBottom: 16,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10
                    }}>
                      <DollarOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                      <div>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>TASA BCV AL MOMENTO DEL PAGO</Text>
                        <Text strong style={{ fontSize: 18, color: '#237804' }}>
                          Bs. {Number(solicitud.tasaBCV).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </Text>
                      </div>
                    </div>
                  </Col>
                </Row>
              )}

              <Divider orientation="left">4. Soportes Adicionales (Layout PDF)</Divider>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item label="Tipos de Soporte" name="tiposSoporte">
                    <Checkbox.Group style={{ width: '100%' }}>
                      <Row>
                        <Col xs={12} md={12}><Checkbox value="FACTURA">FACTURA</Checkbox></Col>
                        <Col xs={12} md={12}><Checkbox value="NOTA DE ENTREGA">NOTA DE ENTREGA</Checkbox></Col>
                        <Col xs={12} md={12}><Checkbox value="PRESUPUESTO">PRESUPUESTO</Checkbox></Col>
                        <Col xs={12} md={12}><Checkbox value="OBLIGACIONES">OBLIGACIONES</Checkbox></Col>
                        <Col xs={12} md={12}><Checkbox value="OTROS">OTROS</Checkbox></Col>
                      </Row>
                    </Checkbox.Group>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="N° Orden de Compra" name="numeroOrdenCompra">
                    <Input placeholder="Ej: OC-001" />
                  </Form.Item>
                </Col>
              </Row>

              <Divider orientation="left">5. Tipo de Pago</Divider>
              <Form.Item name="tipoPago" rules={[{ required: true }]}>
                <Radio.Group>
                  <Radio value="Unico Pago">Único Pago</Radio>
                  <Radio value="Anticipo">Anticipo</Radio>
                  <Radio value="Fondo Fijo">Fondo Fijo</Radio>
                </Radio.Group>
              </Form.Item>




              {puedeEditar && (
                <div style={{ textAlign: 'center', marginTop: 40 }}>
                  <Space size="large">
                    {/* 
                      {!esEdicion && (
                        <Button
                          icon={<BulbOutlined />}
                          onClick={handleLlenarPrueba}
                          style={{ backgroundColor: '#fffbe6', borderColor: '#ffe58f' }}
                        >
                          Autocompletar Prueba
                        </Button>
                      )}
                    */}
                    <Button type="primary" htmlType="submit" size="large" icon={<SaveOutlined />} loading={loading}>
                      {esEdicion ? 'Guardar Cambios' : 'Registrar Solicitud'}
                    </Button>
                  </Space>
                </div>
              )}
            </Form>

            {(!esEdicion || (esEdicion && solicitud?.estatus !== 'Cerrado')) && (
              <>
                <Divider orientation="left">{esEdicion ? 'Adjuntar Factura o Soporte' : '6. Soportes y Documentos'}</Divider>
                <div style={{ marginBottom: 20 }}>
                  <Text type="secondary">
                    {esEdicion
                      ? "Puede subir la factura o soportes adicionales aquí:"
                      : "Adjunte los soportes iniciales (Facturas, Presupuestos, etc.):"}
                  </Text>
                  <>
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginBottom: 10 }}
                      message="Formatos soportados"
                      description="PDF e Imágenes (JPG, PNG, WEBP). Los archivos se incluirán en el expediente consolidado al imprimir (despues de que el status sea 'Cerrado')."
                    />
                    <div style={{ marginTop: 10 }}>
                      <Space>
                        <Upload
                          beforeUpload={() => false}
                          multiple={!esEdicion}
                          fileList={fileList}
                          onChange={({ fileList }) => setFileList(fileList)}
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                        >
                          <Button icon={<UploadOutlined />}>Seleccionar Archivo{!esEdicion && 's'}</Button>
                        </Upload>
                        {esEdicion && fileList.length > 0 && (
                          <Button type="primary" icon={<UploadOutlined />} onClick={handleSubirSoporteAdicional}>Subir Ahora</Button>
                        )}
                      </Space>
                    </div>
                  </>
                </div>
              </>
            )}

            {esEdicion && ((solicitud?.soportes && solicitud.soportes.length > 0) || solicitud?.comprobantePago) && (
              <>
                <Divider orientation="left">Documentos Adjuntos</Divider>
                {solicitud?.soportes && solicitud.soportes.length > 0 && (
                  <List
                    size="small"
                    bordered
                    dataSource={solicitud.soportes}
                    renderItem={(file, index) => {
                      const userRol = usuario?.rol?.toLowerCase();
                      const esSolicitanteDueño = usuario?.id === solicitud?.elaboradoPor?.id ||
                                                 usuario?.departamento === solicitud?.unidadSolicitante;
                      const estatusEditable = ['Devuelto', 'Anulado'].includes(solicitud?.estatus);
                      const canDelete = (userRol === 'administrador' || userRol === 'auditor') ||
                                       (esSolicitanteDueño && estatusEditable);

                      return (
                        <List.Item
                          actions={[
                            <Button
                              key="view"
                              type="primary"
                              ghost
                              size="small"
                              onClick={() => window.open(`${fileBaseURL}/${file.ruta.replace(/\\/g, '/')}`)}
                            >
                              Ver documento
                            </Button>,
                            canDelete && (
                              <Popconfirm
                                key="delete"
                                title="¿Eliminar este soporte?"
                                description="Esta acción no se puede deshacer."
                                onConfirm={() => handleDeleteSoporte(index)}
                                okText="Sí, borrar"
                                cancelText="No"
                                okButtonProps={{ danger: true }}
                              >
                                <Button danger size="small" icon={<DeleteOutlined />} />
                              </Popconfirm>
                            )
                          ].filter(Boolean)}
                        >
                          <List.Item.Meta
                            title={<Tag color="blue">{file.nombre}</Tag>}
                            description={file.subidoPorRol ? `Subido por: ${file.subidoPorRol}` : null}
                          />
                        </List.Item>
                      );
                    }}
                  />
                )}

                {solicitud?.comprobantePago && (
                  <List
                    style={{ marginTop: 10 }}
                    size="small"
                    bordered
                    dataSource={[solicitud.comprobantePago]}
                    renderItem={ruta => (
                      <List.Item>
                        <Space>
                          <Tag color="cyan">COMPROBANTE DE PAGO</Tag>
                          <Button
                            type="primary"
                            size="small"
                            icon={<DollarOutlined />}
                            onClick={() => window.open(`${fileBaseURL}/${ruta.replace(/\\/g, '/')}`)}
                          >
                            Ver Comprobante
                          </Button>
                        </Space>
                      </List.Item>
                    )}
                  />
                )}
                <Divider />
              </>
            )}

            {/* Panel de Acciones (Solo si no puede editar o es un revisor) */}
            {esEdicion && (usuario?.rol === 'Administrador' || usuario?.rol === 'Auditor' || usuario?.rol === 'Gestor') && (
              <div style={{ marginTop: 20, padding: 20, border: '1px solid #d9d9d9', borderRadius: 8, textAlign: 'center' }}>
                <Title level={5}>Acciones de Revisión</Title>
                <Space size="middle" wrap style={{ justifyContent: 'center' }}>
                  {/* ACCIONES DEL GESTOR (GERENTE) */}
                  {usuario?.rol === 'Gestor' && solicitud?.estatus === 'Pendiente' && (
                    <Button type="primary" icon={<CheckOutlined />} onClick={() => handleAccion('Autorizado')} style={{ backgroundColor: '#722ed1' }}>Autorizar</Button>
                  )}

                  {/* ACCIONES DEL ADMINISTRADOR / AUDITOR */}
                  {(solicitud?.estatus === 'Pendiente' || solicitud?.estatus === 'Autorizado' || solicitud?.estatus === 'Aprobado') && (
                    <>
                      {usuario?.rol === 'Administrador' && solicitud?.estatus === 'Autorizado' && (
                        <Button type="primary" icon={<CheckOutlined />} onClick={() => handleAccion('Aprobado')} style={{ backgroundColor: '#52c41a' }}>Aprobar</Button>
                      )}
                      {(usuario?.rol === 'Administrador' || usuario?.rol === 'Auditor' || (usuario?.rol === 'Gestor' && (solicitud?.estatus === 'Pendiente' || solicitud?.estatus === 'Autorizado'))) && (
                        <Button icon={<UndoOutlined />} onClick={() => handleAccion('Devuelto')}>Devolver</Button>
                      )}
                      {usuario?.rol === 'Administrador' && (
                        <Button danger icon={<CloseOutlined />} onClick={() => handleAccion('Rechazado')}>Rechazar</Button>
                      )}
                    </>
                  )}
                  {solicitud?.estatus === 'Aprobado' && usuario?.rol === 'Administrador' && (
                    <Button type="primary" icon={<DollarOutlined />} onClick={() => handleAccion('Pagado')}>Marcar como Pagada</Button>
                  )}
                  {solicitud?.estatus === 'Pagado' && usuario?.rol === 'Administrador' && (
                    <>
                      <Button icon={<ClockCircleOutlined />} onClick={() => handleAccion('En Trámite')} style={{ backgroundColor: '#2f54eb', color: 'white' }}>Marcar En Trámite</Button>
                      <Button type="primary" icon={<CheckOutlined />} onClick={() => handleAccion('Cerrado')} style={{ backgroundColor: '#faad14' }}>Cerrar Solicitud</Button>
                    </>
                  )}
                  {solicitud?.estatus === 'En Trámite' && usuario?.rol === 'Administrador' && (
                    <Button type="primary" icon={<CheckOutlined />} onClick={() => handleAccion('Cerrado')} style={{ backgroundColor: '#faad14' }}>Cerrar Solicitud</Button>
                  )}
                </Space>
              </div>
            )}

            {/* BOTÓN ANULAR PARA SOLICITANTE */}
            {esEdicion && solicitud?.estatus === 'Pendiente' && (usuario?.id === solicitud?.elaboradoPor?.id || usuario?.departamento === solicitud?.unidadSolicitante) && (
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <Button danger icon={<CloseOutlined />} onClick={() => handleAccion('Anulado')}>Anular Solicitud</Button>
              </div>
            )}
          </Card>
        </Col>

        {esEdicion && (
          <Col xs={24} lg={8}>
            <Card title="Historial y Comentarios" style={{ height: '100%', marginTop: '16px' }}>
              <Timeline mode="left">
                {(Array.isArray(solicitud?.historial) ? solicitud.historial : []).map((h, i) => (
                  <Timeline.Item key={i} label={moment(h.fecha).format('DD/MM HH:mm')}>
                    <Text strong>{h.accion}</Text><br />
                    <Text type="secondary" style={{ fontSize: '12px' }}>{h.usuarioNombre || 'Sistema'}</Text>
                    {h.comentario && (
                      <div style={{ marginTop: 4, padding: '4px 8px', backgroundColor: '#f5f5f5', borderRadius: 4, fontSize: '12px', borderLeft: '3px solid #1890ff' }}>
                        {h.comentario}
                      </div>
                    )}
                  </Timeline.Item>
                ))}
              </Timeline>

              <Divider>Comentarios</Divider>
              <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 20 }}>
                <List
                  dataSource={Array.isArray(solicitud?.comentarios) ? solicitud.comentarios : []}
                  renderItem={item => (
                    <List.Item>
                      <div>
                        <Text strong>{item.usuarioNombre}: </Text>
                        <Paragraph style={{ marginBottom: 0 }}>{item.mensaje}</Paragraph>
                        <Text type="secondary" size="small">{moment(item.fecha).fromNow()}</Text>
                      </div>
                    </List.Item>
                  )}
                />
              </div>
              <Input.Search
                placeholder="Escribir comentario..."
                enterButton={<SendOutlined />}
                value={comentario}
                onChange={e => setComentario(e.target.value)}
                onSearch={agregarComentario}
              />
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
};

export default FormularioSolicitud;