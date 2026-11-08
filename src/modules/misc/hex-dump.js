// Hex dump（带 ASCII 列）
(function () {
  const T = TB.util;
  function parseHex(s) { s = (s || '').replace(/[^0-9a-fA-F]/g, ''); if (s.length % 2) return null; const a = []; for (let i = 0; i < s.length; i += 2) a.push(parseInt(s.substr(i, 2), 16)); return a; }

  TB.register({
    id: 'hexdump', name: 'Hex Dump', category: '综合工具',
    desc: '将 HEX 或文本转换为经典 Hex Dump（偏移 + 十六进制 + ASCII）',
    render(c) {
      const modeSel = T.el('select', {}, [T.el('option', { value: 'hex', text: '输入为 HEX' }), T.el('option', { value: 'text', text: '输入为文本' })]);
      const inArea = T.el('textarea', { class: 'mono', placeholder: '粘贴 HEX 或文本' });
      const out = T.el('div', { class: 'pre' });
      function run() {
        let bytes;
        if (modeSel.value === 'hex') { bytes = parseHex(inArea.value); if (!bytes) { out.textContent = 'HEX 格式错误'; return; } }
        else { bytes = Array.from(new TextEncoder().encode(inArea.value)); }
        const lines = [];
        for (let i = 0; i < bytes.length; i += 16) {
          const chunk = bytes.slice(i, i + 16);
          const hex = chunk.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
          const asc = chunk.map(b => (b >= 0x20 && b < 0x7f) ? String.fromCharCode(b) : '.').join('');
          lines.push(i.toString(16).toUpperCase().padStart(8, '0') + '  ' + hex.padEnd(47, ' ') + '  |' + asc + '|');
        }
        out.textContent = lines.join('\n') || '(空)';
      }
      inArea.addEventListener('input', run); modeSel.addEventListener('change', run);
      inArea.value = '68 0E 01 00 02 00 01 03 00 01 00 0A 01 00 00 00';
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: 'Hex Dump' }),
        T.el('div', { class: 'row' }, [T.el('label', { text: '输入类型' }), modeSel]),
        inArea, T.el('div', { class: 'hint', text: '经典十六进制转储，便于人工比对报文。' }), out
      ]));
      run();
    }
  });
})();
