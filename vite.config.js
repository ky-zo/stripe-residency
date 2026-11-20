import {defineConfig} from 'vite';
export default defineConfig({
  build:{outDir:'build/island'},
  server:{proxy:{'/live':{target:'ws://127.0.0.1:8797',ws:true},'/api/':{target:'http://127.0.0.1:8797'}}}
});
