// services/emailService.js
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // Configurar transporte de correo
    this.transporter = nodemailer.createTransporter({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }
  
  async enviarNotificacion({ to, subject, text }) {
    try {
      const info = await this.transporter.sendMail({
        from: `"Sistema de Pagos" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        text,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px;">
              <h2 style="color: #333; margin-top: 0;">${subject}</h2>
              <p style="color: #666; line-height: 1.6;">${text}</p>
              <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
              <p style="color: #999; font-size: 12px;">
                Este es un correo automático del Sistema de Pagos. Por favor, no responda a este mensaje.
              </p>
            </div>
          </div>
        `
      });
      
      console.log('Correo enviado:', info.messageId);
      return info;
    } catch (error) {
      console.error('Error al enviar correo:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();