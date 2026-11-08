// 编码转换：HEX ↔ ASCII、Base64 编/解码、URL 编/解码
TB.register({
  id: 'encoding',
  name: '编码转换',
  category: '通用编解码',
  desc: 'HEX↔ASCII、Base64 编解码、URL 编解码',
  render(c) {
    function hexToBytes(hex) {
      hex = (hex || '').replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '');
      if (hex.length % 2) throw new Error('HEX 长度为奇数');
      const out = [];
      for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.substr(i, 2), 16));
      return out;
    }
    function bytesToHex(bytes, sep) {
      return Array.from(bytes).map(b => (b & 0xff).toString(16).padStart(2, '0')).join(sep || ' ');
    }
    function bytesToAscii(bytes) {
      return Array.from(bytes).map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
    }
    function utf8ToBytes(str) { return Array.from(new TextEncoder().encode(str)); }
    function bytesToUtf8(bytes) { return new TextDecoder().decode(Uint8Array.from(bytes)); }
    function bytesToB64(bytes) {
      const u = Uint8Array.from(bytes); let s = '';
      for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
      return btoa(s);
    }
    function b64ToBytes(b64) {
      const s = atob(b64.trim()); const out = [];
      for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
      return out;
    }

    const typeSel = TB.util.el('select', {}, [
      TB.util.el('option', { value: 'hex2ascii', text: 'HEX → ASCII' }),
      TB.util.el('option', { value: 'ascii2hex', text: 'ASCII → HEX' }),
      TB.util.el('option', { value: 'b64enc', text: '文本 → Base64' }),
      TB.util.el('option', { value: 'b64dec', text: 'Base64 → 文本' }),
      TB.util.el('option', { value: 'urlenc', text: '文本 → URL 编码' }),
      TB.util.el('option', { value: 'urldec', text: 'URL → 文本' })
    ]);
    const input = TB.util.el('textarea', { placeholder: '在此粘贴待转换内容…' });
    const output = TB.util.el('div', { class: 'pre', text: '' });

    function convert(type, txt) {
      switch (type) {
        case 'hex2ascii': return bytesToAscii(hexToBytes(txt));
        case 'ascii2hex': return bytesToHex(utf8ToBytes(txt));
        case 'b64enc': return bytesToB64(utf8ToBytes(txt));
        case 'b64dec': return bytesToUtf8(b64ToBytes(txt));
        case 'urlenc': return encodeURIComponent(txt);
        case 'urldec': return decodeURIComponent(txt.trim());
      }
      return '';
    }

    function run() {
      try {
        const r = convert(typeSel.value, input.value);
        output.textContent = r;
      } catch (e) {
        output.textContent = '错误：' + e.message;
        output.classList.add('error');
        return;
      }
      output.classList.remove('error');
    }

    typeSel.addEventListener('change', run);
    input.addEventListener('input', run);

    c.appendChild(TB.util.el('div', { class: 'card' }, [
      TB.util.el('h3', { text: 'HEX / Base64 / URL 编解码' }),
      TB.util.el('div', { class: 'row' }, [TB.util.el('label', { text: '转换类型' }), typeSel]),
      TB.util.el('div', { class: 'col', style: 'margin-top:10px' }, [
        TB.util.el('label', { text: '输入' }), input,
        TB.util.el('label', { text: '输出' }),
        TB.util.el('div', { class: 'row' }, [output, TB.util.copyBtn(() => output.textContent)])
      ])
    ]));

    input.value = '48 65 6C 6C 6F';
    run();
  }
});
