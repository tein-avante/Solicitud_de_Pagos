/**
 * GESTIÓN DE MAESTROS (Maestros.jsx)
 * Panel administrativo para gestionar las tablas de referencia del sistema.
 * Solo accesible por usuarios con rol 'Administrador'.
 */

import React, { useState, useEffect } from 'react';
import {
    Card,
    Tabs,
    Table,
    Button,
    Space,
    message,
    Modal,
    Form,
    Input,
    Select,
    Typography,
    Popconfirm,
    Upload,
    Divider,
    Tag
} from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    ArrowLeftOutlined,
    DeleteOutlined,
    UserOutlined,
    ShopOutlined,
    AppstoreOutlined,
    UploadOutlined,
    FileExcelOutlined,
    KeyOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const { TabPane } = Tabs;
const { Title } = Typography;

const Maestros = () => {
    const [proveedores, setProveedores] = useState([]);
    const [centros, setCentros] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [departamentos, setDepartamentos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [bulkModalVisible, setBulkModalVisible] = useState(false);
    const [currentTab, setCurrentTab] = useState("1");
    const [editItem, setEditItem] = useState(null);
    const [uploading, setUploading] = useState(false);

    // Obtener datos del usuario logueado
    const storedUser = localStorage.getItem('usuario');
    const usuario = storedUser ? JSON.parse(storedUser) : null;

    const [form] = Form.useForm();
    const navigate = useNavigate();

    useEffect(() => {
        const currentRol = usuario?.rol?.toLowerCase();
        if (currentRol !== 'administrador' && currentRol !== 'gestor' && currentRol !== 'auditor') {
            message.error('Acceso restringido');
            navigate('/');
        } else {
            cargarDatos();
        }
    }, []);

    const cargarDatos = async () => {
        setLoading(true);
        try {
            const [p, c, u, d] = await Promise.all([
                api.get('/proveedores'),
                api.get('/centros-costo'),
                api.get('/usuarios'),
                api.get('/departamentos')
            ]);
            setProveedores(p.data);
            setCentros(c.data);
            setUsuarios(u.data);
            setDepartamentos(d.data);
        } catch (e) { message.error('Error al cargar datos'); }
        setLoading(false);
    };

    const handleOpenModal = (item = null) => {
        setEditItem(item);
        if (item) {
            form.setFieldsValue(item);
        } else {
            form.resetFields();
        }
        setModalVisible(true);
    };

    const onFinish = async (values) => {
        let endpoint = "proveedores";
        if (currentTab === "2") endpoint = "centros-costo";
        if (currentTab === "3") endpoint = "usuarios";
        if (currentTab === "4") endpoint = "departamentos";

        try {
            if (editItem) {
                await api.put(`/${endpoint}/${editItem.id}`, values);
                message.success('Registro actualizado');
            } else {
                await api.post(`/${endpoint}`, values);
                message.success('Registro creado');
            }
            setModalVisible(false);
            cargarDatos();
        } catch (e) {
            console.error('[SAVE ERROR]:', e);
            message.error(e.response?.data?.error || 'No se pudo guardar la información');
        }
    };

    const handleDelete = async (endpoint, id) => {
        try {
            await api.delete(`/${endpoint}/${id}`);
            message.success('Eliminado');
            cargarDatos();
        } catch (e) { message.error('Error al eliminar'); }
    };

    const handleDescargarPlantilla = async () => {
        try {
            const response = await api.get('/proveedores/plantilla', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'plantilla_proveedores.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (e) {
            message.error('No se pudo descargar la plantilla');
        }
    };

    const handleCargaMasiva = async (file) => {
        setUploading(true);
        const formData = new FormData();
        formData.append('archivo', file);

        try {
            const res = await api.post('/proveedores/carga-masiva', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const { creados, actualizados, errores, detallesErrores } = res.data.detalles;

            Modal.success({
                title: 'Carga Masiva Finalizada',
                width: 600,
                content: (
                    <div>
                        <p><strong>Resultados:</strong></p>
                        <ul>
                            <li style={{ color: '#52c41a' }}>Nuevos proveedores: {creados}</li>
                            <li style={{ color: '#1890ff' }}>Registros actualizados: {actualizados}</li>
                            <li style={{ color: errores > 0 ? '#ff4d4f' : '#8c8c8c' }}>Filas con error: {errores}</li>
                        </ul>
                        {detallesErrores && detallesErrores.length > 0 && (
                            <div style={{ marginTop: 10 }}>
                                <p><strong>Detalle de errores:</strong></p>
                                <div style={{ maxHeight: 200, overflowY: 'auto', padding: 10, backgroundColor: '#fff1f0', border: '1px solid #ffccc7', borderRadius: 4 }}>
                                    {detallesErrores.map((err, idx) => (
                                        <div key={idx} style={{ fontSize: '12px', color: '#cf1322', marginBottom: 4 }}>• {err}</div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )
            });

            setBulkModalVisible(false);
            cargarDatos();
        } catch (e) {
            message.error(e.response?.data?.error || 'Error al procesar el archivo');
        }
        setUploading(false);
        return false; // Evitar carga automática de antd
    };

    const handleResetPassword = (userId, targetEmail) => {
        Modal.confirm({
            title: '¿Resetear contraseña?',
            content: `Se le asignará la clave temporal "password123" al usuario ${targetEmail}. El usuario deberá cambiarla obligatoriamente al entrar.`,
            okText: 'Sí, resetear',
            cancelText: 'Cancelar',
            onOk: async () => {
                try {
                    await api.post(`/usuarios/${userId}/reset-password`);
                    message.success('Contraseña reseteada con éxito');
                } catch (e) {
                    message.error('No se pudo resetear la contraseña');
                }
            }
        });
    };

    const renderFormFields = () => {
        if (currentTab === "1") {
            return (
                <>
                    <Form.Item name="razonSocial" label="Razón Social" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="rif" label="RIF / C.I Fiscal" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="direccionFiscal" label="Dirección Fiscal"><Input /></Form.Item>
                    <Form.Item name="telefono" label="Teléfono de Contacto"><Input /></Form.Item>
                    <Form.Item name="email" label="Correo de Contacto"><Input /></Form.Item>
                    
                    <Divider style={{ margin: '12px 0' }} orientation="left">Datos para Transferencias</Divider>
                    <Form.Item name="banco" label="Banco"><Input /></Form.Item>
                    <Form.Item name="cuenta" label="Número de Cuenta"><Input /></Form.Item>

                    <Divider style={{ margin: '12px 0' }} orientation="left">Datos para Pago Móvil / E-pay</Divider>
                    <Form.Item name="bancoPago" label="Banco (Pago Móvil)"><Input placeholder="Ej: Mercantil" /></Form.Item>
                    <Form.Item name="telefonoPago" label="Teléfono (Pago Móvil)"><Input placeholder="Ej: 04121234567" /></Form.Item>
                    <Form.Item name="rifPago" label="Cédula/RIF (Pago Móvil)"><Input placeholder="Ej: V12345678" /></Form.Item>
                    
                    <Form.Item name="emailPago" label="Correo e-pay"><Input placeholder="Ej: pago@empresa.com" /></Form.Item>

                </>
            );
        }
        if (currentTab === "2" || currentTab === "4") {
            return (
                <>
                    <Form.Item name="nombre" label={currentTab === "2" ? "Nombre del Centro" : "Nombre del Departamento"} rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="codigo" label="Código"><Input /></Form.Item>
                </>
            );
        }
        return (
            <>
                <Form.Item name="nombre" label="Nombre Completo" rules={[{ required: true }]}><Input /></Form.Item>
                <Form.Item name="email" label="Correo Electrónico" rules={[{ required: true }]}><Input /></Form.Item>
                <Form.Item name="cargo" label="Cargo (Título Oficial)"><Input placeholder="Ej: Analista de Compras, Director, etc." /></Form.Item>
                <Form.Item
                    name="password"
                    label={editItem ? "Nueva Contraseña (dejar en blanco para no cambiar)" : "Contraseña"}
                    rules={[{ required: !editItem, message: 'Por favor ingrese una contraseña' }]}
                >
                    <Input.Password placeholder={editItem ? "Opcional" : "Obligatorio"} />
                </Form.Item>
                <Form.Item name="rol" label="Rol" rules={[{ required: true }]}>
                    <Select onChange={() => form.setFieldsValue({ departamentosAutorizados: [] })}>
                        <Select.Option value="Administrador">Administrador</Select.Option>
                        <Select.Option value="Solicitante">Solicitante</Select.Option>
                        <Select.Option value="Gestor">Gestor</Select.Option>
                        <Select.Option value="Auditor">Auditor</Select.Option>
                    </Select>
                </Form.Item>
                <Form.Item noStyle shouldUpdate={(prev, curr) => prev.rol !== curr.rol}>
                    {({ getFieldValue }) => getFieldValue('rol') === 'Gestor' && (
                        <Form.Item name="departamentosAutorizados" label="Departamentos bajo su cargo (Opcional)">
                            <Select mode="multiple" placeholder="Seleccione departamentos adicionales">
                                {departamentos.map(d => (
                                    <Select.Option key={d.id} value={d.nombre}>{d.nombre}</Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    )}
                </Form.Item>
                <Form.Item name="departamento" label="Departamento Principal" rules={[{ required: true }]}>
                    <Select>
                        {departamentos.map(d => (
                            <Select.Option key={d.id} value={d.nombre}>{d.nombre}</Select.Option>
                        ))}
                    </Select>
                </Form.Item>
            </>
        );

    };

    return (
        <div style={{ padding: 24 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} style={{ marginBottom: 16 }}>Dashboard</Button>

            <Card title={<Title level={4}>Gestión de Tablas Maestras</Title>}>
                <Tabs defaultActiveKey="1" onChange={setCurrentTab}>
                    <TabPane tab={<span><ShopOutlined /> Proveedores</span>} key="1">
                        <Space style={{ marginBottom: 16 }}>
                            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>Nuevo Proveedor</Button>
                            <Button icon={<UploadOutlined />} onClick={() => setBulkModalVisible(true)}>Carga Masiva</Button>
                        </Space>
                        <Table dataSource={proveedores} rowKey="id" loading={loading} pagination={false} columns={[
                            { title: 'Razón Social', dataIndex: 'razonSocial' },
                            { title: 'RIF', dataIndex: 'rif' },
                            { title: 'Banco', dataIndex: 'banco' },
                            { title: 'Cuenta', dataIndex: 'cuenta' },
                            { 
                                title: 'Pago Móvil', 
                                render: (_, r) => {
                                    if(r.telefonoPago || r.rifPago) {
                                       return <div>
                                            {r.bancoPago && <small style={{ display: 'block' }}><b>Bco:</b> {r.bancoPago}</small>}
                                            <small style={{ display: 'block' }}><b>Telf:</b> {r.telefonoPago}</small>
                                            <small style={{ display: 'block' }}><b>C.I/RIF:</b> {r.rifPago}</small>
                                        </div>;
                                    }
                                    return '-';
                                }
                            },
                            { 
                                title: 'e-pay', 
                                render: (_, r) => r.emailPago ? <small>{r.emailPago}</small> : '-'
                            },

                            {
                                title: 'Acciones', render: (_, r) => (
                                    <Space>
                                        <Button icon={<EditOutlined />} onClick={() => handleOpenModal(r)} />
                                        <Popconfirm title="¿Eliminar?" onConfirm={() => handleDelete('proveedores', r.id)}><Button icon={<DeleteOutlined />} danger /></Popconfirm>
                                    </Space>
                                )
                            }
                        ]} />
                    </TabPane>
                    <TabPane tab={<span><AppstoreOutlined /> Centros de Costo</span>} key="2">
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()} style={{ marginBottom: 16 }}>Nuevo Centro</Button>
                        <Table dataSource={centros} rowKey="id" loading={loading} pagination={false} columns={[
                            { title: 'Nombre', dataIndex: 'nombre' },
                            { title: 'Código', dataIndex: 'codigo' },
                            {
                                title: 'Acciones', render: (_, r) => (
                                    <Space>
                                        <Button icon={<EditOutlined />} onClick={() => handleOpenModal(r)} />
                                        <Popconfirm title="¿Eliminar?" onConfirm={() => handleDelete('centros-costo', r.id)}><Button icon={<DeleteOutlined />} danger /></Popconfirm>
                                    </Space>
                                )
                            }
                        ]} />
                    </TabPane>
                    <TabPane tab={<span><AppstoreOutlined /> Departamentos</span>} key="4">
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()} style={{ marginBottom: 16 }}>Nuevo Departamento</Button>
                        <Table dataSource={departamentos} rowKey="id" loading={loading} pagination={false} columns={[
                            { title: 'Nombre', dataIndex: 'nombre' },
                            { title: 'Código', dataIndex: 'codigo' },
                            {
                                title: 'Acciones', render: (_, r) => (
                                    <Space>
                                        <Button icon={<EditOutlined />} onClick={() => handleOpenModal(r)} />
                                        <Popconfirm title="¿Eliminar?" onConfirm={() => handleDelete('departamentos', r.id)}><Button icon={<DeleteOutlined />} danger /></Popconfirm>
                                    </Space>
                                )
                            }
                        ]} />
                    </TabPane>
                    {usuario?.rol?.toLowerCase() === 'administrador' && (
                        <TabPane tab={<span><UserOutlined /> Usuarios</span>} key="3">
                            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()} style={{ marginBottom: 16 }}>Nuevo Usuario</Button>
                            <Table dataSource={usuarios} rowKey="id" loading={loading} pagination={false} columns={[
                                { title: 'Nombre', dataIndex: 'nombre' },
                                { title: 'Cargo', dataIndex: 'cargo' },
                                { title: 'Email', dataIndex: 'email' },
                                { title: 'Rol', dataIndex: 'rol' },
                                { title: 'Depto', dataIndex: 'departamento' },
                                { 
                                    title: 'Autorizado en', 
                                    dataIndex: 'departamentosAutorizados', 
                                    render: (val) => Array.isArray(val) ? val.join(', ') : '' 
                                },

                                {
                                    title: 'Acciones', render: (_, r) => (
                                        <Space>
                                            <Button icon={<EditOutlined />} onClick={() => handleOpenModal(r)} />
                                            <Button icon={<KeyOutlined />} onClick={() => handleResetPassword(r.id, r.email)} title="Resetear Clave" />
                                            <Popconfirm title="¿Eliminar?" onConfirm={() => handleDelete('usuarios', r.id)}><Button icon={<DeleteOutlined />} danger /></Popconfirm>
                                        </Space>
                                    )
                                }
                            ]} />
                        </TabPane>
                    )}
                </Tabs>
            </Card>

            <Modal
                title={editItem ? "Editar Registro" : "Nuevo Registro"}
                visible={modalVisible}
                onCancel={() => setModalVisible(false)}
                onOk={() => form.submit()}
                destroyOnClose
            >
                <Form form={form} layout="vertical" onFinish={onFinish}>
                    {renderFormFields()}
                </Form>
            </Modal>

            {/* Modal de Carga Masiva */}
            <Modal
                title="Carga Masiva de Proveedores"
                visible={bulkModalVisible}
                onCancel={() => setBulkModalVisible(false)}
                footer={null}
                destroyOnClose
            >
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <Typography.Paragraph>
                        Descarga la plantilla, llénala con los datos de los proveedores y súbela aquí.
                    </Typography.Paragraph>
                    <Button
                        icon={<FileExcelOutlined />}
                        onClick={handleDescargarPlantilla}
                        style={{ marginBottom: 20 }}
                    >
                        Descargar Plantilla
                    </Button>
                    <Upload.Dragger
                        name="archivo"
                        beforeUpload={handleCargaMasiva}
                        showUploadList={false}
                        disabled={uploading}
                    >
                        <p className="ant-upload-drag-icon">
                            <UploadOutlined />
                        </p>
                        <p className="ant-upload-text">Haz clic o arrastra el archivo Excel aquí</p>
                        {uploading && <p style={{ color: '#1890ff' }}>Procesando archivo...</p>}
                    </Upload.Dragger>
                </div>
            </Modal>
        </div>
    );
};

export default Maestros;
