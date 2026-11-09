import { defineConfig } from 'vite';
export default defineConfig({build:{outDir:'../src/BeeHooks.App/wwwroot',emptyOutDir:true,target:['chrome100','safari15.4'],rollupOptions:{input:{main:'index.html',controller:'controller.html'}}}});
