// 程序员计算器：多进制(Hex/Dec/Oct/Bin) + 位运算 + 位面板(BigInt, 支持 64 位)
(function () {
  const T = TB.util;

  function parseBig(s, base) {
    s = (s || '').trim().toUpperCase();
    if (!s) return 0n;
    let v = 0n;
    for (const ch of s) {
      let d;
      if (ch >= '0' && ch <= '9') d = BigInt(ch.charCodeAt(0) - 48);
      else if (ch >= 'A' && ch <= 'F') d = BigInt(ch.charCodeAt(0) - 55);
      else throw new Error('非法数字: ' + ch);
      if (d >= base) throw new Error('超出进制范围: ' + ch);
      v = v * BigInt(base) + d;
    }
    return v;
  }
  function mask(v, bits) {
    const m = (1n << BigInt(bits)) - 1n;
    return ((v % (1n << BigInt(bits))) + (1n << BigInt(bits))) % (1n << BigInt(bits)) & m;
  }
  const DIGITS = { 16: '0123456789ABCDEF', 10: '0123456789', 8: '01234567', 2: '01' };

  TB.register({
    id: 'programmer', name: '程序员计算器', category: '计算器',
    desc: '多进制整数计算：十六/十/八/二进制切换、位运算(与/或/异或/非/移位)与 64 位位面板，适合寄存器/报文解析。',
    tips: ['切换 HEX/DEC/OCT/BIN 会自动按新进制重算显示', '点击位面板可直接翻转对应比特', '位运算 AND/OR/XOR/NOT 与移位 << >>', '字长 QWORD→BYTE 截取低 N 位，运算结果自动掩码'],
    ref: [{ k: '进制', v: 'HEX 十六 / DEC 十 / OCT 八 / BIN 二' }, { k: '字长', v: 'QWORD64 / DWORD32 / WORD16 / BYTE8' }, { k: '位运算', v: 'AND OR XOR NOT << >>' }],
    render(c, ctx) {
      let base = 10;
      let word = 64;
      let entry = '0';
      let prev = null;
      let op = null;
      let waiting = false;

      const valEl = T.el('div', { class: 'val', text: '0' });
      const exprEl = T.el('div', { class: 'expr', text: '' });
      const disp = T.el('div', { class: 'calc-display' }, [exprEl, valEl]);
      const readout = T.el('div', { class: 'base-readout' });
      const bitPanel = T.el('div', { class: 'bitpanel in-aside' });
      const histEl = T.el('div', { class: 'tape' });
      let hist = [];
      function renderHist() {
        histEl.innerHTML = '';
        if (!hist.length) { histEl.appendChild(T.el('div', { class: 'hint', text: '暂无计算记录' })); return; }
        hist.forEach(h => {
          const i = h.indexOf(' = ');
          histEl.appendChild(T.el('div', { class: 'line' }, [
            T.el('span', { text: h.slice(0, i) }),
            T.el('span', { class: 'r', text: h.slice(i + 3) })
          ]));
        });
      }
      function pushHist(s) { hist.unshift(s); hist = hist.slice(0, 50); renderHist(); }

      const baseSwitch = T.el('div', { class: 'base-switch' });
      const baseSegs = [];
      [{ b: 16, l: 'HEX' }, { b: 10, l: 'DEC' }, { b: 8, l: 'OCT' }, { b: 2, l: 'BIN' }].forEach(({ b, l }) => {
        const seg = T.el('div', { class: 'seg' + (b === base ? ' active' : ''), text: l, onclick: () => { const v = curVal(); base = b; entry = v.toString(b).toUpperCase(); rebuildBase(); rebuildKeys(); refresh(); } });
        baseSegs.push({ el: seg, b });
        baseSwitch.appendChild(seg);
      });

      const wordSwitch = T.el('div', { class: 'base-switch', style: 'margin-top:0' });
      const wordSegs = [];
      [{ w: 64, l: 'QWORD' }, { w: 32, l: 'DWORD' }, { w: 16, l: 'WORD' }, { w: 8, l: 'BYTE' }].forEach(({ w, l }) => {
        const seg = T.el('div', { class: 'seg' + (w === word ? ' active' : ''), text: l, onclick: () => { word = w; if (prev !== null) prev = mask(prev, word); entry = mask(curVal(), word).toString(base).toUpperCase(); rebuildWord(); refresh(); } });
        wordSegs.push({ el: seg, w });
        wordSwitch.appendChild(seg);
      });

      function rebuildBase() { baseSegs.forEach(s => s.el.className = 'seg' + (s.b === base ? ' active' : '')); }
      function rebuildWord() { wordSegs.forEach(s => s.el.className = 'seg' + (s.w === word ? ' active' : '')); }

      function curVal() { return mask(parseBig(entry, base), word); }
      function refresh() {
        const v = curVal();
        valEl.textContent = v.toString(base).toUpperCase() || '0';
        exprEl.textContent = (op && prev !== null) ? (prev.toString(base).toUpperCase() + ' ' + op) : '';
        renderReadout(v);
        renderBits(v);
      }
      function renderReadout(v) {
        readout.innerHTML = '';
        [['HEX', 16], ['DEC', 10], ['OCT', 8], ['BIN', 2]].forEach(([k, b]) => {
          readout.appendChild(T.el('div', { class: 'k', text: k }));
          readout.appendChild(T.el('div', { class: 'v', text: v.toString(b).toUpperCase() || '0' }));
        });
      }
      function renderBits(v) {
        bitPanel.innerHTML = '';
        for (let i = word - 1; i >= 0; i--) {
          const on = (v >> BigInt(i)) & 1n;
          const cell = T.el('div', { class: 'cell' + (on ? ' on' : '') }, [
            T.el('span', { class: 'idx', text: String(i) }),
            T.el('span', { text: on ? '1' : '0' })
          ]);
          ((idx) => cell.addEventListener('click', () => {
            let nv = curVal();
            nv = (nv >> BigInt(idx)) & 1n ? nv & ~(1n << BigInt(idx)) : nv | (1n << BigInt(idx));
            nv = mask(nv, word);
            entry = nv.toString(base).toUpperCase() || '0'; waiting = false; prev = null; op = null; refresh();
          }))(i);
          bitPanel.appendChild(cell);
        }
      }

      function digit(d) {
        if (waiting) { entry = d; waiting = false; }
        else entry = entry === '0' ? d : entry + d;
        refresh();
      }
      function setOp(o) {
        const n = curVal();
        if (op && !waiting) prev = operate(prev, op, n);
        else if (prev === null) prev = n;
        op = o; waiting = true; entry = prev.toString(base).toUpperCase(); refresh();
      }
      function operate(a, o, b) {
        switch (o) {
          case '+': return mask(a + b, word);
          case '-': return mask(a - b, word);
          case '*': return mask(a * b, word);
          case '/': return b === 0n ? 0n : mask(a / b, word);
          case '&': return mask(a & b, word);
          case '|': return mask(a | b, word);
          case '^': return mask(a ^ b, word);
          case '<<': return mask(a << b, word);
          case '>>': return mask(a >> b, word);
        }
        return b;
      }
      function notOp() {
        const v = mask(~curVal(), word);
        entry = v.toString(base).toUpperCase(); prev = null; op = null; waiting = false; refresh();
      }
      function equals() {
        if (op === null || prev === null) return;
        const n = curVal();
        const r = operate(prev, op, n);
        pushHist(prev.toString(base).toUpperCase() + ' ' + op + ' ' + n.toString(base).toUpperCase() + ' = ' + r.toString(base).toUpperCase());
        entry = r.toString(base).toUpperCase(); prev = null; op = null; waiting = false; refresh();
      }
      function back() { entry = entry.length > 1 ? entry.slice(0, -1) : '0'; refresh(); }
      function clr() { entry = '0'; prev = null; op = null; waiting = false; refresh(); }

      // 4×4 十六进制键盘（按当前进制禁用无效数字键）
      const numPad = T.el('div', { class: 'keypad' });
      const numKeys = [];
      '0123456789ABCDEF'.split('').forEach(d => {
        const b = T.el('button', { class: 'key num', text: d, onclick: () => digit(d) });
        numKeys.push({ el: b, d });
        numPad.appendChild(b);
      });
      function rebuildKeys() {
        numKeys.forEach(k => {
          const dv = parseInt(k.d, 16);
          if (dv >= base) { k.el.setAttribute('disabled', 'disabled'); }
          else if (k.el.removeAttribute) { k.el.removeAttribute('disabled'); }
        });
      }
      rebuildKeys();

      // 位运算 / 功能键
      const logicPad = T.el('div', { class: 'keypad', style: 'margin-top:10px' }, [
        T.el('button', { class: 'key fn', text: 'AND', onclick: () => setOp('&') }),
        T.el('button', { class: 'key fn', text: 'OR', onclick: () => setOp('|') }),
        T.el('button', { class: 'key fn', text: 'XOR', onclick: () => setOp('^') }),
        T.el('button', { class: 'key fn', text: 'NOT', onclick: notOp }),
        T.el('button', { class: 'key fn', text: '<<', onclick: () => setOp('<<') }),
        T.el('button', { class: 'key fn', text: '>>', onclick: () => setOp('>>') }),
        T.el('button', { class: 'key fn', text: '⌫', onclick: back }),
        T.el('button', { class: 'key clr', text: 'C', onclick: clr })
      ]);
      // 算术键（普通四则 + 等号），补齐程序员计算器的算术能力
      const arithPad = T.el('div', { class: 'keypad', style: 'margin-top:10px' }, [
        T.el('button', { class: 'key op', text: '+', onclick: () => setOp('+') }),
        T.el('button', { class: 'key op', text: '−', onclick: () => setOp('-') }),
        T.el('button', { class: 'key op', text: '×', onclick: () => setOp('*') }),
        T.el('button', { class: 'key op', text: '÷', onclick: () => setOp('/') }),
        T.el('button', { class: 'key eq wide', text: '=', onclick: equals })
      ]);

      refresh();
      renderHist();
      c.appendChild(T.el('div', { class: 'calc-host' }, [T.el('div', { class: 'calc' }, [
        disp, baseSwitch, wordSwitch, readout,
        T.el('h4', { text: '数字键（按进制自动禁用）' }), numPad,
        T.el('h4', { text: '位运算' }), logicPad,
        T.el('h4', { text: '算术' }), arithPad
      ])]));
      // 位面板 + 最近计算 移到右侧"剩余内容"面板，避免左侧翻动
      if (ctx && ctx.aside) {
        const bitCard = T.el('div', { class: 'aside-card' }, [
          T.el('div', { class: 'aside-title' }, [T.el('span', { class: 'dot' }), T.el('span', { text: '位面板（点击切换比特）' })]),
          bitPanel
        ]);
        ctx.aside.insertBefore(bitCard, ctx.aside.firstChild);
        ctx.aside.appendChild(T.el('div', { class: 'aside-card' }, [
          T.el('div', { class: 'aside-title' }, [T.el('span', { class: 'dot' }), T.el('span', { text: '最近计算' })]),
          histEl
        ]));
      }
    }
  });
})();
