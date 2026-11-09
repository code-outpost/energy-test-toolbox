// 三相功率计算器：P = √3 · U(线) · I(线) · cosφ
(function () {
  const T = TB.util;
  const SQRT3 = Math.sqrt(3);

  TB.register({
    id: 'threephase', name: '三相功率', category: '计算器',
    desc: '三相有功功率 P=√3·U·I·cosφ（线电压/线电流），可反算电流或电压；同时给出单相功率参考。',
    refs: ["三相对称负载：P = √3·U·I·cosφ，S = √3·U·I，Q = √3·U·I·sinφ（U、I 为线值）","功率因数 cosφ = P/S；无功补偿与线损计算均以此为基础"],
    render(c) {
      const f = {};
      const defs = [
        ['U', '线电压 U', 'V'],
        ['I', '线电流 I', 'A'],
        ['cos', '功率因数 cosφ', ''],
        ['P', '有功功率 P', 'W']
      ];
      const grid = T.el('div', { class: 'form-grid' });
      defs.forEach(([key, label, unit]) => {
        const inp = T.el('input', { type: 'number', step: 'any', placeholder: '留空自动求' });
        f[key] = inp;
        grid.appendChild(T.el('div', { class: 'field' }, [
          T.el('label', { text: label }),
          T.el('div', { class: 'row', style: 'gap:6px' }, [inp, unit ? T.el('span', { class: 'suffix', text: unit }) : null])
        ]));
      });
      const out = T.el('div', {});

      function compute() {
        out.innerHTML = '';
        const U = f.U.value.trim() === '' ? null : parseFloat(f.U.value);
        const I = f.I.value.trim() === '' ? null : parseFloat(f.I.value);
        const cos = f.cos.value.trim() === '' ? null : parseFloat(f.cos.value);
        const P = f.P.value.trim() === '' ? null : parseFloat(f.P.value);

        if (cos === null) { out.appendChild(T.el('div', { class: 'error', text: '功率因数 cosφ 必填。' })); return; }
        if (cos <= 0 || cos > 1) { out.appendChild(T.el('div', { class: 'error', text: 'cosφ 应在 (0, 1] 之间。' })); return; }

        let r = {};
        const set = (k, v, field) => { if (v !== null && !isNaN(v)) { r[k] = v; if (field && (field.value.trim() === '')) field.value = Math.round(v * 1e6) / 1e6; } };

        if (P === null && U !== null && I !== null) {
          r.P = SQRT3 * U * I * cos;
          r.P1 = U * I * cos;
          set('P', r.P, f.P);
        } else if (I === null && U !== null && P !== null) {
          r.I = P / (SQRT3 * U * cos); set('I', r.I, f.I);
          r.P1 = U * r.I * cos;
        } else if (U === null && I !== null && P !== null) {
          r.U = P / (SQRT3 * I * cos); set('U', r.U, f.U);
          r.P1 = r.U * I * cos;
        } else if (U !== null && I !== null && P !== null) {
          r.P = SQRT3 * U * I * cos; r.P1 = U * I * cos;
          out.appendChild(T.el('div', { class: 'hint', text: '三项已填，按下式校验：P=√3·U·I·cosφ' }));
        } else {
          out.appendChild(T.el('div', { class: 'error', text: '请填写 U、I 其中之一，或填写 P，并配合 cosφ 求解。' })); return;
        }

        const box = T.el('div', { class: 'result-box' });
        box.appendChild(T.el('div', { class: 'big', text: '三相 P = ' + fmt(r.P) + ' W' }));
        box.appendChild(T.el('div', { text: '≈ ' + fmt(r.P / 1000) + ' kW' }));
        box.appendChild(T.el('div', { text: '单相参考 P₁ = ' + fmt(r.P1) + ' W' }));
        box.appendChild(T.el('div', { class: 'hint', style: 'margin-top:6px', text: '公式：P = √3 × U × I × cosφ' }));
        out.appendChild(box);
      }
      function fmt(n) { return Math.round(n * 1e6) / 1e6; }

      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '三相有功功率计算' }),
        grid,
        T.el('div', { class: 'row', style: 'margin-top:6px' }, [
          T.el('button', { class: 'btn primary', text: '计算', onclick: compute }),
          T.el('button', { class: 'btn ghost', text: '清空', onclick: () => { defs.forEach(([k]) => f[k].value = ''); out.innerHTML = ''; } })
        ]),
        out
      ]));
    }
  });
})();
