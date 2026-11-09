// 三相功率计算器：P = √3 · U(线) · I(线) · cosφ
(function () {
  const T = TB.util;
  const SQRT3 = Math.sqrt(3);

  TB.register({
    id: 'threephase', name: '三相功率', category: '计算器',
    desc: '三相有功功率 P=√3·U·I·cosφ（线电压/线电流），可反算电流或电压；同时给出单相功率参考。',
    accepts: ["active","voltage","current"],
    limits: ["输入范围：cosφ ∈ (0, 1]，U、I、P 为正数；留空一项即可自动反算","适用边界：三相对称负载正弦稳态，U / I 均为线值，未计不平衡与谐波","示例：U=400 V、I=10 A、cosφ=0.8 ⇒ P ≈ 5.54 kW","警告：单相负荷或不平衡系统不能直接套用 √3 关系"],
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
      let last = null;
      if (TB.bus) {
        const rr = TB.bus.consume('threephase', [
          { el: f.P, family: 'active', unit: 'W', label: '有功功率 P' },
          { el: f.U, family: 'voltage', unit: 'V', label: '线电压 U' },
          { el: f.I, family: 'current', unit: 'A', label: '线电流 I' }
        ]);
        if (rr && rr.filled && TB.toast) TB.toast('已引用「' + rr.label + '」= ' + rr.value + ' ' + rr.unit + ' 填入' + rr.target + '，请补全 cosφ 后计算', 'ok');
      }

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
        last = { P: r.P, U: U, I: I, cos: cos };
      }
      function fmt(n) { return Math.round(n * 1e6) / 1e6; }
      function publish() {
        if (!last || !isFinite(last.P) || !TB.bus) { if (TB.toast) TB.toast('请先完成一次有效计算', 'warn'); return; }
        TB.bus.publish('threephase', '三相有功功率 P', Number((last.P / 1000).toFixed(4)), 'kW', { note: 'P = √3·U·I·cosφ' });
        if (TB.toast) TB.toast('已发布三相有功功率，可送入「功率因数补偿」继续算补偿容量', 'ok');
      }

      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '三相有功功率计算' }),
        grid,
        T.el('div', { class: 'row', style: 'margin-top:6px' }, [
          T.el('button', { class: 'btn primary', text: '计算', onclick: compute }),
          T.el('button', { class: 'btn ghost', text: '发布结果', onclick: publish }),
          T.el('button', { class: 'btn ghost', text: '清空', onclick: () => { defs.forEach(([k]) => f[k].value = ''); out.innerHTML = ''; last = null; } })
        ]),
        out
      ]));
    }
  });
})();
