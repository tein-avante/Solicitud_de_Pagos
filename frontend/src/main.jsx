import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import 'antd/dist/reset.css'
import './index.css'

console.log('Mounting React application...');
const rootElement = document.getElementById('root');
if (!rootElement) {
    console.error('Root element not found!');
} else {
    ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
            <ThemeProvider>
                <App />
            </ThemeProvider>
        </React.StrictMode>,
    )
    console.log('React application mounted.');
}
