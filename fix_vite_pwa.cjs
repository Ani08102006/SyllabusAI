const fs = require('fs');
let code = fs.readFileSync('vite.config.ts', 'utf-8');

const importPwa = "import { VitePWA } from 'vite-plugin-pwa';\n";

if (!code.includes('VitePWA')) {
  code = importPwa + code;
  
  const pwaConfig = `VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'StudyForge AI',
        short_name: 'StudyForge',
        description: 'AI-powered academic study tutor',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })`;

  code = code.replace(/plugins: \[react\(\), tailwindcss\(\)\]/g, `plugins: [react(), tailwindcss(), ${pwaConfig}]`);
  fs.writeFileSync('vite.config.ts', code);
}
