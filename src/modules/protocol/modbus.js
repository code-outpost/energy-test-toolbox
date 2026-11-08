// MODBUS RTU/TCP 报文解析
(function () {
  const T = TB.util;

  function parseHex(s) {
    s = (s || '').replace(/[^0-9a-fA-F]/g, '');
    if (s.length % 2) return null;
    const a = []; for (let i = 0; i < s.length; i += 2) a.push(parseInt(s.substr(i, 2), 16));
    return a;
  }
  function hx(arr, sep) { return arr.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(sep || ' '); }

  const FUNC = {
    1: '读线圈 (Read Coils)', 2: '读离散输入 (Read Discrete Inputs)', 3: '读保持寄存器 (Read Holding Registers)',
    4: '读输入寄存器 (Read Input Registers)', 5: '写单个线圈 (Write Single Coil)', 6: '写单个寄存器 (Write Single Register)',
    15: '写多个线圈 (Write Multiple Coils)', 16: '写多个寄存器 (Write Multiple Registers)', 22: '屏蔽写寄存器', 23: '读写多个寄存器'
  };
  const EXC = {
    1: '非法功能 (ILLEGAL FUNCTION)', 2: '非法数据地址 (ILLEGAL DATA ADDRESS)', 3: '非法数据值 (ILLEGAL DATA VALUE)',
    4: '从站设备故障 (SLAVE DEVICE FAILURE)', 5: '确认 (ACKNOWLEDGE)', 6: '从站忙 (SLAVE DEVICE BUSY)',
    8: '存储奇偶性错误 (MEMORY PARITY ERROR)', 10: '不可用网关路径', 11: '网关目标无响应'
  };

  function crc16(bytes) {
    let crc = 0xFFFF;
    for (let i = 0; i < bytes.length; i++) {
      crc ^= bytes[i];
      for (let j = 0; j < 8; j++) crc = (crc & 1) ? ((crc >> 1) ^ 0xA001) : (crc >> 1);
    }
    return crc & 0xFFFF;
  }

  // 寄存器字节序 → 返回字节数组
  function reorderBytes(regs, order) {
    let bytes = [];
    regs.forEach(r => bytes.push((r >> 8) & 0xff, r & 0xff));
    const sw = (b) => [b[1], b[0]];
    if (order === 'CD') { for (let i = 0; i < bytes.length; i += 2) bytes.splice(i, 2, ...sw(bytes.slice(i, i + 2))); }
    else if (order === 'BADC') { for (let i = 0; i < bytes.length; i += 4) bytes.splice(i, 4, ...bytes.slice(i + 2, i + 4), ...bytes.slice(i, i + 2)); }
    else if (order === 'CDAB') { for (let i = 0; i < bytes.length; i += 4) bytes.splice(i, 4, bytes[i + 3], bytes[i + 2], bytes[i + 1], bytes[i]); }
    return bytes;
  }
  function decodeNumbers(regs, type, order) {
    const b = reorderBytes(regs, order);
    const out = [];
    if (type === 'uint16' || type === 'int16') {
      for (let i = 0; i + 2 <= b.length; i += 2) {
        const v = b[i] << 8 | b[i + 1];
        out.push(type === 'int16' ? ((v << 16) >> 16) : v);
      }
    } else {
      for (let i = 0; i + 4 <= b.length; i += 4) {
        const dv = new DataView(new Uint8Array(b.slice(i, i + 4)).buffer);
        if (type === 'uint32') out.push(dv.getUint32(0, false));
        else if (type === 'int32') out.push(dv.getInt32(0, false));
        else out.push(dv.getFloat32(0, false));
      }
    }
    return out;
  }

  function parse(bytes, mode) {
    if (!bytes || bytes.length < 4) return { ok: false, err: '报文过短' };
    if (mode === 'tcp') {
      if (bytes.length < 8) return { ok: false, err: 'TCP 帧至少 8 字节(MBAP)' };
      const tid = bytes[0] << 8 | bytes[1], pid = bytes[2] << 8 | bytes[3], len = bytes[4] << 8 | bytes[5], uid = bytes[6], func = bytes[7];
      const data = bytes.slice(8);
      if (pid !== 0) return { ok: false, err: '协议标识应为 0，实际 ' + pid };
      if (len !== data.length + 1) return { ok: false, err: '长度字段与实际不符' };
      return { ok: true, mode: 'tcp', tid, pid, len, uid, func, data };
    } else {
      if (bytes.length < 5) return { ok: false, err: 'RTU 帧至少 5 字节' };
      const addr = bytes[0], func = bytes[1];
      const crcCalc = crc16(bytes.slice(0, bytes.length - 2));
      const crcRecv = bytes[bytes.length - 2] | (bytes[bytes.length - 1] << 8);
      const data = bytes.slice(2, bytes.length - 2);
      const crcOk = crcCalc === crcRecv;
      return { ok: true, mode: 'rtu', addr, func, data, crcOk, crcCalc, crcRecv };
    }
  }

  // 默认样本：RTU 读保持寄存器响应 01 03 04 00 0A 01 2C [CRC]
  function buildSample() {
    const b = [0x01, 0x03, 0x04, 0x00, 0x0a, 0x01, 0x2c];
    const crc = crc16(b); b.push(crc & 0xff, (crc >> 8) & 0xff);
    return b;
  }

  TB.register({
    id: 'modbus',
    name: 'MODBUS',
    category: '协议报文解析',
    desc: 'MODBUS RTU(CRC16)/TCP(MBAP) 帧解析、功能码与异常码语义、寄存器值按 16/32 位有符号/无符号/浮点 + 字节序解释',
    render(c) {
      const input = T.el('textarea', { class: 'mono', placeholder: '粘贴 HEX' });
      const modeSel = T.el('select', {}, [T.el('option', { value: 'rtu', text: 'RTU (含 CRC16)' }), T.el('option', { value: 'tcp', text: 'TCP (MBAP)' })]);
      const out = T.el('div', { class: 'col' });
      const typeSel = T.el('select', {}, ['uint16', 'int16', 'uint32', 'int32', 'float32'].map(t => T.el('option', { value: t, text: t })));
      const orderSel = T.el('select', {}, [
        T.el('option', { value: 'AB', text: '大端 AB CD' }), T.el('option', { value: 'CD', text: '小端 CD AB' }),
        T.el('option', { value: 'BADC', text: '大端字交换 BADC' }), T.el('option', { value: 'CDAB', text: '小端字交换 CDAB' })
      ]);
      let last = null;

      function render(res) {
        out.innerHTML = '';
        if (!res.ok) { out.appendChild(T.el('div', { class: 'error', text: '解析失败：' + res.err })); return; }
        const ov = T.el('div', { class: 'kv' });
        if (res.mode === 'rtu') {
          ov.appendChild(T.el('div', { class: 'k', text: '模式' })); ov.appendChild(T.el('div', { class: 'v', text: 'RTU' }));
          ov.appendChild(T.el('div', { class: 'k', text: '从站地址' })); ov.appendChild(T.el('div', { class: 'v', text: '0x' + res.addr.toString(16).toUpperCase() }));
        } else {
          ov.appendChild(T.el('div', { class: 'k', text: '模式' })); ov.appendChild(T.el('div', { class: 'v', text: 'TCP' }));
          ov.appendChild(T.el('div', { class: 'k', text: '事务标识' })); ov.appendChild(T.el('div', { class: 'v', text: String(res.tid) }));
          ov.appendChild(T.el('div', { class: 'k', text: '单元标识' })); ov.appendChild(T.el('div', { class: 'v', text: '0x' + res.uid.toString(16).toUpperCase() }));
        }
        const isExc = (res.func & 0x80) !== 0;
        const realFunc = res.func & 0x7f;
        ov.appendChild(T.el('div', { class: 'k', text: '功能码' })); ov.appendChild(T.el('div', { class: 'v', text: '0x' + res.func.toString(16).toUpperCase() + ' ' + (isExc ? '(异常响应)' : (FUNC[realFunc] || '保留')) }));
        if (isExc) ov.appendChild(T.el('div', { class: 'k', text: '异常码' })); if (isExc) ov.appendChild(T.el('div', { class: 'v', text: (res.data[0] || 0) + ' ' + (EXC[res.data[0]] || '未知') }));
        if (res.mode === 'rtu') ov.appendChild(T.el('div', { class: 'k', text: 'CRC16' })), ov.appendChild(T.el('div', { class: 'v', text: (res.crcOk ? '✓ 正确' : '✗ 错误') + ' 计算=0x' + res.crcCalc.toString(16).toUpperCase() + ' 收到=0x' + res.crcRecv.toString(16).toUpperCase() }));
        out.appendChild(ov);

        // 数据区解释
        const d = res.data;
        if (!isExc && (realFunc === 3 || realFunc === 4 || realFunc === 6 || realFunc === 16 || realFunc === 5)) {
          const hint = T.el('div', { class: 'hint', text: '数据区' });
          if (realFunc === 3 || realFunc === 4) {
            const bc = d[0]; const regs = []; for (let i = 1; i + 2 <= d.length; i += 2) regs.push(d[i] << 8 | d[i + 1]);
            out.appendChild(hint);
            const tbl = T.el('table', {}); tbl.appendChild(T.el('tr', {}, [T.el('th', { text: '寄存器#' }), T.el('th', { text: 'HEX' }), T.el('th', { text: 'uint16' }), T.el('th', { text: 'int16' })]));
            regs.forEach((r, i) => tbl.appendChild(T.el('tr', {}, [T.el('td', { text: String(i) }), T.el('td', { class: 'mono', text: '0x' + r.toString(16).toUpperCase().padStart(4, '0') }), T.el('td', { text: String(r) }), T.el('td', { text: String((r << 16) >> 16) })])));
            out.appendChild(tbl);
          } else if (realFunc === 6 || realFunc === 5) {
            out.appendChild(hint);
            out.appendChild(T.el('div', { class: 'pre', text: hx(d) }));
          }
          // 多寄存器数值解释
          if ((realFunc === 3 || realFunc === 4) && d.length > 1) {
            out.appendChild(T.el('div', { class: 'hint', text: '数值解释（按类型/字节序）' }));
            const rrow = T.el('div', { class: 'row' }, [T.el('label', { text: '类型' }), typeSel, T.el('label', { text: '字节序' }), orderSel]);
            const res2 = T.el('div', { class: 'pre' });
            function upd() {
              const regs = []; for (let i = 1; i + 2 <= d.length; i += 2) regs.push(d[i] << 8 | d[i + 1]);
              const nums = decodeNumbers(regs, typeSel.value, orderSel.value);
              res2.textContent = nums.map(n => (typeof n === 'number' && !Number.isInteger(n)) ? n.toFixed(6) : String(n)).join('\n');
            }
            typeSel.addEventListener('change', upd); orderSel.addEventListener('change', upd); upd();
            out.appendChild(rrow); out.appendChild(res2);
          }
        } else if (isExc) {
          out.appendChild(T.el('div', { class: 'hint', text: '异常：从站拒绝执行，详见异常码。' }));
        } else {
          out.appendChild(T.el('div', { class: 'hint', text: '数据区' })); out.appendChild(T.el('div', { class: 'pre', text: hx(d) }));
        }
      }

      function run() {
        const b = parseHex(input.value);
        if (!b) { out.innerHTML = ''; out.appendChild(T.el('div', { class: 'error', text: 'HEX 格式错误' })); return; }
        const r = parse(b, modeSel.value); render(r); last = r;
      }
      input.addEventListener('input', run); modeSel.addEventListener('change', run);
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: 'MODBUS RTU / TCP 报文解析' }),
        T.el('div', { class: 'row' }, [
          T.el('label', { text: '模式' }), modeSel,
          T.el('button', { class: 'btn sm primary', text: '载入示例', onclick: () => { modeSel.value = 'rtu'; input.value = hx(buildSample()); run(); } })
        ]),
        input,
        T.el('div', { class: 'hint', text: 'RTU：地址+功能码+数据+CRC16(低字节在前)；TCP：MBAP(事务/协议/长度/单元)+功能码+数据。' }),
        out
      ]));
      input.value = hx(buildSample()); run();
    }
  });
})();
