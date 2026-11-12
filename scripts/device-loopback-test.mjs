// 设备联调 · 本地回显验收脚本（TCP 收发路径端到端验证）
//
// 原理：在本机起一个 TCP 回显服务器，然后让已运行的 EnergyTestToolbox.exe（桌面版）的
//       /api/device/tcp 把一帧 Modbus TCP 报文发到这个回显服务器，验证「发送 → 接收」链路
//       是否打通（回显一致即说明 Go 后端的 TCP 收发路径正常；这覆盖了真实设备联调里
//       除「对端协议语义」之外的全部传输环节）。
//
// 用法：
//   1) 先启动 EnergyTestToolbox.exe（桌面版会监听 http://127.0.0.1:39017）
//   2) node scripts/device-loopback-test.mjs
//
// 串口路径仍需真实 COM 口（或用 com0com 之类的虚拟串口对）才能验收，本脚本只覆盖 TCP。

import net from 'node:net';
import http from 'node:http';

const BACKEND = 'http://127.0.0.1:39017';
const ECHO_PORT = 1502;
// 一帧合法的 Modbus TCP 读保持寄存器请求（事务 0001 / UID 01 / 功能 03 / 起始 0 / 数量 10）
const FRAME = '00 01 00 00 00 06 01 03 00 00 00 0A';

function pingBackend() {
  return new Promise((resolve) => {
    const req = http.get(BACKEND + '/api/device/ping', (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
}

async function postTcp(payload) {
  return new Promise((resolve) => {
    const data = JSON.stringify(payload);
    const req = http.request(BACKEND + '/api/device/tcp', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({ ok: false, error: '无法解析后端响应' }); } });
    });
    req.on('error', (e) => resolve({ ok: false, error: '后端不可达: ' + e.message }));
    req.write(data);
    req.end();
  });
}

const server = net.createServer((sock) => {
  sock.on('data', (d) => sock.write(d)); // 回显
  sock.on('error', () => {});
});

server.listen(ECHO_PORT, '127.0.0.1', async () => {
  console.log('TCP 回显服务器已启动: 127.0.0.1:' + ECHO_PORT);
  const up = await pingBackend();
  if (!up) {
    console.log('✗ 未检测到后端。请先启动 EnergyTestToolbox.exe（桌面版，监听 39017）。');
    server.close();
    process.exit(2);
  }
  console.log('✓ 后端在线，开始发送测试帧...');
  const j = await postTcp({ host: '127.0.0.1', port: ECHO_PORT, hex: FRAME, timeout: 2000 });
  console.log('TX:', j.tx);
  console.log('RX:', j.rx);
  console.log('OK:', j.ok, '  耗时(ms):', j.ms);
  const want = FRAME.replace(/\s/g, '').toUpperCase();
  const got = (j.rx || '').replace(/\s/g, '').toUpperCase();
  if (j.ok && got === want) {
    console.log('✓ PASS：回显一致，TCP 收发路径正常（真实设备联调的传输环节已打通）。');
  } else {
    console.log('✗ FAIL：' + (j.error || ('回显不一致，期望 ' + want)));
  }
  server.close();
});
