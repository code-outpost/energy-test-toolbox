// SV (IEC 61850-9-2 采样值) 报文解析：二层帧 + APPID + ASN.1 BER(SavPdu) + seqData 通道值解释
(function () {
  const T = TB.util;
  function parseHex(s) { s = (s || '').replace(/[^0-9a-fA-F]/g, ''); if (s.length % 2) return null; const a = []; for (let i = 0; i < s.length; i += 2) a.push(parseInt(s.substr(i, 2), 16)); return a; }
  function hx(arr, sep) { return arr.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(sep || ' '); }
  function ber(buf, off) { const tag = buf[off]; let len = buf[off + 1], l = 1; if (len & 0x80) { const n = len & 0x7f; len = 0; for (let i = 0; i < n; i++) len = (len << 8) | buf[off + 2 + i]; l = 1 + n; } const vs = off + 1 + l; return { tag, len, vs, ve: vs + len, next: vs + len }; }
  function readInt(buf, off, len) { let v = 0; for (let i = 0; i < len; i++) v = (v << 8) | buf[off + i]; return v; }
  const ASDU_FIELD = { 0x80: 'svID', 0x81: 'datSet', 0x82: 'smpCnt', 0x83: 'confRev', 0x84: 'smpSynch', 0x85: 'seqData(采样值)', 0x86: 'SmpMod' };

  function parse(bytes) {
    if (bytes.length < 14) return { ok: false, err: '报文过短' };
    const dst = bytes.slice(0, 6), src = bytes.slice(6, 12);
    let off = 12;
    if (bytes[off] === 0x81 && bytes[off + 1] === 0x00) off += 4; // 跳过 VLAN
    if (bytes[off] !== 0x88 || bytes[off + 1] !== 0xba) return { ok: false, err: 'EtherType 应为 0x88BA(SV)，实际 0x' + hx(bytes.slice(off, off + 2)).replace(/ /g, '') };
    off += 2;
    let appid = null;
    if (bytes[off] !== 0x60) { appid = bytes[off] << 8 | bytes[off + 1]; off += 6; } // APPID(2)+Length(2)+Reserved(2)
    if (bytes[off] !== 0x60) return { ok: false, err: 'SV APDU 标签应为 0x60，实际 0x' + bytes[off].toString(16) };
    const pdu = ber(bytes, off);
    const fields = []; const asdus = [];
    let p = pdu.vs; let noASDU = null;
    while (p < pdu.ve) {
      const e = ber(bytes, p);
      if (e.tag === 0x80) noASDU = readInt(bytes, e.vs, e.len);
      else if (e.tag === 0xa1) {
        let q = e.vs; const a = {};
        while (q < e.ve) { const f = ber(bytes, q); const nm = ASDU_FIELD[f.tag] || ('0x' + f.tag.toString(16)); let v; if (f.tag === 0x80 || f.tag === 0x81) v = String.fromCharCode(...bytes.slice(f.vs, f.ve)); else if (f.tag === 0x85) v = hx(bytes.slice(f.vs, f.ve)); else v = readInt(bytes, f.vs, f.len) + ' (0x' + hx(bytes.slice(f.vs, f.ve)).replace(/ /g, '') + ')'; a[nm] = v; if (f.tag === 0x85) a.seqRaw = bytes.slice(f.vs, f.ve); q = f.next; }
        asdus.push(a);
      } else { fields.push({ tag: '0x' + e.tag.toString(16).toUpperCase(), name: '0x' + e.tag.toString(16), val: readInt(bytes, e.vs, e.len) }); }
      p = e.next;
    }
    return { ok: true, dst: hx(dst, ':'), src: hx(src, ':'), appid, noASDU, asdus };
  }

  function buildSample() {
    const str = (s) => Array.from(s).map(c => c.charCodeAt(0));
    const tlv = (tag, b) => [tag, b.length].concat(b);
    // seqData: 2 个通道，每通道 4 字节（INT16 -1000 与 FLOAT32 1.5）
    const ch1 = [0xFC, 0x18, 0x00, 0x00]; const dv = new DataView(new ArrayBuffer(4)); dv.setFloat32(0, 1.5, false); const ch2 = Array.from(new Uint8Array(dv.buffer));
    const asdu = tlv(0xa1, [].concat(
      tlv(0x80, str('sv1')), tlv(0x81, str('dsSV')), tlv(0x82, [0x01]), tlv(0x83, [0x01]), tlv(0x84, [0x00]), tlv(0x85, ch1.concat(ch2)), tlv(0x86, [0x00])
    ));
    const pdu = [0x60, asdu.length].concat(asdu);
    const dst = [0x01, 0x0C, 0xCD, 0x04, 0x00, 0x00], src = [0x00, 0x11, 0x22, 0x33, 0x44, 0x55];
    const appid = [0x40, 0x01];
    return [].concat(dst, src, [0x88, 0xBA], appid, [0x00, (pdu.length & 0xff), 0x00, 0x00], pdu);
  }

  TB.register({
    id: 'sv', name: 'SV 采样值', category: '协议报文解析',
    desc: 'IEC 61850-9-2 SV 采样值解析（APPID/svID/smpCnt/confRev/smpSynch）+ seqData 每通道 INT16/FLOAT32 解释',
    render(c) {
      const input = T.el('textarea', { class: 'mono', placeholder: '粘贴 SV 帧 HEX（含以太网头）' });
      const out = T.el('div', { class: 'col' });
      function render(r) {
        out.innerHTML = '';
        if (!r.ok) { out.appendChild(T.el('div', { class: 'error', text: '解析失败：' + r.err })); return; }
        const ov = T.el('div', { class: 'kv' });
        ov.appendChild(T.el('div', { class: 'k', text: '目的 MAC' })); ov.appendChild(T.el('div', { class: 'v', text: r.dst + (r.dst.startsWith('01:0C:CD') ? ' (组播)' : '') }));
        ov.appendChild(T.el('div', { class: 'k', text: '源 MAC' })); ov.appendChild(T.el('div', { class: 'v', text: r.src }));
        if (r.appid != null) ov.appendChild(T.el('div', { class: 'k', text: 'APPID' })), ov.appendChild(T.el('div', { class: 'v', text: '0x' + r.appid.toString(16).toUpperCase() }));
        if (r.noASDU != null) ov.appendChild(T.el('div', { class: 'k', text: 'noASDU' })), ov.appendChild(T.el('div', { class: 'v', text: String(r.noASDU) }));
        out.appendChild(ov);
        r.asdus.forEach((a, i) => {
          out.appendChild(T.el('div', { class: 'hint', text: 'ASDU #' + (i + 1) }));
          const av = T.el('div', { class: 'kv' });
          ['svID', 'datSet', 'smpCnt', 'confRev', 'smpSynch', 'SmpMod'].forEach(k => { if (a[k] != null) { av.appendChild(T.el('div', { class: 'k', text: k })); av.appendChild(T.el('div', { class: 'v', text: String(a[k]) })); } });
          out.appendChild(av);
          if (a.seqRaw && a.seqRaw.length) {
            const tbl = T.el('table', {}); tbl.appendChild(T.el('tr', {}, [T.el('th', { text: '通道' }), T.el('th', { text: '字节' }), T.el('th', { text: 'INT16(前半)' }), T.el('th', { text: 'INT16(后半)' }), T.el('th', { text: 'FLOAT32' })]));
            for (let j = 0; j + 4 <= a.seqRaw.length; j += 4) {
              const b = a.seqRaw.slice(j, j + 4); const dv = new DataView(new Uint8Array(b).buffer);
              tbl.appendChild(T.el('tr', {}, [T.el('td', { text: String(j / 4) }), T.el('td', { class: 'mono', text: hx(b) }), T.el('td', { text: String(dv.getInt16(0, false)) }), T.el('td', { text: String(dv.getInt16(2, false)) }), T.el('td', { text: dv.getFloat32(0, false).toFixed(6) })]));
            }
            out.appendChild(tbl);
          }
        });
      }
      input.addEventListener('input', () => { const b = parseHex(input.value); if (!b) { out.innerHTML = ''; out.appendChild(T.el('div', { class: 'error', text: 'HEX 格式错误' })); return; } render(parse(b)); });
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: 'SV (IEC 61850-9-2) 采样值解析' }),
        T.el('div', { class: 'row' }, [T.el('button', { class: 'btn sm primary', text: '载入示例', onclick: () => { input.value = hx(buildSample()); input.dispatchEvent(new Event('input')); } })]),
        input,
        T.el('div', { class: 'hint', text: '目的 MAC 01:0C:CD:04 为 SV 组播；EtherType 0x88BA；seqData 每 4 字节为一个采样值（由数据集定义决定 INT16 或 FLOAT32）。' }),
        out
      ]));
      input.value = hx(buildSample()); input.dispatchEvent(new Event('input'));
    }
  });
})();
