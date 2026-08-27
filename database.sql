CREATE DATABASE IF NOT EXISTS proyecto_feria;
USE proyecto_feria;

CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    face_id VARCHAR(50) NOT NULL UNIQUE,
    tiene_acceso BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE accesos_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    face_id VARCHAR(50),
    estado VARCHAR(20),
    fecha_dispositivo VARCHAR(50),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE comandos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    comando VARCHAR(50) NOT NULL,
    procesado BOOLEAN DEFAULT FALSE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar un usuario de prueba
INSERT INTO usuarios (nombre, face_id, tiene_acceso) VALUES ('Administrador', '1', TRUE);
