import React from 'react';
import {
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { Row, Col, Card, Typography, Empty } from 'antd';

const { Title } = Typography;

// Colores modernos para el gráfico
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const EstadisticasVisuales = ({ dataEstatus = [], dataDept = [] }) => {
    const hasEstatusData = dataEstatus.length > 0;
    const hasDeptData = dataDept.length > 0;

    return (
        <div style={{ padding: '10px' }}>
            <Row gutter={[16, 16]}>
                {/* GRÁFICO DE TORTA: ESTATUS */}
                <Col span={12}>
                    <Card title="Distribución por Estatus" bordered={false} style={{ height: '100%' }}>
                        {hasEstatusData ? (
                            <div style={{ width: '100%', height: 300 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={dataEstatus}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            outerRadius={80}
                                            fill="#8884d8"
                                            dataKey="value"
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        >
                                            {dataEstatus.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <Empty description="Sin datos de estatus" />
                        )}
                    </Card>
                </Col>

                {/* GRÁFICO DE BARRAS: DEPARTAMENTOS */}
                <Col span={12}>
                    <Card title="Solicitudes por Departamento" bordered={false} style={{ height: '100%' }}>
                        {hasDeptData ? (
                            <div style={{ width: '100%', height: 300 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dataDept} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="value" name="Solicitudes" fill="#8884d8" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <Empty description="Sin datos de departamentos" />
                        )}
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default EstadisticasVisuales;
