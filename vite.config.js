import { defineConfig } from 'vite'
import laravel from 'laravel-vite-plugin'
import react from '@vitejs/plugin-react'

export default defineConfig({
    build: {
        sourcemap: false,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        if (/node_modules[\\/]react-router-dom/.test(id)) return 'vendor-router';
                        if (/node_modules[\\/](react|react-dom|scheduler)/.test(id)) return 'vendor-react';
                        if (/node_modules[\\/]recharts/.test(id)) return 'vendor-charts';
                        if (/node_modules[\\/]pdfjs-dist/.test(id)) return 'vendor-pdf';
                        if (/node_modules[\\/](jszip|pptxgenjs)/.test(id)) return 'vendor-pptx';
                        if (/node_modules[\\/](pusher-js|laravel-echo)/.test(id)) return 'vendor-realtime';
                        if (/node_modules[\\/](lucide-react|@heroicons|@headlessui)/.test(id)) return 'vendor-ui';
                        // For all other node_modules, return undefined so Rollup can auto-chunk them
                        return undefined;
                    }
                },
            },
        },
    },
    plugins: [
        laravel({
            input: ['resources/js/src/index.tsx'],
            refresh: true,
        }),
        react(),
    ],
})
