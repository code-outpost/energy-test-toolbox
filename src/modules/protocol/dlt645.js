// DL/T645-2007 报文解析与构造（±33 编解码）
(function () {
  const T = TB.util;
  function parseHex(s) { s = (s || '').replace(/[^0-9a-fA-F]/g, ''); if (s.length % 2) return null; const a = []; for (let i = 0; i < s.length; i += 2) a.push(parseInt(s.substr(i, 2), 16)); return a; }
  function hx(arr, sep) { return arr.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(sep || ' '); }
  const CTRL = { 0x11: '读数据请求', 0x91: '读数据应答', 0x14: '写数据请求', 0x94: '写数据应答', 0x08: '广播校时', 0x81: '读通信地址请求', 0x84: '读电能量等', 0x13: '读后续数据', 0x03: '读设备识别' };

  function parse(bytes) {
    if (bytes.length < 12) return { ok: false, err: '报文过短（至少 12 字节）' };
    if (bytes[0] !== 0x68) return { ok: false, err: '起始符应为 0x68' };
    const addr = bytes.slice(1, 7);
    if (bytes[7] !== 0x68) return { ok: false, err: '第二个 0x68 缺失或地址长度异常' };
    const ctrl = bytes[8], L = bytes[9];
    if (bytes.length < 10 + L + 2) return { ok: false, err: '数据长度与报文不符' };
    const data = bytes.slice(10, 10 + L);
    const csRecv = bytes[10 + L];
    const end = bytes[10 + L + 1];
    if (end !== 0x16) return { ok: false, err: '结束符应为 0x16，实际 0x' + end.toString(16).toUpperCase() };
    let sum = 0; for (let i = 1; i <= 9 + L; i++) sum = (sum + bytes[i]) & 0xff;
    const csOk = sum === csRecv;
    const decoded = data.map(b => (b - 0x33) & 0xff);
    return { ok: true, addr, addrText: hx(addr), meterNo: hx(addr.slice().reverse()), ctrl, ctrlName: CTRL[ctrl] || ('0x' + ctrl.toString(16)), L, data, decoded, csOk, csRecv, csCalc: sum };
  }

  function build(addr, ctrl, data) {
    const frame = [0x68].concat(addr, [0x68, ctrl, data.length]).concat(data, [0, 0x16]);
    let sum = 0; for (let i = 1; i < frame.length - 2; i++) sum = (sum + frame[i]) & 0xff;
    frame[frame.length - 2] = sum;
    return frame;
  }

  // 默认样本：广播读数据请求，数据标识 00 00 00 00
  function buildSample() {
    const addr = [0xAA, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA];
    const data = [0x00, 0x00, 0x00, 0x00].map(b => (b + 0x33) & 0xff);
    return build(addr, 0x11, data);
  }

  TB.register({
    id: 'dlt645', name: 'DL/T645', category: '协议报文解析',
    desc: 'DL/T645-2007 帧解析与构造（±33 编解码、校验和、控制码语义）',
    render(c) {
      const out = T.el('div', { class: 'col' });
      // ---- 解析 ----
      const input = T.el('textarea', { class: 'mono', placeholder: '粘贴完整帧 HEX（68 ... 68 C L 数据 CS 16）' });
      const pout = T.el('div', { class: 'col' });
      input.addEventListener('input', () => {
        const b = parseHex(input.value);
        pout.innerHTML = '';
        if (!b) { pout.appendChild(T.el('div', { class: 'error', text: 'HEX 格式错误' })); return; }
        const r = parse(b);
        if (!r.ok) { pout.appendChild(T.el('div', { class: 'error', text: '解析失败：' + r.err })); return; }
        const ov = T.el('div', { class: 'kv' });
        ov.appendChild(T.el('div', { class: 'k', text: '表号(字节序)' })); ov.appendChild(T.el('div', { class: 'v', text: r.addrText }));
        ov.appendChild(T.el('div', { class: 'k', text: '表号(正序)' })); ov.appendChild(T.el('div', { class: 'v', text: r.meterNo }));
        ov.appendChild(T.el('div', { class: 'k', text: '控制码' })); ov.appendChild(T.el('div', { class: 'v', text: '0x' + r.ctrl.toString(16).toUpperCase() + ' ' + r.ctrlName }));
        ov.appendChild(T.el('div', { class: 'k', text: '数据长度 L' })); ov.appendChild(T.el('div', { class: 'v', text: String(r.L) }));
        ov.appendChild(T.el('div', { class: 'k', text: '校验和' })); ov.appendChild(T.el('div', { class: 'v', text: (r.csOk ? '✓ 正确' : '✗ 错误') + ' 计算=0x' + r.csCalc.toString(16).toUpperCase() + ' 收到=0x' + r.csRecv.toString(16).toUpperCase() }));
        pout.appendChild(ov);
        pout.appendChild(T.el('div', { class: 'hint', text: '数据域（已 -0x33 解码）' }));
        pout.appendChild(T.el('div', { class: 'kv' })); const dk = pout.lastChild;
        dk.appendChild(T.el('div', { class: 'k', text: '编码' })); dk.appendChild(T.el('div', { class: 'v', text: hx(r.data) }));
        dk.appendChild(T.el('div', { class: 'k', text: '解码' })); dk.appendChild(T.el('div', { class: 'v', text: hx(r.decoded) }));
      });
      const loadBtn = T.el('button', { class: 'btn sm primary', text: '载入示例', onclick: () => { input.value = hx(buildSample()); input.dispatchEvent(new Event('input')); } });
      const parseCard = T.el('div', { class: 'card' }, [
        T.el('h3', { text: '帧解析' }),
        T.el('div', { class: 'row' }, [loadBtn]),
        input, pout
      ]);
      // ---- 构造 ----
      const aIn = T.el('input', { type: 'text', class: 'mono', value: 'AAAAAAAAAAAA', style: 'width:160px' });
      const cIn = T.el('input', { type: 'text', class: 'mono', value: '11', style: 'width:60px' });
      const dIn = T.el('input', { type: 'text', class: 'mono', placeholder: '逻辑数据 HEX，如 00000000', value: '00000000', style: 'width:200px' });
      const bout = T.el('div', { class: 'col' });
      function doBuild() {
        const addr = parseHex(aIn.value); const data = parseHex(dIn.value);
        bout.innerHTML = '';
        if (!addr || addr.length !== 6) { bout.appendChild(T.el('div', { class: 'error', text: '地址需为 6 字节(12 位 HEX)' })); return; }
        if (!data) { bout.appendChild(T.el('div', { class: 'error', text: '逻辑数据 HEX 格式错误' })); return; }
        const ctrl = parseInt(cIn.value, 16); if (isNaN(ctrl)) { bout.appendChild(T.el('div', { class: 'error', text: '控制码格式错误' })); return; }
        const enc = data.map(b => (b + 0x33) & 0xff);
        const frame = build(addr, ctrl, enc);
        bout.appendChild(T.el('div', { class: 'kv' })); const k = bout.lastChild;
        k.appendChild(T.el('div', { class: 'k', text: '完整帧' })); k.appendChild(T.el('div', { class: 'v' }, [hx(frame), T.util.copyBtn(hx(frame))]));
        k.appendChild(T.el('div', { class: 'k', text: '数据域(+0x33)' })); k.appendChild(T.el('div', { class: 'v', text: hx(enc) }));
      }
      aIn.addEventListener('input', doBuild); cIn.addEventListener('input', doBuild); dIn.addEventListener('input', doBuild);
      const buildCard = T.el('div', { class: 'card' }, [
        T.el('h3', { text: '帧构造' }),
        T.el('div', { class: 'row' }, [T.el('label', { text: '地址' }), aIn, T.el('label', { text: '控制码' }), cIn]),
        T.el('div', { class: 'row' }, [T.el('label', { text: '逻辑数据' }), dIn, T.el('button', { class: 'btn sm primary', text: '生成', onclick: doBuild })]),
        T.el('div', { class: 'hint', text: '逻辑数据按 -0x33 逆向编码为数据域，自动计算校验和与结束符。' }),
        bout
      ]);
      // ---- 容器 ----
      const tabRow = T.el('div', { class: 'row' }, [
        T.el('button', { class: 'btn sm', text: '解析', onclick: () => { parseCard.style.display = ''; buildCard.style.display = 'none'; } }),
        T.el('button', { class: 'btn sm', text: '构造', onclick: () => { buildCard.style.display = ''; parseCard.style.display = 'none'; doBuild(); } })
      ]);
      c.appendChild(T.el('div', { class: 'card' }, [T.el('h3', { text: 'DL/T645-2007 解析 / 构造' }), tabRow, parseCard, buildCard]));
      doBuild();
    }
  });
})();
