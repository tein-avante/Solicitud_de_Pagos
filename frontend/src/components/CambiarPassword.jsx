import React, { useState, useContext } from 'react';
import { Form, Input, Button, Card, message, Typography } from 'antd';
import { LockOutlined, KeyOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ThemeContext } from '../context/ThemeContext';
import logo from '../assets/logo.png';

const { Title, Text } = Typography;

const CambiarPassword = () => {
    const [loading, setLoading] = useState(false);
    const { isDarkMode } = useContext(ThemeContext);
    const navigate = useNavigate();

    const onFinish = async (values) => {
        setLoading(true);
        try {
            await api.post('/auth/cambiar-password', {
                passwordActual: values.passwordActual,
                nuevaPassword: values.nuevaPassword
            });

            message.success('Contraseña actualizada con éxito. Por favor ingrese de nuevo.');
            
            // Limpiar sesión para forzar re-login con nueva clave
            localStorage.removeItem('token');
            localStorage.removeItem('usuario');
            
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch (error) {
            message.error(error.response?.data?.error || 'Error al cambiar la contraseña');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            backgroundColor: isDarkMode ? '#141414' : '#f0f2f5'
        }}>
            <Card
                style={{ width: 450, borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
            >
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <img src={logo} alt="Avante" style={{ maxHeight: '50px', marginBottom: '16px' }} />
                    <Title level={3} style={{ margin: 0 }}>Cambio de Contraseña</Title>
                    <Text type="secondary">Por seguridad, debes actualizar tu contraseña antes de continuar.</Text>
                </div>

                <Form
                    layout="vertical"
                    onFinish={onFinish}
                    requiredMark={false}
                >
                    <Form.Item
                        label="Contraseña Actual"
                        name="passwordActual"
                        rules={[{ required: true, message: 'Ingrese su contraseña actual' }]}
                    >
                        <Input.Password prefix={<KeyOutlined />} placeholder="Su clave actual" />
                    </Form.Item>

                    <Form.Item
                        label="Nueva Contraseña"
                        name="nuevaPassword"
                        rules={[
                            { required: true, message: 'Ingrese su nueva contraseña' },
                            { min: 6, message: 'La contraseña debe tener al menos 6 caracteres' }
                        ]}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder="Mínimo 6 caracteres" />
                    </Form.Item>

                    <Form.Item
                        label="Confirmar Nueva Contraseña"
                        name="confirmarPassword"
                        dependencies={['nuevaPassword']}
                        rules={[
                            { required: true, message: 'Confirme su contraseña' },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue('nuevaPassword') === value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error('Las contraseñas no coinciden'));
                                },
                            }),
                        ]}
                    >
                        <Input.Password prefix={<CheckCircleOutlined />} placeholder="Repita la nueva contraseña" />
                    </Form.Item>

                    <Button type="primary" htmlType="submit" loading={loading} block size="large" style={{ marginTop: '8px' }}>
                        Actualizar y Continuar
                    </Button>
                </Form>
            </Card>
        </div>
    );
};

export default CambiarPassword;
