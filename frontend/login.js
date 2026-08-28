const API_URL = 'http://localhost:3000/api';

const video = document.getElementById('video-login');
const canvas = document.getElementById('canvas-login');
const estadoLogin = document.getElementById('estado-login');
const pantallaReconocimiento = document.getElementById('pantalla-reconocimiento');
const pantallaControl = document.getElementById('pantalla-control');
const bienvenidaUsuario = document.getElementById('bienvenida-usuario');
const permisosListaDisplay = document.getElementById('permisos-lista-display');
const toastContainer = document.getElementById('toast-container');

// Elementos Login por PIN
const btnOpenPinLogin = document.getElementById('btn-open-pin-login');
const modalPinLogin = document.getElementById('modal-pin-login');
const btnClosePinModal = document.getElementById('btn-close-pin-modal');
const btnCancelPin = document.getElementById('btn-cancel-pin');
const formPinLogin = document.getElementById('form-pin-login');
const selectUserPin = document.getElementById('select-user-pin');
const inputUserPin = document.getElementById('input-user-pin');
const btnSubmitPin = document.getElementById('btn-submit-pin');

let labeledFaceDescriptors = [];
let userMetadataMap = {};
let listaUsuariosCache = [];
let faceMatcher = null;
let scanning = false;
let currentUser = null;

// ==========================================
// SISTEMA DE TOASTS
// ==========================================
function showToast(title, message, type = 'success', duration = 3500) {
    if (!toastContainer) return;

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
// INICIALIZACIÓN
// ==========================================
async function init() {
    estadoLogin.innerText = "Cargando modelos de Inteligencia Artificial...";
    const uriList = [
        './models',
        'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights',
        'https://vladmandic.github.io/face-api/model/'
    ];

    let modelsLoaded = false;
    for (const uri of uriList) {
        try {
            await faceapi.nets.ssdMobilenetv1.loadFromUri(uri);
            await faceapi.nets.faceLandmark68Net.loadFromUri(uri);
            await faceapi.nets.faceRecognitionNet.loadFromUri(uri);
            modelsLoaded = true;
            break;
        } catch (err) {
            console.warn(`No se pudieron cargar modelos desde ${uri}:`, err.message);
        }
    }

    if (!modelsLoaded) {
        estadoLogin.innerText = "Error cargando modelos. Puedes usar el ingreso por contraseña o botón demo.";
        showToast('Modelos IA', 'No se pudieron cargar los modelos de visión.', 'warning');
    }

    try {
        estadoLogin.innerText = "Descargando base de datos de usuarios...";
        await cargarRostrosDesdeBD();
        
        estadoLogin.innerText = "Iniciando cámara...";
        iniciarCamara();
    } catch(err) {
        console.error(err);
        estadoLogin.innerText = "Error al conectar con la base de datos o iniciar cámara.";
        showToast('Conexión', 'Error al sincronizar usuarios con el servidor.', 'error');
    }
}

async function cargarRostrosDesdeBD() {
    try {
        const res = await fetch(`${API_URL}/usuarios`);
        listaUsuariosCache = await res.json();
        
        // Llenar select del modal de PIN
        if (selectUserPin) {
            selectUserPin.innerHTML = '<option value="">-- Elige tu usuario --</option>';
            listaUsuariosCache.forEach(u => {
                const opt = document.createElement('option');
                opt.value = u.id;
                opt.innerText = `#${u.id} - ${u.nombre}`;
                selectUserPin.appendChild(opt);
            });
        }

        if(listaUsuariosCache.length === 0) {
            estadoLogin.innerText = "No hay usuarios registrados. Regístrate en el Panel Admin.";
            return;
        }

        userMetadataMap = {};

        const resRostros = await fetch(`${API_URL}/rostros`);
        const usuariosRostros = await resRostros.json();

        labeledFaceDescriptors = usuariosRostros.map(u => {
            const descriptorArray = typeof u.face_descriptor === 'string' ? JSON.parse(u.face_descriptor) : u.face_descriptor;
            const descriptor = new Float32Array(descriptorArray);
            
            const perms = Array.isArray(u.permisos) ? u.permisos : ['puerta', 'luces', 'bomba'];
            userMetadataMap[u.id] = {
                id: u.id,
                nombre: u.nombre,
                permisos: perms
            };

            return new faceapi.LabeledFaceDescriptors(
                u.id.toString() + "|" + u.nombre, 
                [descriptor]
            );
        });

        faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.5); 
    } catch(err) {
        console.error("Error cargando rostros BD:", err);
    }
}

