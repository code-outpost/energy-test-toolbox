// MMS / MQTT / OPC UA 轻量结构 / Payload 解码（参考电力新能源常见的工业互联协议）
(function () {
  const T = TB.util;
  function parseHex(s) { s = (s || '').replace(/[^0-9a-fA-F]/g, ''); if (s.length % 2) return null; const a = []; for (let i = 0; i < s.length; i += 2) a.push(parseInt(s.substr(i, 2), 16)); return a; }
  function hx(arr, sep) { return arr.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(sep || ' '); }
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32le(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
  function i32le(b, o) { return b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24); }

  const MQTT_TYPE = { 1: 'CONNECT', 2: 'CONNACK', 3: 'PUBLISH', 4: 'PUBACK', 5: 'PUBREC', 6: 'PUBREL', 7: 'PUBCOMP', 8: 'SUBSCRIBE', 9: 'SUBACK', 10: 'UNSUBSCRIBE', 11: 'UNSUBACK', 12: 'PINGREQ', 13: 'PINGRESP', 14: 'DISCONNECT' };
  const OPCUA_MSG = { HEL: 'Hello', ACK: 'Acknowledge', MSG: 'Message(安全通道内应用消息)', ERR: 'Error', OPN: 'OpenSecureChannel', CLO: 'CloseSecureChannel' };

  function parseMQTT(bytes) {
    if (bytes.length < 2) return { ok: false, err: '报文过短' };
    const type = bytes[0] >> 4, dup = (bytes[0] >> 3) & 1, qos = (bytes[0] >> 1) & 3, retain = bytes[0] & 1;
    let p = 1, mult = 1, remlen = 0;
    while (p < bytes.length) { const b = bytes[p]; remlen += (b & 0x7f) * mult; mult *= 128; p++; if ((b & 0x80) === 0) break; if (p > 5) return { ok: false, err: '剩余长度编码过长' }; }
    const info = [
      { k: '控制报文类型', v: type + ' (' + (MQTT_TYPE[type] || '未知') + ')' },
      { k: 'DUP', v: String(dup) }, { k: 'QoS', v: String(qos) }, { k: 'Retain', v: String(retain) },
      { k: '剩余长度', v: String(remlen) }
    ];
    let extra = '';
    if (type === 3 && p < bytes.length) {
      const tlen = u16(bytes, p), topic = String.fromCharCode(...bytes.slice(p + 2, p + 2 + tlen));
      let payloadOff = p + 2 + tlen; if (qos > 0) payloadOff += 2;
      const payload = String.fromCharCode(...bytes.slice(payloadOff));
      extra = '主题="' + topic + '" 载荷="' + payload + '"';
    }
    return { ok: true, info, extra };
  }

  function parseOPCUA(bytes) {
    if (bytes.length < 8) return { ok: false, err: '报文过短' };
    const mt = String.fromCharCode(bytes[0], bytes[1], bytes[2]);
    const chunk = String.fromCharCode(bytes[3]);
    const size = u32le(bytes, 4);
    const scid = u32le(bytes, 8);
    const info = [
      { k: 'MessageType', v: mt + ' (' + (OPCUA_MSG[mt] || '未知') + ')' },
      { k: 'ChunkType', v: chunk + (chunk === 'F' ? ' (Final)' : chunk === 'C' ? ' (Intermediate)' : chunk === 'A' ? ' (Abort)' : '') },
      { k: 'MessageSize', v: size + ' 字节' },
      { k: 'SecureChannelId', v: String(scid) }
    ];
    let extra = '';
    if (mt === 'HEL' && bytes.length >= 16) {
      const ver = u32le(bytes, 12), recv = u32le(bytes, 16), send = u32le(bytes, 20), maxMsg = u32le(bytes, 24), maxChk = u32le(bytes, 28);
      extra = '协议版本=' + ver + ' 接收缓冲=' + recv + ' 发送缓冲=' + send + ' 最大消息=' + maxMsg + ' 最大块数=' + maxChk;
    }
    return { ok: true, info, extra };
  }

  // MMS 基于 ASN.1 BER：轻量展示 BER 结构树
  function parseBER(bytes) {
    const nodes = [];
    function walk(b, off, depth) {
      if (off >= b.length || depth > 8) return off;
      const tag = b[off]; let len = b[off + 1], l = 1;
      if (len & 0x80) { const n = len & 0x7f; len = 0; for (let i = 0; i < n; i++) len = (len << 8) | b[off + 2 + i]; l = 1 + n; }
      const vs = off + 1 + l, ve = vs + len;
      const cls = (tag & 0xc0) === 0 ? 'UNI' : (tag & 0xc0) === 0x80 ? 'CTX' : (tag & 0xc0) === 0x40 ? 'APPL' : 'PRIV';
      let content = '';
      if (len <= 8) content = hx(b.slice(vs, ve));
      nodes.push({ depth, tag: '0x' + tag.toString(16).toUpperCase(), cls, pc: (tag & 0x20) ? '构造' : '基本', len, content });
      if (tag & 0x20) { let p = vs; while (p < ve) p = walk(b, p, depth + 1); }
      return ve;
    }
    walk(bytes, 0, 0);
    return { ok: true, nodes };
  }

  function buildMQTT() { return [0x30, 0x06, 0x00, 0x02, 0x61, 0x62, 0x31, 0x32]; } // PUBLISH QoS0 topic=ab payload=12
  function buildOPCUA() { const body = [0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0x6f, 0x70, 0x63, 0x2e, 0x74]; const size = 8 + 4 + body.length; const hdr = [0x48, 0x45, 0x4c, 0x46, size & 0xff, (size >> 8) & 0xff, (size >> 16) & 0xff, (size >> 24) & 0xff, 0, 0, 0, 0]; return [...hdr, ...body]; }
  function buildBER() { return [0x60, 0x06, 0x80, 0x01, 0x01, 0x81, 0x01, 0x02]; }

  TB.register({
    id: 'mms-mqtt-opcua', name: 'MMS/MQTT/OPC UA', category: '协议报文解析',
    desc: '工业互联协议轻量解码：MQTT 固定头(类型/QoS/剩余长度)、OPC UA 二进制(MessageType/Chunk/Size)、MMS(ASN.1 BER 结构树)',
    render(c) {
      let mode = 'mqtt';
      const input = T.el('textarea', { class: 'mono', placeholder: '粘贴 HEX' });
      const out = T.el('div', { class: 'col' });
      const seg = T.el('div', { class: 'row' }, [
        T.el('button', { class: 'btn sm primary', text: 'MQTT', onclick: () => { mode = 'mqtt'; input.value = hx(buildMQTT()); input.dispatchEvent(new Event('input')); } }),
        T.el('button', { class: 'btn sm', text: 'OPC UA', onclick: () => { mode = 'opcua'; input.value = hx(buildOPCUA()); input.dispatchEvent(new Event('input')); } }),
        T.el('button', { class: 'btn sm', text: 'MMS(BER)', onclick: () => { mode = 'ber'; input.value = hx(buildBER()); input.dispatchEvent(new Event('input')); } })
      ]);
      function render(r) {
        out.innerHTML = '';
        if (!r.ok) { out.appendChild(T.el('div', { class: 'error', text: '解析失败：' + r.err })); return; }
        const kv = T.el('div', { class: 'kv' });
        r.info.forEach(f => { kv.appendChild(T.el('div', { class: 'k', text: f.k })); kv.appendChild(T.el('div', { class: 'v', text: f.v })); });
        out.appendChild(kv);
        if (r.extra) out.appendChild(T.el('div', { class: 'tag', text: r.extra }));
        if (r.nodes) {
          const tbl = T.el('table', {}); tbl.appendChild(T.el('tr', {}, [T.el('th', { text: 'Tag' }), T.el('th', { text: '类' }), T.el('th', { text: 'PC' }), T.el('th', { text: '长度' }), T.el('th', { text: '内容' })]));
          r.nodes.forEach(n => tbl.appendChild(T.el('tr', {}, [T.el('td', { class: 'mono', text: '  '.repeat(n.depth) + n.tag }), T.el('td', { text: n.cls }), T.el('td', { text: n.pc }), T.el('td', { text: String(n.len) }), T.el('td', { class: 'mono', text: n.content })])));
          out.appendChild(tbl);
        }
      }
      input.addEventListener('input', () => { const b = parseHex(input.value); if (!b) { out.innerHTML = ''; out.appendChild(T.el('div', { class: 'error', text: 'HEX 格式错误' })); return; }
        if (mode === 'mqtt') render(parseMQTT(b));
        else if (mode === 'opcua') render(parseOPCUA(b));
        else render(parseBER(b));
      });
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: 'MMS / MQTT / OPC UA 轻量解码' }),
        seg, input,
        T.el('div', { class: 'hint', text: 'MQTT=IOT 发布订阅(类型/QoS/剩余长度变长); OPC UA=工业平台二进制报文头; MMS(ISO 9506)基于 ASN.1 BER，此处做结构树展示。物联网/工业互联场景常用。' }),
        out
      ]));
      input.value = hx(buildMQTT()); input.dispatchEvent(new Event('input'));
    }
  });
})();
