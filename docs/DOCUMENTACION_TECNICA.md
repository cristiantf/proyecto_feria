# 🛠️ Documentación Técnica y Manual de Hardware

**Proyecto:** Control de Acceso Biométrico y Domótica IoT  
**Módulos:** Backend REST, Frontend Web AI, Base de Datos MySQL, Firmware ESP8266  

---

## 1. Especificación de la API REST (Backend Node.js)

El backend expone una API REST construida sobre Express.js en el puerto predeterminado `3000`.

### 1.1. Resumen de Endpoints

| Método | Ruta | Propósito | Autenticación |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/admin/login` | Autenticación de administradores | Pública / Credenciales |
| `PUT` | `/api/admin/password` | Cambiar contraseña del administrador | Pública / Validación actual |
| `GET` | `/api/usuarios` | Listar usuarios registrados con sus permisos de dispositivos | Pública |
| `GET` | `/api/rostros` | Descargar vectores biométricos y permisos para matching | Pública |
| `POST` | `/api/usuarios` | Registrar un nuevo usuario con vector facial y permisos | Pública |
| `PUT` | `/api/usuarios/:id` | Actualizar nombre, permisos y opcionalmente Face ID | Pública |
| `DELETE` | `/api/usuarios/:id` | Eliminar usuario de la base de datos | Pública |
| `POST` | `/api/recibir_log` | Registrar eventos de auditoría de acceso | Pública |
| `GET` | `/api/logs` | Consultar los últimos 50 registros de acceso | Pública |
| `POST` | `/api/comando` | Encolar una instrucción domótica validando permisos | Pública |
| `GET` | `/api/check_comando` | Desencolar el comando pendiente más antiguo (FIFO) para el ESP8266 | Pública |

---

### 1.2. Detalle de Endpoints y Esquemas JSON

#### `POST /api/admin/login`
- **Descripción:** Valida las credenciales del administrador para otorgar acceso al panel administrativo.
- **Request Body:**
```json
{
  "usuario": "admin",
  "password": "admin123"
}
```
- **Respuesta Exitosa (200 OK):**
```json
{
  "success": true,
  "admin": {
    "id": 1,
    "usuario": "admin",
    "nombre": "Administrador Principal",
    "rol": "SuperAdmin"
  },
  "token": "auth-admin-YWRtaW46MTc4NzkyOTIzNTE1NA=="
}
```

---

#### `PUT /api/admin/password`
- **Descripción:** Actualiza la contraseña del administrador tras validar la contraseña actual.
- **Request Body:**
```json
{
  "adminId": 1,
  "passwordActual": "admin123",
  "nuevaPassword": "miNuevaPasswordSegura"
}
```
- **Respuesta Exitosa (200 OK):**
```json
{
  "success": true,
  "message": "Contraseña actualizada con éxito."
}
```

---

#### `GET /api/usuarios`
- **Descripción:** Retorna los datos de todos los usuarios registrados incluyendo sus permisos de dispositivos.
- **Respuesta Exitosa (200 OK):**
```json
[
  {
    "id": 1,
    "nombre": "Carlos Gómez (Usuario Ejemplo)",
    "tiene_acceso": 1,
    "permisos": ["puerta", "luces", "bomba"],
    "creado_en": "2026-08-28T14:59:45.000Z"
  }
]
```

---

#### `POST /api/usuarios`
- **Descripción:** Registra un nuevo usuario en la base de datos junto con su descriptor biométrico y permisos de dispositivos.
- **Headers Requeridos:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "nombre": "Juan Pérez",
  "face_descriptor": [-0.145892, 0.098231, 0.124589, "...128 flotantes..."],
  "tiene_acceso": true,
  "permisos": ["puerta", "luces"]
}
```
- **Respuesta Exitosa (200 OK):**
```json
{
  "id": 2,
  "nombre": "Juan Pérez",
  "tiene_acceso": true,
  "permisos": ["puerta", "luces"]
}
```

---

#### `PUT /api/usuarios/:id`
- **Descripción:** Actualiza los datos, permisos y opcionalmente el Face ID de un usuario existente.
- **Request Body:**
```json
{
  "nombre": "Juan Pérez Actualizado",
  "tiene_acceso": true,
  "permisos": ["luces", "bomba"],
  "face_descriptor": [-0.1245, "...128 flotantes... (opcional)"]
}
```
- **Respuesta Exitosa (200 OK):**
```json
{
  "success": true,
  "id": 2,
  "nombre": "Juan Pérez Actualizado",
  "tiene_acceso": true,
  "permisos": ["luces", "bomba"]
}
```

---

#### `DELETE /api/usuarios/:id`
- **Descripción:** Elimina permanentemente a un usuario y sus registros asociados.
- **Respuesta Exitosa (200 OK):**
```json
{
  "success": true,
  "message": "Usuario con ID 2 eliminado correctamente."
}
```

---

#### `POST /api/comando`
- **Descripción:** Registra un comando en la tabla `comandos` para ser consumido por el microcontrolador, validando si el `userId` tiene permiso para el dispositivo.
- **Comandos Soportados:** `ABRIR_PUERTA` (permiso: `puerta`), `LUCES_ON` / `LUCES_OFF` (permiso: `luces`), `BOMBA_ON` / `BOMBA_OFF` (permiso: `bomba`).
- **Request Body:**
```json
{
  "accion": "ABRIR_PUERTA",
  "userId": 1
}
```
- **Respuesta Exitosa (200 OK):**
```json
{
  "success": true,
  "message": "Comando enviado: ABRIR_PUERTA"
}
```
- **Respuesta Denegada (403 Forbidden):**
```json
{
  "error": "No tienes permiso para controlar el dispositivo: puerta."
}
```

