// 电动机额定电流与启动电流
(function () {
  const T = TB.util;
  TB.register({
    id: 'hv-motor', name: '电动机额定电流', category: '高压电工',
    desc: '计算三相/单相电动机额定电流（精确法 I=P/(√3·U·η·cosφ)）与 380V 经验估算(≈2A/kW)，并给出直接启动电流范围。',
    tips: ['三相电机额定电流 I = P×1000/(√3·U·η·cosφ)', '380V 三相电机经验估算：I ≈ 2×P(kW) A', '直接启动电流 Iq ≈ (5~7)×I', '单相电机 I = P×1000/(U·η·cosφ)'],
    ref: [{ k: '精确', v: 'I = P/(√3·U·η·cosφ)' }, { k: '经验', v: '380V ≈ 2A/kW' }],
    render(c) {
      function fld(label, val, unit, id) {
        const inp = T.el('input', { type: 'number', value: val, step: 'any', id: id });
        return { wrap: T.el('div', { class: 'field' }, [T.el('label', { text: label }), inp, unit ? T.el('span', { class: 'suffix', text: unit }) : null]), inp };
      }
      const p = fld('功率 P', '30', 'kW', 'mt_p');
      const u = fld('电压 U', '380', 'V', 'mt_u');
      const eta = fld('效率 η', '0.92', '', 'mt_eta');
      const cos = fld('功率因数 cosφ', '0.86', '', 'mt_cos');
      const type = T.el('select', {}, [T.el('option', { value: '3', text: '三相' }), T.el('option', { value: '1', text: '单相' })]);
      const typeWrap = T.el('div', { class: 'field' }, [T.el('label', { text: '电机类型' }), type]);
      const out = T.el('div', {});
      function calc() {
        const P = parseFloat(p.inp.value), U = parseFloat(u.inp.value), e = parseFloat(eta.inp.value), cf = parseFloat(cos.inp.value);
        out.innerHTML = '';
        if (![P, U].every(x => isFinite(x)) || P <= 0 || U <= 0) {
          out.appendChild(T.el('div', { class: 'error', text: '请检查输入：功率与电压需为正数。' })); return;
        }
        const is3 = type.value === '3';
        const I = is3 ? P * 1000 / (Math.sqrt(3) * U * (e || 1) * (cf || 1)) : P * 1000 / (U * (e || 1) * (cf || 1));
        const exp = is3 ? 2 * P : null;
        const iqLo = 5 * I, iqHi = 7 * I;
        const box = T.el('div', { class: 'result-box' }, [
          T.el('div', { class: 'big', text: 'I = ' + I.toFixed(1) + ' A' }),
          T.el('div', { class: 'hint', text: is3 ? ('380V 经验估算 ≈ ' + (exp ? exp.toFixed(0) : '—') + ' A（约 2A/kW）') : '单相电机无 2A/kW 经验值' })
        ]);
        const rows = [
          ['额定电流 I', I.toFixed(1) + ' A', is3 ? 'P×1000/(√3·U·η·cosφ)' : 'P×1000/(U·η·cosφ)'],
          ['直接启动电流 Iq', iqLo.toFixed(0) + ' ~ ' + iqHi.toFixed(0) + ' A', '(5~7)×I']
        ];
        if (exp !== null) rows.push(['经验估算(380V)', exp.toFixed(0) + ' A', '≈2×P(kW)']);
        const tbl = T.el('table', {}, [
          T.el('tr', {}, [T.el('th', { text: '项目' }), T.el('th', { text: '数值' }), T.el('th', { text: '公式' })])
        ].concat(rows.map(r => T.el('tr', {}, [T.el('td', { text: r[0] }), T.el('td', { text: r[1] }), T.el('td', { class: 'hint', text: r[2] })]))));
        out.appendChild(box); out.appendChild(tbl);
      }
      [p.inp, u.inp, eta.inp, cos.inp, type].forEach(e => e.addEventListener('input', calc));
      type.addEventListener('change', calc);
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '电动机额定电流与启动电流' }),
        T.el('div', { class: 'form-grid' }, [p.wrap, u.wrap, eta.wrap, cos.wrap, typeWrap]),
        out
      ]));
      calc();
    }
  });
})();
