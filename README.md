# 🏢 Sistema de Control de Acceso Biométrico y Automatización Domótica IoT

[![Node.js](https://img.shields.io/badge/Node.js-v16+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18-lightgrey.svg)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-5.7+-blue.svg)](https://www.mysql.com/)
[![ESP8266](https://img.shields.io/badge/Hardware-ESP8266%20NodeMCU-red.svg)](https://www.espressif.com/)
[![face-api.js](https://img.shields.io/badge/AI-Face--API.js%20(TensorFlow.js)-orange.svg)](https://justadudewhohacks.github.io/face-api.js/docs/index.html)

Sistema integral de seguridad y domótica desarrollado para proyectos de feria tecnológica. Combina **Autenticación Administrativa**, **Inteligencia Artificial en el navegador (Visión Artificial / Reconocimiento Facial)**, un **Backend REST con Node.js & MySQL**, y un **Microcontrolador ESP8266** para la activación física de actuadores (cerradura eléctrica/puerta, iluminación y bomba de agua mediante módulo de relés).

---

## 📑 Tabla de Contenidos
1. [Descripción General](#-descripción-general)
2. [Cuentas y Credenciales de Ejemplo](#-cuentas-y-credenciales-de-ejemplo)
3. [Características Principales](#-características-principales)
4. [Arquitectura del Sistema](#-arquitectura-del-sistema)
5. [Estructura del Repositorio](#-estructura-del-repositorio)
6. [Requisitos Previos](#-requisitos-previos)
7. [Instalación y Configuración](#-instalación-y-configuración)
   - [1. Configuración de Base de Datos (MySQL)](#1-configuración-de-base-de-datos-mysql)
   - [2. Configuración y Ejecución del Backend](#2-configuración-y-ejecución-del-backend)
   - [3. Acceso a la Interfaz Frontend](#3-acceso-a-la-interfaz-frontend)
   - [4. Programación y Conexión del ESP8266](#4-programación-y-conexión-del-esp8266)
8. [Referencia de la API REST](#-referencia-de-la-api-rest)
9. [Diagnóstico y Solución: Actualización de Usuarios](#-diagnóstico-y-solución-actualización-de-usuarios)
10. [Documentación Adicional](#-documentación-adicional)

---

## 🌟 Descripción General

El proyecto permite gestionar de forma centralizada la seguridad de una instalación:
1. **Inicio de Sesión Administrativo (`admin_login.html`):** Protege el panel de administración con usuario y contraseña, permitiendo gestionar el registro de nuevos usuarios y consultar la auditoría.
2. **Registro Biométrico (`index.html`):** El administrador captura el rostro de una persona con la cámara web. Los descriptores faciales (vectores de 128 dimensiones de TensorFlow.js/face-api.js) se extraen en el cliente y se almacenan serializados en la base de datos MySQL.
3. **Autenticación Facial en Vivo (`login.html`):** En el portal de acceso, la cámara escanea en tiempo real a la persona frente al dispositivo, calcula la distancia euclidiana frente a los rostros registrados en la base de datos y, si el usuario tiene acceso habilitado, le concede el ingreso.
4. **Control de Actuadores (Domótica IoT):** Al autorizar el acceso, el usuario dispone de controles en tiempo real para abrir la puerta (3s temporizado), encender/apagar luces y activar/desactivar bombas. Estos comandos son encolados en la base de datos y consumidos por el microcontrolador ESP8266 mediante peticiones HTTP.

---

## 🔑 Cuentas y Credenciales de Ejemplo

Para facilitar las pruebas y demostraciones en vivo, la base de datos se inicializa automáticamente con los siguientes accesos:

| Rol | Interfaz | Identificador / Usuario | Contraseña / Método | Propósito |
| :--- | :--- | :--- | :--- | :--- |
| **Administrador** | [admin_login.html](frontend/admin_login.html) | `admin` | `admin123` | Acceso total al panel de gestión, registro biométrico y logs |
| **Usuario de Ejemplo** | [login.html](frontend/login.html) | `Carlos Gómez (Usuario Ejemplo)` (ID: 1) | Reconocimiento Facial / Botón Demo | Acceso al panel domótico y activación de actuadores |

---

## ✨ Características Principales

- **Seguridad y Control de Sesión:** Módulo de inicio de sesión administrativo con almacenamiento de token/sesión en el navegador.
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
  │  - Login Admin (admin_login.html)                        │
  │  - Panel Admin (index.html, app.js)                      │
  │  - Portal de Acceso Facial (login.html, login.js)        │
  │  - Inferencia IA: SSD MobileNet + Face-API (128D Vector) │
  └──────────────────────────┬───────────────────────────────┘
                             │ HTTP REST / JSON
                             ▼
  ┌──────────────────────────────────────────────────────────┐
  │                 BACKEND (Node.js + Express)              │
  │  - Servidor API en Puerto 3000                           │
  │  - Auth Admin, Usuarios, Rostros, Logs y Comandos        │
  └──────────────────────────┬───────────────────────────────┘
                             │ mysql2 / Pool de Conexiones
                             ▼
  ┌──────────────────────────────────────────────────────────┐
  │                 BASE DE DATOS (MySQL / MariaDB)          │
  │  - Tablas: administradores, usuarios, accesos_log, cmds  │
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
│   └── server.js                # Servidor API REST, auth y servidor de estáticos
├── database.sql                 # Script DDL con administradores y datos de prueba
├── esp8266/
│   └── puerta_biometrica.ino    # Firmware Arduino C++ para NodeMCU ESP8266
├── frontend/
│   ├── admin_login.html         # Pantalla de inicio de sesión para el administrador
│   ├── app.js                   # Lógica del panel administrativo y gestión de sesión
│   ├── index.html               # Vista del panel de administración (protegido)
│   ├── login.html               # Vista de login con escáner biométrico y panel domótico
│   ├── login.js                 # Lógica de comparación facial, demo y comandos
│   ├── models/                  # Pesos binarios locales para face-api.js
│   └── style.css                # Estilos modernos con tema oscuro y glassmorphism
├── docs/
│   ├── ARQUITECTURA.md          # Especificación completa de arquitectura y diagramas
│   └── DOCUMENTACION_TECNICA.md # Especificación técnica, endpoints y hardware
├── .gitignore                   # Configuración de exclusiones de git
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
   *(Nota: El servidor Node.js también inicializa automáticamente las tablas y los usuarios de prueba al arrancar si la base de datos `proyecto_feria` está creada).*

### 2. Configuración y Ejecución del Backend

1. Abre una terminal en la carpeta `backend`:
   ```bash
   cd backend
   ```
2. Instala las dependencias necesarias:
   ```bash
   npm install
   ```
3. Verifica la configuración de conexión en [backend/server.js](backend/server.js):
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
- **Inicio de Sesión Administrador:**
  👉 [http://localhost:3000/admin_login.html](http://localhost:3000/admin_login.html) *(Credenciales: `admin` / `admin123`)*
- **Panel de Administración (Protegido):**
  👉 [http://localhost:3000/](http://localhost:3000/) o [http://localhost:3000/index.html](http://localhost:3000/index.html)
- **Portal de Acceso Biométrico y Control Domótico:**
  👉 [http://localhost:3000/login.html](http://localhost:3000/login.html)

---

## 📡 Referencia de la API REST

| Método | Endpoint | Descripción | Body (JSON) / Respuesta |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/admin/login` | Iniciar sesión administrativa | Payload: `{ usuario, password }` -> Retorna token y datos admin |
| `GET` | `/api/usuarios` | Obtiene la lista de usuarios registrados para el panel | Retorna `[{ id, nombre, tiene_acceso, creado_en }]` |
| `GET` | `/api/rostros` | Obtiene los descriptores faciales (vectores 128D) | Retorna `[{ id, nombre, face_descriptor }]` |
| `POST` | `/api/usuarios` | Registra un nuevo usuario con su vector facial | Payload: `{ nombre, face_descriptor, tiene_acceso }` |
| `POST` | `/api/recibir_log` | Registra un evento de acceso en el log | Payload: `{ id, estado }` |
| `GET` | `/api/logs` | Devuelve el historial de accesos recientes | Retorna `[{ id, nombre, face_id, estado, fecha }]` |
| `POST` | `/api/comando` | Encola un comando domótico para el ESP8266 | Payload: `{ accion }` (`ABRIR_PUERTA`, `LUCES_ON`, etc.) |
| `GET` | `/api/check_comando` | Endpoint de consumo para el ESP8266 (FIFO) | Retorna texto plano: `ABRIR_PUERTA`, `NONE`, etc. |

---

## 📚 Documentación Adicional

Para profundizar en los detalles técnicos y de arquitectura:
- 📖 [Documentación de Arquitectura Completa](docs/ARQUITECTURA.md)
- ⚙️ [Manual Técnico y Especificación de Hardware](docs/DOCUMENTACION_TECNICA.md)
