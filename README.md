# 🏢 Sistema de Control de Acceso Biométrico y Automatización Domótica IoT

[![Node.js](https://img.shields.io/badge/Node.js-v16+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18-lightgrey.svg)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-5.7+-blue.svg)](https://www.mysql.com/)
[![ESP8266](https://img.shields.io/badge/Hardware-ESP8266%20NodeMCU-red.svg)](https://www.espressif.com/)
[![face-api.js](https://img.shields.io/badge/AI-Face--API.js%20(TensorFlow.js)-orange.svg)](https://justadudewhohacks.github.io/face-api.js/docs/index.html)

Sistema integral de seguridad y domótica desarrollado para proyectos de feria tecnológica. Combina **Inteligencia Artificial en el navegador (Visión Artificial / Reconocimiento Facial)**, un **Backend REST con Node.js & MySQL**, y un **Microcontrolador ESP8266** para la activación física de actuadores (cerradura eléctrica/puerta, iluminación y bomba de agua mediante módulo de relés).

---

## 📑 Tabla de Contenidos
1. [Descripción General](#-descripción-general)
2. [Características Principales](#-características-principales)
3. [Arquitectura del Sistema](#-arquitectura-del-sistema)
4. [Estructura del Repositorio](#-estructura-del-repositorio)
5. [Requisitos Previos](#-requisitos-previos)
6. [Instalación y Configuración](#-instalación-y-configuración)
   - [1. Configuración de Base de Datos (MySQL)](#1-configuración-de-base-de-datos-mysql)
   - [2. Configuración y Ejecución del Backend](#2-configuración-y-ejecución-del-backend)
   - [3. Acceso a la Interfaz Frontend](#3-acceso-a-la-interfaz-frontend)
   - [4. Programación y Conexión del ESP8266](#4-programación-y-conexión-del-esp8266)
7. [Referencia de la API REST](#-referencia-de-la-api-rest)
8. [Diagnóstico y Solución: Actualización de Usuarios](#-diagnóstico-y-solución-actualización-de-usuarios)
9. [Documentación Adicional](#-documentación-adicional)

---

## 🌟 Descripción General

El proyecto permite gestionar de forma centralizada la seguridad de una instalación:
1. **Registro Biométrico:** Desde el panel de administración, el administrador captura el rostro de una persona con la cámara web. Los descriptores faciales (vectores de 128 dimensiones de TensorFlow.js/face-api.js) se extraen en el cliente y se almacenan serializados en la base de datos MySQL.
2. **Autenticación Facial en Vivo:** En el portal de acceso (`login.html`), la cámara escanea en tiempo real a la persona frente al dispositivo, calcula la distancia euclidiana frente a los rostros registrados en la base de datos y, si el usuario tiene acceso habilitado, le concede el ingreso.
3. **Control de Actuadores (Domótica IoT):** Al autorizar el acceso, el usuario tiene acceso a controles en tiempo real para abrir la puerta, encender/apagar luces y activar/desactivar bombas. Estos comandos son encolados en la base de datos y consumidos por el microcontrolador ESP8266 mediante peticiones HTTP.

---

## ✨ Características Principales

- **IA en el Cliente (Sin costes de API externa):** Utiliza SSD MobileNet v1 y FaceLandmarks68 sobre WebGL/Canvas para inferencia biométrica en tiempo real a alta velocidad.
- **Auditoría y Logs en Tiempo Real:** Registro detallado de cada intento de acceso (exitoso o denegado) con marca de tiempo.
- **Cola de Comandos Asíncrona (Polling IoT):** Comunicación fluida entre la web y el hardware sin necesidad de IP pública o configuración compleja de puertos.
- **Portal Cautivo WiFiManager:** El ESP8266 crea un punto de acceso temporal (`ESP_DOMOTICA`) en caso de no encontrar red WiFi para su fácil configuración sin reprogramar.
- **Temporización Inteligente:** Cierre automático de puerta por hardware tras 3 segundos mediante temporizadores no bloqueantes (`millis()`).

---

## 🏗 Arquitectura del Sistema

```
  ┌──────────────────────────────────────────────────────────┐
  │                   NAVEGADOR WEB / CLIENTE               │
  │  - Panel Admin (index.html, app.js)                      │
  │  - Portal de Acceso Facial (login.html, login.js)        │
  │  - Inferencia IA: SSD MobileNet + Face-API (128D Vector) │
  └──────────────────────────┬───────────────────────────────┘
                             │ HTTP REST / JSON
                             ▼
  ┌──────────────────────────────────────────────────────────┐
  │                 BACKEND (Node.js + Express)              │
  │  - Servidor API en Puerto 3000                           │
  │  - Gestión de Usuarios, Rostros, Logs y Comandos         │
  └──────────────────────────┬───────────────────────────────┘
                             │ mysql2 / Pool de Conexiones
                             ▼
  ┌──────────────────────────────────────────────────────────┐
  │                 BASE DE DATOS (MySQL / MariaDB)          │
  │  - Tablas: usuarios, accesos_log, comandos               │
  └──────────────────────────┬───────────────────────────────┘
                             │ HTTP GET Polling (/api/check_comando)
                             ▼
  ┌──────────────────────────────────────────────────────────┐
  │               HARDWARE (ESP8266 NodeMCU)                 │
  │  - WiFiManager para conexión inalámbrica                 │
  │  - Salidas Digitales (GPIO 2: Puerta, 14: Luces, 15: Bomba)
  │  - Módulo de 4 Relés Optoacoplados                      │
  └──────────────────────────────────────────────────────────┘
```

---

## 📁 Estructura del Repositorio

```text
proyecto_feria/
├── backend/
│   ├── download_models.js       # Script de descarga de pesos de face-api
│   ├── package.json             # Dependencias del servidor (express, cors, mysql2)
│   └── server.js                # Servidor API REST y servidor de estáticos
├── database.sql                 # Script DDL de creación de tablas en MySQL
├── esp8266/
│   └── puerta_biometrica.ino    # Firmware Arduino C++ para NodeMCU ESP8266
├── frontend/
│   ├── app.js                   # Lógica del panel administrativo y registro de rostros
│   ├── index.html               # Vista del panel de administración
│   ├── login.html               # Vista de login con escáner biométrico y panel domótico
│   ├── login.js                 # Lógica de comparación de rostros y envío de comandos
│   ├── models/                  # Pesos binarios locales para face-api.js
│   └── style.css                # Estilos modernos con tema oscuro y glassmorphism
├── docs/
│   ├── ARQUITECTURA.md          # Especificación completa de arquitectura y diagramas
│   └── DOCUMENTACION_TECNICA.md # Especificación técnica, endpoints y hardware
└── README.md                    # Documento principal del proyecto
```

---

## ⚙️ Requisitos Previos

- **Node.js** (versión 16.x o superior) y **npm**.
- **MySQL Server** o **XAMPP / WampServer** (MariaDB / MySQL 5.7+).
- **Arduino IDE** (con paquete de tarjetas ESP8266 instalado).
- **Cámara Web** funcional (integrada o USB) para captura de rostros.
- **Hardware IoT (Opcional para pruebas físicas):**
  - Placa ESP8266 (NodeMCU v3 / D1 Mini).
  - Módulo de Relés 5V de 2 o 4 canales.
  - Fuente de alimentación 5V / 2A.
  - Cables Dupont de conexión.

---

## 🚀 Instalación y Configuración

### 1. Configuración de Base de Datos (MySQL)

1. Abre tu gestor de base de datos favorito (ej. **phpMyAdmin**, MySQL Workbench o CLI).
2. Asegúrate de que el servicio MySQL esté iniciado (por ejemplo en el panel de control de XAMPP).
3. Importa o ejecuta el script [database.sql](database.sql):
   ```sql
   CREATE DATABASE IF NOT EXISTS proyecto_feria;
   USE proyecto_feria;
   ```
4. El script creará las siguientes tablas optimizadas:
   - `usuarios`: Almacena el nombre, el descriptor facial (`LONGTEXT`) y el estado de acceso.
   - `accesos_log`: Auditoría de autenticaciones faciales con fecha y estado.
   - `comandos`: Cola de instrucciones domóticas para el ESP8266.

### 2. Configuración y Ejecución del Backend

1. Abre una terminal en la carpeta `backend`:
   ```bash
   cd backend
   ```
2. Instala las dependencias necesarias:
   ```bash
   npm install
   ```
3. Verifica la configuración de conexión en [backend/server.js](backend/server.js#L18-L23):
   ```javascript
   const dbConfig = {
       host: 'localhost',
       user: 'root',
       password: '',        // Coloca la contraseña de tu MySQL si tiene
       database: 'proyecto_feria'
   };
   ```
4. Inicia el servidor:
   ```bash
   npm start
   ```
   > Verás en consola:
   > `✅ Conexión exitosa a MySQL (Base de datos: proyecto_feria)`
   > `Backend de Feria corriendo en http://localhost:3000`

### 3. Acceso a la Interfaz Frontend

Al arrancar el servidor backend, los archivos del frontend se sirven automáticamente:
- **Panel de Administración (Registro de Rostros y Logs):**
  👉 [http://localhost:3000/](http://localhost:3000/) o [http://localhost:3000/index.html](http://localhost:3000/index.html)
- **Portal de Acceso Biométrico y Control Domótico:**
  👉 [http://localhost:3000/login.html](http://localhost:3000/login.html)

*(También puedes abrir los archivos directamente usando la extensión Live Server en VS Code si lo prefieres).*

### 4. Programación y Conexión del ESP8266

1. Abre el archivo [esp8266/puerta_biometrica.ino](esp8266/puerta_biometrica.ino) en **Arduino IDE**.
2. Instala las librerías necesarias desde el Gestor de Librerías (`Programa -> Incluir Librería -> Administrar Bibliotecas`):
   - `ESP8266WiFi` (incluida en el core ESP8266).
   - `ESP8266HTTPClient`.
   - `WiFiManager` (por tzapu / tablatronix).
3. Modifica la variable `HOST_URL` con la IP local de tu computadora (usa `ipconfig` en Windows para conocerla):
   ```cpp
   const char* HOST_URL = "http://192.168.1.100:3000"; // Reemplaza con la IP de tu PC
   ```
4. Conecta la placa NodeMCU ESP8266 por USB, selecciona la placa y el puerto COM correspondiente y presiona **Subir (Upload)**.
5. Diagrama de Pines:
   | Función | Pin NodeMCU | GPIO ESP8266 | Conexión Relé |
   | :--- | :--- | :--- | :--- |
   | **Cerradura / Puerta** | D4 | GPIO 2 | IN1 |
   | **Luces** | D5 | GPIO 14 | IN2 |
   | **Bomba de Agua** | D8 | GPIO 15 | IN3 |
   | **Alimentación** | VIN (5V) / GND | - | VCC / GND del Relé |

---

## 📡 Referencia de la API REST

| Método | Endpoint | Descripción | Body (JSON) / Respuesta |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/usuarios` | Obtiene la lista de usuarios registrados para el panel | Retorna `[{ id, nombre, tiene_acceso, creado_en }]` |
| `GET` | `/api/rostros` | Obtiene los descriptores faciales (vectores 128D) | Retorna `[{ id, nombre, face_descriptor }]` |
| `POST` | `/api/usuarios` | Registra un nuevo usuario con su vector facial | Payload: `{ nombre, face_descriptor, tiene_acceso }` |
| `POST` | `/api/recibir_log` | Registra un evento de acceso en el log | Payload: `{ id, estado }` |
| `GET` | `/api/logs` | Devuelve el historial de accesos recientes | Retorna `[{ id, nombre, face_id, estado, fecha }]` |
| `POST` | `/api/comando` | Encola un comando domótico para el ESP8266 | Payload: `{ accion }` (`ABRIR_PUERTA`, `LUCES_ON`, etc.) |
| `GET` | `/api/check_comando` | Endpoint de consumo para el ESP8266 (FIFO) | Retorna texto plano: `ABRIR_PUERTA`, `NONE`, etc. |

---

## 🔍 Diagnóstico y Solución: Actualización de Usuarios

### ❓ ¿Por qué los usuarios creados no se actualizaban en la vista?

Durante el análisis del código se detectaron **tres causas fundamentales concatenadas**:

1. **Incompatibilidad de Esquema en Base de Datos (`database.sql` vs `server.js`):**
   - El script original `database.sql` definía la tabla con una columna `face_id VARCHAR(50) NOT NULL UNIQUE`, pero el backend ejecutaba `INSERT INTO usuarios (nombre, face_descriptor, tiene_acceso)`.
   - Como la columna `face_descriptor` no existía en la base de datos y `face_id` requería un valor obligatorio sin valor por defecto, MySQL rechazaba la inserción y devolvía un error HTTP 500 (`Unknown column 'face_descriptor'`).
2. **Falsa Confirmación de Éxito en el Frontend (`frontend/app.js`):**
   - La función estándar `fetch()` de JavaScript **no rechaza la promesa** cuando el servidor responde con un código de error HTTP `500` o `400`. Solo se va al bloque `catch` si hay una caída total de red.
   - En consecuencia, el código ejecutaba `alert("Usuario registrado con éxito.")` y llamaba a `cargarUsuarios()`, pero como la base de datos nunca insertó la fila, la tabla se volvía a cargar exactamente igual, dando la ilusión de que no se actualizaba.
3. **Tipo de Dato Inadecuado para Descriptores Faciales:**
   - Un descriptor facial de face-api.js es un vector de 128 números flotantes. Al serializarse a JSON, ocupa entre 1.5 KB y 2.5 KB de texto.
   - Si la columna se creaba como `VARCHAR(255)`, MySQL truncaba o fallaba por desbordamiento de tamaño.

### ✅ ¿Cómo se solucionó?

1. **Corrección de `database.sql`:** Se actualizó la definición de la columna a `face_descriptor LONGTEXT NOT NULL`.
2. **Validación `res.ok` en `frontend/app.js`:** Se añadió verificación estricta de `res.ok`. Si el servidor responde con un error, se extrae el mensaje de error del backend y se notifica al usuario sin limpiar el formulario erróneamente.
3. **Resiliencia de Modelos:** Se añadió soporte para fallback local (`./models`) y CDN con reintentos para garantizar que la captura biométrica siempre esté lista.

---

## 📚 Documentación Adicional

Para profundizar en los detalles técnicos y de arquitectura:
- 📖 [Documentación de Arquitectura Completa](docs/ARQUITECTURA.md)
- ⚙️ [Manual Técnico y Especificación de Hardware](docs/DOCUMENTACION_TECNICA.md)
