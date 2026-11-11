// MODBUS TCP / RTU 报文「发送计算 + 解析」：组包 → CRC/MBAP → 预期响应 → 响应解码 → 工程值换算
// 纯离线计算；生成的报文可一键送入「设备联调」实际收发。
(function () {
  const T = TB.util;
  const BRIDGE_KEY = 'tb_bridge_frame';

  function parseHex(s) {
    const clean = String(s || '').replace(/0x/gi, '').replace(/[^0-9a-fA-F\s,;:\-]/g, ' ');
    const out = [];
    for (const p of clean.split(/[\s,;:\-]+/).filter(Boolean)) {
      if (p.length % 2) { const n = parseInt(p, 16); if (n >= 0 && n <= 255) out.push(n); }
      else for (let i = 0; i < p.length; i += 2) out.push(parseInt(p.substr(i, 2), 16));
    }
    return out.filter(n => Number.isFinite(n) && n >= 0 && n <= 255);
  }
  function hx(arr, sep) { return arr.map(b => (b & 255).toString(16).toUpperCase().padStart(2, '0')).join(sep === undefined ? ' ' : sep); }
  function u16(n) { return [(n >> 8) & 255, n & 255]; }
  function num(v, d) { const n = Number(v); return isFinite(n) ? n : d; }

  const FUNC = {
    1: '读线圈 (Read Coils)', 2: '读离散输入 (Read Discrete Inputs)', 3: '读保持寄存器 (Read Holding Registers)',
    4: '读输入寄存器 (Read Input Registers)', 5: '写单个线圈 (Write Single Coil)', 6: '写单个寄存器 (Write Single Register)',
    15: '写多个线圈 (0x0F)', 16: '写多个寄存器 (0x10)', 22: '屏蔽写寄存器 (0x16)', 23: '读写多个寄存器 (0x17)'
  };
  const EXC = {
    1: '非法功能 (ILLEGAL FUNCTION)', 2: '非法数据地址 (ILLEGAL DATA ADDRESS)', 3: '非法数据值 (ILLEGAL DATA VALUE)',
    4: '从站设备故障 (SLAVE DEVICE FAILURE)', 5: '确认 (ACKNOWLEDGE)', 6: '从站忙 (SLAVE DEVICE BUSY)',
    8: '存储奇偶性错误 (MEMORY PARITY ERROR)', 10: '不可用网关路径', 11: '网关目标无响应'
  };

  function crc16(bytes) {
    let crc = 0xFFFF;
    for (const b of bytes) {
      crc ^= (b & 255);
      for (let i = 0; i < 8; i++) crc = (crc & 1) ? ((crc >>> 1) ^ 0xA001) : (crc >>> 1);
    }
    return crc & 0xFFFF;
  }
  function appendCrc(bytes) { const c = crc16(bytes); return bytes.concat([c & 255, (c >>> 8) & 255]); }

  // 寄存器字节序（自反置换，编码 / 解码复用同一函数）
  function reorderBytes(regs, order) {
    let bytes = [];
    regs.forEach(r => bytes.push((r >> 8) & 0xff, r & 0xff));
    const sw = (b) => [b[1], b[0]];
    if (order === 'CD') { for (let i = 0; i + 2 <= bytes.length; i += 2) bytes.splice(i, 2, ...sw(bytes.slice(i, i + 2))); }
    else if (order === 'BADC') { for (let i = 0; i + 4 <= bytes.length; i += 4) bytes.splice(i, 4, ...bytes.slice(i + 2, i + 4), ...bytes.slice(i, i + 2)); }
    else if (order === 'CDAB') { for (let i = 0; i + 4 <= bytes.length; i += 4) bytes.splice(i, 4, bytes[i + 3], bytes[i + 2], bytes[i + 1], bytes[i]); }
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
    } else if (type === 'ascii') {
      out.push(b.map(x => String.fromCharCode(x)).join('').replace(/\0+$/, ''));
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
  // 工程值 → 寄存器数组：先按 (v − offset) / scale 得原码，再按类型与字节序拆成 16 位寄存器
  function encodeValue(v, type, order, scale, offset) {
    const raw = (num(v, NaN) - num(offset, 0)) / (num(scale, 1) || 1);
    if (!isFinite(raw)) return null;
    let be;
    if (type === 'uint16' || type === 'int16') {
      if (type === 'uint16' && (raw < 0 || raw > 65535)) return null;
      if (type === 'int16' && (raw < -32768 || raw > 32767)) return null;
      const dv = new DataView(new ArrayBuffer(2));
      type === 'int16' ? dv.setInt16(0, Math.round(raw), false) : dv.setUint16(0, Math.round(raw), false);
      be = Array.from(new Uint8Array(dv.buffer));
    } else if (type === 'ascii') {
      const s = String(v); be = [];
      for (let i = 0; i < s.length; i++) be.push(s.charCodeAt(i) & 255);
      if (be.length % 2) be.push(0);
    } else {
      const dv = new DataView(new ArrayBuffer(4));
      if (type === 'uint32') dv.setUint32(0, Math.round(raw) >>> 0, false);
      else if (type === 'int32') dv.setInt32(0, Math.round(raw), false);
      else dv.setFloat32(0, raw, false);
      be = Array.from(new Uint8Array(dv.buffer));
    }
    const regsBE = [];
    for (let i = 0; i + 2 <= be.length; i += 2) regsBE.push(be[i] << 8 | be[i + 1]);
    const b = reorderBytes(regsBE, order);
    const out = [];
    for (let i = 0; i + 2 <= b.length; i += 2) out.push(b[i] << 8 | b[i + 1]);
    return out;
  }

  // 解析十六进制数值列表：支持 "1,0,1,1"、"0xFF00 0x0000"、"12.5, 33.2"
  function parseValues(s, type) {
    return String(s || '').split(/[\s,;]+/).filter(Boolean).map(t => {
      if (type === 'coil') return /^(1|on|true|合)$/i.test(t) ? 1 : (/^(0|off|false|分)$/i.test(t) ? 0 : (num(t, 0) ? 1 : 0));
      if (/^0x/i.test(t)) return parseInt(t.slice(2), 16);
      return num(t, NaN);
    });
  }

  // 组包：返回 {ok, hex, bytes, pdu, expect, note}
  function build(cfg) {
    const o = cfg || {};
    const mode = o.mode === 'rtu' ? 'rtu' : 'tcp';
    const func = Math.round(num(o.func, 3));
    const addr = Math.round(num(o.addr, 0));
    const count = Math.round(num(o.count, 1));
    if (func < 1 || func > 127) return { ok: false, error: '功能码需在 1–127' };
    if (addr < 0 || addr > 65535) return { ok: false, error: '起始地址需在 0–65535' };
    let pdu = [func].concat(u16(addr));
    let expect = 0, note = '';
    if (func === 1 || func === 2 || func === 3 || func === 4) {
      if (count < 1 || count > (func <= 2 ? 2000 : 125)) return { ok: false, error: '数量超出功能码上限（线圈 2000 / 寄存器 125）' };
      pdu = pdu.concat(u16(count));
      expect = 2 + (func <= 2 ? Math.ceil(count / 8) : count * 2);
      note = func <= 2 ? '响应：字节数 + ' + Math.ceil(count / 8) + ' 字节位串（bit0 对应起始地址）'
        : '响应：字节数 + ' + count + ' 个寄存器（' + (count * 2) + ' 字节）';
    } else if (func === 5 || func === 6) {
      const vals = (o.type === 'ascii' && func === 6) ? [String(o.values || '')]
        : parseValues(o.values, func === 5 ? 'coil' : o.type);
      const v = vals.length ? vals[0] : (func === 5 ? 1 : 0);
      if (func === 5) pdu = pdu.concat(u16(v ? 0xFF00 : 0x0000));
      else {
        const regs = encodeValue(v, o.type || 'uint16', o.order || 'AB', o.scale, o.offset);
        if (!regs || !regs.length) return { ok: false, error: '写入值无法按所选类型编码（检查值域 / 系数）' };
        pdu = pdu.concat(u16(regs[0]));
      }
      expect = 5; note = '响应：回显功能码 + 地址 + 写入值（PDU 共 5 字节）';
    } else if (func === 15) {
      const bits = parseValues(o.values, 'coil');
      if (!bits.length) return { ok: false, error: '写多线圈需填线圈值，如 1,0,1,1' };
      if (bits.length > 1968) return { ok: false, error: '一次最多写 1968 个线圈' };
      const packed = [];
      for (let i = 0; i < bits.length; i += 8) {
        let b = 0; for (let j = 0; j < 8 && i + j < bits.length; j++) if (bits[i + j]) b |= (1 << j);
        packed.push(b);
      }
      pdu = pdu.concat(u16(bits.length), [packed.length], packed);
      expect = 5; note = '响应：回显功能码 + 地址 + 写入线圈数（PDU 共 5 字节）';
    } else if (func === 16) {
      const vals = o.type === 'ascii' ? [String(o.values || '')] : parseValues(o.values, o.type);
      const regs = [];
      for (const v of vals) {
        const r = encodeValue(v, o.type || 'uint16', o.order || 'AB', o.scale, o.offset);
        if (!r) return { ok: false, error: '写入值无法按所选类型编码：' + v };
        regs.push.apply(regs, r);
      }
      if (!regs.length || regs.length > 123) return { ok: false, error: '写多寄存器需 1–123 个寄存器' };
      const data = [];
      regs.forEach(r => data.push.apply(data, u16(r)));
      pdu = pdu.concat(u16(regs.length), [data.length], data);
      expect = 5; note = '响应：回显功能码 + 地址 + 写入寄存器数（PDU 共 5 字节）';
    } else {
      return { ok: false, error: '功能码 ' + func + ' 的组包暂不支持，可粘贴原始 HEX 进行解析' };
    }
    let bytes;
    if (mode === 'tcp') {
      const len = pdu.length + 1; // UID(1) + PDU
      const tid = Math.round(num(o.tid, 1)) & 0xFFFF;
      bytes = u16(tid).concat([0, 0], u16(len), [Math.round(num(o.uid, 1)) & 255], pdu);
      note += '；MBAP 长度 L=' + len + '（单元标识 1 + PDU ' + pdu.length + '）';
    } else {
      bytes = appendCrc([Math.round(num(o.slave, 1)) & 255].concat(pdu));
      note += '；CRC16-MODBUS 低字节在前，已自动追加';
    }
    return { ok: true, mode, func, bytes, pdu, hex: hx(bytes), expect, note };
  }

  // 解析帧（TCP MBAP / RTU CRC）
  function parse(bytes, mode) {
    if (!bytes || bytes.length < 4) return { ok: false, err: '报文过短' };
    if (mode === 'tcp') {
      if (bytes.length < 8) return { ok: false, err: 'TCP 帧至少 8 字节（MBAP 7 + 功能码 1）' };
      const tid = bytes[0] << 8 | bytes[1], pid = bytes[2] << 8 | bytes[3], len = bytes[4] << 8 | bytes[5], uid = bytes[6], func = bytes[7];
      const data = bytes.slice(8);
      if (pid !== 0) return { ok: false, err: '协议标识应为 0，实际 ' + pid };
      // MBAP LEN = UID(1) + FUNC(1) + DATA，故应为 data.length + 2（旧版误写为 +1，会误判所有合法帧）
      if (len !== data.length + 2) return { ok: false, err: '长度字段 L=' + len + ' 与实际不符（应为 ' + (data.length + 2) + '）' };
      return { ok: true, mode: 'tcp', tid, pid, len, uid, func, data };
    }
    if (bytes.length < 5) return { ok: false, err: 'RTU 帧至少 5 字节' };
    const addr = bytes[0], func = bytes[1];
    const crcCalc = crc16(bytes.slice(0, bytes.length - 2));
    const crcRecv = bytes[bytes.length - 2] | (bytes[bytes.length - 1] << 8);
    return { ok: true, mode: 'rtu', addr, func, data: bytes.slice(2, bytes.length - 2), crcOk: crcCalc === crcRecv, crcCalc, crcRecv };
  }

  // 从响应数据区提取寄存器 / 位值，并换算工程值
  function responseValues(res, type, order, scale, offset) {
    if (!res || !res.ok) return null;
    const isExc = (res.func & 0x80) !== 0;
    if (isExc) return { kind: 'exception', code: res.data[0] || 0, text: EXC[res.data[0]] || '未知异常码' };
    const real = res.func & 0x7f, d = res.data || [];
    if (real === 1 || real === 2) {
      const bits = [];
      for (let i = 1; i < d.length; i++) for (let j = 0; j < 8; j++) bits.push((d[i] >> j) & 1);
      return { kind: 'bits', bits, byteCount: d[0] || 0 };
    }
    if (real === 3 || real === 4) {
      const regs = [];
      for (let i = 1; i + 2 <= d.length; i += 2) regs.push(d[i] << 8 | d[i + 1]);
      const raw = decodeNumbers(regs, type, order);
      const s = num(scale, 1) || 1, ofs = num(offset, 0);
      const eng = raw.map(v => typeof v === 'number' ? v * s + ofs : v);
      return { kind: 'regs', regs, raw, eng, byteCount: d[0] || 0 };
    }
    if (real === 5 || real === 6 || real === 15 || real === 16) {
      const regs = [];
      for (let i = 2; i + 2 <= d.length; i += 2) regs.push(d[i] << 8 | d[i + 1]);
      return { kind: 'echo', regs, addr: (d[0] << 8 | d[1]) };
    }
    return { kind: 'raw', bytes: d };
  }

  function buildSample() {
    const b = [0x01, 0x03, 0x04, 0x00, 0x0a, 0x01, 0x2c];
    return appendCrc(b);
  }
  function sampleTCP() {
    // MBAP LEN=7 = UID(1) + FUNC(1) + 数据(5)；数据 = 字节数 04 + 两个寄存器 000A / 012C
    return [0x00, 0x01, 0x00, 0x00, 0x00, 0x07, 0x01, 0x03, 0x04, 0x00, 0x0a, 0x01, 0x2c];
  }

  // 纯函数导出，便于 Node 回归测试直接调用
  TB.modbustcp = { parseHex, hx, crc16, appendCrc, build, parse, decodeNumbers, encodeValue, responseValues, reorderBytes, FUNC, EXC };

  function sendToBridge(hex, mode) {
    try { localStorage.setItem(BRIDGE_KEY, JSON.stringify({ hex, mode: mode === 'rtu' ? 'serial' : 'modbus', at: Date.now() })); } catch (e) {}
    if (typeof location !== 'undefined' && location.hash !== undefined) location.hash = '#/m/device-bridge';
  }

  TB.register({
    id: 'modbus', name: 'MODBUS TCP / RTU 报文计算', category: '协议报文解析',
    desc: 'Modbus TCP(MBAP)/RTU(CRC16) 请求组包与发送计算、功能码 01/02/03/04/05/06/0F/10、写入值按类型与字节序编码、响应解码与工程值换算；可一键送入设备联调。',
    accepts: ['*'],
    tips: [
      '「发送计算」负责生成请求报文并给出预期响应长度；「设备联调」负责实际收发',
      '写寄存器时按 工程值 = 原码 × 系数 + 偏移 反算原码，再按类型/字节序拆成 16 位寄存器',
      'TCP 的 MBAP 长度 = 单元标识(1) + 功能码(1) + 数据；RTU 末尾自动追加 CRC16（低字节在前）',
      '线圈写入：单线圈 ON=FF00 / OFF=0000；多线圈按 bit0 起逐位打包'
    ],
    ref: [
      { k: 'MBAP', v: '事务ID(2) + 协议ID(2)=0 + 长度(2) + 单元ID(1)' },
      { k: 'PDU', v: '功能码(1) + 数据；读请求为 起始地址(2) + 数量(2)' },
      { k: 'CRC', v: 'CRC16-MODBUS 多项式 0xA001，初值 0xFFFF，低字节先发' },
      { k: '字节序', v: 'AB 大端 / CD 小端 / BADC 字交换 / CDAB 全反转' }
    ],
    refs: [
      'Modbus Application Protocol V1.1b3：MBAP 头、PDU 与功能码 01–0x10 定义',
      'Modbus over Serial Line V1.02：RTU 帧 CRC16（多项式 0xA001，初值 0xFFFF）',
      'IEEE 754 单精度浮点按 2 个 16 位寄存器传输，字节序由设备手册决定'
    ],
    limits: [
      'TCP 长度字段只校验本机计算值，真实设备可能因分包/粘包需要按 MBAP 逐帧切分',
      '系数、偏移、字节序与寄存器地址由设备点表决定，本工具不替你核对现场配置',
      '遥控/写寄存器类操作会真实改变设备状态，请先用只读功能码确认地址后再下发',
      '功能码 22/23 与自定义功能仅支持原始 HEX 解析，不自动生成请求'
    ],
    render(c, ctx) {
      // ---------- 发送计算（组包） ----------
      const modeSel = T.el('select', { id: 'mb_mode', 'aria-label': '链路模式' }, [
        T.el('option', { value: 'tcp', text: 'Modbus TCP（MBAP）' }),
        T.el('option', { value: 'rtu', text: 'Modbus RTU（CRC16）' })
      ]);
      const funcSel = T.el('select', { id: 'mb_func', 'aria-label': '功能码' },
        Object.keys(FUNC).map(k => T.el('option', { value: k, text: '0x' + Number(k).toString(16).toUpperCase().padStart(2, '0') + ' ' + FUNC[k] })));
      funcSel.value = '3';
      function field(label, val, id, type) {
        const inp = T.el('input', { type: type || 'text', id, value: val, 'aria-label': label });
        return { wrap: T.el('div', { class: 'field' }, [T.el('label', { text: label }), inp]), inp };
      }
      const tid = field('事务 ID', '1', 'mb_tid', 'number');
      const uid = field('单元 ID (TCP)', '1', 'mb_uid', 'number');
      const slave = field('从站地址 (RTU)', '1', 'mb_slave', 'number');
      const addr = field('起始地址', '0', 'mb_addr', 'number');
      const count = field('数量（读）', '10', 'mb_count', 'number');
      const values = field('写入值（写）', '1', 'mb_values');
      const scale = field('系数 scale', '1', 'mb_scale');
      const offset = field('偏移 offset', '0', 'mb_offset');
      const typeSel = T.el('select', { id: 'mb_type', 'aria-label': '数据类型' },
        ['uint16', 'int16', 'uint32', 'int32', 'float32', 'ascii'].map(t => T.el('option', { value: t, text: t })));
      const orderSel = T.el('select', { id: 'mb_order', 'aria-label': '字节序' }, [
        T.el('option', { value: 'AB', text: '大端 AB CD' }), T.el('option', { value: 'CD', text: '小端 CD AB' }),
        T.el('option', { value: 'BADC', text: '大端字交换 BADC' }), T.el('option', { value: 'CDAB', text: '小端字交换 CDAB' })
      ]);
      const reqOut = T.el('div', { class: 'col', id: 'mb_req' });
      let lastHex = '';

      function cfg() {
        return {
          mode: modeSel.value || 'tcp', func: num(funcSel.value, 3), addr: num(addr.inp.value, 0),
          count: num(count.inp.value, 1), values: values.inp.value, type: typeSel.value || 'uint16',
          order: orderSel.value || 'AB', scale: num(scale.inp.value, 1), offset: num(offset.inp.value, 0),
          tid: num(tid.inp.value, 1), uid: num(uid.inp.value, 1), slave: num(slave.inp.value, 1)
        };
      }
      function runBuild() {
        reqOut.innerHTML = '';
        const f = (funcSel.value || '3');
        const isWrite = ['5', '6', '15', '16'].indexOf(f) >= 0;
        const isRead = ['1', '2', '3', '4'].indexOf(f) >= 0;
        const set = (el, on) => { if (el && el.wrap && el.wrap.style) el.wrap.style.display = on ? '' : 'none'; };
        set(count, isRead); set(values, isWrite); set(scale, isWrite); set(offset, isWrite);
        set(tid, (modeSel.value || 'tcp') === 'tcp'); set(uid, (modeSel.value || 'tcp') === 'tcp');
        set(slave, modeSel.value === 'rtu');
        const r = build(cfg());
        if (!r.ok) { reqOut.appendChild(T.el('div', { class: 'error', text: '组包失败：' + r.error })); return; }
        lastHex = r.hex;
        const kv = T.el('div', { class: 'kv' });
        const add = (k, v) => { kv.appendChild(T.el('div', { class: 'k', text: k })); kv.appendChild(T.el('div', { class: 'v', text: String(v) })); };
        add('模式', r.mode === 'tcp' ? 'Modbus TCP' : 'Modbus RTU');
        add('功能码', '0x' + r.func.toString(16).toUpperCase().padStart(2, '0') + '  ' + (FUNC[r.func] || ''));
        add('PDU HEX', hx(r.pdu));
        add('预期响应 PDU', r.expect + ' 字节（不含 MBAP / CRC）');
        add('说明', r.note);
        reqOut.appendChild(kv);
        reqOut.appendChild(T.el('div', { class: 'hint', text: '完整请求报文 HEX' }));
        reqOut.appendChild(T.el('div', { class: 'pre mono', id: 'mb_req_hex', text: r.hex }));
        reqOut.appendChild(T.el('div', { class: 'row' }, [
          T.copyBtn(() => lastHex),
          T.el('button', { class: 'btn sm ghost', text: '发布报文到中转站', onclick: () => {
            if (TB.bus) TB.bus.publish('modbus', 'Modbus 请求 0x' + r.func.toString(16).toUpperCase(), r.hex, 'HEX');
          } }),
          T.el('button', { class: 'btn sm primary', text: '送入设备联调 →', onclick: () => sendToBridge(r.hex, r.mode) }),
          T.el('button', { class: 'btn sm ghost', text: '填入下方解析', onclick: () => {
            parseInp.value = r.hex; parseMode.value = r.mode; runParse();
          } })
        ]));
      }
      [modeSel, funcSel, typeSel, orderSel].forEach(e => { e.addEventListener('change', runBuild); e.addEventListener('input', runBuild); });
      [tid, uid, slave, addr, count, values, scale, offset].forEach(f => f.inp.addEventListener('input', runBuild));

      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '① 报文发送计算（请求组包）' }),
        T.el('div', { class: 'form-grid' }, [
          T.el('div', { class: 'field' }, [T.el('label', { text: '链路模式' }), modeSel]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '功能码' }), funcSel]),
          tid.wrap, uid.wrap, slave.wrap, addr.wrap, count.wrap, values.wrap,
          T.el('div', { class: 'field' }, [T.el('label', { text: '数值类型' }), typeSel]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '寄存器字节序' }), orderSel]),
          scale.wrap, offset.wrap
        ]),
        T.el('div', { class: 'hint', text: '写功能码：单个值填一个；0F/10 可填多个值（逗号或空格分隔）。工程值按 (值 − 偏移) / 系数 反算原码。' }),
        reqOut
      ]));

      // ---------- 响应解析 + 工程值换算 ----------
      const parseMode = T.el('select', { id: 'mb_pmode', 'aria-label': '解析模式' }, [
        T.el('option', { value: 'tcp', text: 'TCP（MBAP）' }), T.el('option', { value: 'rtu', text: 'RTU（CRC16）' })
      ]);
      const parseInp = T.el('textarea', { class: 'mono', id: 'mb_resp', rows: '3', placeholder: '粘贴响应 HEX，如 00 01 00 00 00 09 01 03 04 00 0A 01 2C' });
      const respOut = T.el('div', { class: 'col', id: 'mb_resp_out' });
      let paintLatest = null; // 类型/字节序控件只注册一次监听，避免每次解析重复叠加
      const decType = T.el('select', { id: 'mb_dtype', 'aria-label': '响应数值类型' },
        ['uint16', 'int16', 'uint32', 'int32', 'float32', 'ascii'].map(t => T.el('option', { value: t, text: t })));
      const decOrder = T.el('select', { id: 'mb_dorder', 'aria-label': '响应字节序' }, [
        T.el('option', { value: 'AB', text: '大端 AB CD' }), T.el('option', { value: 'CD', text: '小端 CD AB' }),
        T.el('option', { value: 'BADC', text: '大端字交换 BADC' }), T.el('option', { value: 'CDAB', text: '小端字交换 CDAB' })
      ]);
      const decScale = field('系数 scale', '1', 'mb_dscale');
      const decOffset = field('偏移 offset', '0', 'mb_doffset');

      function runParse() {
        respOut.innerHTML = '';
        const b = parseHex(parseInp.value);
        if (!b.length) { respOut.appendChild(T.el('div', { class: 'error', text: 'HEX 格式错误' })); return; }
        const r = parse(b, parseMode.value || 'tcp');
        if (!r.ok) { respOut.appendChild(T.el('div', { class: 'error', text: '解析失败：' + r.err })); return; }
        const kv = T.el('div', { class: 'kv' });
        const add = (k, v) => { kv.appendChild(T.el('div', { class: 'k', text: k })); kv.appendChild(T.el('div', { class: 'v', text: String(v) })); };
        if (r.mode === 'tcp') { add('模式', 'TCP'); add('事务 ID', r.tid); add('协议 ID', r.pid); add('MBAP 长度', r.len); add('单元 ID', r.uid); }
        else { add('模式', 'RTU'); add('从站地址', '0x' + r.addr.toString(16).toUpperCase()); add('CRC16', (r.crcOk ? '✓ 正确' : '✗ 错误') + ' 计算=0x' + r.crcCalc.toString(16).toUpperCase() + ' 收到=0x' + r.crcRecv.toString(16).toUpperCase()); }
        const isExc = (r.func & 0x80) !== 0, real = r.func & 0x7f;
        add('功能码', '0x' + r.func.toString(16).toUpperCase() + '  ' + (isExc ? '(异常响应)' : (FUNC[real] || '保留')));
        if (isExc) add('异常码', (r.data[0] || 0) + ' ' + (EXC[r.data[0]] || '未知'));
        respOut.appendChild(kv);
        respOut.appendChild(T.el('div', { class: 'row' }, [
          T.el('label', { text: '类型' }), decType, T.el('label', { text: '字节序' }), decOrder,
          decScale.wrap, decOffset.wrap
        ]));
        const valsBox = T.el('div', { class: 'col', id: 'mb_vals' });
        respOut.appendChild(valsBox);
        function paintVals() {
          valsBox.innerHTML = '';
          const v = responseValues(r, decType.value || 'uint16', decOrder.value || 'AB', num(decScale.inp.value, 1), num(decOffset.inp.value, 0));
          if (!v) { valsBox.appendChild(T.el('div', { class: 'hint', text: '无数据区' })); return; }
          if (v.kind === 'exception') { valsBox.appendChild(T.el('div', { class: 'error', text: '异常：' + v.text })); return; }
          if (v.kind === 'bits') {
            valsBox.appendChild(T.el('div', { class: 'hint', text: '位值（bit0 = 起始地址，共 ' + v.bits.length + ' 位）' }));
            valsBox.appendChild(T.el('div', { class: 'pre', text: v.bits.map((x, i) => i + ':' + x).join('  ') }));
            return;
          }
          if (v.kind === 'echo') {
            valsBox.appendChild(T.el('div', { class: 'hint', text: '写操作确认：地址 ' + v.addr + '，值寄存器 ' + v.regs.join(', ') }));
            return;
          }
          if (v.kind !== 'regs') { valsBox.appendChild(T.el('div', { class: 'pre', text: hx(v.bytes || []) })); return; }
          const tbl = T.el('table', { class: 'data-table' });
          tbl.appendChild(T.el('tr', {}, ['寄存器#', 'HEX', '原码', '工程值'].map(t => T.el('th', { text: t }))));
          v.regs.forEach((reg, i) => tbl.appendChild(T.el('tr', {}, [
            T.el('td', { text: String(i) }), T.el('td', { class: 'mono', text: '0x' + reg.toString(16).toUpperCase().padStart(4, '0') }),
            T.el('td', { class: 'mono', text: String(v.raw[i] !== undefined ? v.raw[i] : reg) }),
            T.el('td', { class: 'mono', text: String(v.eng[i] !== undefined ? v.eng[i] : '') })
          ])));
          valsBox.appendChild(T.el('div', { class: 'hint', text: '寄存器 / 解码结果（工程值 = 原码 × 系数 + 偏移）' }));
          valsBox.appendChild(T.el('div', { class: 'table-wrap' }, [tbl]));
        }
        paintLatest = paintVals;
        paintVals();
      }
      [decType, decOrder].forEach(e => {
        const upd = () => { if (paintLatest) paintLatest(); };
        e.addEventListener('change', upd); e.addEventListener('input', upd);
      });
      [decScale.inp, decOffset.inp].forEach(e => e.addEventListener('input', () => { if (paintLatest) paintLatest(); }));
      parseInp.addEventListener('input', runParse);
      parseMode.addEventListener('change', runParse);

      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '② 响应解析与工程值换算' }),
        T.el('div', { class: 'row' }, [
          parseMode,
          T.el('button', { class: 'btn sm ghost', text: 'RTU 示例', onclick: () => { parseMode.value = 'rtu'; parseInp.value = hx(buildSample()); runParse(); } }),
          T.el('button', { class: 'btn sm ghost', text: 'TCP 示例', onclick: () => { parseMode.value = 'tcp'; parseInp.value = hx(sampleTCP()); runParse(); } }),
          T.el('button', { class: 'btn sm ghost', text: '清空', onclick: () => { parseInp.value = ''; runParse(); } })
        ]),
        parseInp,
        T.el('div', { class: 'hint', text: 'RTU：地址 + 功能码 + 数据 + CRC16(低在前)；TCP：MBAP(事务/协议/长度/单元) + 功能码 + 数据。' }),
        respOut
      ]));

      // ---------- 原始帧字段速览（保留原有能力） ----------
      const quickInp = T.el('textarea', { class: 'mono', id: 'mb_quick', rows: '3', placeholder: '粘贴任意 Modbus 帧 HEX，查看逐字段解释' });
      const quickMode = T.el('select', { id: 'mb_qmode' }, [
        T.el('option', { value: 'tcp', text: 'TCP' }), T.el('option', { value: 'rtu', text: 'RTU' })
      ]);
      const quickOut = T.el('div', { class: 'col' });
      function runQuick() {
        quickOut.innerHTML = '';
        const b = parseHex(quickInp.value);
        if (!b.length) { quickOut.appendChild(T.el('div', { class: 'error', text: 'HEX 格式错误' })); return; }
        const r = parse(b, quickMode.value || 'tcp');
        if (!r.ok) { quickOut.appendChild(T.el('div', { class: 'error', text: r.err })); return; }
        const kv = T.el('div', { class: 'kv' });
        const add = (k, v) => { kv.appendChild(T.el('div', { class: 'k', text: k })); kv.appendChild(T.el('div', { class: 'v', text: String(v) })); };
        if (r.mode === 'tcp') { add('事务 / 协议 / 长度', r.tid + ' / ' + r.pid + ' / ' + r.len); add('单元 ID', r.uid); }
        else { add('从站地址', r.addr); add('CRC16', r.crcOk ? '✓ 正确' : '✗ 错误'); }
        add('功能码', '0x' + r.func.toString(16).toUpperCase() + ' ' + (FUNC[r.func & 0x7f] || '保留'));
        add('数据区 HEX', hx(r.data) || '（空）');
        quickOut.appendChild(kv);
      }
      quickInp.addEventListener('input', runQuick);
      quickMode.addEventListener('change', runQuick);
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '③ 任意帧字段速览' }),
        T.el('div', { class: 'row' }, [quickMode,
          T.el('button', { class: 'btn sm ghost', text: '载入示例', onclick: () => { quickMode.value = 'rtu'; quickInp.value = hx(buildSample()); runQuick(); } })]),
        quickInp, quickOut
      ]));

      if (ctx && ctx.aside) {
        ctx.aside.appendChild(T.el('div', { class: 'aside-card' }, [
          T.el('div', { class: 'aside-title' }, [T.el('span', { class: 'dot' }), T.el('span', { text: '常用功能码' })]),
          T.el('div', { class: 'ref-list' }, Object.keys(FUNC).slice(0, 8).map(k => T.el('div', { class: 'ref-row' }, [
            T.el('span', { class: 'rk', text: '0x' + Number(k).toString(16).toUpperCase().padStart(2, '0') }),
            T.el('span', { class: 'rv', text: FUNC[k] })
          ])))
        ]));
      }

      runBuild();
      parseMode.value = 'tcp';
      parseInp.value = hx(sampleTCP());
      runParse();
      if (TB.bus && TB.bus.consume) {
        const p = TB.bus.consume('modbus', [{ el: addr.inp, family: '*', label: '起始地址' }]);
        if (p && p.filled) runBuild();
      }
    }
  });
})();
