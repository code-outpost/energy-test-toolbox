// 科学计算器：表达式输入 + 函数网格 + 数字键盘，复用 TB.calcEval（安全引擎，无 eval）
(function () {
  const T = TB.util;

  TB.register({
    id: 'scientific', name: '科学计算器', category: '计算器',
    desc: '点击式科学计算器：三角函数 / 对数 / 幂 / 阶乘 / 常数，支持弧度(RAD)与角度(DEG)切换，带结果预览与历史。',
    tips: ['DEG/RAD 按钮切换角度制与弧度制', 'xʸ 计算幂，如 2 xʸ 8 = 256', 'n! 计算阶乘，仅支持非负整数', '表达式实时预览，按 = 记入历史'],
    ref: [{ k: '函数', v: 'sin cos tan ln log √ x² xʸ n! π e' }, { k: '常数', v: 'π≈3.1416  e≈2.7183' }, { k: '幂运算', v: '^ 例：2^10=1024' }],
    render(c, ctx) {
      let deg = false;
      let expr = '';
      let justEval = false;
      let hist = [];

      const exprEl = T.el('div', { class: 'expr', text: '' });
      const valEl = T.el('div', { class: 'val', text: '0' });
      const disp = T.el('div', { class: 'calc-display' }, [exprEl, valEl]);
      const histEl = T.el('div', { class: 'tape' });

      const TOK = {
        'sin': 'sin(', 'cos': 'cos(', 'tan': 'tan(', 'ln': 'ln(', 'log': 'log(',
        '√': 'sqrt(', 'x²': '^2', 'xʸ': '^', 'n!': 'fact(', 'π': 'pi', 'e': 'e'
      };
      function fmt(v) {
        if (v === '' || v == null) return '';
        const n = Number(v);
        if (!isFinite(n)) return String(v);
        if (Number.isInteger(n)) return String(n);
        return String(parseFloat(n.toPrecision(12)));
      }
      function update() {
        exprEl.textContent = expr || '0';
        try {
          const r = TB.calcEval(expr, { deg });
          valEl.textContent = fmt(r);
        } catch { valEl.textContent = ''; }
      }
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
      function pushHist(e, r) { hist.unshift(e + ' = ' + r); hist = hist.slice(0, 50); renderHist(); }
      const OPS = '+-*/';
      function append(tok) {
        if (justEval) {
          if (OPS.indexOf(tok) === -1 && tok !== ')') expr = '';
          justEval = false;
        }
        expr += tok; update();
      }
      function equals() {
        if (!expr.trim()) return;
        try {
          const r = TB.calcEval(expr, { deg });
          const rs = fmt(r);
          pushHist(expr, rs);
          expr = rs; justEval = true; update();
        } catch (e) { exprEl.textContent = '表达式错误'; valEl.textContent = ''; }
      }
      function clearAll() { expr = ''; justEval = false; update(); }
      function back() { if (justEval) { expr = ''; justEval = false; } else expr = expr.slice(0, -1); update(); }

      // 函数键盘
      const fnDefs = ['sin', 'cos', 'tan', 'ln', 'log', '√', 'x²', 'xʸ', 'n!', 'π'];
      const fnPad = T.el('div', { class: 'keypad func' });
      fnDefs.forEach(label => {
        fnPad.appendChild(T.el('button', { class: 'key fn', text: label, onclick: () => append(TOK[label]) }));
      });

      // 控制条：角度切换 / 清除 / 退格 / 常数 e / 括号
      const degBtn = T.el('button', { class: 'key fn', text: 'RAD', onclick: () => { deg = !deg; degBtn.textContent = deg ? 'DEG' : 'RAD'; } });
      const ctl = T.el('div', { class: 'sci-ctl' }, [
        degBtn,
        T.el('button', { class: 'key fn', text: 'C', onclick: clearAll }),
        T.el('button', { class: 'key fn', text: '⌫', onclick: back }),
        T.el('button', { class: 'key fn', text: 'e', onclick: () => append('e') }),
        T.el('button', { class: 'key fn', text: '(', onclick: () => append('(') }),
        T.el('button', { class: 'key fn', text: ')', onclick: () => append(')') })
      ]);

      function k(label, cls, fn) { return T.el('button', { class: 'key ' + cls, text: label, onclick: fn }); }
      const pad = T.el('div', { class: 'keypad' }, [
        k('7', 'num', () => append('7')), k('8', 'num', () => append('8')), k('9', 'num', () => append('9')), k('÷', 'op', () => append('/')),
        k('4', 'num', () => append('4')), k('5', 'num', () => append('5')), k('6', 'num', () => append('6')), k('×', 'op', () => append('*')),
        k('1', 'num', () => append('1')), k('2', 'num', () => append('2')), k('3', 'num', () => append('3')), k('−', 'op', () => append('-')),
        k('0', 'num wide', () => append('0')), k('.', 'num', () => append('.')), k('=', 'eq', equals)
      ]);

      renderHist(); update();
      c.appendChild(T.el('div', { class: 'calc-host' }, [T.el('div', { class: 'calc' }, [disp, fnPad, ctl, pad])]));
      // 历史记录移至右侧"剩余内容"面板
      if (ctx && ctx.aside) {
        ctx.aside.appendChild(T.el('div', { class: 'aside-card' }, [
          T.el('div', { class: 'aside-title' }, [T.el('span', { class: 'dot' }), T.el('span', { text: '历史记录' })]),
          histEl
        ]));
      }
    }
  });
})();
