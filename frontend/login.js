const API_URL = 'http://localhost:3000/api';

const video = document.getElementById('video-login');
const canvas = document.getElementById('canvas-login');
const estadoLogin = document.getElementById('estado-login');
const pantallaReconocimiento = document.getElementById('pantalla-reconocimiento');
const pantallaControl = document.getElementById('pantalla-control');
const bienvenidaUsuario = document.getElementById('bienvenida-usuario');

let labeledFaceDescriptors = [];
let faceMatcher = null;
let scanning = false;
let currentUser = null;

// ==========================================
// INICIALIZACIÓN
// ==========================================
async function init() {
    estadoLogin.innerText = "Cargando modelos de Inteligencia Artificial...";
    try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights');
        await faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights');
        await faceapi.nets.faceRecognitionNet.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights');
        
        estadoLogin.innerText = "Descargando base de datos de rostros...";
        await cargarRostrosDesdeBD();
        
        estadoLogin.innerText = "Iniciando cámara...";
        iniciarCamara();
    } catch(err) {
        console.error(err);
        estadoLogin.innerText = "Error. Inicia el servidor web (Live Server o similar).";
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

        labeledFaceDescriptors = usuarios.map(u => {
            const descriptorArray = JSON.parse(u.face_descriptor);
            const descriptor = new Float32Array(descriptorArray);
            return new faceapi.LabeledFaceDescriptors(
                u.id.toString() + "|" + u.nombre, 
                [descriptor]
            );
        });

        // 0.6 es la distancia máxima (menor = más estricto)
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
        estadoLogin.innerText = "Error al acceder a la cámara web.";
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
                
                const [idStr, nombre] = bestMatch.label.split('|');
                currentUser = { id: parseInt(idStr), nombre: nombre };
                
                estadoLogin.innerText = `¡Hola ${nombre}! Accediendo...`;
                estadoLogin.style.color = "var(--success-color)";
                
                // Registrar log en BD
                await registrarAcceso(currentUser.id, 'EXITO');
                
                // Mostrar panel de control
                setTimeout(mostrarPanelControl, 1000);

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
    } catch (e) {}
}

// ==========================================
// DOMÓTICA - PANEL DE USUARIO
// ==========================================

function mostrarPanelControl() {
    pantallaReconocimiento.style.display = 'none';
    pantallaControl.style.display = 'flex';
    bienvenidaUsuario.innerText = `Hola, ${currentUser.nombre}`;
}

async function enviarComando(accion) {
    try {
        await fetch(`${API_URL}/comando`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accion })
        });
        // Feedback visual
        const btn = event.currentTarget;
        const textoOriginal = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-check"></i> Enviado`;
        setTimeout(() => btn.innerHTML = textoOriginal, 2000);
    } catch (error) {
        alert("Error al enviar el comando al servidor.");
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
