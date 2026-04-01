const bcrypt = require('bcrypt');
const sequelize = require('./config/database');
const Usuario = require('./models/Usuario');

async function seedUsuarios() {
    try {
        await sequelize.authenticate();
        console.log('Conexión a la base de datos establecida exitosamente.');

        await sequelize.sync();

        const usuarios = [
            /*  {
                  nombre: 'Juan Pérez (Operaciones)',
                  email: 'operaciones@avante.com',
                  password: 'password123',
                  departamento: 'OPERACIONES',
                  rol: 'Solicitante'
              },
              {
                  nombre: 'María Gómez (RRHH)',
                  email: 'rrhh@avante.com',
                  password: 'password123',
                  departamento: 'RECURSOS HUMANOS',
                  rol: 'Solicitante'
              },*/
            {
                nombre: 'Administrador de prueba',
                email: 'admin@avante.com',
                password: 'password123',
                departamento: 'ADMINISTRACION',
                rol: 'Administrador'
            }
        ];

        for (const data of usuarios) {
            const existe = await Usuario.findOne({ where: { email: data.email } });
            if (!existe) {
                const salt = await bcrypt.genSalt(10);
                data.password = await bcrypt.hash(data.password, salt);
                data.debeCambiarPassword = true;
                await Usuario.create(data);
                console.log(`Usuario ${data.email} creado.`);
            } else {
                console.log(`Usuario ${data.email} ya existe.`);
            }
        }

        console.log('Proceso de seeder finalizado.');
    } catch (error) {
        console.error('Error al crear usuarios:', error);
    } finally {
        process.exit(0);
    }
}

seedUsuarios();
