// 变压器参数与变比：额定一/二次电流、变比、负载电流折算
(function () {
  const T = TB.util;
  TB.register({
    id: 'hv-transformer', name: '变压器参数与变比', category: '高压电工',
    desc: '输入容量与一/二次侧电压，计算额定一、二次电流与电压/电流变比；并支持按一次侧实际电流折算二次侧电流。',
    refs: ["三相变压器额定电流 I = S/(√3·U)，定义见 GB/T 1094.1《电力变压器 第1部分：总则》","电压变比 k = U₁/U₂，电流变比与之互为倒数关系；分接位置以铭牌为准","短路阻抗、接线组别等参数参见 GB/T 1094 系列与出厂试验报告"],
    tips: ['三相变压器额定电流 I = S×1000 / (√3·U)', '电压变比 k = U₁/U₂，电流变比 ≈ k（I₂ ≈ k·I₁）', '10kV/0.4kV 配变常用容量 50~2000kVA', 'Yyn0 / Dyn11 为常见接线组别'],
    ref: [{ k: '额定电流', v: 'I = S/(√3·U)（三相）' }, { k: '变比', v: 'k = U₁/U₂ = I₂/I₁' }],
    render(c) {
      function fld(label, val, unit, id) {
        const inp = T.el('input', { type: 'number', value: val, step: 'any', id: id });
        return { wrap: T.el('div', { class: 'field' }, [T.el('label', { text: label }), inp, unit ? T.el('span', { class: 'suffix', text: unit }) : null]), inp };
      }
      const s = fld('容量 S', '800', 'kVA', 'tf_s');
      const u1 = fld('一次侧电压 U₁', '10000', 'V', 'tf_u1');
      const u2 = fld('二次侧电压 U₂', '400', 'V', 'tf_u2');
      const i1a = fld('一次侧实际电流 I₁′', '10', 'A', 'tf_i1a');

      const out = T.el('div', {});
      function calc() {
        const S = parseFloat(s.inp.value), U1 = parseFloat(u1.inp.value), U2 = parseFloat(u2.inp.value), I1a = parseFloat(i1a.inp.value);
        out.innerHTML = '';
        if (![S, U1, U2].every(x => isFinite(x)) || S <= 0 || U1 <= 0 || U2 <= 0) {
          out.appendChild(T.el('div', { class: 'error', text: '请检查输入：容量与电压均需为正数。' })); return;
        }
        const r3 = Math.sqrt(3);
        const I1 = S * 1000 / (r3 * U1);
        const I2 = S * 1000 / (r3 * U2);
        const k = U1 / U2;
        const I2a = isFinite(I1a) ? I1a * k : null;
        const box = T.el('div', { class: 'result-box' }, [
          T.el('div', { class: 'big', text: 'I₁=' + I1.toFixed(1) + ' A   I₂=' + I2.toFixed(1) + ' A' }),
          T.el('div', { class: 'hint', text: '电压变比 k = ' + k.toFixed(2) + '（电流变比 ≈ k）' })
        ]);
        const rows = [
          ['额定一次电流 I₁', I1.toFixed(1) + ' A', 'S×1000/(√3·U₁)'],
          ['额定二次电流 I₂', I2.toFixed(1) + ' A', 'S×1000/(√3·U₂)'],
          ['电压变比 k', k.toFixed(2), 'U₁/U₂'],
          ['电流变比', k.toFixed(2), 'I₂/I₁ ≈ k']
        ];
        if (I2a !== null) rows.push(['二次侧折算电流 I₂′', I2a.toFixed(1) + ' A', 'I₁′ × k']);
        const tbl = T.el('table', {}, [
          T.el('tr', {}, [T.el('th', { text: '项目' }), T.el('th', { text: '数值' }), T.el('th', { text: '公式' })])
        ].concat(rows.map(r => T.el('tr', {}, [T.el('td', { text: r[0] }), T.el('td', { text: r[1] }), T.el('td', { class: 'hint', text: r[2] })]))));
        out.appendChild(box); out.appendChild(tbl);
      }
      [s.inp, u1.inp, u2.inp, i1a.inp].forEach(e => e.addEventListener('input', calc));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '变压器额定参数与变比' }),
        T.el('div', { class: 'form-grid' }, [s.wrap, u1.wrap, u2.wrap, i1a.wrap]),
        out
      ]));
      calc();
    }
  });
})();
