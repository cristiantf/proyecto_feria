# 🛠️ Documentación Técnica y Manual de Hardware

**Proyecto:** Control de Acceso Biométrico y Domótica IoT  
**Módulos:** Backend REST, Frontend Web AI, Base de Datos MySQL, Firmware ESP8266  

---

## 1. Especificación de la API REST (Backend Node.js)

El backend expone una API REST construida sobre Express.js en el puerto predeterminado `3000`.

### 1.1. Resumen de Endpoints

| Método | Ruta | Propósito | Autenticación |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/usuarios` | Listar usuarios registrados para la tabla administrativa | Pública |
| `GET` | `/api/rostros` | Descargar vectores biométricos para el motor de matching | Pública |
| `POST` | `/api/usuarios` | Registrar un nuevo usuario y su vector de 128 flotantes | Pública |
| `POST` | `/api/recibir_log` | Registrar eventos de auditoría de acceso | Pública |
| `GET` | `/api/logs` | Consultar los últimos 50 registros de acceso | Pública |
| `POST` | `/api/comando` | Encolar una instrucción domótica para el ESP8266 | Pública |
| `GET` | `/api/check_comando` | Desencolar el comando pendiente más antiguo (FIFO) para el ESP8266 | Pública |

---

### 1.2. Detalle de Endpoints y Esquemas JSON

#### `GET /api/usuarios`
- **Descripción:** Retorna los datos básicos de todos los usuarios registrados (excluyendo el vector biométrico para optimizar ancho de banda).
- **Respuesta Exitosa (200 OK):**
```json
[
  {
    "id": 1,
    "nombre": "Administrador General",
    "tiene_acceso": 1,
    "creado_en": "2026-08-27T18:00:00.000Z"
  }
]
```

---

#### `GET /api/rostros`
- **Descripción:** Obtiene los vectores descriptores faciales únicamente de aquellos usuarios con `tiene_acceso = TRUE`.
- **Respuesta Exitosa (200 OK):**
```json
[
  {
    "id": 1,
    "nombre": "Administrador General",
    "face_descriptor": "[-0.145892, 0.098231, ..., 0.034512]"
  }
]
```

---

#### `POST /api/usuarios`
- **Descripción:** Registra un nuevo usuario en la base de datos junto con su descriptor biométrico.
- **Headers Requeridos:** `Content-Type: application/json`
- **Cuerpo de la Petición (Request Body):**
```json
{
  "nombre": "Juan Pérez",
  "face_descriptor": [-0.145892, 0.098231, 0.124589, "...128 flotantes..."],
  "tiene_acceso": true
}
```
- **Respuesta Exitosa (200 OK):**
```json
{
  "id": 2,
  "nombre": "Juan Pérez",
  "tiene_acceso": true
}
```
- **Respuesta de Error (400 Bad Request):**
```json
{
  "error": "Nombre y descriptor facial son obligatorios."
}
```
- **Respuesta de Error (500 Internal Server Error):**
```json
{
  "error": "Error interno del motor de base de datos..."
}
```

---

#### `POST /api/recibir_log`
- **Descripción:** Registra un intento de acceso en la tabla de auditoría.
- **Request Body:**
```json
{
  "id": 2,
  "estado": "EXITO"
}
```
- **Respuesta (200 OK):** Texto plano `OK`

---

#### `POST /api/comando`
- **Descripción:** Registra un comando en la tabla `comandos` para ser consumido por el microcontrolador.
- **Comandos Soportados:** `ABRIR_PUERTA`, `LUCES_ON`, `LUCES_OFF`, `BOMBA_ON`, `BOMBA_OFF`.
- **Request Body:**
```json
{
  "accion": "ABRIR_PUERTA"
}
```
- **Respuesta (200 OK):**
```json
{
  "success": true,
  "message": "Comando enviado: ABRIR_PUERTA"
}
```

---

#### `GET /api/check_comando`
- **Descripción:** Consulta consumida por el ESP8266 cada 2 segundos. Lee el primer comando no procesado, lo marca como `procesado = TRUE` y retorna la instrucción en texto plano.
- **Respuesta:**
  - Si hay comando pendiente: `ABRIR_PUERTA` (o la acción correspondiente).
  - Si no hay comandos pendientes: `NONE`.

---

## 2. Diccionario de Datos (Base de Datos MySQL)

### 2.1. Tabla: `usuarios`
Almacena las credenciales biométricas y permisos de cada persona registrada.

| Campo | Tipo | Nulo | Clave | Default | Descripción |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | No | PK (AI) | Auto | Identificador único del usuario |
| `nombre` | `VARCHAR(100)` | No | - | - | Nombre completo o alias del usuario |
| `face_descriptor` | `LONGTEXT` | No | - | - | Vector de 128 dimensiones serializado en formato JSON |
| `tiene_acceso` | `BOOLEAN` | Sí | - | `TRUE` | Bandera de autorización de acceso (1: Activo, 0: Bloqueado) |
| `creado_en` | `TIMESTAMP` | Sí | - | `CURRENT_TIMESTAMP` | Fecha y hora de creación del registro |

### 2.2. Tabla: `accesos_log`
Historial de eventos de autenticación biométrica para auditoría y trazabilidad.

| Campo | Tipo | Nulo | Clave | Default | Descripción |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | No | PK (AI) | Auto | Identificador único del log |
| `face_id` | `VARCHAR(50)` | Sí | - | NULL | ID del usuario o indicador de sujeto desconocido |
| `estado` | `VARCHAR(20)` | Sí | - | NULL | Resultado del acceso: `EXITO` o `DENEGADO` |
| `fecha_dispositivo`| `TIMESTAMP` | Sí | - | `CURRENT_TIMESTAMP` | Marca temporal del evento |
| `creado_en` | `TIMESTAMP` | Sí | - | `CURRENT_TIMESTAMP` | Marca temporal de inserción |

### 2.3. Tabla: `comandos`
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

---

## 4. Análisis del Fallo de Actualización de Usuarios y Solución Técnica

### 4.1. Análisis Causa-Raíz (Root Cause Analysis)

```
[Problema: Los usuarios registrados en el panel no aparecían en la tabla]
  │
  ├── 1. Discrepancia en Base de Datos (SQL DDL vs Node.js Query)
  │      - database.sql creaba: `face_id VARCHAR(50) NOT NULL`
  │      - server.js ejecutaba: `INSERT INTO usuarios (nombre, face_descriptor, tiene_acceso)`
  │      - Consecuencia: MySQL rechazaba la inserción con error de columna inexistente.
  │
  ├── 2. Silenciamiento de Excepciones en el Frontend (app.js)
  │      - fetch() no rechaza la promesa ante códigos HTTP 500.
  │      - El frontend asumía que la petición fue exitosa, emitía el alert() de éxito
  │        y llamaba a cargarUsuarios().
  │      - Al no haber ningún usuario nuevo en MySQL, la vista no mostraba cambios.
  │
  └── 3. Tipo de Datos para Descriptores Faciales
         - Un descriptor facial de face-api.js consta de 128 valores en coma flotante.
         - Serializado en JSON requiere >1500 caracteres, requiriendo tipo `LONGTEXT`.
