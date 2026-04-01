const mysql = require('mysql2/promise');
require('dotenv').config();

async function createDb() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
        });

        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\`;`);
        console.log(`Base de datos "${process.env.DB_NAME}" verificada/creada.`);
        await connection.end();
    } catch (err) {
        console.error('Error al crear la base de datos:', err.message);
        console.log('Por favor, asegúrate de que el panel de XAMPP tenga MySQL (MariaDB) activo.');
    }
}

createDb();
