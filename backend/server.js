const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());
// Aumentar el límite de JSON porque los descriptores faciales (arrays de 128 floats) pueden ser grandes
app.use(express.json({ limit: '10mb' })); 

// Servir archivos estáticos del frontend (permite abrir http://localhost:3000 en el navegador)
app.use(express.static(path.join(__dirname, '../frontend')));

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'proyecto_feria'
};

const pool = mysql.createPool(dbConfig);

// ==========================================
// INICIALIZACIÓN AUTOMÁTICA DE TABLAS Y DATOS
// ==========================================
async function inicializarBaseDatos() {
    try {
        const conn = await pool.getConnection();
        console.log('✅ Conexión exitosa a MySQL (Base de datos: proyecto_feria)');

        // 1. Tabla Administradores
        await conn.query(`
            CREATE TABLE IF NOT EXISTS administradores (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario VARCHAR(50) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                nombre VARCHAR(100) NOT NULL,
                rol VARCHAR(20) DEFAULT 'admin',
                creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Tabla Usuarios Biométricos
        await conn.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                face_descriptor LONGTEXT NOT NULL,
                tiene_acceso BOOLEAN DEFAULT TRUE,
                creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 3. Tabla Accesos Log
        await conn.query(`
            CREATE TABLE IF NOT EXISTS accesos_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                face_id VARCHAR(50),
                estado VARCHAR(20),
                fecha_dispositivo TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 4. Tabla Comandos
        await conn.query(`
            CREATE TABLE IF NOT EXISTS comandos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                comando VARCHAR(50) NOT NULL,
                procesado BOOLEAN DEFAULT FALSE,
                creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Sembrar Administrador por defecto si no existe
        const [adminRows] = await conn.query('SELECT id FROM administradores WHERE usuario = ?', ['admin']);
        if (adminRows.length === 0) {
            await conn.query(`
                INSERT INTO administradores (usuario, password, nombre, rol)
                VALUES ('admin', 'admin123', 'Administrador Principal', 'SuperAdmin')
            `);
            console.log('👤 Administrador por defecto creado: [Usuario: admin | Contraseña: admin123]');
        }

        // Sembrar Usuario de Ejemplo si no hay usuarios
        const [userRows] = await conn.query('SELECT id FROM usuarios LIMIT 1');
        if (userRows.length === 0) {
            const mockDescriptor = Array(128).fill(0).map((_, i) => Math.sin(i * 0.1) * 0.15);
            await conn.query(`
                INSERT INTO usuarios (id, nombre, face_descriptor, tiene_acceso)
                VALUES (1, 'Carlos Gómez (Usuario Ejemplo)', ?, TRUE)
            `, [JSON.stringify(mockDescriptor)]);
            console.log('👥 Usuario de ejemplo creado: "Carlos Gómez (Usuario Ejemplo)"');

            // Sembrar logs iniciales
            await conn.query(`
                INSERT INTO accesos_log (face_id, estado, fecha_dispositivo)
                VALUES 
                    ('1', 'EXITO', NOW() - INTERVAL 15 MINUTE),
                    ('Desconocido', 'DENEGADO', NOW() - INTERVAL 5 MINUTE)
            `);
        }

        conn.release();
    } catch (err) {
        console.error('❌ Error de conexión/inicialización con MySQL:', err.message);
        console.error('   Verifica que XAMPP/MySQL esté encendido y que exista la base de datos "proyecto_feria".');
    }
}

inicializarBaseDatos();

// ==========================================
// ENDPOINTS DE AUTENTICACIÓN ADMINISTRATIVA
// ==========================================

// Inicio de sesión para administradores
app.post('/api/admin/login', async (req, res) => {
    const { usuario, password } = req.body;
    if (!usuario || !password) {
        return res.status(400).json({ success: false, error: 'Usuario y contraseña son requeridos.' });
    }

    try {
        const [rows] = await pool.query(
            'SELECT id, usuario, password, nombre, rol FROM administradores WHERE usuario = ?',
            [usuario.trim()]
        );

        if (rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Usuario no encontrado.' });
        }

        const admin = rows[0];
        // Verificación de contraseña en texto plano (o configurable para hash)
        if (admin.password !== password.trim()) {
            return res.status(401).json({ success: false, error: 'Contraseña incorrecta.' });
        }

        console.log(`🔑 Inicio de sesión exitoso: Administrador ${admin.usuario} (${admin.nombre})`);
        res.json({
            success: true,
            admin: {
                id: admin.id,
                usuario: admin.usuario,
                nombre: admin.nombre,
                rol: admin.rol
            },
            token: 'auth-admin-' + Buffer.from(admin.usuario + ':' + Date.now()).toString('base64')
        });
    } catch (error) {
        console.error('❌ Error en login de administrador:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// ENDPOINTS PARA EL PANEL Y USUARIOS
// ==========================================

// Obtener todos los usuarios registrados
app.get('/api/usuarios', async (req, res) => {
    try {
        // Solo traemos info básica para la tabla admin (sin el descriptor gigante)
        const [rows] = await pool.query('SELECT id, nombre, tiene_acceso, creado_en FROM usuarios ORDER BY id DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener TODOS los descriptores faciales (para cargar en el navegador y hacer matching)
app.get('/api/rostros', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, nombre, face_descriptor FROM usuarios WHERE tiene_acceso = TRUE');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Registrar nuevo usuario con su rostro
app.post('/api/usuarios', async (req, res) => {
    const { nombre, face_descriptor, tiene_acceso } = req.body;
    if (!nombre || !face_descriptor) {
        return res.status(400).json({ error: 'Nombre y descriptor facial son obligatorios.' });
    }

    try {
        const [result] = await pool.query(
            'INSERT INTO usuarios (nombre, face_descriptor, tiene_acceso) VALUES (?, ?, ?)',
            [nombre, JSON.stringify(face_descriptor), tiene_acceso !== false]
        );
        console.log(`👤 Usuario registrado: [ID: ${result.insertId}] ${nombre}`);
        res.json({ id: result.insertId, nombre, tiene_acceso });
    } catch (error) {
        console.error('❌ Error al registrar usuario:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Registrar un log de acceso (cuando alguien se loguea con el rostro)
app.post('/api/recibir_log', async (req, res) => {
    const { id, estado } = req.body; // id es el ID del usuario en MySQL
    try {
        await pool.query(
            'INSERT INTO accesos_log (face_id, estado, fecha_dispositivo) VALUES (?, ?, NOW())',
            [id ? id.toString() : 'Desconocido', estado || 'DESCONOCIDO']
        );
        console.log(`📋 Log de acceso registrado: Usuario ID ${id} -> Estado: ${estado}`);
        res.status(200).send('OK');
    } catch (error) {
        console.error('❌ Error al guardar log:', error.message);
        res.status(500).send('Error');
    }
});

// Enviar comando para los relés
app.post('/api/comando', async (req, res) => {
    const { accion } = req.body; // Ej: ABRIR_PUERTA, LUCES_ON, LUCES_OFF
    try {
        await pool.query("INSERT INTO comandos (comando) VALUES (?)", [accion]);
        res.json({ success: true, message: 'Comando enviado: ' + accion });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener logs para el panel admin
app.get('/api/logs', async (req, res) => {
    try {
        const query = `
            SELECT l.id, u.nombre, l.face_id, l.estado, l.fecha_dispositivo 
            FROM accesos_log l 
            LEFT JOIN usuarios u ON l.face_id = CAST(u.id AS CHAR)
            ORDER BY l.id DESC LIMIT 50
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// ENDPOINTS PARA EL ESP8266
// ==========================================

app.get('/api/check_comando', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, comando FROM comandos WHERE procesado = FALSE ORDER BY id ASC LIMIT 1');
        if (rows.length > 0) {
            const comando = rows[0];
            await pool.query('UPDATE comandos SET procesado = TRUE WHERE id = ?', [comando.id]);
            res.send(comando.comando);
        } else {
            res.send('NONE');
        }
    } catch (error) {
        console.error('Error al leer comandos:', error);
        res.status(500).send('NONE');
    }
});

app.listen(port, () => {
    console.log(`Backend de Feria corriendo en http://localhost:${port}`);
});