```

### 4.2. Correcciones Implementadas

1. **Corrección del Esquema SQL (`database.sql`):**
   ```sql
   CREATE TABLE IF NOT EXISTS usuarios (
       id INT AUTO_INCREMENT PRIMARY KEY,
       nombre VARCHAR(100) NOT NULL,
       face_descriptor LONGTEXT NOT NULL,
       tiene_acceso BOOLEAN DEFAULT TRUE,
       creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```
2. **Validación de Respuestas HTTP en el Frontend (`frontend/app.js`):**
   ```javascript
   const res = await fetch(`${API_URL}/usuarios`, { ... });
   if (!res.ok) {
       const errorData = await res.json().catch(() => ({ error: 'Error ' + res.status }));
       throw new Error(errorData.error || 'Error al registrar el usuario');
   }
   await cargarUsuarios(); // Se invoca tras inserción garantizada
   ```
3. **Servicio Unificado de Archivos Estáticos:**
   - Se configuró Express en `server.js` para servir directamente la carpeta `frontend`, permitiendo ejecutar todo el sistema desde `http://localhost:3000`.

---

## 5. Protocolo de Pruebas y Validación

1. **Prueba de Inserción de Usuario:**
   - Abrir `http://localhost:3000/`.
   - Clic en *"Registrar Rostro"*.
   - Posicionarse frente a la cámara hasta ver el indicador en verde *"¡Rostro detectado y capturado!"*.
   - Introducir un nombre (ej. "Carlos Gómez") y presionar *"Guardar Rostro y Usuario"*.
   - **Resultado Esperado:** La tabla de usuarios se actualiza de inmediato con el nuevo ID, nombre y estado "Habilitado".
2. **Prueba de Autenticación Facial:**
   - Navegar a `http://localhost:3000/login.html`.
   - Permitir acceso a la cámara.
   - **Resultado Esperado:** El sistema identifica a "Carlos Gómez", registra el evento en `accesos_log` y muestra el panel domótico interactivo.
3. **Prueba de Comandos Domóticos:**
   - En el panel de control, presionar *"Abrir Puerta"*.
   - Comprobar en la consola del backend y en el Monitor Serie del ESP8266 (115200 baudios) la recepción del comando `ABRIR_PUERTA` y el cambio de estado del Relé 1 durante 3 segundos.
