// GOOSE (IEC 61850-8-1) 报文解析：二层帧 + ASN.1 BER 头部字段 + stNum/sqNum 事件判定
(function () {
  const T = TB.util;
  function parseHex(s) { s = (s || '').replace(/[^0-9a-fA-F]/g, ''); if (s.length % 2) return null; const a = []; for (let i = 0; i < s.length; i += 2) a.push(parseInt(s.substr(i, 2), 16)); return a; }
  function hx(arr, sep) { return arr.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(sep || ' '); }

  function ber(buf, off) {
    const tag = buf[off]; let len = buf[off + 1], l = 1;
    if (len & 0x80) { const n = len & 0x7f; len = 0; for (let i = 0; i < n; i++) len = (len << 8) | buf[off + 2 + i]; l = 1 + n; }
    const vs = off + 1 + l; return { tag, len, vs, ve: vs + len, next: vs + len };
  }
  function readInt(buf, off, len) { let v = 0; for (let i = 0; i < len; i++) v = (v << 8) | buf[off + i]; return v; }
  function decodeUTC(b) {
    const year = b[0] << 8 | b[1], mon = b[2], day = b[3], hr = b[4], min = b[5], sec = b[6], frac = b[7];
    return `${2000 + 0}`.length ? `${year}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(Math.round(frac / 256 * 1000)).padStart(3, '0')}` : '';
  }

  const FIELD = {
    0x80: 'gocbRef', 0x81: 'timeAllowedToLive', 0x82: 'datSet', 0x83: 'goID', 0x84: 'T(时标)',
    0x85: 'stNum', 0x86: 'sqNum', 0x87: 'simulation', 0x88: 'confRev', 0x89: 'ndsCom', 0x8A: 'numDatSetEntries', 0xAB: '数据集值(data)'
  };

  function parse(bytes) {
    if (bytes.length < 14) return { ok: false, err: '报文过短' };
    const dst = bytes.slice(0, 6), src = bytes.slice(6, 12);
    let off = 12;
    let vlan = null;
    if (bytes[off] === 0x81 && bytes[off + 1] === 0x00) { vlan = bytes[off + 2] << 8 | bytes[off + 3]; off += 4; }
    if (bytes[off] !== 0x88 || bytes[off + 1] !== 0xb8) return { ok: false, err: 'EtherType 应为 0x88B8(GOOSE)，实际 0x' + hx(bytes.slice(off, off + 2)).replace(/ /g, '') };
    off += 2;
    const pdu = ber(bytes, off);
    if (pdu.tag !== 0x60) return { ok: false, err: 'GOOSE APDU 标签应为 0x60，实际 0x' + pdu.tag.toString(16) };
    const fields = []; let p = pdu.vs; let stNum = null, sqNum = null, confRev = null;
    while (p < pdu.ve) {
      const e = ber(bytes, p);
      const name = FIELD[e.tag] || ('0x' + e.tag.toString(16));
      let val;
      if (e.tag === 0x80 || e.tag === 0x82 || e.tag === 0x83) val = String.fromCharCode(...bytes.slice(e.vs, e.ve));
      else if (e.tag === 0x84) val = decodeUTC(bytes.slice(e.vs, e.ve)) + '  (原值 ' + hx(bytes.slice(e.vs, e.ve)) + ')';
      else if (e.tag === 0x87 || e.tag === 0x89) val = bytes[e.vs] ? 'TRUE' : 'FALSE';
      else if (e.tag === 0xAB) { val = hx(bytes.slice(e.vs, e.ve)); var dataHex = hx(bytes.slice(e.vs, e.ve)); }
      else val = readInt(bytes, e.vs, e.len) + '  (0x' + bytes.slice(e.vs, e.ve).toString ? '0x' + hx(bytes.slice(e.vs, e.ve)).replace(/ /g, '') : '';
      if (e.tag === 0x85) stNum = readInt(bytes, e.vs, e.len);
      if (e.tag === 0x86) sqNum = readInt(bytes, e.vs, e.len);
      if (e.tag === 0x88) confRev = readInt(bytes, e.vs, e.len);
      fields.push({ tag: '0x' + e.tag.toString(16).toUpperCase(), name, val });
      p = e.next;
    }
    return { ok: true, dst: hx(dst, ':'), src: hx(src, ':'), vlan, fields, stNum, sqNum, confRev, dataHex: typeof dataHex !== 'undefined' ? dataHex : '' };
  }

  // 默认样本（含 VLAN 标签）
  function buildSample() {
    const str = (s) => Array.from(s).map(c => c.charCodeAt(0));
    const tlv = (tag, bytes) => [tag, bytes.length].concat(bytes);
    const data = [].concat(
      tlv(0x80, str('gocb1')),
      tlv(0x81, [0x0A]),
      tlv(0x82, str('ds1')),
      tlv(0x83, str('go1')),
      tlv(0x84, [0x07, 0xEA, 0x0B, 0x04, 0x07, 0x1E, 0x00, 0x00]),
      tlv(0x85, [0x01]), tlv(0x86, [0x00]), tlv(0x87, [0x00]), tlv(0x88, [0x01]), tlv(0x89, [0x00]), tlv(0x8A, [0x02]),
      tlv(0xAB, [0x83, 0x01, 0x01, 0x83, 0x01, 0x00])
    );
    const pdu = [0x60, data.length].concat(data);
    const dst = [0x01, 0x0C, 0xCD, 0x01, 0x00, 0x01], src = [0x00, 0x11, 0x22, 0x33, 0x44, 0x55];
    return [].concat(dst, src, [0x81, 0x00, 0x00, 0x00, 0x88, 0xB8], pdu);
  }

  TB.register({
    id: 'goose', name: 'GOOSE', category: '协议报文解析',
    desc: 'IEC 61850 GOOSE 二层帧解析（gocbRef/datSet/goID/stNum/sqNum/Test/ConfRev）+ stNum/sqNum 变化事件判定',
    render(c) {
      const input = T.el('textarea', { class: 'mono', placeholder: '粘贴 GOOSE 帧 HEX（含以太网头）' });
      const out = T.el('div', { class: 'col' });
      function render(r) {
        out.innerHTML = '';
        if (!r.ok) { out.appendChild(T.el('div', { class: 'error', text: '解析失败：' + r.err })); return; }
        const ov = T.el('div', { class: 'kv' });
        ov.appendChild(T.el('div', { class: 'k', text: '目的 MAC' })); ov.appendChild(T.el('div', { class: 'v', text: r.dst + (r.dst.startsWith('01:0C:CD') ? ' (组播)' : '') }));
        ov.appendChild(T.el('div', { class: 'k', text: '源 MAC' })); ov.appendChild(T.el('div', { class: 'v', text: r.src }));
        if (r.vlan != null) ov.appendChild(T.el('div', { class: 'k', text: 'VLAN/VID' })), ov.appendChild(T.el('div', { class: 'v', text: String(r.vlan & 0x0fff) }));
        out.appendChild(ov);
        const tbl = T.el('table', {}); tbl.appendChild(T.el('tr', {}, [T.el('th', { text: 'Tag' }), T.el('th', { text: '字段' }), T.el('th', { text: '值' })]));
        r.fields.forEach(f => tbl.appendChild(T.el('tr', {}, [T.el('td', { class: 'mono', text: f.tag }), T.el('td', { text: f.name }), T.el('td', { class: 'mono', text: f.val })])));
        out.appendChild(tbl);
        const ev = (r.stNum != null) ? `stNum=${r.stNum}, sqNum=${r.sqNum}` + (r.stNum > 1 ? '  → 状态变化/事件' : '  → 首帧/稳态') : '';
        out.appendChild(T.el('div', { class: 'tag', text: ev }));
        if (r.dataHex) out.appendChild(T.el('div', { class: 'hint', text: '数据集原始值（需结合数据集定义解读每个成员）' })), out.appendChild(T.el('div', { class: 'pre', text: r.dataHex }));
      }
      input.addEventListener('input', () => { const b = parseHex(input.value); if (!b) { out.innerHTML = ''; out.appendChild(T.el('div', { class: 'error', text: 'HEX 格式错误' })); return; } render(parse(b)); });
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: 'GOOSE (IEC 61850-8-1) 报文解析' }),
        T.el('div', { class: 'row' }, [T.el('button', { class: 'btn sm primary', text: '载入示例', onclick: () => { input.value = hx(buildSample()); input.dispatchEvent(new Event('input')); } })]),
        input,
        T.el('div', { class: 'hint', text: '目的 MAC 01:0C:CD 为 GOOSE 组播；EtherType 0x88B8。stNum 变化=事件发生，sqNum 在每个 stNum 内递增。' }),
        out
      ]));
      input.value = hx(buildSample()); input.dispatchEvent(new Event('input'));
    }
  });
})();
