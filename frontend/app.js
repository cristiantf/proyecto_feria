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

// ==========================================
// SISTEMA DE MENSAJES EMERGENTES (TOASTS)
// ==========================================
const toastContainer = document.getElementById('toast-container');

function showToast(title, message, type = 'success', duration = 4000) {
    const icons = {
        success: 'fa-circle-check',
        error: 'fa-circle-exclamation',
        warning: 'fa-triangle-exclamation',
        info: 'fa-circle-info'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fa-solid ${icons[type] || 'fa-bell'} toast-icon"></i>
        <div class="toast-body">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close">&times;</button>
        <div class="toast-progress" style="animation-duration: ${duration}ms;"></div>
    `;

    toastContainer.appendChild(toast);

    const closeToast = () => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    };

    toast.querySelector('.toast-close').addEventListener('click', closeToast);
    setTimeout(closeToast, duration);
}

// ==========================================
// DIÁLOGO DE CONFIRMACIÓN MODERNO (PROMISE)
// ==========================================
const modalConfirmacion = document.getElementById('modal-confirmacion');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');
const confirmIconContainer = document.getElementById('confirm-icon-container');
const btnConfirmOk = document.getElementById('btn-confirm-ok');
const btnConfirmCancel = document.getElementById('btn-confirm-cancel');

function showConfirm(title, message, confirmText = 'Confirmar', isDanger = true) {
    return new Promise((resolve) => {
        confirmTitle.innerText = title;
        confirmMessage.innerText = message;
        btnConfirmOk.innerText = confirmText;

        if (isDanger) {
            btnConfirmOk.className = 'btn btn-danger';
            confirmIconContainer.className = 'confirm-icon-wrapper confirm-icon-danger';
            confirmIconContainer.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        } else {
            btnConfirmOk.className = 'btn btn-primary';
            confirmIconContainer.className = 'confirm-icon-wrapper';
            confirmIconContainer.style.background = 'rgba(59, 130, 246, 0.15)';
            confirmIconContainer.style.color = 'var(--primary-color)';
            confirmIconContainer.innerHTML = '<i class="fa-solid fa-question"></i>';
        }

        modalConfirmacion.classList.add('show');

        const handleOk = () => {
            cleanup();
            modalConfirmacion.classList.remove('show');
            resolve(true);
        };

        const handleCancel = () => {
            cleanup();
            modalConfirmacion.classList.remove('show');
            resolve(false);
        };

        function cleanup() {
            btnConfirmOk.removeEventListener('click', handleOk);
            btnConfirmCancel.removeEventListener('click', handleCancel);
        }

        btnConfirmOk.addEventListener('click', handleOk);
        btnConfirmCancel.addEventListener('click', handleCancel);
    });
}

// ==========================================
// CIERRE DE SESIÓN
// ==========================================
async function cerrarSesionAdmin() {
    const confirm = await showConfirm('Cerrar Sesión', '¿Estás seguro de que deseas salir del panel de administración?', 'Cerrar Sesión', false);
    if (confirm) {
        localStorage.removeItem('admin_session');
        localStorage.removeItem('admin_token');
        showToast('Sesión Finalizada', 'Has cerrado sesión correctamente.', 'info', 1500);
        setTimeout(() => {
            window.location.href = 'admin_login.html';
        }, 800);
    }
}

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
const modalPassword = document.getElementById('modal-password');
const btnNuevoUsuario = document.getElementById('btn-nuevo-usuario');
const btnOpenPassword = document.getElementById('btn-open-password');
const btnSidebarPassword = document.getElementById('btn-sidebar-password');
const closeBtns = document.querySelectorAll('.close-modal');

// Formularios
const formUsuario = document.getElementById('form-usuario');
const formEditarUsuario = document.getElementById('form-editar-usuario');
const formCambiarPassword = document.getElementById('form-cambiar-password');
const btnRefreshLogs = document.getElementById('btn-refresh-logs');

// IA y Video para Registro
const video = document.getElementById('video-registro');
const canvas = document.getElementById('canvas-registro');
const estadoIA = document.getElementById('estado-ia');
const btnGuardar = document.getElementById('btn-guardar');
let capturedDescriptor = null;

// IA y Video para Recaptura en Edición
const btnToggleRecaptura = document.getElementById('btn-toggle-recaptura');
const panelRecaptura = document.getElementById('panel-recaptura');
const videoRecaptura = document.getElementById('video-recaptura');
const canvasRecaptura = document.getElementById('canvas-recaptura');
const estadoIARecaptura = document.getElementById('estado-ia-recaptura');
const editFaceStatusText = document.getElementById('edit-face-status-text');
let editCapturedDescriptor = null;
let recapturaStream = null;
let recapturaInterval = null;

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
                    <td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 30px;">
                        <i class="fa-solid fa-users-slash" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                        No hay usuarios registrados aún. Presiona <strong>"Registrar Usuario"</strong> para crear uno.
                    </td>
                </tr>
            `;
            return;
        }

        listaUsuarios.forEach(user => {
            const fecha = user.creado_en ? new Date(user.creado_en).toLocaleString() : 'Reciente';
            
            // Badges de dispositivos
            const perms = Array.isArray(user.permisos) ? user.permisos : ['puerta', 'luces', 'bomba'];
            let badgesHtml = '<div class="devices-badges-wrapper">';
            if (perms.length === 0) {
                badgesHtml += '<span class="badge-device badge-none"><i class="fa-solid fa-ban"></i> Sin permisos</span>';
            } else {
                if (perms.includes('puerta')) badgesHtml += '<span class="badge-device badge-door"><i class="fa-solid fa-door-open"></i> Puerta</span>';
                if (perms.includes('luces')) badgesHtml += '<span class="badge-device badge-lights"><i class="fa-solid fa-lightbulb"></i> Luces</span>';
                if (perms.includes('bomba')) badgesHtml += '<span class="badge-device badge-pump"><i class="fa-solid fa-water"></i> Bomba</span>';
            }
            badgesHtml += '</div>';

            const userPass = user.password || '1234';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>#${user.id}</strong></td>
                <td><i class="fa-solid fa-user" style="color: var(--primary-color); margin-right: 8px;"></i> <strong>${user.nombre}</strong></td>
                <td>
                    <span class="password-badge" title="Contraseña / PIN de acceso">
                        <i class="fa-solid fa-key" style="color: #94a3b8; font-size: 0.75rem;"></i>
                        <span>${userPass}</span>
                    </span>
                </td>
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
                        <button class="btn btn-sm btn-action-edit" onclick="abrirModalEditar(${user.id})" title="Editar usuario, contraseña y Face ID">
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
        showToast('Error', 'No se pudieron cargar los usuarios del servidor.', 'error');
    }
}

function escapeHtml(text) {
    return text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ==========================================
// EDITAR USUARIO, CONTRASEÑA Y ACTUALIZAR FACE ID
// ==========================================
function abrirModalEditar(id) {
    const user = listaUsuarios.find(u => u.id === id);
    if (!user) return;

    document.getElementById('edit-user-id').value = user.id;
    document.getElementById('edit-nombre').value = user.nombre;
    document.getElementById('edit-password').value = user.password || '';
    document.getElementById('edit-tiene_acceso').checked = user.tiene_acceso === 1 || user.tiene_acceso === true;

    const perms = Array.isArray(user.permisos) ? user.permisos : ['puerta', 'luces', 'bomba'];
    document.getElementById('edit-perm-puerta').checked = perms.includes('puerta');
    document.getElementById('edit-perm-luces').checked = perms.includes('luces');
    document.getElementById('edit-perm-bomba').checked = perms.includes('bomba');

    // Resetear panel de recaptura facial
    editCapturedDescriptor = null;
    panelRecaptura.style.display = 'none';
    editFaceStatusText.innerText = 'Rostro biométrico original activo';
    editFaceStatusText.style.color = 'var(--text-secondary)';
    btnToggleRecaptura.innerHTML = '<i class="fa-solid fa-camera-rotate"></i> Actualizar Rostro';
    detenerCamaraRecaptura();

    modalEditarUsuario.classList.add('show');
}

// Botón para alternar la cámara de recaptura facial
btnToggleRecaptura.addEventListener('click', async () => {
    if (panelRecaptura.style.display === 'none') {
        panelRecaptura.style.display = 'block';
        btnToggleRecaptura.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Cancelar Cámara';
        await iniciarCamaraRecaptura();
    } else {
        panelRecaptura.style.display = 'none';
        btnToggleRecaptura.innerHTML = '<i class="fa-solid fa-camera-rotate"></i> Actualizar Rostro';
        detenerCamaraRecaptura();
    }
});

async function iniciarCamaraRecaptura() {
    estadoIARecaptura.innerText = "Iniciando cámara para Face ID...";
    try {
        recapturaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRecaptura.srcObject = recapturaStream;
        
        videoRecaptura.onloadedmetadata = () => {
            videoRecaptura.play();
            const displaySize = { width: videoRecaptura.width, height: videoRecaptura.height };
            faceapi.matchDimensions(canvasRecaptura, displaySize);
            
            recapturaInterval = setInterval(async () => {
                if (!modalEditarUsuario.classList.contains('show') || panelRecaptura.style.display === 'none') return;

                const detections = await faceapi.detectSingleFace(videoRecaptura).withFaceLandmarks().withFaceDescriptor();
                const context = canvasRecaptura.getContext('2d');
                context.clearRect(0, 0, canvasRecaptura.width, canvasRecaptura.height);

                if (detections) {
                    const resized = faceapi.resizeResults(detections, displaySize);
                    faceapi.draw.drawDetections(canvasRecaptura, resized);
                    faceapi.draw.drawFaceLandmarks(canvasRecaptura, resized);

                    editCapturedDescriptor = Array.from(detections.descriptor);
                    estadoIARecaptura.innerText = "¡Nuevo rostro detectado y listo!";
                    estadoIARecaptura.style.color = "var(--success-color)";
                    editFaceStatusText.innerText = "✓ Nuevo rostro capturado (se guardará al actualizar)";
                    editFaceStatusText.style.color = "var(--success-color)";
                } else {
                    estadoIARecaptura.innerText = "Buscando rostro... Mira fijamente a la cámara.";
                    estadoIARecaptura.style.color = "var(--warning-color)";
                }
            }, 500);
        };
    } catch (err) {
        estadoIARecaptura.innerText = "No se pudo acceder a la cámara.";
        showToast('Cámara', 'No se pudo iniciar la cámara para Face ID.', 'warning');
    }
}

function detenerCamaraRecaptura() {
    if (recapturaInterval) clearInterval(recapturaInterval);
    if (recapturaStream) {
        recapturaStream.getTracks().forEach(track => track.stop());
        recapturaStream = null;
    }
    if (canvasRecaptura) {
        const context = canvasRecaptura.getContext('2d');
        context.clearRect(0, 0, canvasRecaptura.width, canvasRecaptura.height);
    }
}

formEditarUsuario.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('edit-user-id').value;
    const nombre = document.getElementById('edit-nombre').value.trim();
    const password = document.getElementById('edit-password').value.trim();
    const tiene_acceso = document.getElementById('edit-tiene_acceso').checked;

    const permisos = [];
    if (document.getElementById('edit-perm-puerta').checked) permisos.push('puerta');
    if (document.getElementById('edit-perm-luces').checked) permisos.push('luces');
    if (document.getElementById('edit-perm-bomba').checked) permisos.push('bomba');

    const payload = { nombre, password, tiene_acceso, permisos };
    if (editCapturedDescriptor) {
        payload.face_descriptor = editCapturedDescriptor;
    }

    const btnSubmit = document.getElementById('btn-actualizar-usuario');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

    try {
        const res = await fetch(`${API_URL}/usuarios/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({ error: 'Error ' + res.status }));
            throw new Error(errData.error || 'Error al actualizar');
        }

        detenerCamaraRecaptura();
        modalEditarUsuario.classList.remove('show');
        await cargarUsuarios();
        
        const faceMsg = editCapturedDescriptor ? ' y nuevo Face ID actualizado' : '';
        showToast('Usuario Actualizado', `¡"${nombre}" actualizado con éxito${faceMsg}!`, 'success');
    } catch (error) {
        console.error('Error al actualizar usuario:', error);
        showToast('Error', error.message, 'error');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fa-solid fa-check"></i> Guardar Cambios';
    }
});

// ==========================================
// ELIMINAR USUARIO
// ==========================================
async function eliminarUsuario(id, nombre) {
    const confirmed = await showConfirm(
        'Eliminar Usuario',
        `¿Estás seguro de que deseas eliminar permanentemente a "${nombre}" (ID: #${id})? Se borrarán sus datos biométricos, contraseña y permisos.`,
        'Eliminar Permanentemente',
        true
    );

    if (!confirmed) return;

    try {
        const res = await fetch(`${API_URL}/usuarios/${id}`, {
            method: 'DELETE'
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({ error: 'Error ' + res.status }));
            throw new Error(errData.error || 'Error al eliminar');
        }

        await cargarUsuarios();
        showToast('Usuario Eliminado', `"${nombre}" ha sido eliminado del sistema.`, 'success');
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        showToast('Error', error.message, 'error');
    }
}

// ==========================================
// CAMBIAR CONTRASEÑA DEL ADMINISTRADOR
// ==========================================
const abrirModalPassword = () => {
    formCambiarPassword.reset();
    modalPassword.classList.add('show');
};

if (btnOpenPassword) btnOpenPassword.addEventListener('click', abrirModalPassword);
if (btnSidebarPassword) btnSidebarPassword.addEventListener('click', abrirModalPassword);

formCambiarPassword.addEventListener('submit', async (e) => {
    e.preventDefault();

    const passActual = document.getElementById('pass-actual').value.trim();
    const passNueva = document.getElementById('pass-nueva').value.trim();
    const passConfirmar = document.getElementById('pass-confirmar').value.trim();

    if (passNueva !== passConfirmar) {
        showToast('Error de Validación', 'Las nuevas contraseñas no coinciden.', 'warning');
        return;
    }

    const btnSubmit = document.getElementById('btn-submit-password');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Actualizando...';

    try {
        const res = await fetch(`${API_URL}/admin/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adminId: currentAdmin ? currentAdmin.id : 1,
                passwordActual: passActual,
                nuevaPassword: passNueva
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al cambiar contraseña');

        modalPassword.classList.remove('show');
        formCambiarPassword.reset();
        showToast('Seguridad Actualizada', 'Tu contraseña de administrador ha sido cambiada con éxito.', 'success');
    } catch (error) {
        showToast('Error de Autenticación', error.message, 'error');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fa-solid fa-lock"></i> Actualizar';
    }
});

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
            const badgeClass = log.estado.includes('EXITO') ? 'badge-success' : 'badge-danger';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${date}</td>
                <td><strong>${log.nombre ? log.nombre : 'Sujeto No Reconocido'}</strong> (ID: ${log.face_id || 'N/A'})</td>
                <td>
                    <span class="badge ${badgeClass}">
                        <i class="fa-solid ${log.estado.includes('EXITO') ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
                        ${log.estado}
                    </span>
                </td>
            `;
            tablaLogs.appendChild(tr);
        });
    } catch (error) {
        console.error('Error al cargar logs:', error);
        showToast('Error', 'No se pudieron sincronizar los logs de acceso.', 'error');
    }
}

// ==========================================
// LÓGICA DE RECONOCIMIENTO FACIAL (REGISTRO)
// ==========================================
async function cargarModelos() {
    estadoIA.innerText = "Cargando modelos de IA...";
    const uriList = [
        './models',
        '/models',
        'models',
        'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights',
        'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights'
    ];

    for (const uri of uriList) {
        try {
            await faceapi.nets.ssdMobilenetv1.loadFromUri(uri);
            await faceapi.nets.faceLandmark68Net.loadFromUri(uri);
            await faceapi.nets.faceRecognitionNet.loadFromUri(uri);
            estadoIA.innerText = "Modelos cargados exitosamente. Iniciando cámara...";
            iniciarCamara();
            return;
        } catch (err) {
            console.warn(`No se pudieron cargar modelos desde ${uri}:`, err.message);
        }
    }
    estadoIA.innerText = "Error cargando modelos. Verifica que el servidor Express esté corriendo.";
    showToast('Modelos IA', 'No se pudieron cargar los modelos de visión artificial.', 'warning');
}

function iniciarCamara() {
    navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
        video.srcObject = stream;
    })
    .catch(err => {
        estadoIA.innerText = "Error al acceder a la cámara o permisos denegados.";
        showToast('Cámara', 'Permisos de cámara denegados o cámara no encontrada.', 'warning');
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

// Guardar Nuevo Usuario con Rostro, Contraseña y Permisos
formUsuario.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!capturedDescriptor) {
        showToast('Atención', 'Aún no se ha capturado un rostro válido.', 'warning');
        return;
    }

    const nombreInput = document.getElementById('nombre');
    const nombre = nombreInput.value.trim();
    const passwordInput = document.getElementById('nuevo-password');
    const password = passwordInput ? passwordInput.value.trim() : '1234';
    const tiene_acceso = document.getElementById('tiene_acceso').checked;

    const permisos = [];
    if (document.getElementById('perm-puerta').checked) permisos.push('puerta');
    if (document.getElementById('perm-luces').checked) permisos.push('luces');
    if (document.getElementById('perm-bomba').checked) permisos.push('bomba');

    if (!nombre) {
        showToast('Campo Requerido', 'Por favor ingresa el nombre del usuario.', 'warning');
        return;
    }

    btnGuardar.disabled = true;
    btnGuardar.innerText = "Guardando en Base de Datos...";

    try {
        const res = await fetch(`${API_URL}/usuarios`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, password, face_descriptor: capturedDescriptor, tiene_acceso, permisos })
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: 'Error del servidor (' + res.status + ')' }));
            throw new Error(errorData.error || 'Error al registrar el usuario en el servidor');
        }

        modalUsuario.classList.remove('show');
        formUsuario.reset();
        capturedDescriptor = null;
        btnGuardar.innerText = "Guardar Usuario y Rostro";
        btnGuardar.disabled = false;

        await cargarUsuarios();
        showToast('Usuario Creado', `¡"${nombre}" registrado con contraseña y rostro con éxito!`, 'success');
    } catch (error) {
        console.error('Error al crear usuario:', error);
        showToast('Error al Guardar', error.message, 'error');
        btnGuardar.disabled = false;
        btnGuardar.innerText = "Guardar Usuario y Rostro";
    }
});

// ==========================================
// MODALES Y EVENTOS GENERALES
// ==========================================
btnNuevoUsuario.addEventListener('click', () => {
    modalUsuario.classList.add('show');
    if(!video.srcObject) cargarModelos();
});

closeBtns.forEach(btn => btn.addEventListener('click', () => {
    modalUsuario.classList.remove('show');
    modalEditarUsuario.classList.remove('show');
    modalPassword.classList.remove('show');
    detenerCamaraRecaptura();
}));

btnRefreshLogs.addEventListener('click', () => {
    cargarLogs();
    showToast('Logs Actualizados', 'Historial de accesos sincronizado.', 'info', 2000);
});

// Inicializar tabla
cargarUsuarios();
