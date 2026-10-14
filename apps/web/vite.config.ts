import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const commit = process.env.ROWTRACE_COMMIT || 'local';
export default defineConfig({ plugins: [react(),{name:'release-version',generateBundle(){this.emitFile({type:'asset',fileName:'version.json',source:JSON.stringify({version:'0.1.0',commit})});}}], define:{__ROWTRACE_COMMIT__:JSON.stringify(commit)}, base: '/rowtrace/', worker: { format: 'es' }, build: { target: 'es2022' } });
