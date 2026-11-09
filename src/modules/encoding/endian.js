// 字节序互换：按数据类型解释大端/小端，并输出交换后 HEX
TB.register({
  id: 'endian',
  name: '字节序互换',
  category: '通用编解码',
  desc: '按 int16/32/64、float32/64 解释大端/小端，并交换字节序',
  render(c) {
    function hexToBytes(hex) {
      hex = (hex || '').replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '');
      if (hex.length % 2) throw new Error('HEX 长度为奇数');
      const out = [];
      for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.substr(i, 2), 16));
      return out;
    }
    function bytesToHex(bytes) {
      return Array.from(bytes).map(b => (b & 0xff).toString(16).toUpperCase().padStart(2, '0')).join(' ');
    }

    const typeSel = TB.util.el('select', {}, [
      TB.util.el('option', { value: 'int16', text: 'int16 (有符号 16 位)' }),
      TB.util.el('option', { value: 'uint16', text: 'uint16 (无符号 16 位)' }),
      TB.util.el('option', { value: 'int32', text: 'int32 (有符号 32 位)' }),
      TB.util.el('option', { value: 'uint32', text: 'uint32 (无符号 32 位)' }),
      TB.util.el('option', { value: 'int64', text: 'int64 (有符号 64 位)' }),
      TB.util.el('option', { value: 'uint64', text: 'uint64 (无符号 64 位)' }),
      TB.util.el('option', { value: 'float32', text: 'float32 (单精度)' }),
      TB.util.el('option', { value: 'float64', text: 'float64 (双精度)' })
    ]);
    const input = TB.util.el('input', { type: 'text', class: 'mono', placeholder: 'HEX 字节，如 01 02 03 04', style: 'width:280px' });
    const out = TB.util.el('div', { class: 'kv' });

    const SIZES = { int16: 2, uint16: 2, int32: 4, uint32: 4, int64: 8, uint64: 8, float32: 4, float64: 8 };

    function run() {
      out.innerHTML = '';
      const put = (k, v) => { out.appendChild(TB.util.el('div', { class: 'k', text: k })); out.appendChild(TB.util.el('div', { class: 'v' }, [v, TB.util.copyBtn(v)])); };
      try {
        const bytes = hexToBytes(input.value);
        const size = SIZES[typeSel.value];
        if (bytes.length !== size) { put('提示', '该类型需要 ' + size + ' 字节，当前 ' + bytes.length + ' 字节'); return; }
        const buf = new ArrayBuffer(size);
        const u8 = new Uint8Array(buf);
        u8.set(bytes);
        const dv = new DataView(buf);
        const t = typeSel.value;
        let be, le;
        if (t === 'float32') { be = dv.getFloat32(0, false); le = dv.getFloat32(0, true); }
        else if (t === 'float64') { be = dv.getFloat64(0, false); le = dv.getFloat64(0, true); }
        else {
          const signed = t.startsWith('int');
          const bits = parseInt(t.replace(/[a-z]/g, ''), 10);
          const method = (signed ? 'getInt' : 'getUint') + bits;
          if (typeof dv[method] !== 'function') throw new Error('不支持的整数类型: ' + t);
          be = dv[method](0, false);
          le = dv[method](0, true);
        }
        put('大端 BE 解释', String(be));
        put('小端 LE 解释', String(le));
        put('交换字节序(HEX)', bytesToHex(bytes.slice().reverse()));
        put('原始 HEX', bytesToHex(bytes));
      } catch (e) {
        put('错误', e.message);
      }
    }
    typeSel.addEventListener('change', run);
    input.addEventListener('input', run);

    c.appendChild(TB.util.el('div', { class: 'card' }, [
      TB.util.el('h3', { text: '字节序互换 / 数据类型解释' }),
      TB.util.el('div', { class: 'row' }, [TB.util.el('label', { text: '数据类型' }), typeSel]),
      TB.util.el('div', { class: 'row', style: 'margin-top:8px' }, [TB.util.el('label', { text: 'HEX 字节' }), input]),
      out
    ]));

    input.value = '01 02 03 04';
    typeSel.value = 'uint32';
    run();
  }
});
