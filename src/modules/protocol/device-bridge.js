// 设备联调：Modbus TCP / 裸 TCP / 串口收发。
// 桌面版通过 Go 内置 127.0.0.1 API 实际连接设备；纯前端/网页预览自动降级为离线报文构造。
(function () {
  const T = TB.util;

  function parseHex(s) {
    const clean = String(s || '').replace(/0x/gi, '').replace(/[^0-9a-fA-F\s,]/g, ' ');
    const out = [];
    for (const p of clean.split(/[\s,]+/).filter(Boolean)) {
      if (p.length % 2) { const n = parseInt(p, 16); if (n >= 0 && n <= 255) out.push(n); }
      else for (let i = 0; i < p.length; i += 2) out.push(parseInt(p.substr(i, 2), 16));
    }
    return out.filter(n => Number.isFinite(n) && n >= 0 && n <= 255);
  }
  function hexStr(bytes) { return (bytes || []).map(b => (b & 255).toString(16).toUpperCase().padStart(2, '0')).join(' '); }
  function crc16(bytes) {
    let crc = 0xFFFF;
    for (const b of bytes) {
      crc ^= (b & 255);
      for (let i = 0; i < 8; i++) crc = (crc & 1) ? ((crc >>> 1) ^ 0xA001) : (crc >>> 1);
    }
    return crc & 0xFFFF;
  }
  function appendCrc(bytes) { const c = crc16(bytes); return bytes.concat([c & 0xFF, (c >>> 8) & 0xFF]); }
  function buildModbus(unit, func, addr, count) {
    const tid = 1;
    const pdu = [func & 255, (addr >> 8) & 255, addr & 255, (count >> 8) & 255, count & 255];
    const len = pdu.length + 1;
    return [(tid >> 8) & 255, tid & 255, 0, 0, (len >> 8) & 255, len & 255, unit & 255].concat(pdu);
  }

  const TEMPLATES = {
    modbus: [
      { n: '读保持寄存器 (03) × 10', f: 3, a: 0, c: 10 },
      { n: '读输入寄存器 (04) × 10', f: 4, a: 0, c: 10 },
      { n: '读线圈 (01) × 8', f: 1, a: 0, c: 8 },
      { n: '写单寄存器 (06)', f: 6, a: 0, c: 1 }
    ],
    tcp: [
      { n: 'IEC 104 STARTDT 启动帧', h: '68 04 07 00 00 00' },
      { n: 'IEC 104 总召唤 (C_IC_NA_1)', h: '68 0E 00 00 00 00 64 01 06 00 01 00 00 00 00 14' },
      { n: 'Modbus TCP 读保持寄存器', h: '00 01 00 00 00 06 01 03 00 00 00 0A' },
      { n: '自定义报文', h: '' }
    ],
    serial: [
      { n: '读保持寄存器 (03) × 10 + 自动 CRC', h: '01 03 00 00 00 0A' },
      { n: '读输入寄存器 (04) × 2 + 自动 CRC', h: '01 04 00 00 00 02' },
      { n: '自定义 RTU 帧', h: '' }
    ]
  };

  TB.register({
    id: 'device-bridge', name: '设备联调（Modbus / TCP / 串口）', category: '协议报文解析',
    desc: '连接真实设备收发报文：Modbus TCP 主站、裸 TCP 透传、串口 RTU。内置报文模板、自动 CRC、响应解析与收发日志。',
    tips: [
      '桌面版（exe）可实际连接设备；网页预览为纯前端模式，只构造报文不发送',
      'Modbus TCP 默认端口 502；串口常见 9600/8N1',
      'RTU 帧末尾需 CRC16-MODBUS（低字节在前），点「追加 CRC」自动补齐',
      '所有连接仅在本机发起，不经过任何外部服务器'
    ],
    refs: [
      'Modbus TCP 帧结构见 Modbus Application Protocol V1.1b3（MBAP + PDU）',
      'Modbus RTU CRC16 多项式 0xA001，初值 0xFFFF，低字节先发',
      'IEC 60870-5-104 U 格式启动帧：68 04 07 00 00 00'
    ],
    render(c, ctx) {
      const modeSel = T.el('select', { id: 'db_mode', value: 'modbus', 'aria-label': '连接方式' }, [
        T.el('option', { value: 'modbus', text: 'Modbus TCP' }),
        T.el('option', { value: 'tcp', text: '裸 TCP' }),
        T.el('option', { value: 'serial', text: '串口 RTU' })
      ]);
      function fld(label, def, id, type) {
        const inp = T.el('input', { type: type || 'text', value: def, id: id, 'aria-label': label });
        return { wrap: T.el('div', { class: 'field' }, [T.el('label', { text: label }), inp]), inp };
      }
      const host = fld('设备 IP / 域名', '127.0.0.1', 'db_host');
      const port = fld('TCP 端口', '502', 'db_port', 'number');
      const unit = fld('从站号 Unit ID', '1', 'db_unit', 'number');
      const func = fld('功能码', '3', 'db_func', 'number');
      const addr = fld('起始地址', '0', 'db_addr', 'number');
      const count = fld('数量 / 写入值', '10', 'db_count', 'number');
      const timeout = fld('超时 (ms)', '2000', 'db_timeout', 'number');
      const comPort = fld('串口 (如 COM3)', 'COM3', 'db_com');
      const baud = fld('波特率', '9600', 'db_baud', 'number');
      const refresh = T.el('button', { class: 'btn sm ghost', text: '刷新串口列表', onclick: loadPorts });

      const tplSel = T.el('select', { id: 'db_tpl', 'aria-label': '报文模板' });
      const hexInput = T.el('textarea', { id: 'db_hex', class: 'pre', rows: '3', 'aria-label': '请求报文 HEX', placeholder: '例如 00 01 00 00 00 06 01 03 00 00 00 0A' });
      const respBox = T.el('div', { class: 'pre', id: 'db_resp' });
      respBox.appendChild(T.el('span', { class: 'hint', text: '尚未发送报文。' }));
      const envBox = T.el('div', { class: 'hint', text: '正在检测运行环境…' });
      const logBox = T.el('div', { class: 'log-list' });

      let desktop = false;
      function setResp(nodes) { respBox.innerHTML = ''; nodes.forEach(n => respBox.appendChild(n)); }
      function log(line) {
        const row = T.el('div', { class: 'log-row', text: new Date().toLocaleTimeString() + '  ' + line });
        logBox.insertBefore(row, logBox.firstChild);
        while (logBox.childNodes && logBox.childNodes.length > 30 && logBox.removeChild) logBox.removeChild(logBox.lastChild);
      }
      function setEnv(ok, msg) {
        desktop = ok;
        envBox.textContent = ok
          ? '● 桌面版已连接：本机 API 可用，可实际收发报文。'
          : '○ 纯前端模式：' + msg + '（仍可构造报文与计算 CRC，不会发送）';
      }
      function loadPorts() {
        if (typeof fetch !== 'function') { setResp([T.el('div', { class: 'hint', text: '纯前端模式无法枚举串口，请手动填写 COM 端口。' })]); return; }
        fetch('/api/device/ports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
          .then(r => r.json()).then(j => {
            const list = (j.ports || []).join(', ') || '未发现可用串口';
            setResp([T.el('div', { class: 'hint', text: '可用串口：' + list })]);
            log('枚举串口 → ' + list);
          }).catch(e => setResp([T.el('div', { class: 'error', text: '枚举失败：' + e.message })]));
      }
      function fillTemplates() {
        tplSel.innerHTML = '';
        const mode = TEMPLATES[modeSel.value] ? modeSel.value : 'modbus';
        TEMPLATES[mode].forEach((t, i) => tplSel.appendChild(T.el('option', { value: String(i), text: t.n })));
        applyTemplate();
      }
      function applyTemplate() {
        const mode = TEMPLATES[modeSel.value] ? modeSel.value : 'modbus';
        const t = TEMPLATES[mode][parseInt(tplSel.value || '0', 10)] || TEMPLATES[mode][0];
        if (mode === 'modbus') {
          hexInput.value = hexStr(buildModbus(parseInt(unit.inp.value, 10) || 1, parseInt(func.inp.value, 10) || 3,
            parseInt(addr.inp.value, 10) || 0, parseInt(count.inp.value, 10) || 10));
        } else {
          hexInput.value = t.h || '';
        }
      }
      function syncMode() {
        const m = TEMPLATES[modeSel.value] ? modeSel.value : 'modbus';
        const show = (el, on) => { if (el && el.style) el.style.display = on ? '' : 'none'; };
        show(host.wrap, m !== 'serial'); show(port.wrap, m !== 'serial');
        show(unit.wrap, m === 'modbus'); show(func.wrap, m === 'modbus');
        show(addr.wrap, m === 'modbus'); show(count.wrap, m === 'modbus');
        show(comPort.wrap, m === 'serial'); show(baud.wrap, m === 'serial');
        show(refresh, m === 'serial');
        fillTemplates();
      }
      function appendCrcBtn() {
        const bytes = parseHex(hexInput.value);
        if (!bytes.length) { setResp([T.el('div', { class: 'error', text: '请先输入 HEX 报文。' })]); return; }
        hexInput.value = hexStr(appendCrc(bytes));
        const crc = crc16(bytes);
        setResp([T.el('div', { class: 'hint', text: 'CRC16-MODBUS = 0x' + crc.toString(16).toUpperCase().padStart(4, '0') + '（低字节 ' + (crc & 255).toString(16).toUpperCase() + ' 在前，已追加）' })]);
        log('追加 CRC → ' + hexInput.value);
      }
      async function send() {
        const bytes = parseHex(hexInput.value);
        if (!bytes.length) { setResp([T.el('div', { class: 'error', text: '请输入有效的 HEX 报文。' })]); return; }
        const tx = hexStr(bytes);
        log('TX → ' + tx);
        if (!desktop) {
          setResp([
            T.el('div', { class: 'hint', text: '纯前端模式：报文已构造，未发送。' }),
            T.el('div', { class: 'pre', text: tx }),
            T.el('div', { class: 'hint', text: 'CRC16-MODBUS = 0x' + crc16(bytes).toString(16).toUpperCase().padStart(4, '0') })
          ]);
          return;
        }
        const mode = TEMPLATES[modeSel.value] ? modeSel.value : 'modbus';
        const payload = {
          host: host.inp.value, port: parseInt(port.inp.value, 10) || 502,
          unit: parseInt(unit.inp.value, 10) || 1, func: parseInt(func.inp.value, 10) || 3,
          addr: parseInt(addr.inp.value, 10) || 0, count: parseInt(count.inp.value, 10) || 10,
          port_name: comPort.inp.value, baud: parseInt(baud.inp.value, 10) || 9600,
          hex: tx, timeout: parseInt(timeout.inp.value, 10) || 2000
        };
        const ep = mode === 'modbus' ? 'modbus' : (mode === 'serial' ? 'serial' : 'tcp');
        try {
          const r = await fetch('/api/device/' + ep, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
          });
          const j = await r.json();
          const nodes = [
            T.el('div', { class: j.ok ? 'success' : 'error', text: j.ok ? '● 通信成功 · 耗时 ' + (j.ms || 0) + ' ms' : '● 通信失败：' + (j.error || '未知错误') }),
            T.el('div', { class: 'hint', text: 'TX  ' + (j.tx || tx) })
          ];
          if (j.rx) nodes.push(T.el('div', { class: 'pre', text: 'RX  ' + j.rx }));
          if (j.registers && j.registers.length) {
            nodes.push(T.el('div', { class: 'hint', text: '寄存器值：' + j.registers.join(', ') }));
          }
          if (j.ports && j.ports.length) nodes.push(T.el('div', { class: 'hint', text: '串口：' + j.ports.join(', ') }));
          setResp(nodes);
          log((j.ok ? 'RX ← ' : 'ERR  ') + (j.rx || j.error || ''));
        } catch (e) {
          setResp([T.el('div', { class: 'error', text: '请求失败：' + e.message })]);
          log('ERR  ' + e.message);
        }
      }

      modeSel.addEventListener('change', syncMode);
      tplSel.addEventListener('change', applyTemplate);
      [unit.inp, func.inp, addr.inp, count.inp].forEach(e => e.addEventListener('input', () => { if (modeSel.value === 'modbus') applyTemplate(); }));

      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '连接参数' }),
        envBox,
        T.el('div', { class: 'form-grid' }, [modeSel, host.wrap, port.wrap, unit.wrap, func.wrap, addr.wrap, count.wrap, timeout.wrap, comPort.wrap, baud.wrap, refresh])
      ]));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '请求报文' }),
        T.el('div', { class: 'row' }, [tplSel,
          T.el('button', { class: 'btn sm ghost', text: '追加 CRC16', onclick: appendCrcBtn }),
          T.el('button', { class: 'btn sm primary', text: '发送并接收', onclick: send })
        ]),
        hexInput
      ]));
      c.appendChild(T.el('div', { class: 'card' }, [T.el('h3', { text: '响应与解析' }), respBox]));

      if (ctx && ctx.aside) {
        ctx.aside.appendChild(T.el('div', { class: 'aside-card' }, [
          T.el('div', { class: 'aside-title' }, [T.el('span', { class: 'dot' }), T.el('span', { text: '收发日志' })]),
          logBox
        ]));
      }

      syncMode();
      if (typeof fetch === 'function') {
        fetch('/api/device/ping').then(r => r.json()).then(j => setEnv(!!j.ok, 'API 未响应')).catch(() => setEnv(false, '本机 API 不可用'));
      } else {
        setEnv(false, '当前为网页预览环境');
      }
    }
  });
})();
