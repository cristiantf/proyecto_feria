const API_URL = 'http://localhost:3000/api';

// ==========================================
// CONTROL DE ACCESO / AUTENTICACIÓN ADMIN
// ==========================================
const adminSessionData = localStorage.getItem('admin_session');
if (!adminSessionData) {
    window.location.href = 'admin_login.html';
}

let currentAdmin = null;
try {
    currentAdmin = JSON.parse(adminSessionData);
    const adminDisplay = document.getElementById('admin-nombre-display');
    if (adminDisplay && currentAdmin) {
        adminDisplay.innerText = currentAdmin.nombre || currentAdmin.usuario || 'Administrador';
    }
} catch (e) {
    console.error('Error al leer datos de sesión:', e);
}

function cerrarSesionAdmin() {
    if (confirm('¿Deseas cerrar la sesión administrativa?')) {
        localStorage.removeItem('admin_session');
        localStorage.removeItem('admin_token');
        window.location.href = 'admin_login.html';
    }
}

// Botones de Logout
const btnLogout = document.getElementById('btn-logout');
if (btnLogout) btnLogout.addEventListener('click', cerrarSesionAdmin);

const btnSidebarLogout = document.getElementById('btn-sidebar-logout');
if (btnSidebarLogout) btnSidebarLogout.addEventListener('click', cerrarSesionAdmin);

// ==========================================
// ELEMENTOS DOM
// ==========================================
const navItems = document.querySelectorAll('.nav-menu li');
const sections = document.querySelectorAll('.content-section');
const tablaUsuarios = document.getElementById('tabla-usuarios');
const tablaLogs = document.getElementById('tabla-logs');

// Modales
const modalUsuario = document.getElementById('modal-usuario');
const modalEditarUsuario = document.getElementById('modal-editar-usuario');
const btnNuevoUsuario = document.getElementById('btn-nuevo-usuario');
const closeBtns = document.querySelectorAll('.close-modal');

// Formularios
const formUsuario = document.getElementById('form-usuario');
const formEditarUsuario = document.getElementById('form-editar-usuario');
const btnRefreshLogs = document.getElementById('btn-refresh-logs');

// IA y Video
const video = document.getElementById('video-registro');
const canvas = document.getElementById('canvas-registro');
const estadoIA = document.getElementById('estado-ia');
const btnGuardar = document.getElementById('btn-guardar');
let capturedDescriptor = null;

// Cache local de usuarios
let listaUsuarios = [];

// ==========================================
// NAVEGACIÓN ENTRE SECCIONES
// ==========================================
navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        sections.forEach(sec => sec.classList.remove('active'));
        document.getElementById(item.dataset.target).classList.add('active');
        
        if(item.dataset.target === 'usuarios-section') cargarUsuarios();
        if(item.dataset.target === 'logs-section') cargarLogs();
    });
});

// ==========================================
// CARGAR Y RENDERIZAR USUARIOS (CRUD)
// ==========================================
async function cargarUsuarios() {
    try {
        const res = await fetch(`${API_URL}/usuarios`);
        listaUsuarios = await res.json();
        tablaUsuarios.innerHTML = '';

        if (listaUsuarios.length === 0) {
            tablaUsuarios.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 30px;">
                        <i class="fa-solid fa-users-slash" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                        No hay usuarios registrados aún. Presiona <strong>"Registrar Rostro"</strong> para crear uno.
                    </td>
                </tr>
            `;
            return;
        }

        listaUsuarios.forEach(user => {
            const fecha = user.creado_en ? new Date(user.creado_en).toLocaleString() : 'Reciente';
            
            // Renderizar badges de dispositivos permitidos
            const perms = Array.isArray(user.permisos) ? user.permisos : ['puerta', 'luces', 'bomba'];
            let badgesHtml = '<div class="devices-badges-wrapper">';
            if (perms.length === 0) {
                badgesHtml += '<span class="badge-device badge-none"><i class="fa-solid fa-ban"></i> Sin permisos</span>';
            } else {
                if (perms.includes('puerta')) {
                    badgesHtml += '<span class="badge-device badge-door"><i class="fa-solid fa-door-open"></i> Puerta</span>';
                }
                if (perms.includes('luces')) {
                    badgesHtml += '<span class="badge-device badge-lights"><i class="fa-solid fa-lightbulb"></i> Luces</span>';
                }
                if (perms.includes('bomba')) {
                    badgesHtml += '<span class="badge-device badge-pump"><i class="fa-solid fa-water"></i> Bomba</span>';
                }
            }
            badgesHtml += '</div>';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>#${user.id}</strong></td>
                <td><i class="fa-solid fa-user" style="color: var(--primary-color); margin-right: 8px;"></i> <strong>${user.nombre}</strong></td>
                <td>
                    <span class="badge ${user.tiene_acceso ? 'badge-success' : 'badge-danger'}">
                        <i class="fa-solid ${user.tiene_acceso ? 'fa-check' : 'fa-ban'}"></i>
                        ${user.tiene_acceso ? 'Habilitado' : 'Denegado'}
                    </span>
                </td>
                <td>${badgesHtml}</td>
                <td style="color: var(--text-secondary); font-size: 0.85rem;">${fecha}</td>
                <td style="text-align: center;">
                    <div class="action-buttons" style="justify-content: center;">
                        <button class="btn btn-sm btn-action-edit" onclick="abrirModalEditar(${user.id})" title="Editar usuario y permisos">
                            <i class="fa-solid fa-pen-to-square"></i> Editar
                        </button>
                        <button class="btn btn-sm btn-action-delete" onclick="eliminarUsuario(${user.id}, '${escapeHtml(user.nombre)}')" title="Eliminar usuario">
                            <i class="fa-solid fa-trash-can"></i> Eliminar
                        </button>
                    </div>
                </td>
            `;
            tablaUsuarios.appendChild(tr);
        });
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
    }
}

