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
  DeleteOutlined
} from '@ant-design/icons';
import moment from 'moment';
import api from '../services/api';
import logo from '../assets/logo.png';
import { ThemeContext } from '../context/ThemeContext';

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
        centroCosto: data.centroCosto,
        montoTotal: Number(data.montoTotal),
        elaboradoPorNombre: data.elaboradoPor?.nombre || 'N/A',
        tiposSoporte: Array.isArray(data.tiposSoporte) ? data.tiposSoporte : (data.tiposSoporte ? [data.tiposSoporte] : [])
      });
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

  /**
   * Al cambiar el proveedor, autocompletamos los datos bancarios si existen
   */
  const handleCambioProveedor = (id) => {
    const prov = proveedores.find(p => p.id === id);
    if (prov && (prov.banco || prov.cuenta)) {
      const coordinates = `${prov.banco || ''} ${prov.cuenta || ''}`.trim();
      if (coordinates) {
        form.setFieldsValue({
          datosBancarios: {
            coordenadas: coordinates
          }
        });
      }
    }
  };

  /**
   * Guarda o actualiza la solicitud

  */
  const onFinish = async (values) => {
    setLoading(true);
    try {
      const provCompleto = proveedores.find(p => p.id === values.proveedorId);

      if (esEdicion) {
        // En edición mantenemos el envío JSON por ahora para simplificar, 
        // ya que la carga de archivos se centra en la creación según el reporte.
        const payload = { ...values, proveedor: provCompleto };
        await api.put(`/solicitudes/${id}`, payload);
        message.success('Solicitud actualizada');
      } else {
        const formData = new FormData();
        Object.keys(values).forEach(key => {
          if (values[key] !== undefined) {
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

        fileList.forEach(file => {
          formData.append('soportes', file.originFileObj);
        });

        const res = await api.post('/solicitudes', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        message.success('Solicitud creada con éxito');
        navigate(`/solicitudes/${res.data.solicitud.id}`);
      }
    } catch (e) {
      console.error(e);
      message.error('No se pudo guardar la solicitud');
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
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>Volver</Button>
        <img src={logo} style={{ height: 60 }} alt="Logo" />
        <Space>
          {esEdicion && <Button icon={<PrinterOutlined />} onClick={handleImprimir}>Imprimir PDF</Button>}
          <Tag color={
            solicitud?.estatus === 'Autorizado' ? 'purple' :
              (solicitud?.estatus === 'Aprobado' ? 'green' :
                (solicitud?.estatus === 'Pagado' ? 'cyan' :
                  (solicitud?.estatus === 'Cerrado' ? 'gold' :
                    (solicitud?.estatus === 'Devuelto' ? 'orange' :
                      (solicitud?.estatus === 'Anulado' ? 'default' : 'blue')))))
          } style={{ fontSize: 14, padding: '4px 10px' }}>
            {solicitud?.estatus || 'NUEVA'}
          </Tag>
        </Space>
      </div>

      <Row gutter={24}>
        <Col span={esEdicion ? 16 : 24}>
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
                <Col span={8}><Form.Item label="Correlativo" name="correlativo"><Input disabled placeholder="Auto-generado" /></Form.Item></Col>
                <Col span={8}><Form.Item label="Fecha de Solicitud" name="fechaSolicitud"><DatePicker disabled style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={8}><Form.Item label="Elaborado por" name="elaboradoPorNombre"><Input disabled /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}><Form.Item label="Unidad Solicitante" name="unidadSolicitante"><Input disabled /></Form.Item></Col>
                <Col span={12}><Form.Item label="N° de Requerimiento Asociado" name="numeroRequerimiento"><Input /></Form.Item></Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Fecha Límite Requerida" name="fechaLimiteRequerida" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
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
                <Col span={14}>
                  <Form.Item label="Proveedor" name="proveedorId" rules={[{ required: true }]}>
                    <Select showSearch optionFilterProp="children" onChange={handleCambioProveedor}>
                      {(Array.isArray(proveedores) ? proveedores : []).map(p => (
                        <Select.Option key={p.id} value={p.id}>{p.razonSocial} ({p.rif})</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>

                </Col>
                <Col span={10}>
                  <Form.Item label="Centro de Costo" name="centroCosto" rules={[{ required: true }]}>
                    <Select showSearch optionFilterProp="children">
                      {(Array.isArray(centros) ? centros : []).map(c => <Select.Option key={c.id} value={c.nombre}>{c.nombre}</Select.Option>)}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={8}><Form.Item label="Monto Total" name="montoTotal" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} precision={2} min={0} /></Form.Item></Col>
                <Col span={4}><Form.Item label="Moneda" name="moneda" rules={[{ required: true }]}><Select><Select.Option value="USD">USD</Select.Option><Select.Option value="Bs">Bs</Select.Option><Select.Option value="EUR">EUR</Select.Option></Select></Form.Item></Col>
                <Col span={12}><Form.Item label="Método de Pago" name="metodoPago" rules={[{ required: true }]}><Select><Select.Option value="Transferencia">Transferencia</Select.Option><Select.Option value="Pago Movil">Pago Móvil</Select.Option><Select.Option value="Efectivo">Efectivo</Select.Option><Select.Option value="e-pay">e-pay</Select.Option></Select></Form.Item></Col>
              </Row>
              <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.metodoPago !== currentValues.metodoPago}>
                {({ getFieldValue }) => {
                  const metodo = getFieldValue('metodoPago');
                  if (['Transferencia', 'Pago Movil', 'e-pay'].includes(metodo)) {
                    return (
                      <Row gutter={16}>
                        <Col span={24}>
                          <Form.Item label="Coordenadas o Credenciales" name={['datosBancarios', 'coordenadas']} rules={[{ required: true, message: 'Requerido para el método de pago seleccionado' }]}>
                            <Input.TextArea rows={2} placeholder="Ingrese números de cuenta, teléfonos, RIF, correo u otros datos necesarios para el pago" />
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
                  <Col span={8}>
                    <Form.Item label="Tasa BCV del Pago" name="tasaBCV">
                      <InputNumber style={{ width: '100%' }} disabled precision={4} />
                    </Form.Item>
                  </Col>
                </Row>
              )}

              <Divider orientation="left">4. Soportes Adicionales (Layout PDF)</Divider>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Tipos de Soporte" name="tiposSoporte">
                    <Checkbox.Group style={{ width: '100%' }}>
                      <Row>
                        <Col span={12}><Checkbox value="FACTURA">FACTURA</Checkbox></Col>
                        <Col span={12}><Checkbox value="NOTA DE ENTREGA">NOTA DE ENTREGA</Checkbox></Col>
                        <Col span={12}><Checkbox value="PRESUPUESTO">PRESUPUESTO</Checkbox></Col>
                        <Col span={12}><Checkbox value="OBLIGACIONES">OBLIGACIONES</Checkbox></Col>
                        <Col span={12}><Checkbox value="OTROS">OTROS</Checkbox></Col>
                      </Row>
                    </Checkbox.Group>
                  </Form.Item>
                </Col>
                <Col span={12}>
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
                <Space size="middle">
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
          <Col span={8}>
            <Card title="Historial y Comentarios" style={{ height: '100%' }}>
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