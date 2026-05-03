import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

// Rewrites require("node-pty") in the final bundle to resolve from the unpacked asar path at runtime
function nativeModulePlugin(): Plugin {
  return {
    name: 'native-module-resolve',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'chunk' && file.code) {
          file.code = file.code.replace(
            /require\("node-pty"\)/g,
            `(function(){try{return require("node-pty")}catch(e){return require(require("path").join(process.resourcesPath,"app.asar.unpacked","node_modules","node-pty"))}})()`,
          );
        }
      }
    },
  };
}

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['node-pty', 'electron-squirrel-startup'],
    },
  },
  plugins: [nativeModulePlugin()],
});
