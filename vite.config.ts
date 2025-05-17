// vite.config.ts
// poe-canvas-utils/vite.config.ts
import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'PoeCanvasUtils', // UMD bundle name
            fileName: (format) => `poe-canvas-utils.${format === 'es' ? 'js' : format === 'umd' ? 'umd.cjs' : 'js'}`,
            formats: ['es', 'umd'],
        },
        rollupOptions: {
            // Ensure to externalize deps that shouldn't be bundled
            // into your library
            external: ['react', 'react/jsx-runtime'],
            output: {
                // Provide global variables to use in the UMD build
                // for externalized deps
                globals: {
                    react: 'React',
                    'react/jsx-runtime': 'jsxRuntime',
                },
            },
        },
        sourcemap: true, // Optional: include source maps
    },
    plugins: [
        dts({
            insertTypesEntry: true,
            tsconfigPath: './tsconfig.json',
        }),
    ],
});