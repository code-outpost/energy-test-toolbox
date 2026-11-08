// 标准计算器：真实计算器布局（深色显示屏 + 立体键帽 + 颜色分区）
(function () {
  const T = TB.util;

  TB.register({
    id: 'standard', name: '标准计算器', category: '计算器',
    desc: '点击式标准计算器，四则运算 / 百分比 / 正负号 / 退格 / 历史记录。',
    tips: ['百分比 %：先输入基数，按运算符后再按 %', '± 键切换当前数值正负号', '⌫ 退格删除末位，AC 清空全部', '支持连续运算，历史记录在右侧面板'],
    ref: [{ k: '运算符', v: '+ − × ÷' }, { k: '功能键', v: '% 百分比 / ± 正负 / ⌫ 退格 / AC 全清' }],
    render(c, ctx) {
      let cur = '0';      // 当前输入
      let prev = null;    // 前一个操作数
      let op = null;      // 待执行运算符
      let waiting = false;// 等待输入下一个数
      let tape = [];

      const exprEl = T.el('div', { class: 'expr', text: '' });
      const valEl = T.el('div', { class: 'val', text: '0' });
      const disp = T.el('div', { class: 'calc-display' }, [exprEl, valEl]);
      const tapeEl = T.el('div', { class: 'tape' });

      const SYM = { '+': '+', '-': '−', '*': '×', '/': '÷' };
      function refresh() {
        valEl.textContent = cur;
        exprEl.textContent = (op && prev !== null) ? (fmtNum(prev) + ' ' + SYM[op]) : '';
      }
      function fmtNum(n) {
        if (!isFinite(n)) return '错误';
        if (Number.isInteger(n)) return String(n);
        return String(parseFloat(n.toPrecision(12)));
      }
      function num(x) {
        if (waiting) { cur = (x === '.' ? '0.' : x); waiting = false; }
        else if (x === '.') { if (cur.indexOf('.') === -1) cur += '.'; }
        else { cur = (cur === '0' ? x : cur + x); }
        refresh();
      }
      function setOp(o) {
        const n = parseFloat(cur);
        if (op && !waiting) prev = operate(prev, op, n);
        else if (prev === null) prev = n;
        op = o; waiting = true; cur = fmtNum(prev); refresh();
      }
      function operate(a, o, b) {
        switch (o) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/': return b === 0 ? NaN : a / b;
        }
        return b;
      }
      function equals() {
        if (op === null || prev === null) return;
        const n = parseFloat(cur);
        const r = operate(prev, op, n);
        tape.unshift({ a: fmtNum(prev), o: op, b: fmtNum(n), r: fmtNum(r) });
        tape = tape.slice(0, 50); renderTape();
        cur = fmtNum(r); prev = null; op = null; waiting = false;
        exprEl.textContent = ''; refresh();
      }
      function percent() {
        if (prev !== null && op) { cur = fmtNum(parseFloat(cur) * prev / 100); }
        else { cur = fmtNum(parseFloat(cur) / 100); }
        refresh();
      }
      function negate() { cur = fmtNum(parseFloat(cur) * -1); refresh(); }
      function back() { cur = cur.length > 1 ? cur.slice(0, -1) : '0'; if (cur === '-' || cur === '-0') cur = '0'; refresh(); }
      function ce() { cur = '0'; refresh(); }
      function ac() { cur = '0'; prev = null; op = null; waiting = false; exprEl.textContent = ''; refresh(); }

      function renderTape() {
        tapeEl.innerHTML = '';
        if (!tape.length) { tapeEl.appendChild(T.el('div', { class: 'hint', text: '暂无计算记录' })); return; }
        tape.forEach(t => {
          tapeEl.appendChild(T.el('div', { class: 'line' }, [
            T.el('span', { text: t.a + ' ' + SYM[t.o] + ' ' + t.b + ' =' }),
            T.el('span', { class: 'r', text: t.r })
          ]));
        });
      }
      renderTape(); refresh();

      function key(label, cls, fn) {
        return T.el('button', { class: 'key ' + cls, text: label, onclick: fn });
      }
      const pad = T.el('div', { class: 'keypad' }, [
        key('AC', 'clr', ac),
        key('⌫', 'fn', back),
        key('%', 'fn', percent),
        key('÷', 'op', () => setOp('/')),
        key('7', 'num', () => num('7')),
        key('8', 'num', () => num('8')),
        key('9', 'num', () => num('9')),
        key('×', 'op', () => setOp('*')),
        key('4', 'num', () => num('4')),
        key('5', 'num', () => num('5')),
        key('6', 'num', () => num('6')),
        key('−', 'op', () => setOp('-')),
        key('1', 'num', () => num('1')),
        key('2', 'num', () => num('2')),
        key('3', 'num', () => num('3')),
        key('+', 'op', () => setOp('+')),
        key('±', 'fn', negate),
        key('0', 'num', () => num('0')),
        key('.', 'num', () => num('.')),
        key('=', 'eq', equals)
      ]);

      c.appendChild(T.el('div', { class: 'calc-host' }, [T.el('div', { class: 'calc' }, [disp, pad])]));
      // 历史记录移至右侧"剩余内容"面板
      if (ctx && ctx.aside) {
        ctx.aside.appendChild(T.el('div', { class: 'aside-card' }, [
          T.el('div', { class: 'aside-title' }, [T.el('span', { class: 'dot' }), T.el('span', { text: '历史记录' })]),
          tapeEl
        ]));
      }
    }
  });
})();
