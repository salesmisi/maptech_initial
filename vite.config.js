import { defineConfig } from 'vite'
import laravel from 'laravel-vite-plugin'
import react from '@vitejs/plugin-react'

export default defineConfig({
    build: {
        // Use inline sourcemaps so browsers always have access to mappings
        // even when serving static build files. This helps DevTools show
        // original source file/line in runtime stack traces.
        sourcemap: 'inline',
    },
    plugins: [
        laravel({
            input: ['resources/js/src/index.tsx'],
            refresh: true,
        }),
        react(),
    ],
})
