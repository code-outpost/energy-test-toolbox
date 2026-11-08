// 表达式计算：复用共享安全引擎 TB.calcEval（无 eval）
(function () {
  const T = TB.util;

  TB.register({
    id: 'calc', name: '表达式计算', category: '计算器',
    desc: '高级表达式计算（+ - * / % ^ 括号，函数 sqrt/abs/pow/sin/cos/tan/log/ln/exp/min/max/fact… 常量 pi/e），不使用 eval。',
    render(c) {
      const inArea = T.el('input', { type: 'text', class: 'mono', style: 'width:100%', placeholder: '如 (1+2)*3^2 - sqrt(16)' });
      const out = T.el('div', { class: 'col' });
      const degChk = T.el('input', { type: 'checkbox' });
      function run() {
        out.innerHTML = '';
        const v = inArea.value.trim();
        if (!v) return;
        try {
          const r = TB.calcEval(v, { deg: degChk.checked });
          out.appendChild(T.el('div', { class: 'tag', text: '= ' + r }));
        } catch (e) { out.appendChild(T.el('div', { class: 'error', text: e.message })); }
      }
      inArea.addEventListener('input', run);
      inArea.value = '(1+2)*3^2 - sqrt(16)';
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '表达式计算' }),
        T.el('div', { class: 'field' }, [T.el('label', { text: '表达式' }), inArea]),
        T.el('div', { class: 'row', style: 'gap:8px;align-items:center' }, [degChk, T.el('label', { text: '角度模式(DEG) — 影响三角函数', style: 'margin:0' })]),
        T.el('div', { class: 'hint', text: '支持: 运算符 +-*/%^、括号、函数(sqrt cbrt abs sin cos tan asin acos atan ln log exp pow min max fact 10x)、常量 pi e。' }),
        out
      ]));
      run();
    }
  });
})();
