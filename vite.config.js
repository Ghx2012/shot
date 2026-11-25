import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // three.js 很少变动，拆成独立 chunk 后，游戏逻辑更新时玩家仍可复用浏览器缓存的引擎代码
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          return undefined;
        },
      },
    },
  },
});
