const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const port = 3000;

app.use(cors());
// Aumentar el límite de JSON porque los descriptores faciales (arrays de 128 floats) pueden ser grandes
app.use(express.json({ limit: '10mb' })); 

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'proyecto_feria'
};

const pool = mysql.createPool(dbConfig);

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
    try {
        const [result] = await pool.query(
            'INSERT INTO usuarios (nombre, face_descriptor, tiene_acceso) VALUES (?, ?, ?)',
            [nombre, JSON.stringify(face_descriptor), tiene_acceso]
        );
        res.json({ id: result.insertId, nombre, tiene_acceso });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Registrar un log de acceso (cuando alguien se loguea con el rostro)
app.post('/api/recibir_log', async (req, res) => {
    const { id, estado } = req.body; // id es el ID del usuario en MySQL
    try {
        await pool.query(
            'INSERT INTO accesos_log (face_id, estado, fecha_dispositivo) VALUES (?, ?, NOW())',
            [id.toString(), estado]
        );
        res.status(200).send('OK');
    } catch (error) {
        console.error('Error al guardar log:', error);
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
