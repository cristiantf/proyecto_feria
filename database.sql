CREATE DATABASE IF NOT EXISTS proyecto_feria;
USE proyecto_feria;

-- ============================================================================
-- TABLA DE ADMINISTRADORES (Inicio de Sesión Panel de Control)
-- ============================================================================
CREATE TABLE IF NOT EXISTS administradores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    rol VARCHAR(20) DEFAULT 'admin',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLA DE USUARIOS BIOMÉTRICOS Y PERMISOS DE DISPOSITIVOS
-- ============================================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    face_descriptor LONGTEXT NOT NULL,
    tiene_acceso BOOLEAN DEFAULT TRUE,
    permisos VARCHAR(255) DEFAULT '["puerta","luces","bomba"]',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLA DE REGISTRO DE ACCESOS (Historial / Auditoría)
-- ============================================================================
CREATE TABLE IF NOT EXISTS accesos_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    face_id VARCHAR(50),
    estado VARCHAR(20),
    fecha_dispositivo TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLA DE COLA DE COMANDOS (ESP8266 IoT)
-- ============================================================================
CREATE TABLE IF NOT EXISTS comandos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    comando VARCHAR(50) NOT NULL,
    procesado BOOLEAN DEFAULT FALSE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- DATOS INICIALES POR DEFECTO
-- ============================================================================

-- 1. Administrador por defecto (Usuario: admin / Contraseña: admin123)
INSERT INTO administradores (usuario, password, nombre, rol)
VALUES ('admin', 'admin123', 'Administrador Principal', 'SuperAdmin')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- 2. Usuario de Ejemplo para pruebas con permisos completos
INSERT INTO usuarios (id, nombre, face_descriptor, tiene_acceso, permisos)
VALUES (
    1,
    'Carlos Gómez (Usuario Ejemplo)',
    '[-0.1245, 0.0892, 0.0412, -0.0781, -0.0912, 0.0543, -0.0123, -0.1124, 0.1876, -0.0654, 0.2134, -0.0432, -0.2211, -0.0987, -0.0345, 0.1456, -0.1678, -0.1234, -0.0567, -0.0891, 0.0345, -0.0456, 0.0789, 0.0123, -0.1456, -0.2789, -0.0891, -0.1678, 0.0234, -0.1345, -0.0678, 0.0456, -0.1789, -0.0234, -0.0567, 0.0891, -0.0123, -0.0456, 0.1891, -0.0345, -0.1789, 0.0234, 0.0456, 0.2345, 0.1789, 0.0456, -0.0234, -0.1345, 0.1234, -0.2345, 0.0567, 0.1456, 0.1678, 0.0789, 0.0891, -0.1456, 0.0234, 0.0789, -0.1891, 0.0456, 0.0678, -0.0789, -0.0456, 0.0123, 0.2134, 0.1234, -0.0891, -0.1345, 0.1789, -0.1456, -0.0567, 0.0678, -0.1234, -0.1678, -0.2345, 0.0456, 0.2891, 0.1456, -0.1345, 0.0234, -0.0789, -0.0345, 0.0891, 0.1345, -0.0456, -0.0789, -0.0912, 0.0345, 0.1789, -0.0234, -0.0567, 0.1456, 0.0234, 0.0456, -0.0345, -0.0234, -0.0789, 0.0345, -0.0678, 0.0123, 0.0456, -0.0234, 0.0789, 0.1123, -0.1456, 0.0789, -0.0345, -0.0891, 0.0234, -0.0456, 0.1123, -0.0678, -0.0891, 0.1456, 0.2134, 0.0789, 0.0456, -0.0345, -0.0234, 0.0678, 0.0123, -0.0456, -0.0789, 0.0345, 0.0123, 0.0456, -0.0678, 0.0234]',
    TRUE,
    '["puerta","luces","bomba"]'
)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), permisos = VALUES(permisos);

-- 3. Registro de Acceso de Ejemplo
INSERT INTO accesos_log (face_id, estado, fecha_dispositivo)
VALUES 
    ('1', 'EXITO', NOW() - INTERVAL 15 MINUTE),
    ('Desconocido', 'DENEGADO', NOW() - INTERVAL 5 MINUTE);
