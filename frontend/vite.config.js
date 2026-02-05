import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 配置代理，将 /agent/* 请求代理到项目根目录的 agent/ 文件夹
    proxy: {
      '/agent': {
        target: 'http://localhost:5173',
        configure: (proxy, options) => {
          // 自定义处理，直接读取文件系统
        },
        bypass: (req, res, options) => {
          // 绕过代理，直接返回文件
          const filePath = path.resolve(__dirname, '..', req.url);
          return req.url;
        }
      }
    },
    // 或者使用 fs 选项允许访问项目外的文件
    fs: {
      // 允许访问项目根目录之外的文件
      allow: ['..']
    }
  }
})
