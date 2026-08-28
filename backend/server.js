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

        // 2. Tabla Usuarios Biométricos y Contraseña/PIN
        await conn.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                password VARCHAR(255) DEFAULT '1234',
                face_descriptor LONGTEXT NOT NULL,
                tiene_acceso BOOLEAN DEFAULT TRUE,
                permisos VARCHAR(255) DEFAULT '["puerta","luces","bomba"]',
                creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Migración: Asegurar que la columna permisos exista en tablas previas
        try {
            const [columns] = await conn.query("SHOW COLUMNS FROM usuarios LIKE 'permisos'");
            if (columns.length === 0) {
                await conn.query(`ALTER TABLE usuarios ADD COLUMN permisos VARCHAR(255) DEFAULT '["puerta","luces","bomba"]'`);
                console.log('🔄 Columna "permisos" añadida a la tabla usuarios.');
            }
        } catch (e) {
            console.warn('Verificación de columna permisos:', e.message);
        }

        // Migración: Asegurar que la columna password exista en tabla usuarios
        try {
            const [passCols] = await conn.query("SHOW COLUMNS FROM usuarios LIKE 'password'");
            if (passCols.length === 0) {
                await conn.query(`ALTER TABLE usuarios ADD COLUMN password VARCHAR(255) DEFAULT '1234'`);
                console.log('🔄 Columna "password" añadida a la tabla usuarios.');
            }
        } catch (e) {
            console.warn('Verificación de columna password:', e.message);
        }

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
                INSERT INTO usuarios (id, nombre, password, face_descriptor, tiene_acceso, permisos)
                VALUES (1, 'Carlos Gómez (Usuario Ejemplo)', '1234', ?, TRUE, '["puerta","luces","bomba"]')
            `, [JSON.stringify(mockDescriptor)]);
            console.log('👥 Usuario de ejemplo creado: "Carlos Gómez (Usuario Ejemplo)" con contraseña "1234"');

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

// Cambiar contraseña del administrador
app.put('/api/admin/password', async (req, res) => {
    const { adminId, passwordActual, nuevaPassword } = req.body;
    if (!passwordActual || !nuevaPassword) {
        return res.status(400).json({ error: 'La contraseña actual y la nueva contraseña son obligatorias.' });
    }

    if (nuevaPassword.trim().length < 4) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 4 caracteres.' });
    }

    try {
        const [rows] = await pool.query('SELECT id, password FROM administradores WHERE id = ?', [adminId || 1]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Administrador no encontrado.' });
        }

        const admin = rows[0];
        if (admin.password !== passwordActual.trim()) {
            return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
        }

        await pool.query('UPDATE administradores SET password = ? WHERE id = ?', [nuevaPassword.trim(), admin.id]);
        console.log(`🔒 Contraseña de administrador actualizada para ID: ${admin.id}`);
        res.json({ success: true, message: 'Contraseña actualizada con éxito.' });
    } catch (error) {
        console.error('❌ Error al cambiar contraseña de admin:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// ENDPOINTS CRUD PARA USUARIOS Y ROSTROS
// ==========================================

// 1. Obtener todos los usuarios registrados (con permisos y contraseña)
app.get('/api/usuarios', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, nombre, password, tiene_acceso, permisos, creado_en FROM usuarios ORDER BY id DESC');
        
        const usuarios = rows.map(u => {
            let permisosParsed = ['puerta', 'luces', 'bomba'];
            if (u.permisos) {
                try {
                    permisosParsed = typeof u.permisos === 'string' ? JSON.parse(u.permisos) : u.permisos;
                } catch (e) {
                    permisosParsed = ['puerta', 'luces', 'bomba'];
                }
            }
            return {
                ...u,
                password: u.password || '1234',
                permisos: permisosParsed
            };
        });

        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Obtener descriptores faciales y permisos para matching biométrico
app.get('/api/rostros', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, nombre, face_descriptor, permisos FROM usuarios WHERE tiene_acceso = TRUE');
        const rostros = rows.map(u => {
            let permisosParsed = ['puerta', 'luces', 'bomba'];
            if (u.permisos) {
                try {
                    permisosParsed = typeof u.permisos === 'string' ? JSON.parse(u.permisos) : u.permisos;
                } catch (e) {}
            }
            return {
                ...u,
                permisos: permisosParsed
            };
        });
        res.json(rostros);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Registrar nuevo usuario con su rostro, permisos y contraseña/PIN
app.post('/api/usuarios', async (req, res) => {
    const { nombre, password, face_descriptor, tiene_acceso, permisos } = req.body;
    if (!nombre || !face_descriptor) {
        return res.status(400).json({ error: 'Nombre y descriptor facial son obligatorios.' });
    }

    const permisosStr = JSON.stringify(Array.isArray(permisos) && permisos.length > 0 ? permisos : ['puerta', 'luces', 'bomba']);
    const userPass = (password && password.trim().length > 0) ? password.trim() : '1234';

    try {
        const [result] = await pool.query(
            'INSERT INTO usuarios (nombre, password, face_descriptor, tiene_acceso, permisos) VALUES (?, ?, ?, ?, ?)',
            [nombre.trim(), userPass, JSON.stringify(face_descriptor), tiene_acceso !== false, permisosStr]
        );
        console.log(`👤 Usuario registrado: [ID: ${result.insertId}] ${nombre} | Pass: ${userPass} | Permisos: ${permisosStr}`);
        res.json({ id: result.insertId, nombre, tiene_acceso, permisos: JSON.parse(permisosStr) });
    } catch (error) {
        console.error('❌ Error al registrar usuario:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 4. Editar usuario existente (Nombre, Contraseña, Acceso, Permisos y Face ID)
app.put('/api/usuarios/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, password, tiene_acceso, permisos, face_descriptor } = req.body;

    if (!nombre) {
        return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }

    const permisosStr = JSON.stringify(Array.isArray(permisos) ? permisos : ['puerta', 'luces', 'bomba']);

    try {
        let result;
        const hasNewPass = password && password.trim().length > 0;
        const hasNewFace = face_descriptor && Array.isArray(face_descriptor) && face_descriptor.length > 0;

        if (hasNewFace && hasNewPass) {
            // Actualizar Todo (Nombre, Password, Acceso, Permisos y Face ID)
            [result] = await pool.query(
                'UPDATE usuarios SET nombre = ?, password = ?, tiene_acceso = ?, permisos = ?, face_descriptor = ? WHERE id = ?',
                [nombre.trim(), password.trim(), tiene_acceso === true || tiene_acceso === 1, permisosStr, JSON.stringify(face_descriptor), id]
            );
            console.log(`📸 Contraseña y Face ID actualizados para usuario ID ${id} (${nombre})`);
        } else if (hasNewFace) {
            // Actualizar con Face ID sin cambiar password
            [result] = await pool.query(
                'UPDATE usuarios SET nombre = ?, tiene_acceso = ?, permisos = ?, face_descriptor = ? WHERE id = ?',
                [nombre.trim(), tiene_acceso === true || tiene_acceso === 1, permisosStr, JSON.stringify(face_descriptor), id]
            );
            console.log(`📸 Face ID actualizado para usuario ID ${id} (${nombre})`);
        } else if (hasNewPass) {
            // Actualizar con nueva password sin cambiar Face ID
            [result] = await pool.query(
                'UPDATE usuarios SET nombre = ?, password = ?, tiene_acceso = ?, permisos = ? WHERE id = ?',
                [nombre.trim(), password.trim(), tiene_acceso === true || tiene_acceso === 1, permisosStr, id]
            );
            console.log(`🔑 Contraseña actualizada para usuario ID ${id} (${nombre}) -> ${password}`);
        } else {
            // Actualizar datos básicos
            [result] = await pool.query(
                'UPDATE usuarios SET nombre = ?, tiene_acceso = ?, permisos = ? WHERE id = ?',
                [nombre.trim(), tiene_acceso === true || tiene_acceso === 1, permisosStr, id]
            );
            console.log(`✏️ Usuario actualizado: [ID: ${id}] ${nombre} | Permisos: ${permisosStr}`);
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        res.json({ success: true, id: parseInt(id), nombre, tiene_acceso, permisos: JSON.parse(permisosStr) });
    } catch (error) {
        console.error('❌ Error al actualizar usuario:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 5. Eliminar usuario
app.delete('/api/usuarios/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await pool.query('DELETE FROM usuarios WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        console.log(`🗑️ Usuario eliminado: [ID: ${id}]`);
        res.json({ success: true, message: `Usuario con ID ${id} eliminado correctamente.` });
    } catch (error) {
        console.error('❌ Error al eliminar usuario:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 6. Inicio de sesión manual para usuarios mediante PIN / Contraseña
app.post('/api/user/login', async (req, res) => {
    const { userId, password } = req.body;
    if (!userId || !password) {
        return res.status(400).json({ error: 'Selecciona un usuario e ingresa la contraseña/PIN.' });
    }

    try {
        const [rows] = await pool.query('SELECT id, nombre, password, tiene_acceso, permisos FROM usuarios WHERE id = ?', [userId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        const user = rows[0];
        if (!user.tiene_acceso) {
            return res.status(403).json({ error: 'Tu acceso se encuentra suspendido. Consulta al administrador.' });
        }

        const passExpected = user.password || '1234';
        if (passExpected !== password.trim()) {
            return res.status(401).json({ error: 'Contraseña o PIN incorrecto.' });
        }

        let permisosParsed = ['puerta', 'luces', 'bomba'];
        try {
            permisosParsed = typeof user.permisos === 'string' ? JSON.parse(user.permisos) : user.permisos;
        } catch (e) {}

        await pool.query('INSERT INTO accesos_log (face_id, estado, fecha_dispositivo) VALUES (?, ?, NOW())', [user.id.toString(), 'EXITO (PIN/PASSWORD)']);
        console.log(`🔑 Login manual con contraseña para usuario [ID: ${user.id}] ${user.nombre}`);

        res.json({
            success: true,
            user: {
                id: user.id,
                nombre: user.nombre,
                permisos: permisosParsed
            }
        });
    } catch (error) {
        console.error('❌ Error en login manual de usuario:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// LOGS Y COMANDOS DOMÓTICOS
// ==========================================

// Registrar un log de acceso
app.post('/api/recibir_log', async (req, res) => {
    const { id, estado } = req.body;
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
    const { accion, userId } = req.body;
    if (!accion) {
        return res.status(400).json({ error: 'Acción requerida.' });
    }

    try {
        // Validación de permisos por usuario si se proporciona userId
        if (userId) {
            const [userRows] = await pool.query('SELECT tiene_acceso, permisos FROM usuarios WHERE id = ?', [userId]);
            if (userRows.length > 0) {
                const user = userRows[0];
                if (!user.tiene_acceso) {
                    return res.status(403).json({ error: 'El usuario tiene el acceso global deshabilitado.' });
                }
                
                let userPerms = ['puerta', 'luces', 'bomba'];
                try {
                    userPerms = typeof user.permisos === 'string' ? JSON.parse(user.permisos) : user.permisos;
                } catch (e) {}

                const mapComandoPermiso = {
                    'ABRIR_PUERTA': 'puerta',
                    'LUCES_ON': 'luces',
                    'LUCES_OFF': 'luces',
                    'BOMBA_ON': 'bomba',
                    'BOMBA_OFF': 'bomba'
                };

                const permisoRequerido = mapComandoPermiso[accion];
                if (permisoRequerido && !userPerms.includes(permisoRequerido)) {
                    console.warn(`⛔ Intento no autorizado: Usuario ID ${userId} sin permiso para "${permisoRequerido}"`);
                    return res.status(403).json({ error: `No tienes permiso para controlar el dispositivo: ${permisoRequerido}.` });
                }
            }
        }

        await pool.query("INSERT INTO comandos (comando) VALUES (?)", [accion]);
        console.log(`⚡ Comando encolado para ESP8266: ${accion}`);
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
