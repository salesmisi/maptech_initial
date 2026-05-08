import { defineConfig } from 'vite'
import laravel from 'laravel-vite-plugin'
import react from '@vitejs/plugin-react'

export default defineConfig({
    build: {
        sourcemap: false,
    },
    plugins: [
        laravel({
            input: ['resources/js/src/index.tsx'],
            refresh: true,
        }),
        react(),
    ],
})
