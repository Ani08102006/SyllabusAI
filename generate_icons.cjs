const fs = require('fs');

// 1x1 transparent PNG base64
const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

fs.writeFileSync('public/pwa-192x192.png', transparentPng);
fs.writeFileSync('public/pwa-512x512.png', transparentPng);
fs.writeFileSync('public/favicon.ico', transparentPng);
fs.writeFileSync('public/apple-touch-icon.png', transparentPng);
fs.writeFileSync('public/masked-icon.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#indigo"/></svg>');

