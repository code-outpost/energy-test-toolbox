// 日期计算：日期差（两日期相差天数）与日期增减（±N 天）
(function () {
  const T = TB.util;
  TB.register({
    id: 'datecalc', name: '日期计算', category: '计算器',
    desc: '计算两个日期之间相差的天数，或将某日期增减指定天数得到新日期。',
    render(c) {
      function fld(label, val) {
        const inp = T.el('input', { type: 'date', value: val });
        return { wrap: T.el('div', { class: 'field' }, [T.el('label', { text: label }), inp]), inp };
      }
      const today = new Date().toISOString().slice(0, 10);
      const mode = T.el('select', {}, [T.el('option', { value: 'diff', text: '日期差' }), T.el('option', { value: 'add', text: '日期增减' })]);
      const modeWrap = T.el('div', { class: 'field' }, [T.el('label', { text: '模式' }), mode]);
      const d1 = fld('起始日期', today);
      const d2 = fld('结束日期', today);
      const addN = T.el('input', { type: 'number', value: '30', step: '1' });
      const addWrap = T.el('div', { class: 'field' }, [T.el('label', { text: '增减天数 N' }), addN]);
      const out = T.el('div', {});

      function parse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
      function fmt(dt) { const y = dt.getFullYear(), m = String(dt.getMonth() + 1).padStart(2, '0'), d = String(dt.getDate()).padStart(2, '0'); return y + '-' + m + '-' + d; }
      function show() {
        const isDiff = mode.value === 'diff';
        d2.wrap.style.display = isDiff ? '' : 'none';
        addWrap.style.display = isDiff ? 'none' : '';
      }
      function calc() {
        out.innerHTML = '';
        const m = mode.value || 'diff';
        if (m === 'diff') {
          const a = parse(d1.inp.value), b = parse(d2.inp.value);
          if (isNaN(a) || isNaN(b)) { out.appendChild(T.el('div', { class: 'error', text: '请选择两个日期。' })); return; }
          const days = Math.round((b - a) / 86400000);
          const yrs = (days / 365.25).toFixed(1);
          const box = T.el('div', { class: 'result-box' }, [
            T.el('div', { class: 'big', text: (days >= 0 ? days : -days) + ' 天' }),
            T.el('div', { class: 'hint', text: (days < 0 ? '结束早于开始 ' : '相差 ') + '约 ' + yrs + ' 年' })
          ]);
          out.appendChild(box);
        } else {
          const a = parse(d1.inp.value), n = parseInt(addN.value, 10);
          if (isNaN(a) || isNaN(n)) { out.appendChild(T.el('div', { class: 'error', text: '请选择日期并输入整数天数。' })); return; }
          const r = new Date(a.getTime() + n * 86400000);
          const box = T.el('div', { class: 'result-box' }, [
            T.el('div', { class: 'big', text: fmt(r) }),
            T.el('div', { class: 'hint', text: fmt(a) + ' ' + (n >= 0 ? '+' : '') + n + ' 天' })
          ]);
          out.appendChild(box);
        }
      }
      mode.addEventListener('change', () => { show(); calc(); });
      [d1.inp, d2.inp, addN].forEach(e => e.addEventListener('input', calc));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '日期计算' }),
        T.el('div', { class: 'form-grid' }, [modeWrap, d1.wrap, d2.wrap, addWrap]),
        out
      ]));
      show(); calc();
    }
  });
})();
