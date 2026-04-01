/**
 * COMPONENTE DE LOGIN
 * Pantalla de entrada al sistema que gestiona la autenticación del usuario.
 * Utiliza Ant Design para los componentes de UI.
 */

import React, { useState, useContext } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined, BulbOutlined, BulbFilled } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import logo from '../assets/logo.png';
import { ThemeContext } from '../context/ThemeContext';

const Login = () => {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { isDarkMode, toggleTheme } = useContext(ThemeContext);

    /**
     * Se ejecuta al enviar el formulario con datos válidos
     */
    const onFinish = async (values) => {
        setLoading(true);
        try {
            // Petición al endpoint de login
            const response = await api.post('/auth/login', values);

            // Persistir token y datos del usuario en el navegador
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('usuario', JSON.stringify(response.data.usuario));

            console.log('[DEBUG LOGIN] Datos de usuario recibidos:', response.data.usuario);
            message.success('Bienvenido al sistema');

            // Redirigir al panel principal o a cambio de password
            if (response.data.usuario.debeCambiarPassword) {
                navigate('/cambiar-password');
            } else {
                navigate('/');
            }
        } catch (error) {
            // Mostrar error amigable si las credenciales fallan
            message.error(error.response?.data?.error || 'Error al iniciar sesión');
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
            backgroundColor: isDarkMode ? '#141414' : '#f0f2f5',
            position: 'relative'
        }}>
            {/* Botón para alternar tema claro/oscuro */}
            <Button
                type="text"
                icon={isDarkMode ? <BulbFilled style={{ color: '#faad14' }} /> : <BulbOutlined />}
                onClick={toggleTheme}
                style={{ position: 'absolute', top: 20, right: 20 }}
                title="Cambiar Modo Oscuro/Claro"
            />

            <Card
                title={<div style={{ textAlign: 'center' }}><img src={logo} alt="Avante Bureau Shipping" style={{ maxHeight: '60px' }} /></div>}
                style={{ width: 400, borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            >
                <Form
                    name="login"
                    onFinish={onFinish}
                    layout="vertical"
                >
                    {/* Campo de Correo */}
                    <Form.Item
                        name="email"
                        rules={[{ required: true, message: 'Por favor ingrese su correo' }]}
                    >
                        <Input prefix={<UserOutlined />} placeholder="Correo Electrónico" />
                    </Form.Item>

                    {/* Campo de Contraseña */}
                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: 'Por favor ingrese su contraseña' }]}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder="Contraseña" />
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading} block>
                            Iniciar Sesión
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};

export default Login;
