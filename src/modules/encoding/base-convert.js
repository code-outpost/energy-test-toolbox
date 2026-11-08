// 进制转换：2–36 进制互转、位视图、二补码、大端/小端字节序预览
TB.register({
  id: 'base-convert',
  name: '进制转换',
  category: '通用编解码',
  desc: '任意进制互转、位视图点击翻转、二补码解释、大端/小端字节序预览',
  render(c) {
    let state = { value: 0n, width: 16 };

    const input = TB.util.el('input', { type: 'text', class: 'mono', placeholder: '如 0x1A2B / 6703 / 0b1010 / -5', style: 'width:300px' });
    const widthSel = TB.util.el('select', {});
    [8, 16, 32, 64].forEach(w => {
      widthSel.appendChild(TB.util.el('option', { value: String(w), text: w + ' 位', selected: w === 16 ? 'selected' : null }));
    });
    const outBox = TB.util.el('div', { class: 'kv' });
    const bitBox = TB.util.el('div', { class: 'bit-grid' });
    const endianBox = TB.util.el('div', { class: 'kv' });

    function parse(s) {
      s = (s || '').trim();
      if (!s) return null;
      try {
        if (/^0x/i.test(s)) return BigInt(s);
        if (/^0b/i.test(s)) return BigInt(s);
        if (/^0o/i.test(s)) return BigInt(s);
        return BigInt(s);
      } catch { return null; }
    }

    const TWO = (w) => (1n << BigInt(w));
    function uval(v, w) {
      const mod = TWO(w);
      return ((v % mod) + mod) % mod;
    }

    function refresh() {
      const w = state.width;
      const u = uval(state.value, w);
      outBox.innerHTML = '';
      const rows = [
        ['2 进制', u.toString(2).padStart(w, '0')],
        ['8 进制', u.toString(8)],
        ['10 进制(有符号)', state.value.toString(10)],
        ['10 进制(无符号)', u.toString(10)],
        ['16 进制', '0x' + u.toString(16).toUpperCase().padStart(w / 4, '0')]
      ];
      rows.forEach(([k, v]) => {
        outBox.appendChild(TB.util.el('div', { class: 'k', text: k }));
        outBox.appendChild(TB.util.el('div', { class: 'v' }, [v, TB.util.copyBtn(v)]));
      });

      bitBox.innerHTML = '';
      for (let i = 0; i < w; i++) {
        const bitIndex = w - 1 - i;
        const on = (u >> BigInt(bitIndex)) & 1n;
        const b = TB.util.el('div', { class: 'bit' + (on ? ' on' : ''), text: on ? '1' : '0', title: 'bit ' + bitIndex });
        b.addEventListener('click', () => {
          state.value = state.value ^ (1n << BigInt(bitIndex));
          input.value = '0x' + uval(state.value, w).toString(16).toUpperCase().padStart(w / 4, '0');
          refresh();
        });
        bitBox.appendChild(b);
      }

      const bytes = w / 8;
      const arr = [];
      for (let i = 0; i < bytes; i++) arr.push(Number((u >> BigInt(8 * (bytes - 1 - i))) & 0xffn));
      const be = arr.map(x => x.toString(16).toUpperCase().padStart(2, '0')).join(' ');
      const le = arr.slice().reverse().map(x => x.toString(16).toUpperCase().padStart(2, '0')).join(' ');
      endianBox.innerHTML = '';
      endianBox.appendChild(TB.util.el('div', { class: 'k', text: '大端 BE' }));
      endianBox.appendChild(TB.util.el('div', { class: 'v' }, [be, TB.util.copyBtn(be)]));
      endianBox.appendChild(TB.util.el('div', { class: 'k', text: '小端 LE' }));
      endianBox.appendChild(TB.util.el('div', { class: 'v' }, [le, TB.util.copyBtn(le)]));
    }

    input.addEventListener('input', () => {
      const v = parse(input.value);
      if (v !== null) { state.value = v; refresh(); }
    });
    widthSel.addEventListener('change', () => { state.width = parseInt(widthSel.value, 10); refresh(); });

    c.appendChild(TB.util.el('div', { class: 'card' }, [
      TB.util.el('h3', { text: '进制转换 / 位视图 / 字节序' }),
      TB.util.el('div', { class: 'row' }, [
        TB.util.el('label', { text: '输入' }), input,
        TB.util.el('label', { text: '位宽' }), widthSel
      ]),
      TB.util.el('div', { class: 'hint', text: '支持 0x / 0b / 0o 前缀与负号；点击比特翻转会同步改写输入值。' }),
      TB.util.el('div', { class: 'col', style: 'margin-top:12px' }, [
        TB.util.el('div', { class: 'hint', text: '进制结果' }), outBox,
        TB.util.el('div', { class: 'hint', text: '位视图（点击翻转，MSB → LSB）' }), bitBox,
        TB.util.el('div', { class: 'hint', text: '字节序' }), endianBox
      ])
    ]));

    input.value = '0x1A2B';
    state.value = parse('0x1A2B');
    refresh();
  }
});
