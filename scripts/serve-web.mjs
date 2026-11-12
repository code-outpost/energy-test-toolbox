// 能源测试工具箱 · 网页试用版静态服务器（零依赖，仅用 Node 内置模块）
//
// 作用：把仓库内的 src/ 作为静态站点托管。应用本身已内置「桌面 API 不可用即降级」
//      逻辑（设备联调 / 更新下载会优雅退化为纯前端模式），因此无需 Go 后端即可试用
//      全部计算 / 解析 / 报文构造类工具；只有真机串口 / TCP 收发需要桌面版 exe。
//
// 用法：
//   node scripts/serve-web.mjs            # 默认 http://localhost:8080
//   PORT=9000 node scripts/serve-web.mjs  # 自定义端口
//   然后浏览器打开提示的地址即可。
//
// 部署：把 src/ 整个目录交给任意静态托管（GitHub Pages / Netlify / Vercel / Nginx）。
//       本脚本仅用于本地预览；如需一键发到 GitHub Pages，可另加一条 workflow 把 src/ 发布。

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../src', import.meta.url)));
const PORT = Number(process.env.PORT) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8'
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  // 桌面 API 在本环境不存在：规范返回 {"ok":false}，让前端干净地降级为纯前端模式。
  if (pathname.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, web: true, error: 'web-mode: 桌面 API 不可用，已降级为纯前端模式' }));
    return;
  }

  // 路由：/ -> index.html
  let rel = pathname === '/' ? '/index.html' : pathname;
  // 防目录穿越
  const safe = normalize(rel).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(ROOT, safe);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  try {
    const st = await stat(filePath);
    if (st.isDirectory()) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    const body = await readFile(filePath);
    const type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`能源测试工具箱 · 网页试用版已启动`);
  console.log(`  本地访问: http://localhost:${PORT}`);
  console.log(`  局域网访问: http://<本机IP>:${PORT}`);
  console.log(`  托管根目录: ${ROOT}`);
  console.log(`  按 Ctrl+C 停止。`);
});