function iniciarCamara() {
    navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
        video.srcObject = stream;
        scanning = true;
    })
    .catch(err => {
        estadoLogin.innerText = "Cámara no detectada o permisos denegados. Puedes usar el ingreso por contraseña o botón demo.";
        showToast('Cámara', 'No se detectó cámara web. Puedes ingresar con contraseña.', 'info');
    });
}

video.addEventListener('play', () => {
    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);
    estadoLogin.innerText = "Por favor, mira a la cámara para iniciar sesión.";

    const scanInterval = setInterval(async () => {
        if(!scanning || !faceMatcher) return;

        const detections = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor();
        
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        if (detections) {
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            faceapi.draw.drawDetections(canvas, resizedDetections);
            
            const bestMatch = faceMatcher.findBestMatch(detections.descriptor);
            
            if (bestMatch.label !== 'unknown') {
                scanning = false;
                clearInterval(scanInterval);
                
                const [idStr] = bestMatch.label.split('|');
                const userId = parseInt(idStr);
                const metadata = userMetadataMap[userId] || { id: userId, nombre: 'Usuario', permisos: ['puerta', 'luces', 'bomba'] };
                
                currentUser = metadata;
                
                estadoLogin.innerText = `¡Hola ${currentUser.nombre}! Accediendo...`;
                estadoLogin.style.color = "var(--success-color)";
                
                await registrarAcceso(currentUser.id, 'EXITO');
                showToast('Acceso Concedido', `Bienvenido/a, ${currentUser.nombre}`, 'success', 3000);
                setTimeout(mostrarPanelControl, 800);

            } else {
                estadoLogin.innerText = "Rostro no reconocido. Acceso denegado.";
                estadoLogin.style.color = "var(--danger-color)";
            }
        }
    }, 500); 
});

async function registrarAcceso(id, estado) {
    try {
        await fetch(`${API_URL}/recibir_log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, estado })
        });
    } catch (e) {
        console.error('Error al registrar log de acceso:', e);
    }
}

// ==========================================
// INGRESO MANUAL POR CONTRASEÑA / PIN
// ==========================================
if (btnOpenPinLogin) {
    btnOpenPinLogin.addEventListener('click', () => {
        formPinLogin.reset();
        modalPinLogin.classList.add('show');
    });
}

const cerrarModalPin = () => {
    modalPinLogin.classList.remove('show');
};

if (btnClosePinModal) btnClosePinModal.addEventListener('click', cerrarModalPin);
if (btnCancelPin) btnCancelPin.addEventListener('click', cerrarModalPin);

if (formPinLogin) {
    formPinLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userId = selectUserPin.value;
        const password = inputUserPin.value.trim();

        if (!userId) {
            showToast('Validación', 'Por favor selecciona un usuario.', 'warning');
            return;
        }

        btnSubmitPin.disabled = true;
        btnSubmitPin.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';

        try {
            const res = await fetch(`${API_URL}/user/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, password })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al autenticar');

            cerrarModalPin();
            currentUser = data.user;
            showToast('Acceso Concedido', `Bienvenido/a, ${currentUser.nombre}`, 'success');
            setTimeout(mostrarPanelControl, 600);
        } catch (err) {
            showToast('Acceso Denegado', err.message, 'error');
        } finally {
            btnSubmitPin.disabled = false;
            btnSubmitPin.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar';
        }
    });
}

