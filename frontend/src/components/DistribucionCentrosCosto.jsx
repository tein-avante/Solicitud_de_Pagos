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
                        <Col span={10}>TOTAL ASIGNADO:</Col>
                        <Col span={6}>{moneda} {sumaMontos.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</Col>
                        <Col span={4}>{sumaPorcentajes.toFixed(2)}%</Col>
                        <Col span={4}>
                            {Math.abs(diferencia) > 0.01 ? (
                                <Text type="danger">Dif: {diferencia.toFixed(2)}</Text>
                            ) : (
                                <Text type="success">✓ OK</Text>
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
                            placeholder="Seleccione"
                            style={{ width: '100%' }}
                            value={val}
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
