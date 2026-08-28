const fs = require('fs');
const https = require('https');
const path = require('path');

const modelsDir = path.join(__dirname, '../frontend/models');
if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
}

const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';
const files = [
    'ssd_mobilenetv1_model-weights_manifest.json',
    'ssd_mobilenetv1_model-shard1',
    'ssd_mobilenetv1_model-shard2',
    'face_landmark_68_model-weights_manifest.json',
    'face_landmark_68_model-shard1',
    'face_recognition_model-weights_manifest.json',
    'face_recognition_model-shard1',
    'face_recognition_model-shard2',
    'tiny_face_detector_model-weights_manifest.json',
    'tiny_face_detector_model-shard1'
];

console.log('Descargando pesos oficiales de face-api.js...');

const downloadFile = (file) => new Promise((resolve, reject) => {
    const dest = path.join(modelsDir, file);
    const fileStream = fs.createWriteStream(dest);
    
    https.get(baseUrl + file, response => {
        if (response.statusCode !== 200) {
            console.error(`Error descargando ${file}: Código ${response.statusCode}`);
            reject(new Error(`Status ${response.statusCode}`));
            return;
        }
        response.pipe(fileStream);
        fileStream.on('finish', () => {
            fileStream.close();
            console.log(`✅ Descargado: ${file} (${fs.statSync(dest).size} bytes)`);
            resolve();
        });
    }).on('error', err => {
        fs.unlink(dest, () => {});
        console.error(`❌ Error al descargar ${file}:`, err.message);
        reject(err);
    });
});

(async () => {
    for (const f of files) {
        try {
            await downloadFile(f);
        } catch (e) {
            console.error(`Fallo en ${f}:`, e.message);
        }
    }
    console.log('🎉 Todos los modelos han sido guardados localmente en frontend/models');
})();
