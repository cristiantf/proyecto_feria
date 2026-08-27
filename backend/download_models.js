const fs = require('fs');
const https = require('https');
const path = require('path');

const modelsDir = path.join(__dirname, '../frontend/models');
if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
}

const baseUrl = 'https://vladmandic.github.io/face-api/model/';
const files = [
    'ssd_mobilenet_v1_model-weights_manifest.json',
    'ssd_mobilenet_v1_model.weights',
    'face_landmark_68_model-weights_manifest.json',
    'face_landmark_68_model.weights',
    'face_recognition_model-weights_manifest.json',
    'face_recognition_model.weights'
];

console.log('Downloading face-api models from new URL...');

files.forEach(file => {
    const dest = path.join(modelsDir, file);
    const fileStream = fs.createWriteStream(dest);
    
    https.get(baseUrl + file, response => {
        if (response.statusCode !== 200) {
            console.error(`Error downloading ${file}: Status Code ${response.statusCode}`);
            return;
        }
        response.pipe(fileStream);
        fileStream.on('finish', () => {
            fileStream.close();
            console.log(`Downloaded: ${file}`);
        });
    }).on('error', err => {
        fs.unlink(dest, () => {});
        console.error(`Error downloading ${file}:`, err.message);
    });
});
