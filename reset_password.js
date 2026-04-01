const bcrypt = require('bcrypt');
const sequelize = require('./config/database');
const Usuario = require('./models/Usuario');

async function resetPassword() {
    const email = 'tesoreria@avante.com';
    const newPassword = 'password123';

    try {
        await sequelize.authenticate();
        console.log('--- Conexión a la base de datos exitosa ---');

        const usuario = await Usuario.findOne({ where: { email } });

        if (!usuario) {
            console.error(`ERROR: No se encontró al usuario con el correo: ${email}`);
            process.exit(1);
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await usuario.update({
            password: hashedPassword,
            debeCambiarPassword: true
        });

        console.log('--------------------------------------------------');
        console.log(`¡ÉXITO! Contraseña reseteada para: ${email}`);
        console.log(`Nueva clave temporal: ${newPassword}`);
        console.log(`Estado: SE OBLIGARÁ A CAMBIAR CONTRASEÑA AL ENTRAR.`);
        console.log('--------------------------------------------------');

    } catch (error) {
        console.error('ERROR AL RESETEAR CONTRASEÑA:', error);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

resetPassword();
