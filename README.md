# 🏢 Sistema de Control de Acceso Biométrico y Automatización Domótica IoT

[![Node.js](https://img.shields.io/badge/Node.js-v16+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18-lightgrey.svg)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-5.7+-blue.svg)](https://www.mysql.com/)
[![ESP8266](https://img.shields.io/badge/Hardware-ESP8266%20NodeMCU-red.svg)](https://www.espressif.com/)
[![face-api.js](https://img.shields.io/badge/AI-Face--API.js%20(TensorFlow.js)-orange.svg)](https://justadudewhohacks.github.io/face-api.js/docs/index.html)

Sistema integral de seguridad y domótica desarrollado para proyectos de feria tecnológica. Combina **Autenticación Administrativa**, **Gestión de Permisos por Dispositivo (Puerta, Luces, Bomba)**, **Inteligencia Artificial en el navegador (Visión Artificial / Reconocimiento Facial)**, un **Backend REST con Node.js & MySQL**, y un **Microcontrolador ESP8266** para la activación física de actuadores mediante módulo de relés.

---

## 📑 Tabla de Contenidos
1. [Descripción General](#-descripción-general)
2. [Cuentas y Credenciales de Ejemplo](#-cuentas-y-credenciales-de-ejemplo)
3. [Características Principales](#-características-principales)
4. [Control de Acceso y Permisos por Dispositivo](#-control-de-acceso-y-permisos-por-dispositivo)
5. [Arquitectura del Sistema](#-arquitectura-del-sistema)
6. [Estructura del Repositorio](#-estructura-del-repositorio)
7. [Instalación y Configuración](#-instalación-y-configuración)
8. [Referencia de la API REST](#-referencia-de-la-api-rest)
9. [Documentación Adicional](#-documentación-adicional)

---

## 🌟 Descripción General

El proyecto permite gestionar de forma centralizada la seguridad y automatización de una instalación:
1. **Inicio de Sesión Administrativo (`admin_login.html`):** Protege el panel de administración con usuario y contraseña, permitiendo gestionar el registro, edición y eliminación de usuarios y la auditoría.
2. **Gestión CRUD y Permisos Granulares (`index.html`):** Permite registrar nuevos rostros con la cámara web, **editar nombres y permisos de dispositivos** o **eliminar usuarios** en cualquier momento.
3. **Autenticación Facial en Vivo (`login.html`):** En el portal de acceso, la cámara escanea en tiempo real a la persona frente al dispositivo, calcula la distancia euclidiana frente a los rostros registrados en la base de datos y, si el usuario tiene acceso habilitado, le concede el ingreso.
4. **Control de Actuadores Restringido por Permisos:** Cada usuario cuenta con acceso selectivo a uno o varios dispositivos (🚪 Puerta, 💡 Luces, 💧 Bomba). Los controles domóticos no autorizados se bloquean automáticamente tanto en la interfaz como en el backend.

---

## 🔑 Cuentas y Credenciales de Ejemplo

La base de datos se inicializa automáticamente con los siguientes accesos:

| Rol | Interfaz | Identificador / Usuario | Contraseña / Método | Permisos Asignados |
| :--- | :--- | :--- | :--- | :--- |
| **Administrador** | [admin_login.html](frontend/admin_login.html) | `admin` | `admin123` | Control total del sistema y gestión de usuarios |
| **Usuario de Ejemplo** | [login.html](frontend/login.html) | `Carlos Gómez (Usuario Ejemplo)` (ID: 1) | Reconocimiento Facial / Botón Demo | 🚪 Puerta, 💡 Luces, 💧 Bomba |

---

## 🎛 Control de Acceso y Permisos por Dispositivo

El sistema soporta asignación granular de actuadores por usuario:
- 🚪 **Puerta / Cerradura Eléctrica (`puerta`):** Permite activar el pulso de apertura temporal (3 segundos).
- 💡 **Iluminación Domótica (`luces`):** Permite encender (`LUCES_ON`) y apagar (`LUCES_OFF`) las luces.
- 💧 **Bomba de Agua (`bomba`):** Permite activar (`BOMBA_ON`) y detener (`BOMBA_OFF`) la bomba.

Si un usuario no tiene asignado un dispositivo:
1. En el **Panel de Administración**, se visualiza claramente con badges de color.
2. En el **Portal de Usuario**, los botones de los dispositivos no autorizados quedan deshabilitados en gris con el estado *"Sin permiso"*.
3. En el **Backend REST**, cualquier intento de enviar un comando sin autorización es rechazado con código `HTTP 403 Forbidden`.

---

## ✨ Características Principales

- **Gestión Completa de Usuarios (CRUD):** Crear con captura biométrica, editar nombre/permisos y eliminar usuarios.
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
  │  - Panel Admin CRUD & Permisos (index.html, app.js)      │
  │  - Portal de Acceso Facial (login.html, login.js)        │
  │  - Inferencia IA: SSD MobileNet + Face-API (128D Vector) │
  └──────────────────────────┬───────────────────────────────┘
                             │ HTTP REST / JSON
                             ▼
  ┌──────────────────────────────────────────────────────────┐
  │                 BACKEND (Node.js + Express)              │
  │  - Servidor API en Puerto 3000                           │
  │  - Auth Admin, CRUD Usuarios, Validación de Permisos     │
  └──────────────────────────┬───────────────────────────────┘
                             │ mysql2 / Pool de Conexiones
                             ▼
  ┌──────────────────────────────────────────────────────────┐
  │                 BASE DE DATOS (MySQL / MariaDB)          │
  │  - Tablas: administradores, usuarios (permisos), logs    │
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
│   └── server.js                # Servidor API REST, CRUD, auth y servidor de estáticos
├── database.sql                 # Script DDL con administradores, usuarios y permisos
├── esp8266/
│   └── puerta_biometrica.ino    # Firmware Arduino C++ para NodeMCU ESP8266
├── frontend/
│   ├── admin_login.html         # Pantalla de inicio de sesión para el administrador
│   ├── app.js                   # Lógica del panel administrativo (CRUD y permisos)
│   ├── index.html               # Vista del panel de administración (protegido)
│   ├── login.html               # Vista de login con escáner biométrico y panel domótico
│   ├── login.js                 # Lógica de comparación facial, permisos y comandos
│   ├── models/                  # Pesos binarios locales para face-api.js
│   └── style.css                # Estilos modernos con tema oscuro y glassmorphism
├── docs/
│   ├── ARQUITECTURA.md          # Especificación completa de arquitectura y diagramas
│   └── DOCUMENTACION_TECNICA.md # Especificación técnica, endpoints y hardware
├── .gitignore                   # Configuración de exclusiones de git
└── README.md                    # Documento principal del proyecto
```

---

## 🚀 Instalación y Configuración

### 1. Base de Datos (MySQL)
Inicia tu servicio MySQL (ej. XAMPP) e importa [database.sql](database.sql). *(El backend también migra y siembra automáticamente las tablas al iniciar).*

### 2. Backend Node.js
```bash
cd backend
npm install
npm start
```
> Servidor corriendo en `http://localhost:3000`

### 3. Acceso a las Interfaces Web
- **Login Administrador:** [http://localhost:3000/admin_login.html](http://localhost:3000/admin_login.html) (`admin` / `admin123`)
- **Panel Administrativo (CRUD y Permisos):** [http://localhost:3000/index.html](http://localhost:3000/index.html)
- **Portal de Acceso Facial y Domótica:** [http://localhost:3000/login.html](http://localhost:3000/login.html)

---

## 📡 Referencia de la API REST

| Método | Endpoint | Descripción | Body (JSON) / Respuesta |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/admin/login` | Iniciar sesión administrativa | `{ usuario, password }` -> Retorna token y datos admin |
| `GET` | `/api/usuarios` | Lista usuarios registrados con sus permisos | Retorna `[{ id, nombre, tiene_acceso, permisos, creado_en }]` |
| `GET` | `/api/rostros` | Obtiene descriptores faciales y permisos para matching | Retorna `[{ id, nombre, face_descriptor, permisos }]` |
| `POST` | `/api/usuarios` | Registra un nuevo usuario con rostro y permisos | `{ nombre, face_descriptor, tiene_acceso, permisos }` |
| `PUT` | `/api/usuarios/:id` | Actualiza nombre, acceso y permisos de dispositivos | `{ nombre, tiene_acceso, permisos }` |
| `DELETE` | `/api/usuarios/:id` | Elimina permanentemente un usuario | Retorna `{ success: true }` |
| `POST` | `/api/recibir_log` | Registra un evento de acceso en el log | `{ id, estado }` |
| `GET` | `/api/logs` | Devuelve el historial de accesos recientes | Retorna `[{ id, nombre, face_id, estado, fecha }]` |
| `POST` | `/api/comando` | Encola comando con validación de permisos de usuario | `{ accion, userId }` (`ABRIR_PUERTA`, etc.) |
| `GET` | `/api/check_comando` | Endpoint de consumo para el ESP8266 (FIFO) | Retorna texto plano: `ABRIR_PUERTA`, `NONE`, etc. |

---

## 📚 Documentación Adicional

- 📖 [Documentación de Arquitectura Completa](docs/ARQUITECTURA.md)
- ⚙️ [Manual Técnico y Especificación de Hardware](docs/DOCUMENTACION_TECNICA.md)