function escapeHtml(text) {
    return text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ==========================================
// EDITAR USUARIO
// ==========================================
function abrirModalEditar(id) {
    const user = listaUsuarios.find(u => u.id === id);
    if (!user) return;

    document.getElementById('edit-user-id').value = user.id;
    document.getElementById('edit-nombre').value = user.nombre;
    document.getElementById('edit-tiene_acceso').checked = user.tiene_acceso === 1 || user.tiene_acceso === true;

    const perms = Array.isArray(user.permisos) ? user.permisos : ['puerta', 'luces', 'bomba'];
    document.getElementById('edit-perm-puerta').checked = perms.includes('puerta');
    document.getElementById('edit-perm-luces').checked = perms.includes('luces');
    document.getElementById('edit-perm-bomba').checked = perms.includes('bomba');

    modalEditarUsuario.classList.add('show');
}

formEditarUsuario.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('edit-user-id').value;
    const nombre = document.getElementById('edit-nombre').value.trim();
    const tiene_acceso = document.getElementById('edit-tiene_acceso').checked;

    const permisos = [];
    if (document.getElementById('edit-perm-puerta').checked) permisos.push('puerta');
    if (document.getElementById('edit-perm-luces').checked) permisos.push('luces');
    if (document.getElementById('edit-perm-bomba').checked) permisos.push('bomba');

    const btnSubmit = document.getElementById('btn-actualizar-usuario');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

    try {
        const res = await fetch(`${API_URL}/usuarios/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, tiene_acceso, permisos })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({ error: 'Error ' + res.status }));
            throw new Error(errData.error || 'Error al actualizar');
        }

        modalEditarUsuario.classList.remove('show');
        await cargarUsuarios();
        alert(`¡Usuario "${nombre}" actualizado correctamente!`);
    } catch (error) {
        console.error('Error al actualizar usuario:', error);
        alert(`Error al guardar cambios: ${error.message}`);
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fa-solid fa-check"></i> Guardar Cambios';
    }
});

// ==========================================
// ELIMINAR USUARIO
// ==========================================
async function eliminarUsuario(id, nombre) {
    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente a "${nombre}" (ID: ${id})?\n\nEsta acción borrará sus datos biométricos y permisos de acceso.`)) {
        return;
    }

    try {
        const res = await fetch(`${API_URL}/usuarios/${id}`, {
            method: 'DELETE'
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({ error: 'Error ' + res.status }));
            throw new Error(errData.error || 'Error al eliminar');
        }

        await cargarUsuarios();
        alert(`Usuario "${nombre}" eliminado con éxito.`);
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        alert(`Error al eliminar usuario: ${error.message}`);
    }
}

// ==========================================
// CARGAR LOGS DE AUDITORÍA
// ==========================================
async function cargarLogs() {
    try {
        const res = await fetch(`${API_URL}/logs`);
        const logs = await res.json();
        tablaLogs.innerHTML = '';

        if (logs.length === 0) {
            tablaLogs.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; color: var(--text-secondary); padding: 30px;">
                        <i class="fa-solid fa-clipboard-list" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                        No hay eventos de acceso registrados aún.
                    </td>
                </tr>
            `;
            return;
        }

        logs.forEach(log => {
            const date = new Date(log.fecha_dispositivo).toLocaleString();
            const badgeClass = log.estado === 'EXITO' ? 'badge-success' : 'badge-danger';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${date}</td>
                <td><strong>${log.nombre ? log.nombre : 'Sujeto No Reconocido'}</strong> (ID: ${log.face_id || 'N/A'})</td>
                <td>
                    <span class="badge ${badgeClass}">
                        <i class="fa-solid ${log.estado === 'EXITO' ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
                        ${log.estado}
                    </span>
                </td>
            `;
            tablaLogs.appendChild(tr);
        });
    } catch (error) {
        console.error('Error al cargar logs:', error);
    }
}

