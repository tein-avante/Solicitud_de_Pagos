import React, { createContext, useState, useEffect } from 'react';
import { ConfigProvider, theme } from 'antd';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    // Intentar cargar la preferencia guardada, por defecto false (modo claro)
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const savedTheme = localStorage.getItem('theme');
        return savedTheme === 'dark';
    });

    useEffect(() => {
        // Guardar preferencia en localStorage
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');

        // Cambiar el color de fondo del body para que coincida con el tema de Ant Design
        if (isDarkMode) {
            document.body.style.backgroundColor = '#141414'; // Color de fondo oscuro de Antd
            document.body.style.color = '#ffffff'; // Blanco puro para máximo contraste en modo oscuro
        } else {
            document.body.style.backgroundColor = '#f0f2f5'; // Color de fondo claro normal
            document.body.style.color = '#000000'; // Negro puro para máximo contraste en modo claro
        }
    }, [isDarkMode]);

    const toggleTheme = () => {
        setIsDarkMode(!isDarkMode);
    };

    return (
        <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
            <ConfigProvider
                theme={{
                    algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
                    token: {
                        colorText: isDarkMode ? '#ffffff' : '#000000',
                        colorTextSecondary: isDarkMode ? '#e5e5e5' : '#1f1f1f',
                        colorTextTertiary: isDarkMode ? '#d9d9d9' : '#434343',
                        colorTextQuaternary: isDarkMode ? '#bfbfbf' : '#595959',
                        borderRadius: 6,
                        colorPrimary: '#1890ff',
                    },
                    components: {
                        Table: {
                            headerColor: isDarkMode ? '#ffffff' : '#000000',
                            colorText: isDarkMode ? '#ffffff' : '#000000',
                        },
                        Card: {
                            colorTextHeading: isDarkMode ? '#ffffff' : '#000000',
                        },
                        Statistic: {
                            colorTextDescription: isDarkMode ? '#e5e5e5' : '#1f1f1f',
                        }
                    }
                }}
            >
                {children}
            </ConfigProvider>
        </ThemeContext.Provider>
    );
};
