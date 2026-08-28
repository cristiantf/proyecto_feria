const API_URL = 'http://localhost:3000/api';

const video = document.getElementById('video-login');
const canvas = document.getElementById('canvas-login');
const estadoLogin = document.getElementById('estado-login');
const pantallaReconocimiento = document.getElementById('pantalla-reconocimiento');
const pantallaControl = document.getElementById('pantalla-control');
const bienvenidaUsuario = document.getElementById('bienvenida-usuario');
const permisosListaDisplay = document.getElementById('permisos-lista-display');

let labeledFaceDescriptors = [];
let userMetadataMap = {}; // Mapa para obtener datos de usuario (permisos, nombre) por ID
let faceMatcher = null;
let scanning = false;
let currentUser = null;

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
        estadoLogin.innerText = "Error cargando modelos. Asegúrate de ejecutar bajo un servidor web local.";
        return;
    }

    try {
        estadoLogin.innerText = "Descargando base de datos de rostros y permisos...";
        await cargarRostrosDesdeBD();
        
        estadoLogin.innerText = "Iniciando cámara...";
        iniciarCamara();
    } catch(err) {
        console.error(err);
        estadoLogin.innerText = "Error al conectar con la base de datos o iniciar cámara.";
    }
}

async function cargarRostrosDesdeBD() {
    try {
        const res = await fetch(`${API_URL}/rostros`);
        const usuarios = await res.json();
        
        if(usuarios.length === 0) {
            estadoLogin.innerText = "No hay usuarios registrados. Regístrate en el Panel Admin.";
            return;
        }

        userMetadataMap = {};

        labeledFaceDescriptors = usuarios.map(u => {
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

        // 0.5 distancia estricta
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
        estadoLogin.innerText = "Cámara no detectada o permisos denegados. Puedes usar el botón de prueba demo.";
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
            
            // Buscar coincidencia
            const bestMatch = faceMatcher.findBestMatch(detections.descriptor);
            
            if (bestMatch.label !== 'unknown') {
                // EXITO: ROSTRO RECONOCIDO
                scanning = false; // Detener escaneo
                clearInterval(scanInterval);
                
                const [idStr] = bestMatch.label.split('|');
                const userId = parseInt(idStr);
                const metadata = userMetadataMap[userId] || { id: userId, nombre: 'Usuario', permisos: ['puerta', 'luces', 'bomba'] };
                
                currentUser = metadata;
                
                estadoLogin.innerText = `¡Hola ${currentUser.nombre}! Accediendo...`;
                estadoLogin.style.color = "var(--success-color)";
                
                // Registrar log en BD
                await registrarAcceso(currentUser.id, 'EXITO');
                
                // Mostrar panel de control
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

// Simular acceso con usuario de ejemplo (para ferias/demos rápidas)
async function simularAccesoDemo() {
    try {
        const res = await fetch(`${API_URL}/usuarios`);
        const usuarios = await res.json();
        const demoUser = usuarios.find(u => u.id === 1) || usuarios[0] || {
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
    
    // Renderizar badges de permisos
    let badgesHtml = '';
    if (permisos.length === 0) {
        badgesHtml = '<span class="badge-device badge-none"><i class="fa-solid fa-ban"></i> Sin permisos asignados</span>';
    } else {
        if (permisos.includes('puerta')) badgesHtml += '<span class="badge-device badge-door"><i class="fa-solid fa-door-open"></i> Puerta</span>';
        if (permisos.includes('luces')) badgesHtml += '<span class="badge-device badge-lights"><i class="fa-solid fa-lightbulb"></i> Luces</span>';
        if (permisos.includes('bomba')) badgesHtml += '<span class="badge-device badge-pump"><i class="fa-solid fa-water"></i> Bomba</span>';
    }
    permisosListaDisplay.innerHTML = badgesHtml;

    // Control de activación de botones por dispositivo
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

        // Feedback visual
        if (event && event.currentTarget) {
            const btn = event.currentTarget;
            const originalHtml = btn.innerHTML;
            btn.innerHTML = `<i class="fa-solid fa-check"></i> <span>Enviado al ESP8266</span>`;
            setTimeout(() => btn.innerHTML = originalHtml, 1800);
        }
    } catch (error) {
        alert(error.message || "Error al enviar el comando al servidor.");
    }
}

function cerrarSesion() {
    pantallaControl.style.display = 'none';
    pantallaReconocimiento.style.display = 'flex';
    estadoLogin.innerText = "Por favor, mira a la cámara para iniciar sesión.";
    estadoLogin.style.color = "var(--text-secondary)";
    currentUser = null;
    
    // Recargar página para limpiar memoria y reiniciar escaneo limpio
    window.location.reload(); 
}

// Arrancar
init();