// ==========================================
// LÓGICA DE RECONOCIMIENTO FACIAL (REGISTRO)
// ==========================================
async function cargarModelos() {
    estadoIA.innerText = "Cargando modelos de IA...";
    const uriList = [
        './models',
        'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights',
        'https://vladmandic.github.io/face-api/model/'
    ];

    for (const uri of uriList) {
        try {
            await faceapi.nets.ssdMobilenetv1.loadFromUri(uri);
            await faceapi.nets.faceLandmark68Net.loadFromUri(uri);
            await faceapi.nets.faceRecognitionNet.loadFromUri(uri);
            estadoIA.innerText = "Modelos cargados. Iniciando cámara...";
            iniciarCamara();
            return;
        } catch (err) {
            console.warn(`No se pudieron cargar modelos desde ${uri}:`, err.message);
        }
    }
    estadoIA.innerText = "Error cargando modelos. Asegúrate de iniciar un servidor web local.";
}

function iniciarCamara() {
    navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
        video.srcObject = stream;
    })
    .catch(err => {
        estadoIA.innerText = "Error al acceder a la cámara o permisos denegados.";
    });
}

video.addEventListener('play', () => {
    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);
    estadoIA.innerText = "Analizando rostro...";

    setInterval(async () => {
        if(!modalUsuario.classList.contains('show')) return;

        const detections = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor();
        
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        if (detections) {
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            faceapi.draw.drawDetections(canvas, resizedDetections);
            faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
            
            capturedDescriptor = Array.from(detections.descriptor);
            estadoIA.innerText = "¡Rostro detectado y capturado! Puedes guardar.";
            estadoIA.style.color = "var(--success-color)";
            btnGuardar.disabled = false;
        } else {
            estadoIA.innerText = "No se detecta rostro. Mira a la cámara.";
            estadoIA.style.color = "var(--danger-color)";
            btnGuardar.disabled = true;
            capturedDescriptor = null;
        }
    }, 500);
});

// Guardar Nuevo Usuario con Rostro y Permisos
formUsuario.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!capturedDescriptor) {
        alert("Aún no se ha capturado un rostro válido. Por favor mira a la cámara.");
        return;
    }

    const nombreInput = document.getElementById('nombre');
    const nombre = nombreInput.value.trim();
    const tiene_acceso = document.getElementById('tiene_acceso').checked;

    const permisos = [];
    if (document.getElementById('perm-puerta').checked) permisos.push('puerta');
    if (document.getElementById('perm-luces').checked) permisos.push('luces');
    if (document.getElementById('perm-bomba').checked) permisos.push('bomba');

    if (!nombre) {
        alert("Por favor ingresa el nombre del usuario.");
        return;
    }

    btnGuardar.disabled = true;
    btnGuardar.innerText = "Guardando en Base de Datos...";

    try {
        const res = await fetch(`${API_URL}/usuarios`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, face_descriptor: capturedDescriptor, tiene_acceso, permisos })
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: 'Error del servidor (' + res.status + ')' }));
            throw new Error(errorData.error || 'Error al registrar el usuario en el servidor');
        }

        modalUsuario.classList.remove('show');
        formUsuario.reset();
        capturedDescriptor = null;
        btnGuardar.innerText = "Guardar Rostro y Usuario";
        btnGuardar.disabled = false;

        await cargarUsuarios();
        alert(`¡Usuario "${nombre}" registrado con éxito!`);
    } catch (error) {
        console.error('Error al crear usuario:', error);
        alert(`Error al guardar usuario: ${error.message}`);
        btnGuardar.disabled = false;
        btnGuardar.innerText = "Guardar Rostro y Usuario";
    }
});

// ==========================================
// MODALES Y EVENTOS
// ==========================================
btnNuevoUsuario.addEventListener('click', () => {
    modalUsuario.classList.add('show');
    if(!video.srcObject) cargarModelos();
});

closeBtns.forEach(btn => btn.addEventListener('click', () => {
    modalUsuario.classList.remove('show');
    modalEditarUsuario.classList.remove('show');
}));

btnRefreshLogs.addEventListener('click', cargarLogs);

// Inicializar tabla
cargarUsuarios();
