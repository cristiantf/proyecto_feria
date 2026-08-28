# 🏢 Sistema de Control de Acceso Biométrico y Automatización Domótica IoT

[![Node.js](https://img.shields.io/badge/Node.js-v16+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18-lightgrey.svg)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-5.7+-blue.svg)](https://www.mysql.com/)
[![ESP8266](https://img.shields.io/badge/Hardware-ESP8266%20NodeMCU-red.svg)](https://www.espressif.com/)
[![face-api.js](https://img.shields.io/badge/AI-Face--API.js%20(TensorFlow.js)-orange.svg)](https://justadudewhohacks.github.io/face-api.js/docs/index.html)

Sistema integral de seguridad y domótica desarrollado para proyectos de feria tecnológica. Combina **Autenticación Administrativa**, **Gestión de Contraseñas/PIN de Usuarios**, **Control de Permisos por Dispositivo (Puerta, Luces, Bomba)**, **Actualización de Face ID en Caliente**, **Doble Factor de Acceso (Biométrico y Contraseña)**, **Sistema de Notificaciones Toast Modernas**, **Inferencia de Visión Artificial en el Navegador con face-api.js**, un **Backend REST con Node.js & MySQL**, y un **Microcontrolador ESP8266** para la activación física de actuadores mediante módulo de relés.

---

## 📑 Tabla de Contenidos
1. [Descripción General](#-descripción-general)
2. [Cuentas y Credenciales de Ejemplo](#-cuentas-y-credenciales-de-ejemplo)
3. [Novedades y Gestión de Contraseñas](#-novedades-y-gestión-de-contraseñas)
4. [Control de Acceso y Permisos por Dispositivo](#-control-de-acceso-y-permisos-por-dispositivo)
5. [Arquitectura del Sistema](#-arquitectura-del-sistema)
6. [Estructura del Repositorio](#-estructura-del-repositorio)
7. [Instalación y Configuración](#-instalación-y-configuración)
8. [Referencia de la API REST](#-referencia-de-la-api-rest)
9. [Documentación Adicional](#-documentación-adicional)

---

## 🌟 Descripción General

El proyecto permite gestionar de forma centralizada la seguridad y automatización de una instalación:
1. **Inicio de Sesión y Seguridad del Administrador (`admin_login.html` & `index.html`):** Protege el panel de administración con credenciales, permitiendo gestionar el registro, edición, eliminación de usuarios, cambio de contraseña del admin y consulta de auditoría.
2. **Gestión de Usuarios, Contraseñas y Face ID:** Permite registrar usuarios con contraseña y captura facial, **editar sus contraseñas / PIN** en cualquier momento, gestionar sus permisos y **recapturar/actualizar su rostro biométrico (Face ID)** en caliente.
3. **Autenticación Dual (Facial o por Contraseña/PIN en `login.html`):** Los usuarios pueden ingresar tanto por reconocimiento facial en tiempo real como introduciendo su contraseña/PIN personal como método alternativo o de contingencia.
4. **Control de Actuadores Restringido por Permisos:** Cada usuario cuenta con acceso selectivo a uno o varios dispositivos (🚪 Puerta, 💡 Luces, 💧 Bomba). Los controles no autorizados se bloquean automáticamente en la interfaz y en el backend.

---

## 💎 Novedades y Gestión de Contraseñas

- 🔑 **Gestión Completa de Contraseñas de Usuarios:** Los administradores pueden asignar contraseñas o PINs individuales al crear o editar cualquier usuario desde el panel.
- 🔢 **Acceso Alternativo por Contraseña/PIN:** Modal en `login.html` que permite a los usuarios autenticarse ingresando su PIN/contraseña si no disponen de cámara web.
- 🔒 **Cambio de Contraseña de Administrador:** Modal para actualizar la clave de acceso del administrador con validación de clave actual.
- 🔔 **Sistema de Mensajes Emergentes (Toast Notifications):** Reemplazo total de alertas nativas por toasts animados y modales de confirmación con Glassmorphism.
- 📸 **Actualización en Caliente de Face ID:** Cámara integrada en el modal de edición para escanear y actualizar el descriptor biométrico sin recrear el usuario.

---

## 🔑 Cuentas y Credenciales de Ejemplo

La base de datos se inicializa automáticamente con los siguientes accesos:

| Rol | Interfaz | Identificador / Usuario | Contraseña / Método | Permisos Asignados |
| :--- | :--- | :--- | :--- | :--- |
| **Administrador** | [admin_login.html](frontend/admin_login.html) | `admin` | `admin123` | Control total del sistema, gestión de usuarios y contraseñas |
| **Usuario de Ejemplo** | [login.html](frontend/login.html) | `Carlos Gómez (Usuario Ejemplo)` (ID: 1) | `1234` / Reconocimiento Facial / Demo | 🚪 Puerta, 💡 Luces, 💧 Bomba |

---

## 🎛 Control de Acceso y Permisos por Dispositivo

El sistema soporta asignación granular de actuadores por usuario:
- 🚪 **Puerta / Cerradura Eléctrica (`puerta`):** Permite activar el pulso de apertura temporal (3 segundos).
- 💡 **Iluminación Domótica (`luces`):** Permite encender (`LUCES_ON`) y apagar (`LUCES_OFF`) las luces.
- 💧 **Bomba de Agua (`bomba`):** Permite activar (`BOMBA_ON`) y detener (`BOMBA_OFF`) la bomba.

Si un usuario no tiene asignado un dispositivo:
1. En el **Panel de Administración**, se visualiza con badges de color.
2. En el **Portal de Usuario**, los botones de los dispositivos no autorizados quedan deshabilitados en gris con el estado *"Sin permiso"*.
3. En el **Backend REST**, cualquier intento de enviar un comando sin autorización es rechazado con código `HTTP 403 Forbidden`.

---

## 🏗 Arquitectura del Sistema

```
  ┌──────────────────────────────────────────────────────────┐
  │                   NAVEGADOR WEB / CLIENTE               │
  │  - Login Admin & Cambio Clave (admin_login.html)         │
  │  - Panel Admin CRUD, Password, Face ID & Permisos        │
  │  - Portal de Acceso Facial & Acceso PIN (login.html)     │
  │  - Sistema de Toasts y Modales de Confirmación           │
  │  - Inferencia IA: SSD MobileNet + Face-API (128D Vector) │
  └──────────────────────────┬───────────────────────────────┘
                             │ HTTP REST / JSON
                             ▼
  ┌──────────────────────────────────────────────────────────┐
  │                 BACKEND (Node.js + Express)              │
  │  - Servidor API en Puerto 3000                           │
  │  - Auth Admin, User Passwords, CRUD Usuarios & Face ID   │
  └──────────────────────────┬───────────────────────────────┘
                             │ mysql2 / Pool de Conexiones
                             ▼
  ┌──────────────────────────────────────────────────────────┐
  │                 BASE DE DATOS (MySQL / MariaDB)          │
  │  - Tablas: administradores, usuarios (password), logs    │
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
│   └── server.js                # Servidor API REST, CRUD, passwords, Face ID & auth
├── database.sql                 # Script DDL con administradores, usuarios y permisos
├── esp8266/
│   └── puerta_biometrica.ino    # Firmware Arduino C++ para NodeMCU ESP8266
├── frontend/
│   ├── admin_login.html         # Pantalla de inicio de sesión para el administrador
│   ├── app.js                   # Lógica del panel (CRUD, Passwords, Face ID, Toasts)
│   ├── index.html               # Vista del panel de administración (protegido)
│   ├── login.html               # Vista de login facial / login manual por PIN
│   ├── login.js                 # Lógica de comparación facial, PIN y comandos
│   ├── models/                  # Pesos binarios locales para face-api.js
│   └── style.css                # Estilos modernos, Glassmorphism, Toasts y Modales
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
- **Panel Administrativo (CRUD, Contraseñas, Face ID y Permisos):** [http://localhost:3000/index.html](http://localhost:3000/index.html)
- **Portal de Acceso Facial y PIN:** [http://localhost:3000/login.html](http://localhost:3000/login.html)

---

## 📡 Referencia de la API REST

| Método | Endpoint | Descripción | Body (JSON) / Respuesta |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/admin/login` | Iniciar sesión administrativa | `{ usuario, password }` -> Retorna token y datos admin |
| `PUT` | `/api/admin/password` | Cambiar contraseña del administrador | `{ adminId, passwordActual, nuevaPassword }` |
| `POST` | `/api/user/login` | Iniciar sesión de usuario con PIN/Contraseña | `{ userId, password }` -> Retorna datos y permisos |
| `GET` | `/api/usuarios` | Lista usuarios registrados con sus contraseñas y permisos | Retorna `[{ id, nombre, password, tiene_acceso, permisos, creado_en }]` |
| `GET` | `/api/rostros` | Obtiene descriptores faciales y permisos para matching | Retorna `[{ id, nombre, face_descriptor, permisos }]` |
| `POST` | `/api/usuarios` | Registra nuevo usuario con contraseña, rostro y permisos | `{ nombre, password?, face_descriptor, tiene_acceso, permisos }` |
| `PUT` | `/api/usuarios/:id` | Actualiza nombre, contraseña, permisos y/o Face ID | `{ nombre, password?, tiene_acceso, permisos, face_descriptor? }` |
| `DELETE` | `/api/usuarios/:id` | Elimina permanentemente un usuario | Retorna `{ success: true }` |
| `POST` | `/api/recibir_log` | Registra un evento de acceso en el log | `{ id, estado }` |
| `GET` | `/api/logs` | Devuelve el historial de accesos recientes | Retorna `[{ id, nombre, face_id, estado, fecha }]` |
| `POST` | `/api/comando` | Encola comando con validación de permisos de usuario | `{ accion, userId }` (`ABRIR_PUERTA`, etc.) |
| `GET` | `/api/check_comando` | Endpoint de consumo para el ESP8266 (FIFO) | Retorna texto plano: `ABRIR_PUERTA`, `NONE`, etc. |

---

## 📚 Documentación Adicional

- 📖 [Documentación de Arquitectura Completa](docs/ARQUITECTURA.md)
- ⚙️ [Manual Técnico y Especificación de Hardware](docs/DOCUMENTACION_TECNICA.md)
