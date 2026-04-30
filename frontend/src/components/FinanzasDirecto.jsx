import React, { useState, useEffect } from 'react';
import { 
    Tabs, Card, Table, Button, Modal, Form, Input, InputNumber, 
    Select, DatePicker, Row, Col, Space, Tag, message, Typography, Upload, Divider, List, Avatar, Tooltip 
} from 'antd';
import { 
    PlusOutlined, WalletOutlined, DollarOutlined, HistoryOutlined, 
    AuditOutlined, FileSyncOutlined, UploadOutlined, EyeOutlined, ArrowLeftOutlined,
    FilePdfOutlined, FileExcelOutlined, SearchOutlined, DownloadOutlined, SwapOutlined,
    DeleteOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import * as XLSX from 'xlsx';
import api from '../services/api';
import DistribucionCentrosCosto from './DistribucionCentrosCosto';

const { Title, Text, Paragraph } = Typography;

const FinanzasDirecto = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('caja_chica');
    const [centros, setCentros] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    
    // Detectar URL base para archivos
    const isLocal = window.location.port === '5173' || window.location.hostname === 'localhost';
    const fileBaseURL = isLocal ? `http://${window.location.hostname}:3000` : window.location.origin;

    // CAJA CHICA STATES
    const [cajas, setCajas] = useState([]);
    const [cajaSeleccionada, setCajaSeleccionada] = useState(null);
    const [historialCaja, setHistorialCaja] = useState([]);
    const [arqueosHistory, setArqueosHistory] = useState([]);
    const [modalCaja, setModalCaja] = useState(false);
    const [modalGasto, setModalGasto] = useState(false);
    const [modalArqueo, setModalArqueo] = useState(false);
    const [modalHistorialArqueos, setModalHistorialArqueos] = useState(false);
    const [modalReposicion, setModalReposicion] = useState(false);
    const [modalIngreso, setModalIngreso] = useState(false);
    const [distribucion, setDistribucion] = useState([]);
    const [fileList, setFileList] = useState([]);

    // REPORTES STATES
    const [reporteItems, setReporteItems] = useState([]);
    const [filtrosReporte, setFiltrosReporte] = useState({ fechaInicio: null, fechaFin: null, centroCostoId: null });

    // PAGOS DIRECTOS STATES
    const [pagosDirectos, setPagosDirectos] = useState([]);
    const [modalPagoDirecto, setModalPagoDirecto] = useState(false);

    const [formCaja] = Form.useForm();
    const [formGasto] = Form.useForm();
    const [formArqueo] = Form.useForm();
    const [formPagoDirecto] = Form.useForm();
    const [formIngreso] = Form.useForm();
    const [messageApi, contextHolder] = message.useMessage();
    const [loading, setLoading] = useState(false);
    const [sistemaInfo, setSistemaInfo] = useState({ version: '2.9', operaciones: null });

    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    const esAdmin = usuario?.rol?.toLowerCase() === 'administrador';

    useEffect(() => {
        fetchInitialData();
        cargarSistemaInfo();
    }, []);

    const cargarSistemaInfo = async () => {
        try {
            const res = await api.get('/solicitudes/sistema/info');
            setSistemaInfo(res.data);
        } catch (e) {
            console.warn('Error al cargar info del sistema');
        }
    };

    const fetchInitialData = async () => {
        try {
            const [cent, usr, cjs, pgs] = await Promise.all([
                api.get('/centros-costo'),
                api.get('/usuarios'),
                api.get('/caja-chica'),
                api.get('/pagos-directos')
            ]);
            setCentros(cent.data);
            setUsuarios(usr.data.filter(u => u.rol === 'Administrador' || u.rol === 'Gestor'));
            setCajas(cjs.data);
            setPagosDirectos(pgs.data);
            if (cjs.data.length > 0) setCajaSeleccionada(cjs.data[0]);
        } catch (e) {
            messageApi.error('Error al cargar datos iniciales');
        }
    };

    useEffect(() => {
        if (cajaSeleccionada) {
            fetchHistorial(cajaSeleccionada.id);
            fetchArqueos(cajaSeleccionada.id);
        }
    }, [cajaSeleccionada]);

    const fetchHistorial = async (id) => {
        try {
            const res = await api.get(`/caja-chica/${id}/historial`);
            setHistorialCaja(res.data);
        } catch (e) {
            console.error('Error al cargar historial:', e);
        }
    };

    const fetchArqueos = async (id) => {
        try {
            const res = await api.get(`/caja-chica/arqueos?cajaChicaId=${id}`);
            setArqueosHistory(res.data);
        } catch (e) {
            console.error('Error al cargar arqueos:', e);
        }
    };

    // REPORTES HANDLERS
    const handleGenerarReporte = async () => {
        try {
            setLoading(true);
            const { fechaInicio, fechaFin, centroCostoId } = filtrosReporte;
            let query = '?';
            if (fechaInicio) query += `fechaInicio=${fechaInicio.format('YYYY-MM-DD')}&`;
            if (fechaFin) query += `fechaFin=${fechaFin.format('YYYY-MM-DD')}&`;
            if (centroCostoId) query += `centroCostoId=${centroCostoId}&`;

            const res = await api.get(`/finanzas/reporte${query.slice(0, -1)}`);
            setReporteItems(res.data);
            messageApi.success('Reporte generado exitosamente');
        } catch (e) {
            messageApi.error('Error al generar el reporte compensado');
        } finally {
            setLoading(false);
        }
    };

    const descargarExcel = () => {
        if (reporteItems.length === 0) return messageApi.warning('No hay datos para exportar');
        
        // Preparar los datos mapeando a nombres de columnas amigables
        const dataParaExcel = reporteItems.map(r => ({
            'Tipo de Movimiento': r._tipoItem || 'Gasto',
            'ID': r.id,
            'Fecha': moment(r.fecha).format('DD/MM/YYYY'),
            'Concepto': r.concepto,
            'Moneda Pago': r.monedaPago || r.moneda || 'N/A',
            'Monto Pagado': r.montoTotal,
            'Tasa del Día (Bs/$)': r.tasaDelDia ? Number(r.tasaDelDia) : 'N/A',
            'Equivalente': r.montoAlCambio
                ? `${r.monedaPago === 'Bs' ? 'USD' : 'Bs'} ${Number(r.montoAlCambio).toFixed(2)}`
                : 'N/A',
            'Responsable': r.Responsable || r.responsable || 'N/A',
            'Estatus': r.estatus || 'N/A',
            'Caja Chica': r.cajaChicaNombre || 'N/A'
        }));

        // Crear hoja de trabajo (Worksheet)
        const ws = XLSX.utils.json_to_sheet(dataParaExcel);

        // Configurar anchos de columna para que se vea ordenado
        const wscols = [
            { wch: 20 }, // Tipo de Movimiento
            { wch: 10 }, // ID
            { wch: 12 }, // Fecha
            { wch: 45 }, // Concepto
            { wch: 12 }, // Moneda Pago
            { wch: 15 }, // Monto Pagado
            { wch: 18 }, // Tasa del Día
            { wch: 22 }, // Equivalente
            { wch: 25 }, // Responsable
            { wch: 15 }, // Estatus
            { wch: 30 }, // Caja Chica
        ];
        ws['!cols'] = wscols;

        // Crear libro de trabajo (Workbook)
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reporte Financiero");

        // Generar archivo y disparar descarga
        XLSX.writeFile(wb, `Reporte_Financiero_${moment().format('YYYY-MM-DD')}.xlsx`);
    };

    // CAJA CHICA HANDLERS
    const handleCrearCaja = async (values) => {
        if (!esAdmin) {
            messageApi.error('Solo los administradores pueden crear Cajas Chicas');
            return;
        }

        try {
            await api.post('/caja-chica', values);
            messageApi.success('Caja Chica creada');
            setModalCaja(false);
            fetchInitialData();
        } catch (e) { messageApi.error('Error al crear'); }
    };

    const handleRegistrarGasto = async (values) => {
        // Validar distribución
        const totalAsignado = distribucion.reduce((sum, d) => sum + (d.monto || 0), 0);
        
        if (distribucion.length === 0 || distribucion.some(d => !d.centroCostoId)) {
            return messageApi.error('Debe seleccionar un Centro de Costo para cada línea de distribución');
        }

        if (Math.abs(totalAsignado - values.montoTotal) > 0.01) {
            return messageApi.error('La suma de los montos asignados no coincide con el total del gasto');
        }

        const formData = new FormData();
        formData.append('cajaChicaId', cajaSeleccionada.id);
        formData.append('fecha', values.fecha.toISOString());
        formData.append('concepto', values.concepto);
        formData.append('montoTotal', values.montoTotal);
        formData.append('distribucion', JSON.stringify(distribucion));
        if (fileList.length > 0) {
            formData.append('comprobante', fileList[0].originFileObj);
        }

        try {
            setLoading(true);
            await api.post('/caja-chica/gasto', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            messageApi.success('Gasto registrado exitosamente');
            setModalGasto(false);
            setFileList([]);
            fetchInitialData();
            if (cajaSeleccionada) fetchHistorial(cajaSeleccionada.id);
        } catch (e) {
            messageApi.error(e.response?.data?.error || 'Error al registrar gasto');
        } finally {
            setLoading(false);
        }
    };

    const handleArqueo = async (values) => {
        const formData = new FormData();
        formData.append('cajaChicaId', cajaSeleccionada.id);
        formData.append('saldoFisico', values.saldoFisico);
        formData.append('observaciones', values.observaciones || '');
        if (fileList.length > 0) {
            formData.append('comprobante', fileList[0].originFileObj);
        }

        try {
            setLoading(true);
            await api.post('/caja-chica/arqueo', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            messageApi.success('Arqueo registrado');
            setModalArqueo(false);
            setFileList([]);
            fetchInitialData();
            fetchArqueos(cajaSeleccionada.id);
            fetchHistorial(cajaSeleccionada.id);
        } catch (e) { 
            messageApi.error(e.response?.data?.error || 'Error al realizar arqueo'); 
        } finally {
            setLoading(false);
        }
    };

    const handleRegistrarIngreso = async (values) => {
        try {
            setLoading(true);
            await api.post('/caja-chica/ingreso', {
                cajaChicaId: cajaSeleccionada.id,
                fecha: values.fecha.toISOString(),
                concepto: values.concepto,
                monto: values.monto
            });
            messageApi.success('Ingreso registrado correctamente');
            setModalIngreso(false);
            fetchInitialData();
            if (cajaSeleccionada) fetchHistorial(cajaSeleccionada.id);
        } catch (e) {
            messageApi.error(e.response?.data?.error || 'Error al registrar ingreso');
        } finally {
            setLoading(false);
        }
    };

    const handleReposicion = async () => {
        try {
            Modal.confirm({
                title: '¿Solicitar Reposición?',
                content: 'Se generará una solicitud de reposición formal por todos los gastos pendientes de esta caja.',
                onOk: async () => {
                    setLoading(true);
                    const res = await api.post('/caja-chica/reposicion', { cajaChicaId: cajaSeleccionada.id });
                    const { correlativoSolicitud, solicitudId } = res.data;
                    
                    Modal.success({
                        title: 'Reposición Solicitada con Éxito',
                        width: 500,
                        content: (
                            <div>
                                <Paragraph>Se ha generado el requerimiento de reposición <strong>{res.data.reposicion.correlativo}</strong>.</Paragraph>
                                <Paragraph>Automáticamente se ha creado una <strong>Solicitud de Pago Formal</strong> con el correlativo:</Paragraph>
                                <div style={{ 
                                    padding: '10px', 
                                    background: '#f6ffed', 
                                    border: '1px solid #b7eb8f', 
                                    textAlign: 'center',
                                    marginBottom: '10px'
                                }}>
                                    <Text strong style={{ fontSize: '18px', color: '#52c41a' }}>{correlativoSolicitud}</Text>
                                </div>
                                <Text type="secondary">Puede hacer seguimiento de este pago en el Dashboard principal.</Text>
                            </div>
                        ),
                        okText: 'Ver Solicitud de Pago',
                        onOk: () => navigate(`/solicitudes/${solicitudId}`)
                    });

                    fetchInitialData();
                    setLoading(false);
                }
            });
        } catch (e) { 
            messageApi.error(e.response?.data?.error || 'Error al solicitar reposición'); 
            setLoading(false);
        }
    };
    
    const handleDeleteGasto = async (id) => {
        Modal.confirm({
            title: '¿Estás seguro de eliminar este gasto?',
            icon: <ExclamationCircleOutlined />,
            content: 'Esta acción devolverá el monto al saldo de la caja y no se puede deshacer.',
            okText: 'Sí, eliminar',
            okType: 'danger',
            cancelText: 'No',
            onOk: async () => {
                try {
                    setLoading(true);
                    await api.delete(`/caja-chica/gasto/${id}`);
                    messageApi.success('Gasto eliminado correctamente');
                    fetchInitialData();
                    if (cajaSeleccionada) fetchHistorial(cajaSeleccionada.id);
                } catch (e) {
                    messageApi.error(e.response?.data?.error || 'Error al eliminar el gasto');
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    // PAGOS DIRECTOS HANDLERS
    const handleRegistrarPagoDirecto = async (values) => {
        const totalAsignado = distribucion.reduce((sum, d) => sum + (d.monto || 0), 0);

        if (distribucion.length === 0 || distribucion.some(d => !d.centroCostoId)) {
            return messageApi.error('Debe seleccionar un Centro de Costo para cada línea de distribución');
        }

        if (Math.abs(totalAsignado - values.montoTotal) > 0.01) {
            return messageApi.error('La suma de los montos asignados no coincide con el total');
        }

        const formData = new FormData();
        Object.keys(values).forEach(key => {
            if (key === 'fecha') formData.append(key, values[key].toISOString());
            else formData.append(key, values[key]);
        });
        formData.append('distribucion', JSON.stringify(distribucion));
        if (fileList.length > 0) {
            formData.append('comprobante', fileList[0].originFileObj);
        }

        try {
            setLoading(true);
            await api.post('/pagos-directos', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            messageApi.success('Pago Directo registrado');
            setModalPagoDirecto(false);
            setFileList([]);
            fetchInitialData();
        } catch (e) {
            messageApi.error('Error al registrar pago');
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePagoDirecto = async (id) => {
        Modal.confirm({
            title: '¿Estás seguro de eliminar este Pago Directo?',
            icon: <ExclamationCircleOutlined />,
            content: 'Esta acción eliminará el registro y su distribución de forma permanente.',
            okText: 'Sí, eliminar',
            okType: 'danger',
            cancelText: 'No',
            onOk: async () => {
                try {
                    setLoading(true);
                    await api.delete(`/pagos-directos/${id}`);
                    messageApi.success('Pago Directo eliminado correctamente');
                    fetchInitialData();
                } catch (e) {
                    messageApi.error(e.response?.data?.error || 'Error al eliminar el pago');
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const columnsGastos = [
        { 
            title: 'Movimiento', 
            dataIndex: '_tipoItem', 
            render: (t, r) => {
                let color = 'blue';
                let icon = <HistoryOutlined />;
                if (t === 'Arqueo') { color = 'purple'; icon = <AuditOutlined />; }
                if (t === 'Reposicion') { color = 'gold'; icon = <FileSyncOutlined />; }
                if (t === 'Ingreso') { color = 'green'; icon = <PlusOutlined />; }
                return <Tag color={color} icon={icon}>{t ? t.toUpperCase() : 'GASTO'}</Tag>
            }
        },
        { title: 'Fecha', dataIndex: 'fecha', render: (d, r) => moment(d || r.fechaSolicitud).format('DD/MM/YYYY') },
        { title: 'Concepto', dataIndex: 'concepto', render: (c, r) => c || r.correlativo || 'Arqueo de Caja' },
        { 
            title: 'Monto', 
            dataIndex: 'montoTotal', 
            render: (m, r) => {
                const val = m || r.montoTotalReposicion || r.diferencia || r.monto;
                const isNeg = val < 0;
                const isIngreso = r._tipoItem === 'Ingreso';
                return <Text strong style={{ color: isIngreso ? '#52c41a' : (isNeg ? 'red' : 'inherit') }}>
                    {isIngreso ? '+' : ''}{cajaSeleccionada?.moneda} {Number(Math.abs(val)).toLocaleString()}
                </Text> 
            }
        },
        { 
            title: 'Responsable / Registrado por', 
            render: (_, r) => (
                <Space direction="vertical" size={0}>
                    <Text strong style={{ fontSize: '13px' }}>{r.responsable?.nombre || r.elaboradoPor?.nombre || 'S/R'}</Text>
                    {r.registrador && r.registrador.nombre !== (r.responsable?.nombre || r.elaboradoPor?.nombre) && (
                        <Text type="secondary" style={{ fontSize: '11px' }}>Reg: {r.registrador.nombre}</Text>
                    )}
                </Space>
            )
        },
        { title: 'Estatus', dataIndex: 'estatus', render: s => s ? <Tag color={s === 'Pendiente' ? 'orange' : 'green'}>{s.toUpperCase()}</Tag> : '-' },
        {
            title: 'Acciones',
            key: 'acciones',
            width: 120,
            render: (_, r) => (
                <Space>
                    {r.comprobante && (
                        <Button 
                            icon={<EyeOutlined />} 
                            size="small" 
                            onClick={() => window.open(`${fileBaseURL}/${r.comprobante.replace(/\\/g, '/')}`)}
                        >
                            Ver
                        </Button>
                    )}
                    {(!r._tipoItem || r._tipoItem === 'Gasto') && r.estatus === 'Pendiente' && (
                        <Button 
                            danger
                            icon={<DeleteOutlined />} 
                            size="small" 
                            onClick={() => handleDeleteGasto(r.id)}
                        />
                    )}
                </Space>
            )
        }
    ];

    const ExpandedRowRender = ({ record }) => {
        const dist = record.DistribucionGastos || [];
        if (dist.length === 0) return <div style={{ padding: 10 }}>No hay distribución detallada para este registro.</div>;
        
        return (
            <Table
                columns={[
                    { title: 'Centro de Costo', dataIndex: ['CentroCosto', 'nombre'] },
                    { title: 'Descripción', dataIndex: 'descripcion' },
                    { title: 'Monto', dataIndex: 'monto', render: m => `${cajaSeleccionada?.moneda} ${Number(m).toLocaleString()}` },
                    { title: 'Porcentaje', dataIndex: 'porcentaje', render: p => `${p}%` }
                ]}
                dataSource={dist}
                pagination={false}
                rowKey="id"
                size="small"
                footer={() => record.comprobante && (
                    <div style={{ padding: '8px 0' }}>
                        <Text strong>Comprobante adjunto: </Text>
                        <Button 
                            type="link" 
                            icon={<DownloadOutlined />} 
                            onClick={() => window.open(`${fileBaseURL}/${record.comprobante.replace(/\\/g, '/')}`)}
                        >
                            Abrir archivo
                        </Button>
                    </div>
                )}
            />
        );
    };

    const columnsPagos = [
        { title: 'Correlativo', dataIndex: 'correlativo', render: c => <Tag color="blue">{c}</Tag> },
        { title: 'Fecha', dataIndex: 'fecha', render: d => moment(d).format('DD/MM/YYYY') },
        { title: 'Beneficiario', dataIndex: 'beneficiario' },
        { title: 'Concepto', dataIndex: 'concepto' },
        { 
            title: 'Monto Pagado', 
            dataIndex: 'montoTotal', 
            render: (m, r) => (
                <Space direction="vertical" size={0}>
                    <Text strong>{r.monedaPago || r.moneda} {Number(m).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</Text>
                    {r.tasaDelDia && r.montoAlCambio && (
                        <Text type="secondary" style={{ fontSize: '11px' }}>
                            Tasa: {Number(r.tasaDelDia).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs/$
                            &nbsp;≈&nbsp;
                            <strong>{r.monedaPago === 'Bs' ? 'USD' : 'Bs'} {Number(r.montoAlCambio).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>
                        </Text>
                    )}
                </Space>
            )
        },
        { title: 'Elaborado por', dataIndex: ['elaboradoPor', 'nombre'] },
        {
            title: 'Acciones',
            key: 'acciones',
            width: 100,
            render: (_, r) => (
                <Space>
                    {r.comprobante && (
                        <Button 
                            icon={<EyeOutlined />} 
                            size="small" 
                            onClick={() => window.open(`${fileBaseURL}/${r.comprobante.replace(/\\/g, '/')}`)}
                        />
                    )}
                    <Button 
                        danger
                        icon={<DeleteOutlined />} 
                        size="small" 
                        onClick={() => handleDeletePagoDirecto(r.id)}
                    >
                        Eliminar
                    </Button>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
            {contextHolder}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <Space>
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>Dashboard</Button>
                    <Title level={3} style={{ margin: 0 }}>Gerencia de Administración y Finanzas</Title>
                </Space>
                <div style={{ textAlign: 'right' }}>
                    <Tag color="geekblue" style={{ fontSize: 16, padding: '5px 15px', marginBottom: 5 }}>MÓDULO DE FINANZAS</Tag>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                        <Text type="secondary" style={{ fontSize: '11px' }}>Versión v{sistemaInfo.version}</Text>
                        {usuario?.rol?.toLowerCase() === 'administrador' && sistemaInfo.operaciones && (
                            <Text type="secondary" style={{ fontSize: '11px', color: '#888' }}>
                                🔢 {Number(sistemaInfo.operaciones).toLocaleString()} ops
                            </Text>
                        )}
                    </div>
                </div>
            </div>

            <Card variant="borderless" className="glass-card">
                <Tabs 
                    activeKey={activeTab} 
                    onChange={setActiveTab}
                    items={[
                        {
                            key: 'caja_chica',
                            label: (<span><WalletOutlined /> Caja Chica</span>),
                            children: (
                                <Row gutter={24}>
                                    <Col span={6}>
                                        {esAdmin && (
                                            <div style={{ marginBottom: 16 }}>
                                                <Button 
                                                    type="primary" 
                                                    icon={<PlusOutlined />} 
                                                    block 
                                                    onClick={() => {
                                                        formCaja.resetFields();
                                                        setModalCaja(true);
                                                    }}
                                                >
                                                    Nueva Caja Chica
                                                </Button>
                                            </div>
                                        )}
                                        <ListCajas 
                                            cajas={cajas} 
                                            seleccionada={cajaSeleccionada} 
                                            onSelect={setCajaSeleccionada} 
                                        />
                                    </Col>
                                    <Col span={18}>
                                        {cajaSeleccionada ? (
                                            <Card 
                                                title={
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px 0' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <WalletOutlined style={{ color: '#1890ff', fontSize: '18px' }} />
                                                            <Text strong style={{ fontSize: '16px' }}>{cajaSeleccionada.nombre}</Text>
                                                        </div>
                                                        <Tag color="cyan" style={{ margin: 0, width: 'fit-content', borderRadius: '4px' }}>
                                                            Responsable: {cajaSeleccionada.responsable?.nombre}
                                                        </Tag>
                                                    </div>
                                                }
                                                extra={
                                                    <Space>
                                                        <Button icon={<PlusOutlined />} type="primary" onClick={() => {
                                                            formGasto.resetFields();
                                                            setModalGasto(true);
                                                        }}>Gasto</Button>
                                                        <Button icon={<PlusOutlined />} style={{ backgroundColor: '#52c41a', borderColor: '#52c41a', color: 'white' }} onClick={() => {
                                                            formIngreso.resetFields();
                                                            setModalIngreso(true);
                                                        }}>Ingreso</Button>
                                                        <Button icon={<AuditOutlined />} onClick={() => {
                                                            formArqueo.resetFields();
                                                            setModalArqueo(true);
                                                        }}>Arqueo</Button>
                                                        <Button icon={<HistoryOutlined />} onClick={() => setModalHistorialArqueos(true)}>Historial Arqueos</Button>
                                                        <Button icon={<FileSyncOutlined />} onClick={handleReposicion}>Reposición</Button>
                                                    </Space>
                                                }
                                            >
                                                <Row gutter={16} style={{ marginBottom: 24 }}>
                                                    <Col span={12}>
                                                        <Card style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                                                            <Text type="secondary">Saldo Actual</Text><br />
                                                            <Title level={2} style={{ color: '#52c41a', margin: 0 }}>
                                                                {cajaSeleccionada.moneda} {Number(cajaSeleccionada.saldoActual).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                                            </Title>
                                                        </Card>
                                                    </Col>
                                                    <Col span={12}>
                                                        <Card style={{ background: '#e6f7ff', border: '1px solid #91d5ff' }}>
                                                            <Text type="secondary">Monto Inicial</Text><br />
                                                            <Title level={2} style={{ color: '#1890ff', margin: 0 }}>
                                                                {cajaSeleccionada.moneda} {Number(cajaSeleccionada.montoInicial).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                                            </Title>
                                                        </Card>
                                                    </Col>
                                                </Row>
                                                
                                                <Title level={5}><HistoryOutlined /> Historial Global de Movimientos</Title>
                                                <Table 
                                                    columns={columnsGastos} 
                                                    dataSource={historialCaja} 
                                                    pagination={{ pageSize: 5 }} 
                                                    rowKey={(r) => (r._tipoItem || 'Gasto') + r.id}
                                                    expandable={{
                                                        expandedRowRender: (record) => <ExpandedRowRender record={record} />
                                                    }}
                                                />
                                            </Card>
                                        ) : (
                                            <div style={{ textAlign: 'center', padding: '50px' }}>
                                                <WalletOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />
                                                <Paragraph>Seleccione una caja chica para ver su detalle</Paragraph>
                                            </div>
                                        )}
                                    </Col>
                                </Row>
                            )
                        },
                        {
                            key: 'pagos_directos',
                            label: (<span><DollarOutlined /> Pagos Directos GAF</span>),
                            children: (
                                <>
                                    <div style={{ marginBottom: 16, textAlign: 'right' }}>
                                        <Space>
                                            <Button icon={<FilePdfOutlined />} style={{ backgroundColor: '#cf1322', color: 'white' }} onClick={() => {
                                                api.get('/pagos-directos/reporte/pdf', { responseType: 'blob' })
                                                   .then(res => {
                                                       const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
                                                       const link = document.createElement('a');
                                                       link.href = url;
                                                       link.setAttribute('download', `Reporte_PagosDirectos_GAF.pdf`);
                                                       document.body.appendChild(link);
                                                       link.click();
                                                       link.remove();
                                                   }).catch(() => messageApi.error('Error al generar Reporte PDF'));
                                            }}>
                                                PDF
                                            </Button>
                                            <Button icon={<FileExcelOutlined />} style={{ backgroundColor: '#52c41a', color: 'white' }} onClick={() => {
                                                api.get('/pagos-directos/reporte/excel', { responseType: 'blob' })
                                                   .then(res => {
                                                       const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
                                                       const link = document.createElement('a');
                                                       link.href = url;
                                                       link.setAttribute('download', `Reporte_PagosDirectos_GAF.xlsx`);
                                                       document.body.appendChild(link);
                                                       link.click();
                                                       link.remove();
                                                   }).catch(() => messageApi.error('Error al generar Reporte Excel'));
                                            }}>
                                                Excel
                                            </Button>
                                            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                                                formPagoDirecto.resetFields();
                                                setModalPagoDirecto(true);
                                            }}>
                                                Registrar Pago Directo
                                            </Button>
                                        </Space>
                                    </div>
                                    <Table 
                                        columns={columnsPagos} 
                                        dataSource={pagosDirectos} 
                                        rowKey="id"
                                        expandable={{
                                            expandedRowRender: (record) => <ExpandedRowRender record={record} />
                                        }}
                                    />
                                </>
                            )
                        },
                        {
                            key: 'reportes',
                            label: (<span><FilePdfOutlined /> Reportes GAF</span>),
                            children: (
                                <Card title="Generador de Reportes Consolidados" className="glass-card">
                                    <Row gutter={16} align="bottom">
                                        <Col span={6}>
                                            <Text type="secondary">Fecha Inicio</Text><br/>
                                            <DatePicker style={{ width: '100%' }} onChange={(d) => setFiltrosReporte({...filtrosReporte, fechaInicio: d})} />
                                        </Col>
                                        <Col span={6}>
                                            <Text type="secondary">Fecha Fin</Text><br/>
                                            <DatePicker style={{ width: '100%' }} onChange={(d) => setFiltrosReporte({...filtrosReporte, fechaFin: d})} />
                                        </Col>
                                        <Col span={6}>
                                            <Text type="secondary">Centro de Costo</Text><br/>
                                            <Select style={{ width: '100%' }} placeholder="Todos" allowClear onChange={(v) => setFiltrosReporte({...filtrosReporte, centroCostoId: v})}>
                                                {centros.map(c => <Select.Option key={c.id} value={c.id}>{c.nombre}</Select.Option>)}
                                            </Select>
                                        </Col>
                                        <Col span={6}>
                                            <Space>
                                                <Button type="primary" icon={<SearchOutlined />} onClick={handleGenerarReporte} loading={loading}>Generar</Button>
                                                <Button icon={<FileExcelOutlined />} onClick={descargarExcel} disabled={reporteItems.length === 0}>Excel</Button>
                                            </Space>
                                        </Col>
                                    </Row>

                                    <Divider />

                                    <Table
                                        dataSource={reporteItems}
                                        rowKey="id"
                                        columns={[
                                            { title: 'Tipo', dataIndex: '_tipoItem', render: t => <Tag color={t === 'Pago Directo' ? 'blue' : 'green'}>{t}</Tag>},
                                            { title: 'Fecha', dataIndex: 'fecha', render: d => moment(d).format('DD/MM/YYYY')},
                                            { title: 'Concepto', dataIndex: 'concepto'},
                                            { 
                                                title: 'Monto', 
                                                render: (_, r) => (
                                                    <Space direction="vertical" size={0}>
                                                        <Text strong>{r.monedaPago || r.moneda} {Number(r.montoTotal).toLocaleString('es-VE', {minimumFractionDigits: 2})}</Text>
                                                        {r.tasaDelDia && r.montoAlCambio && (
                                                            <Text type="secondary" style={{ fontSize: '11px' }}>
                                                                Tasa {Number(r.tasaDelDia).toLocaleString('es-VE', {minimumFractionDigits: 2})} Bs/$
                                                                &nbsp;≈&nbsp;
                                                                <strong>{r.monedaPago === 'Bs' ? 'USD' : 'Bs'} {Number(r.montoAlCambio).toLocaleString('es-VE', {minimumFractionDigits: 2})}</strong>
                                                            </Text>
                                                        )}
                                                    </Space>
                                                )
                                            },
                                            { title: 'Responsable', dataIndex: 'Responsable'},
                                            { title: 'Estatus', dataIndex: 'estatus', render: s => <Tag>{s}</Tag>},
                                            {
                                                title: 'Comp.',
                                                key: 'comprobante',
                                                render: (_, r) => r.comprobante ? (
                                                    <Button 
                                                        icon={<EyeOutlined />} 
                                                        size="small" 
                                                        onClick={() => window.open(`${fileBaseURL}/${r.comprobante.replace(/\\/g, '/')}`)}
                                                    />
                                                ) : '-'
                                            }
                                        ]}
                                        expandable={{
                                            expandedRowRender: (record) => (
                                                <div style={{ padding: 10, background: '#fafafa' }}>
                                                    <Text strong>Distribución de Gasto:</Text>
                                                    <List
                                                        size="small"
                                                        dataSource={record.DistribucionGastos}
                                                        renderItem={item => (
                                                            <List.Item>
                                                                <Text>{item.CentroCosto?.nombre || 'S/C'}: </Text>
                                                                <Text strong>{record.moneda} {Number(item.monto).toLocaleString()} ({item.porcentaje}%)</Text>
                                                                {item.descripcion && <Text disabled> - {item.descripcion}</Text>}
                                                            </List.Item>
                                                        )}
                                                    />
                                                </div>
                                            )
                                        }}
                                    />
                                </Card>
                            )
                        }
                    ]}
                />
            </Card>

            <Modal
                title="Nueva Caja Chica"
                open={modalCaja}
                onCancel={() => setModalCaja(false)}
                footer={null}
            >
                <Form layout="vertical" onFinish={handleCrearCaja} form={formCaja}>
                    <Form.Item name="nombre" label="Nombre de la Caja" rules={[{ required: true }]}>
                        <Input placeholder="Ej: Caja Chica Administración" />
                    </Form.Item>
                    <Form.Item name="responsableId" label="Responsable" rules={[{ required: true }]}>
                        <Select showSearch optionFilterProp="children">
                            {usuarios.map(u => <Select.Option key={u.id} value={u.id}>{u.nombre}</Select.Option>)}
                        </Select>
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={16}>
                            <Form.Item name="montoInicial" label="Monto Inicial" rules={[{ required: true }]}>
                                <InputNumber style={{ width: '100%' }} precision={2} min={0} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="moneda" label="Moneda" initialValue="USD">
                                <Select>
                                    <Select.Option value="USD">USD</Select.Option>
                                    <Select.Option value="Bs">Bs</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" block>Crear Caja</Button>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Registrar Gasto de Caja Chica"
                open={modalGasto}
                onCancel={() => setModalGasto(false)}
                footer={null}
                width={800}
            >
                <Form layout="vertical" onFinish={handleRegistrarGasto} form={formGasto}>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="fecha" label="Fecha" rules={[{ required: true }]} initialValue={moment()}>
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item 
                                name="montoTotal" 
                                label={`Monto Total (${cajaSeleccionada?.moneda})`} 
                                extra={<Form.Item noStyle shouldUpdate={(prev, curr) => prev.montoTotal !== curr.montoTotal}>
                                    {({ getFieldValue }) => {
                                        const monto = getFieldValue('montoTotal') || 0;
                                        return <Text type={monto > cajaSeleccionada?.saldoActual ? 'danger' : 'secondary'}>Saldo Disponible: {cajaSeleccionada?.moneda} {Number(cajaSeleccionada?.saldoActual).toLocaleString()}</Text>
                                    }}
                                </Form.Item>}
                                rules={[
                                    { required: true, message: 'El monto es obligatorio' },
                                    { validator: (_, value) => value > cajaSeleccionada?.saldoActual ? Promise.reject('El monto supera el saldo disponible') : Promise.resolve() }
                                ]}
                            >
                                <InputNumber style={{ width: '100%' }} precision={2} min={0.01} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="concepto" label="Concepto del Gasto" rules={[{ required: true }]}>
                        <Input.TextArea rows={2} />
                    </Form.Item>

                    <Form.Item noStyle shouldUpdate={(prev, curr) => prev.montoTotal !== curr.montoTotal}>
                        {({ getFieldValue }) => (
                            <DistribucionCentrosCosto 
                                total={getFieldValue('montoTotal') || 0} 
                                centros={centros}
                                onChange={setDistribucion}
                                moneda={cajaSeleccionada?.moneda}
                            />
                        )}
                    </Form.Item>

                    <Divider />
                    <Form.Item label="Comprobante (Opcional)">
                        <Upload 
                            beforeUpload={() => false} 
                            maxCount={1} 
                            fileList={fileList}
                            onChange={({ fileList }) => setFileList(fileList)}
                        >
                            <Button icon={<UploadOutlined />}>Adjuntar Imagen/PDF</Button>
                        </Upload>
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" block loading={loading}>Registrar Gasto</Button>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Arqueo de Caja Chica"
                open={modalArqueo}
                onCancel={() => setModalArqueo(false)}
                footer={null}
            >
                <Form layout="vertical" onFinish={handleArqueo} form={formArqueo}>
                    <Paragraph>Ingrese el monto físico contado en caja para contrastar con el saldo teórico de <strong>{cajaSeleccionada?.moneda} {Number(cajaSeleccionada?.saldoActual).toLocaleString()}</strong></Paragraph>
                    <Form.Item name="saldoFisico" label="Monto Físico Actual" rules={[{ required: true }]}>
                        <InputNumber style={{ width: '100%' }} precision={2} />
                    </Form.Item>
                    <Form.Item name="observaciones" label="Observaciones">
                        <Input.TextArea rows={3} />
                    </Form.Item>
                    <Form.Item label="Comprobante (Opcional)">
                        <Upload 
                            beforeUpload={() => false} 
                            maxCount={1} 
                            fileList={fileList}
                            onChange={({ fileList }) => setFileList(fileList)}
                        >
                            <Button icon={<UploadOutlined />}>Adjuntar Imagen/PDF</Button>
                        </Upload>
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" block loading={loading}>Registrar Arqueo</Button>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Historial de Arqueos de Caja"
                open={modalHistorialArqueos}
                onCancel={() => setModalHistorialArqueos(false)}
                footer={null}
                width={800}
            >
                <Table
                    dataSource={arqueosHistory}
                    rowKey="id"
                    pagination={{ pageSize: 5 }}
                    columns={[
                        { title: 'Fecha', dataIndex: 'fecha', render: d => moment(d).format('DD/MM/YYYY HH:mm')},
                        { title: 'Saldo Teórico', dataIndex: 'saldoTeorico', render: v => `${cajaSeleccionada?.moneda} ${Number(v).toLocaleString()}`},
                        { title: 'Saldo Físico', dataIndex: 'saldoFisico', render: v => `${cajaSeleccionada?.moneda} ${Number(v).toLocaleString()}`},
                        { title: 'Diferencia', dataIndex: 'diferencia', render: v => <Text strong style={{ color: v < 0 ? 'red' : (v > 0 ? 'green' : 'inherit') }}>{cajaSeleccionada?.moneda} {Number(v).toLocaleString()}</Text>},
                        { title: 'Auditado por', dataIndex: ['elaboradoPor', 'nombre']},
                        { title: 'Observaciones', dataIndex: 'observaciones'},
                        {
                            title: 'Acciones',
                            key: 'acciones',
                            render: (_, r) => r.comprobante ? (
                                <Button 
                                    icon={<EyeOutlined />} 
                                    size="small" 
                                    onClick={() => window.open(`${fileBaseURL}/${r.comprobante.replace(/\\/g, '/')}`)}
                                />
                            ) : '-'
                        }
                    ]}
                />
            </Modal>

            <Modal
                title="Registro de Pago Directo (GAF)"
                open={modalPagoDirecto}
                onCancel={() => setModalPagoDirecto(false)}
                footer={null}
                width={800}
            >
                <Form layout="vertical" onFinish={handleRegistrarPagoDirecto} form={formPagoDirecto}>
                    <Row gutter={16}>
                        <Col span={8}><Form.Item name="fecha" label="Fecha" initialValue={moment()}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                        <Col span={8}>
                            <Form.Item name="moneda" label="Moneda del Registro" initialValue="USD">
                                <Select>
                                    <Select.Option value="USD">USD (Dólares)</Select.Option>
                                    <Select.Option value="Bs">Bs (Bolívares)</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="metodoPago" label="Método de Pago" rules={[{ required: true }]}>
                                <Select onChange={(val) => {
                                    if(val === 'e-pay') {
                                        formPagoDirecto.setFieldsValue({ monedaPago: 'USD', moneda: 'USD' });
                                    }
                                }}>
                                    <Select.Option value="Transferencia">Transferencia</Select.Option>
                                    <Select.Option value="Efectivo">Efectivo</Select.Option>
                                    <Select.Option value="Cheque">Cheque</Select.Option>
                                    <Select.Option value="e-pay">e-pay</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* --- TASA Y MONEDA DE PAGO --- */}
                    <Form.Item noStyle shouldUpdate={(prev, curr) => prev.metodoPago !== curr.metodoPago}>
                        {({ getFieldValue }) => {
                            if (getFieldValue('metodoPago') === 'e-pay') return null;

                            return (
                                <Row gutter={16} style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6, padding: '8px 8px 0 8px', marginBottom: 16 }}>
                                    <Col span={24} style={{ marginBottom: 4 }}>
                                        <Text strong style={{ color: '#d48806' }}>💱 Información Cambiaria</Text>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item
                                            name="monedaPago"
                                            label="Moneda de Pago"
                                            rules={[{ required: true, message: 'Seleccione la moneda' }]}
                                            initialValue="USD"
                                        >
                                            <Select>
                                                <Select.Option value="USD">💵 USD – Dólares</Select.Option>
                                                <Select.Option value="Bs">🇻🇪 Bs – Bolívares</Select.Option>
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item
                                            name="tasaDelDia"
                                            label="Tasa del Día (Bs/$)"
                                            rules={[
                                                { required: true, message: 'Ingrese la tasa BCV' },
                                                { type: 'number', min: 0.01, message: 'La tasa debe ser mayor a 0' }
                                            ]}
                                        >
                                            <InputNumber
                                                style={{ width: '100%' }}
                                                precision={4}
                                                min={0.0001}
                                                placeholder="Ej: 36.50"
                                                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                                parser={v => v.replace(/,/g, '')}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        {/* Cálculo en tiempo real del equivalente */}
                                        <Form.Item noStyle shouldUpdate={(prev, curr) =>
                                            prev.montoTotal !== curr.montoTotal ||
                                            prev.monedaPago !== curr.monedaPago ||
                                            prev.tasaDelDia !== curr.tasaDelDia
                                        }>
                                            {({ getFieldValue }) => {
                                                const monto = getFieldValue('montoTotal') || 0;
                                                const tasa = getFieldValue('tasaDelDia') || 0;
                                                const monedaPago = getFieldValue('monedaPago') || 'USD';
                                                let equivalente = null;
                                                let etiqueta = '';
                                                if (monto > 0 && tasa > 0) {
                                                    if (monedaPago === 'Bs') {
                                                        equivalente = (monto / tasa).toFixed(2);
                                                        etiqueta = `≈ USD ${Number(equivalente).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
                                                    } else {
                                                        equivalente = (monto * tasa).toFixed(2);
                                                        etiqueta = `≈ Bs ${Number(equivalente).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
                                                    }
                                                }
                                                return (
                                                    <Form.Item label={`Equivalente (${monedaPago === 'Bs' ? 'USD' : 'Bs'})`}>
                                                        <div style={{
                                                            border: '1px solid #d9d9d9',
                                                            borderRadius: 6,
                                                            padding: '6px 11px',
                                                            background: equivalente ? '#f6ffed' : '#fafafa',
                                                            color: equivalente ? '#52c41a' : '#aaa',
                                                            fontWeight: 'bold',
                                                            minHeight: 32
                                                        }}>
                                                            {equivalente ? etiqueta : 'Ingrese monto y tasa'}
                                                        </div>
                                                    </Form.Item>
                                                );
                                            }}
                                        </Form.Item>
                                    </Col>
                                </Row>
                            );
                        }}
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={14}><Form.Item name="beneficiario" label="Beneficiario" rules={[{ required: true }]}><Input /></Form.Item></Col>
                        <Col span={10}>
                            <Form.Item noStyle shouldUpdate={(prev, curr) => prev.monedaPago !== curr.monedaPago}>
                                {({ getFieldValue }) => (
                                    <Form.Item 
                                        name="montoTotal" 
                                        label={`Monto Total (${getFieldValue('monedaPago') || 'USD'})`} 
                                        rules={[{ required: true }]}
                                    >
                                        <InputNumber style={{ width: '100%' }} precision={2} min={0.01} />
                                    </Form.Item>
                                )}
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="concepto" label="Concepto / Motivo de Pago" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item>

                    <Form.Item noStyle shouldUpdate={(prev, curr) => prev.montoTotal !== curr.montoTotal || prev.monedaPago !== curr.monedaPago}>
                        {({ getFieldValue }) => (
                            <DistribucionCentrosCosto 
                                total={getFieldValue('montoTotal') || 0} 
                                centros={centros}
                                onChange={setDistribucion}
                                moneda={getFieldValue('monedaPago')}
                            />
                        )}
                    </Form.Item>

                    <Divider />
                    <Form.Item label="Comprobante de Pago">
                        <Upload 
                            beforeUpload={() => false} 
                            maxCount={1}
                            fileList={fileList}
                            onChange={({ fileList }) => setFileList(fileList)}
                        >
                            <Button icon={<UploadOutlined />}>Adjuntar Comprobante</Button>
                        </Upload>
                    </Form.Item>
                    <Form.Item><Button type="primary" htmlType="submit" block loading={loading}>Registrar Pago Directo</Button></Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Registrar Ingreso a Caja Chica"
                open={modalIngreso}
                onCancel={() => setModalIngreso(false)}
                footer={null}
            >
                <Form layout="vertical" onFinish={handleRegistrarIngreso} form={formIngreso}>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="fecha" label="Fecha" rules={[{ required: true }]} initialValue={moment()}>
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="monto" label={`Monto a Ingresar (${cajaSeleccionada?.moneda})`} rules={[{ required: true }]}>
                                <InputNumber style={{ width: '100%' }} precision={2} min={0.01} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="concepto" label="Concepto de Ingreso" rules={[{ required: true }]}>
                        <Input.TextArea rows={2} placeholder="Ej: Aporte inicial, inyección de capital extra..." />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" block loading={loading} style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}>
                            Registrar Ingreso
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

const ListCajas = ({ cajas, seleccionada, onSelect }) => (
    <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
        {cajas.map(c => (
            <Card 
                key={c.id} 
                size="small" 
                hoverable 
                onClick={() => onSelect(c)}
                style={{ 
                    marginBottom: 10, 
                    borderLeft: seleccionada?.id === c.id ? '5px solid #1890ff' : '1px solid #d9d9d9',
                    background: seleccionada?.id === c.id ? '#e6f7ff' : '#fff'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <Text strong>{c.nombre}</Text><br />
                        <Text type="secondary" size="small">{c.moneda} {Number(c.saldoActual).toLocaleString()}</Text>
                    </div>
                    {seleccionada?.id === c.id && <Tag color="blue">ACTIVA</Tag>}
                </div>
            </Card>
        ))}
    </div>
);

export default FinanzasDirecto;