---

#### `GET /api/check_comando`
- **Descripción:** Consulta consumida por el ESP8266 cada 2 segundos. Lee el primer comando no procesado, lo marca como `procesado = TRUE` y retorna la instrucción en texto plano.
- **Respuesta:** `ABRIR_PUERTA`, `LUCES_ON`, `LUCES_OFF`, `BOMBA_ON`, `BOMBA_OFF` o `NONE`.

---

## 2. Diccionario de Datos (Base de Datos MySQL)

### 2.1. Tabla: `administradores`
Gestiona las credenciales del personal administrativo para el acceso al panel.

| Campo | Tipo | Nulo | Clave | Default | Descripción |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | No | PK (AI) | Auto | Identificador único del administrador |
| `usuario` | `VARCHAR(50)` | No | UNIQUE | - | Nombre de usuario para login |
| `password` | `VARCHAR(255)` | No | - | - | Contraseña de acceso |
| `nombre` | `VARCHAR(100)` | No | - | - | Nombre del administrador |
| `rol` | `VARCHAR(20)` | Sí | - | `admin` | Nivel de privilegios |
| `creado_en` | `TIMESTAMP` | Sí | - | `CURRENT_TIMESTAMP` | Fecha de alta |

### 2.2. Tabla: `usuarios`
Almacena las credenciales biométricas y permisos de cada persona registrada.

| Campo | Tipo | Nulo | Clave | Default | Descripción |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | No | PK (AI) | Auto | Identificador único del usuario |
| `nombre` | `VARCHAR(100)` | No | - | - | Nombre completo o alias del usuario |
| `face_descriptor` | `LONGTEXT` | No | - | - | Vector de 128 dimensiones serializado en formato JSON |
| `tiene_acceso` | `BOOLEAN` | Sí | - | `TRUE` | Bandera de autorización de acceso (1: Activo, 0: Bloqueado) |
| `permisos` | `VARCHAR(255)` | Sí | - | `["puerta","luces","bomba"]` | Array JSON con dispositivos autorizados |
| `creado_en` | `TIMESTAMP` | Sí | - | `CURRENT_TIMESTAMP` | Fecha y hora de creación del registro |

### 2.3. Tabla: `accesos_log`
Historial de eventos de autenticación biométrica para auditoría y trazabilidad.

| Campo | Tipo | Nulo | Clave | Default | Descripción |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | No | PK (AI) | Auto | Identificador único del log |
| `face_id` | `VARCHAR(50)` | Sí | - | NULL | ID del usuario o indicador de sujeto desconocido |
| `estado` | `VARCHAR(20)` | Sí | - | NULL | Resultado del acceso: `EXITO` o `DENEGADO` |
| `fecha_dispositivo`| `TIMESTAMP` | Sí | - | `CURRENT_TIMESTAMP` | Marca temporal del evento |
| `creado_en` | `TIMESTAMP` | Sí | - | `CURRENT_TIMESTAMP` | Marca temporal de inserción |

### 2.4. Tabla: `comandos`
Cola FIFO para la comunicación asíncrona hacia el microcontrolador ESP8266.

| Campo | Tipo | Nulo | Clave | Default | Descripción |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | No | PK (AI) | Auto | Identificador único de la orden |
| `comando` | `VARCHAR(50)` | No | - | - | Nombre del comando a ejecutar (`ABRIR_PUERTA`, etc.) |
| `procesado` | `BOOLEAN` | Sí | - | `FALSE` | `FALSE`: Pendiente de ejecución, `TRUE`: Ejecutado |
| `creado_en` | `TIMESTAMP` | Sí | - | `CURRENT_TIMESTAMP` | Fecha y hora en que se originó el comando |

---

## 3. Especificación de Hardware e Interfaces de Control (ESP8266)

### 3.1. Asignación de Pines (Pinout) en NodeMCU ESP8266

```
                  ┌──────────────────────┐
                  │    ESP8266 NodeMCU   │
                  │                      │
       (GPIO 2)   │ D4  ──> Relé 1       │ (Cerradura Eléctrica / Puerta)
       (GPIO 14)  │ D5  ──> Relé 2       │ (Iluminación Principal)
       (GPIO 15)  │ D8  ──> Relé 3       │ (Bomba de Agua)
                  │ VIN ──> 5V VCC Relé  │
                  │ GND ──> GND Relé     │
                  └──────────────────────┘
```

### 3.2. Lógica de Disparo de Relés y Temporización
- **Nivel Lógico:** El firmware actual asume módulos de relé con disparo por nivel alto (`HIGH`). Si se utilizan módulos con lógica invertida (disparo en `LOW`), se deben intercambiar las instrucciones `HIGH` y `LOW` en la función `ejecutarComando()`.
- **Manejo de Tiempos No Bloqueante:**
  - La apertura de puerta define `TIEMPO_PUERTA_MS = 3000` (3 segundos).
  - El cierre se efectúa comparando `millis() - msPuertaAbierta >= TIEMPO_PUERTA_MS` en la función `loop()`, asegurando que el microcontrolador no se congele con un `delay()` y siga respondiendo a la red.
- **Configuración de Red WiFi Dinámica:**
  - Si el dispositivo pierde la conexión o no encuentra la red, `WiFiManager` levanta automáticamente un punto de acceso denominado `ESP_DOMOTICA` con IP `192.168.4.1` durante 180 segundos.
