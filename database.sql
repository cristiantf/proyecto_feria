CREATE DATABASE IF NOT EXISTS proyecto_feria;
USE proyecto_feria;

-- Tabla de Usuarios con descriptor biométrico facial (128 floats serializados en JSON)
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    face_descriptor LONGTEXT NOT NULL,
    tiene_acceso BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Registro de Accesos (Historial / Auditoría)
CREATE TABLE IF NOT EXISTS accesos_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    face_id VARCHAR(50),
    estado VARCHAR(20),
    fecha_dispositivo TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Cola de Comandos para el microcontrolador ESP8266
CREATE TABLE IF NOT EXISTS comandos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    comando VARCHAR(50) NOT NULL,
    procesado BOOLEAN DEFAULT FALSE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Nota: Si ya tienes una base de datos previa con error, ejecuta:
-- ALTER TABLE usuarios ADD COLUMN face_descriptor LONGTEXT;
-- ALTER TABLE usuarios DROP COLUMN face_id;
