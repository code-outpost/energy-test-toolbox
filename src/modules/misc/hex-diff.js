// 报文 HEX 字节级 diff
(function () {
  const T = TB.util;
  function parseHex(s) { s = (s || '').replace(/[^0-9a-fA-F]/g, ''); if (s.length % 2) return null; const a = []; for (let i = 0; i < s.length; i += 2) a.push(parseInt(s.substr(i, 2), 16)); return a; }

  TB.register({
    id: 'hexdiff', name: 'HEX Diff', category: '综合工具',
    desc: '两份 HEX 报文按字节比对，高亮不同/缺失字节并统计差异',
    render(c) {
      const aIn = T.el('textarea', { class: 'mono', placeholder: '报文 A (HEX)' });
      const bIn = T.el('textarea', { class: 'mono', placeholder: '报文 B (HEX)' });
      const out = T.el('div', { class: 'col' });
      function run() {
        const A = parseHex(aIn.value), B = parseHex(bIn.value);
        out.innerHTML = '';
        if (!A || !B) { out.appendChild(T.el('div', { class: 'error', text: 'HEX 格式错误（需偶数字符）' })); return; }
        const n = Math.max(A.length, B.length); let diff = 0, missA = 0, missB = 0;
        const rows = [];
        for (let i = 0; i < n; i++) {
          const a = A[i], b = B[i];
          if (a == null) { missA++; rows.push([i, '  ', b.toString(16).toUpperCase().padStart(2, '0'), '仅B']); }
          else if (b == null) { missB++; rows.push([i, a.toString(16).toUpperCase().padStart(2, '0'), '  ', '仅A']); }
          else if (a !== b) { diff++; rows.push([i, a.toString(16).toUpperCase().padStart(2, '0'), b.toString(16).toUpperCase().padStart(2, '0'), '不同']); }
        }
        out.appendChild(T.el('div', { class: 'kv' }));
        const k = out.lastChild;
        k.appendChild(T.el('div', { class: 'k', text: '长度' })); k.appendChild(T.el('div', { class: 'v', text: `A=${A.length}  B=${B.length}` }));
        k.appendChild(T.el('div', { class: 'k', text: '差异' })); k.appendChild(T.el('div', { class: 'v', text: `不同=${diff}  仅A=${missB}  仅B=${missA}` }));
        if (!rows.length) { out.appendChild(T.el('div', { class: 'tag', text: '✓ 两份报文完全一致' })); return; }
        const tbl = T.el('table', {}); tbl.appendChild(T.el('tr', {}, [T.el('th', { text: '偏移' }), T.el('th', { text: 'A' }), T.el('th', { text: 'B' }), T.el('th', { text: '状态' })]));
        rows.slice(0, 300).forEach(r => tbl.appendChild(T.el('tr', {}, [T.el('td', { class: 'mono', text: '0x' + r[0].toString(16).toUpperCase().padStart(4, '0') }), T.el('td', { class: 'mono', text: r[1] }), T.el('td', { class: 'mono', text: r[2] }), T.el('td', { text: r[3] })])));
        out.appendChild(tbl);
        if (rows.length > 300) out.appendChild(T.el('div', { class: 'hint', text: `仅显示前 300 处差异（共 ${rows.length} 处）` }));
      }
      aIn.addEventListener('input', run); bIn.addEventListener('input', run);
      aIn.value = '68 0E 01 00 02 00 01 03 00 01 00 0A 01 00 00 00';
      bIn.value = '68 0E 01 00 02 00 01 03 00 01 00 0A 02 00 00 00';
      c.appendChild(T.el('div', { class: 'card' }, [T.el('h3', { text: 'HEX 字节级比对' }), aIn, bIn, T.el('div', { class: 'hint', text: '逐字节比对，标记“不同 / 仅A / 仅B”。' }), out]));
      run();
    }
  });
})();
