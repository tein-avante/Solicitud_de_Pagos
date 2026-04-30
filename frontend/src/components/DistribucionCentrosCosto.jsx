import React, { useState, useEffect } from 'react';
import { Table, Button, InputNumber, Select, Space, Typography, message, Divider, Row, Col } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

const { Text } = Typography;

const DistribucionCentrosCosto = ({ total, centros, onChange, moneda = 'USD', initialLines = [] }) => {
    const [lineas, setLineas] = useState([]);

    useEffect(() => {
        if (initialLines && initialLines.length > 0) {
            // Si vienen líneas precargadas (modo edición), usarlas
            setLineas(initialLines);
            onChange(initialLines);
        } else if (lineas.length === 0 && centros.length > 0) {
            // Inicializar con una línea al 100%
            const inicial = [{
                key: Date.now(),
                centroCostoId: undefined,
                monto: total,
                porcentaje: 100,
                descripcion: ''
            }];
            setLineas(inicial);
            onChange(inicial);
        }
    }, [centros, initialLines]);

    // Sincronizar automáticamente si solo hay una línea (facilita la UX y evita diferencias por redondeo)
    useEffect(() => {
        if (lineas.length === 1 && (!initialLines || initialLines.length === 0)) {
            if (lineas[0].monto !== total) {
                const nuevas = [{
                    ...lineas[0],
                    monto: total,
                    porcentaje: 100
                }];
                setLineas(nuevas);
                onChange(nuevas);
            }
        }
    }, [total]);

    const handleAdd = () => {
        const nueva = {
            key: Date.now(),
            centroCostoId: undefined,
            monto: 0,
            porcentaje: 0,
            descripcion: ''
        };
        const nuevas = [...lineas, nueva];
        setLineas(nuevas);
        onChange(nuevas);
    };

    const handleRemove = (key) => {
        const filtradas = lineas.filter(l => l.key !== key);
        setLineas(filtradas);
        onChange(filtradas);
    };

    const handleUpdate = (key, field, value) => {
        const nuevas = lineas.map(l => {
            if (l.key === key) {
                const item = { ...l, [field]: value };
                if (field === 'monto') {
                    item.porcentaje = total > 0 ? (value / total) * 100 : 0;
                } else if (field === 'porcentaje') {
                    item.monto = (value / 100) * total;
                }
                return item;
            }
            return l;
        });
        setLineas(nuevas);
        onChange(nuevas);
    };

    const sumaMontos = lineas.reduce((sum, l) => sum + (l.monto || 0), 0);
    const sumaPorcentajes = lineas.reduce((sum, l) => sum + (l.porcentaje || 0), 0);
    const diferencia = total - sumaMontos;

    return (
        <div style={{ padding: '10px', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #d9d9d9' }}>
            <Text strong>Distribución por Centros de Costo</Text>
            <Table
                dataSource={lineas}
                pagination={false}
                size="small"
                rowKey="key"
                footer={() => (
                    <Row gutter={16} style={{ fontWeight: 'bold' }}>
                        <Col span={10}><span>TOTAL ASIGNADO:</span></Col>
                        <Col span={6}><span>{moneda} {sumaMontos.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span></Col>
                        <Col span={4}><span>{sumaPorcentajes.toFixed(2)}%</span></Col>
                        <Col span={4}>
                            {Math.abs(diferencia) > 0.01 ? (
                                <Text type="danger" key="diff_err"><span>Dif: {diferencia.toFixed(2)}</span></Text>
                            ) : (
                                <Text type="success" key="diff_ok"><span>✓ OK</span></Text>
                            )}
                        </Col>
                    </Row>
                )}
            >
                <Table.Column
                    title="Centro de Costo"
                    dataIndex="centroCostoId"
                    render={(val, record) => (
                        <Select
                            showSearch
                            placeholder="Seleccione o busque..."
                            style={{ width: '100%' }}
                            value={val}
                            status={!val ? 'error' : ''}
                            optionFilterProp="children"
                            filterOption={(input, option) =>
                                (option?.children ?? '').toString().toLowerCase().includes(input.toLowerCase())
                            }
                            onChange={(v) => handleUpdate(record.key, 'centroCostoId', v)}
                        >
                            {centros.map(c => <Select.Option key={c.id} value={c.id}>{c.nombre}</Select.Option>)}
                        </Select>
                    )}
                />
                <Table.Column
                    title="Monto"
                    dataIndex="monto"
                    width={150}
                    render={(val, record) => (
                        <InputNumber
                            style={{ width: '100%' }}
                            value={val}
                            precision={2}
                            onChange={(v) => handleUpdate(record.key, 'monto', v)}
                        />
                    )}
                />
                <Table.Column
                    title="%"
                    dataIndex="porcentaje"
                    width={100}
                    render={(val, record) => (
                        <InputNumber
                            style={{ width: '100%' }}
                            value={val}
                            precision={2}
                            suffix="%"
                            onChange={(v) => handleUpdate(record.key, 'porcentaje', v)}
                        />
                    )}
                />
                <Table.Column
                    title=""
                    key="action"
                    width={50}
                    render={(_, record) => (
                        <Button
                            type="link"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleRemove(record.key)}
                            disabled={lineas.length === 1}
                        />
                    )}
                />
            </Table>
            <Button
                type="dashed"
                onClick={handleAdd}
                block
                icon={<PlusOutlined />}
                style={{ marginTop: 10 }}
            >
                Agregar Centro de Costo
            </Button>
        </div>
    );
};

export default DistribucionCentrosCosto;