// Simular acceso con usuario de ejemplo (para ferias/demos rápidas)
async function simularAccesoDemo() {
    try {
        const demoUser = listaUsuariosCache.find(u => u.id === 1) || listaUsuariosCache[0] || {
            id: 1,
            nombre: 'Carlos Gómez (Usuario Ejemplo)',
            permisos: ['puerta', 'luces', 'bomba']
        };

        currentUser = {
            id: demoUser.id,
            nombre: demoUser.nombre,
            permisos: Array.isArray(demoUser.permisos) ? demoUser.permisos : ['puerta', 'luces', 'bomba']
        };

        estadoLogin.innerText = `Autenticando usuario demo: ${currentUser.nombre}...`;
        estadoLogin.style.color = 'var(--success-color)';
        await registrarAcceso(currentUser.id, 'EXITO');
        showToast('Acceso Demo', `Modo demostración iniciado como ${currentUser.nombre}`, 'info', 2500);
        setTimeout(mostrarPanelControl, 600);
    } catch (e) {
        console.error('Error en demo:', e);
    }
}

// ==========================================
// DOMÓTICA - PANEL DE USUARIO CON PERMISOS
// ==========================================

function mostrarPanelControl() {
    pantallaReconocimiento.style.display = 'none';
    pantallaControl.style.display = 'flex';
    bienvenidaUsuario.innerText = `Hola, ${currentUser.nombre}`;

    const permisos = Array.isArray(currentUser.permisos) ? currentUser.permisos : ['puerta', 'luces', 'bomba'];
    
    let badgesHtml = '';
    if (permisos.length === 0) {
        badgesHtml = '<span class="badge-device badge-none"><i class="fa-solid fa-ban"></i> Sin permisos asignados</span>';
    } else {
        if (permisos.includes('puerta')) badgesHtml += '<span class="badge-device badge-door"><i class="fa-solid fa-door-open"></i> Puerta</span>';
        if (permisos.includes('luces')) badgesHtml += '<span class="badge-device badge-lights"><i class="fa-solid fa-lightbulb"></i> Luces</span>';
        if (permisos.includes('bomba')) badgesHtml += '<span class="badge-device badge-pump"><i class="fa-solid fa-water"></i> Bomba</span>';
    }
    permisosListaDisplay.innerHTML = badgesHtml;

    configurarBoton('btn-puerta', permisos.includes('puerta'), 'Abrir Puerta (3s)', 'Puerta (Sin permiso)');
    configurarBoton('btn-luces-on', permisos.includes('luces'), 'Encender Luces', 'Luces (Sin permiso)');
    configurarBoton('btn-luces-off', permisos.includes('luces'), 'Apagar Luces', 'Luces (Sin permiso)');
    configurarBoton('btn-bomba-on', permisos.includes('bomba'), 'Activar Bomba', 'Bomba (Sin permiso)');
    configurarBoton('btn-bomba-off', permisos.includes('bomba'), 'Apagar Bomba', 'Bomba (Sin permiso)');
}

function configurarBoton(btnId, permitido, textoHabilitado, textoBloqueado) {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    btn.disabled = !permitido;
    const span = btn.querySelector('span');
    if (span) {
        span.innerText = permitido ? textoHabilitado : textoBloqueado;
    }
    if (!permitido) {
        btn.title = "No tienes permiso asignado para este dispositivo.";
    } else {
        btn.title = "";
    }
}

async function enviarComando(accion) {
    if (!currentUser) return;

    try {
        const res = await fetch(`${API_URL}/comando`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accion, userId: currentUser.id })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al enviar comando');

        showToast('Comando IoT', `Instrucción "${accion}" enviada al ESP8266`, 'success', 2500);

        if (event && event.currentTarget) {
            const btn = event.currentTarget;
            const originalHtml = btn.innerHTML;
            btn.innerHTML = `<i class="fa-solid fa-check"></i> <span>Enviado</span>`;
            setTimeout(() => btn.innerHTML = originalHtml, 1800);
        }
    } catch (error) {
        showToast('Acceso Restringido', error.message, 'error', 3500);
    }
}

function cerrarSesion() {
    pantallaControl.style.display = 'none';
    pantallaReconocimiento.style.display = 'flex';
    estadoLogin.innerText = "Por favor, mira a la cámara para iniciar sesión.";
    estadoLogin.style.color = "var(--text-secondary)";
    currentUser = null;
    window.location.reload(); 
}

init();
