// 感抗·容抗·谐振
(function () {
  const T = TB.util;
  TB.register({
    id: 'hv-reactance', name: '感抗·容抗·谐振', category: '高压电工',
    desc: '计算电感感抗 XL=2πfL、电容容抗 XC=1/(2πfC)，并由 L、C 求串联/并联谐振频率 f₀。',
    refs: ["感抗 XL = 2πfL，容抗 XC = 1/(2πfC)，出自正弦交流电路基本理论","串联谐振频率 f₀ = 1/(2π√(LC))，此时 XL = XC","单位换算：L 用 H、C 用 F、f 用 Hz"],
    tips: ['感抗 XL = 2πfL（Ω）', '容抗 XC = 1/(2πfC)（Ω）', '谐振频率 f₀ = 1/(2π√(LC))', '工频 f=50Hz'],
    ref: [{ k: '感抗', v: 'XL = 2πfL' }, { k: '容抗', v: 'XC = 1/(2πfC)' }, { k: '谐振', v: 'f₀ = 1/(2π√(LC))' }],
    render(c) {
      function fld(label, val, unit, id) {
        const inp = T.el('input', { type: 'number', value: val, step: 'any', id: id });
        return { wrap: T.el('div', { class: 'field' }, [T.el('label', { text: label }), inp, unit ? T.el('span', { class: 'suffix', text: unit }) : null]), inp };
      }
      const f = fld('频率 f', '50', 'Hz', 'rx_f');
      const l = fld('电感 L', '100', 'mH', 'rx_l');
      const cc = fld('电容 C', '10', 'μF', 'rx_c');
      const out = T.el('div', {});
      function calc() {
        const F = parseFloat(f.inp.value), Lm = parseFloat(l.inp.value), Cm = parseFloat(cc.inp.value);
        out.innerHTML = '';
        if (!isFinite(F) || F <= 0) { out.appendChild(T.el('div', { class: 'error', text: '频率需为正数(Hz)。' })); return; }
        const w = 2 * Math.PI * F;
        const rows = [];
        if (isFinite(Lm) && Lm > 0) rows.push(['感抗 XL', (w * (Lm / 1000)).toFixed(2) + ' Ω', '2πfL']);
        if (isFinite(Cm) && Cm > 0) rows.push(['容抗 XC', (1 / (w * (Cm / 1e6))).toFixed(2) + ' Ω', '1/(2πfC)']);
        if (isFinite(Lm) && Lm > 0 && isFinite(Cm) && Cm > 0) {
          const f0 = 1 / (2 * Math.PI * Math.sqrt((Lm / 1000) * (Cm / 1e6)));
          rows.push(['谐振频率 f₀', f0.toFixed(2) + ' Hz', '1/(2π√(LC))']);
        }
        if (!rows.length) { out.appendChild(T.el('div', { class: 'hint', text: '请输入电感 L 或电容 C（二者都填可算谐振频率）。' })); return; }
        const box = T.el('div', { class: 'result-box' }, rows.slice(0, 1).map(r => T.el('div', { class: 'big', text: r[0] + ' = ' + r[1] })));
        const tbl = T.el('table', {}, [
          T.el('tr', {}, [T.el('th', { text: '项目' }), T.el('th', { text: '数值' }), T.el('th', { text: '公式' })])
        ].concat(rows.map(r => T.el('tr', {}, [T.el('td', { text: r[0] }), T.el('td', { text: r[1] }), T.el('td', { class: 'hint', text: r[2] })]))));
        out.appendChild(box); out.appendChild(tbl);
      }
      [f.inp, l.inp, cc.inp].forEach(e => e.addEventListener('input', calc));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '感抗 · 容抗 · 谐振' }),
        T.el('div', { class: 'form-grid' }, [f.wrap, l.wrap, cc.wrap]),
        out
      ]));
      calc();
    }
  });
})();
