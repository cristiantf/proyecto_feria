const API_URL = 'http://localhost:3000/api';

// Elementos DOM
const navItems = document.querySelectorAll('.nav-menu li');
const sections = document.querySelectorAll('.content-section');
const tablaUsuarios = document.getElementById('tabla-usuarios');
const tablaLogs = document.getElementById('tabla-logs');
const modalUsuario = document.getElementById('modal-usuario');
const btnNuevoUsuario = document.getElementById('btn-nuevo-usuario');
const closeBtns = document.querySelectorAll('.close-modal');
const formUsuario = document.getElementById('form-usuario');
const btnRefreshLogs = document.getElementById('btn-refresh-logs');

// IA y Video
const video = document.getElementById('video-registro');
const canvas = document.getElementById('canvas-registro');
const estadoIA = document.getElementById('estado-ia');
const btnGuardar = document.getElementById('btn-guardar');
let capturedDescriptor = null;

// Navegación
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

// Cargar Usuarios (Admin Panel)
async function cargarUsuarios() {
    try {
        const res = await fetch(`${API_URL}/usuarios`);
        const usuarios = await res.json();
        tablaUsuarios.innerHTML = '';
        usuarios.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>#${user.id}</strong></td>
                <td>${user.nombre}</td>
                <td>
                    <span class="badge ${user.tiene_acceso ? 'badge-success' : 'badge-danger'}">
                        ${user.tiene_acceso ? 'Habilitado' : 'Denegado'}
                    </span>
                </td>
            `;
            tablaUsuarios.appendChild(tr);
        });
    } catch (error) {
        console.error(error);
    }
}

// Cargar Logs
async function cargarLogs() {
    try {
        const res = await fetch(`${API_URL}/logs`);
        const logs = await res.json();
        tablaLogs.innerHTML = '';
        logs.forEach(log => {
            const date = new Date(log.fecha_dispositivo).toLocaleString();
            const badgeClass = log.estado === 'EXITO' ? 'badge-success' : 'badge-danger';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${date}</td>
                <td>${log.nombre ? log.nombre : 'Desconocido'}</td>
                <td><span class="badge ${badgeClass}">${log.estado}</span></td>
            `;
            tablaLogs.appendChild(tr);
        });
    } catch (error) {
        console.error(error);
    }
}

// ==========================================
// LÓGICA DE RECONOCIMIENTO FACIAL (face-api.js)
// ==========================================

async function cargarModelos() {
    try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights');
        await faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights');
        await faceapi.nets.faceRecognitionNet.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights');
        estadoIA.innerText = "Modelos cargados. Iniciando cámara...";
        iniciarCamara();
    } catch(err) {
        estadoIA.innerText = "Error cargando modelos. Asegúrate de iniciar un servidor web.";
        console.error(err);
    }
}

function iniciarCamara() {
    navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
        video.srcObject = stream;
    })
    .catch(err => {
        estadoIA.innerText = "Error al acceder a la cámara.";
    });
}

video.addEventListener('play', () => {
    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);
    estadoIA.innerText = "Analizando rostro...";

    setInterval(async () => {
        if(!modalUsuario.classList.contains('show')) return; // No analizar si modal está cerrado

        const detections = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor();
        
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        if (detections) {
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            faceapi.draw.drawDetections(canvas, resizedDetections);
            faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
            
            capturedDescriptor = Array.from(detections.descriptor); // Convertir Float32Array a Array normal
            estadoIA.innerText = "¡Rostro detectado y capturado! Puedes guardar.";
            estadoIA.style.color = "var(--success-color)";
            btnGuardar.disabled = false;
        } else {
            estadoIA.innerText = "No se detecta rostro. Mira a la cámara.";
            estadoIA.style.color = "var(--danger-color)";
            btnGuardar.disabled = true;
            capturedDescriptor = null;
        }
    }, 500); // 2 FPS para no saturar
});


// Guardar Usuario
formUsuario.addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!capturedDescriptor) {
        alert("Aún no se ha capturado un rostro válido.");
        return;
    }

    const nombre = document.getElementById('nombre').value;
    const tiene_acceso = document.getElementById('tiene_acceso').checked;

    btnGuardar.disabled = true;
    btnGuardar.innerText = "Guardando...";

    try {
        await fetch(`${API_URL}/usuarios`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, face_descriptor: capturedDescriptor, tiene_acceso })
        });
        
        // Cerrar modal y limpiar
        modalUsuario.classList.remove('show');
        formUsuario.reset();
        capturedDescriptor = null;
        btnGuardar.innerText = "Guardar Rostro y Usuario";
        
        cargarUsuarios();
        alert("Usuario registrado con éxito.");
    } catch (error) {
        alert('Error al crear usuario');
        btnGuardar.disabled = false;
        btnGuardar.innerText = "Guardar Rostro y Usuario";
    }
});

// Modales
btnNuevoUsuario.addEventListener('click', () => {
    modalUsuario.classList.add('show');
    if(!video.srcObject) cargarModelos();
});

closeBtns.forEach(btn => btn.addEventListener('click', () => {
    modalUsuario.classList.remove('show');
}));

btnRefreshLogs.addEventListener('click', cargarLogs);

// Init
cargarUsuarios();
