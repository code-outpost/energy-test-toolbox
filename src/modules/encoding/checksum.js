// 校验和：CRC16-MODBUS、CRC16-CCITT、CRC32、LRC
TB.register({
  id: 'checksum',
  name: '校验和 / CRC',
  category: '通用编解码',
  desc: 'CRC16-MODBUS、CRC16-CCITT、CRC32、LRC 校验（文本或 HEX 输入）',
  render(c) {
    function hexToBytes(hex) {
      hex = (hex || '').replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '');
      if (hex.length % 2) throw new Error('HEX 长度为奇数');
      const out = [];
      for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.substr(i, 2), 16));
      return out;
    }
    function toBytes(txt, mode) {
      if (mode === 'hex') return hexToBytes(txt);
      return Array.from(new TextEncoder().encode(txt));
    }
    function rev8(x) { let r = 0; for (let i = 0; i < 8; i++) r = (r << 1) | (x & 1), x >>= 1; return r & 0xff; }
    function crc16(data, poly, init, refin, refout, xorout) {
      let crc = init & 0xffff;
      for (const b0 of data) {
        let b = refin ? rev8(b0) : b0;
        crc ^= (b << 8);
        for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ poly) & 0xffff : (crc << 1) & 0xffff;
      }
      if (refout) crc = rev8(crc & 0xff) | (rev8((crc >> 8) & 0xff) << 8);
      return (crc ^ xorout) & 0xffff;
    }
    function crc32(data) {
      let crc = 0xffffffff;
      for (const b of data) {
        crc ^= b;
        for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
      }
      return (crc ^ 0xffffffff) >>> 0;
    }
    function lrc(data) {
      let sum = 0;
      for (const b of data) sum = (sum + b) & 0xff;
      return (0x100 - sum) & 0xff;
    }

    const modeSel = TB.util.el('select', {}, [
      TB.util.el('option', { value: 'text', text: '文本 (UTF-8)' }),
      TB.util.el('option', { value: 'hex', text: 'HEX' })
    ]);
    const input = TB.util.el('textarea', { placeholder: '粘贴待校验内容…' });
    const out = TB.util.el('div', { class: 'kv' });

    function run() {
      out.innerHTML = '';
      const put = (k, v) => { out.appendChild(TB.util.el('div', { class: 'k', text: k })); out.appendChild(TB.util.el('div', { class: 'v' }, [v, TB.util.copyBtn(v)])); };
      try {
        const data = toBytes(input.value, modeSel.value);
        put('CRC16-MODBUS', '0x' + crc16(data, 0x8005, 0xFFFF, true, true, 0x0000).toString(16).toUpperCase().padStart(4, '0'));
        put('CRC16-CCITT', '0x' + crc16(data, 0x1021, 0xFFFF, false, false, 0x0000).toString(16).toUpperCase().padStart(4, '0'));
        put('CRC32', '0x' + crc32(data).toString(16).toUpperCase().padStart(8, '0'));
        put('LRC', '0x' + lrc(data).toString(16).toUpperCase().padStart(2, '0'));
      } catch (e) {
        put('错误', e.message);
      }
    }
    modeSel.addEventListener('change', run);
    input.addEventListener('input', run);

    c.appendChild(TB.util.el('div', { class: 'card' }, [
      TB.util.el('h3', { text: 'CRC / 校验和' }),
      TB.util.el('div', { class: 'row' }, [TB.util.el('label', { text: '输入模式' }), modeSel]),
      TB.util.el('div', { class: 'col', style: 'margin-top:10px' }, [TB.util.el('label', { text: '输入' }), input]),
      out
    ]));

    input.value = '01 03 00 00 00 01';
    run();
  }
});
