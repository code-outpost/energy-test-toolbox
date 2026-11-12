// CT/PT 二次负荷与精度校核：变比、准确级、二次负荷(VA)、二次回路导线压降对精度影响
(function () {
  const T = TB.util;
  const GAMMA_CU = 57; // m/(Ω·mm²) 铜电导率
  TB.register({
    id: 'ct-pt', name: 'CT/PT 二次负荷与精度', category: '高压电工',
    desc: '计算电流互感器/电压互感器变比，校核二次负荷(VA)、二次回路导线压降对测量精度的影响。',
    limits: [
      '输入范围：一/二次电流、电压为正；导线长度、截面为正；准确级按铭牌',
      '适用边界：二次导线电阻 R=2L/(γA)（铜γ≈57），仅计电阻分量，忽略电抗',
      'CT 精度以「二次负荷 VA ≤ 额定」为准；PT 精度以「二次压降% ≤ 限值」为准',
      '警告：实际准确级还受二次负荷功率因数、暂态特性影响，须以铭牌与 GB 1208/20840 为准'
    ],
    refs: [
      'CT 变比 K = I₁ₙ/I₂ₙ；二次负荷 S₂ = I₂ₙ²·R + S_仪表 ≤ S₂rated 方可保证准确级',
      'PT 变比 K = U₁ₙ/U₂ₙ；二次压降 ΔU = I₂·R，压降% = ΔU/U₂ₙ×100 ≤ 限值(计量 0.2/0.5%)',
      '依据 GB 1208《电流互感器》、GB 20840《电压互感器》'
    ],
    render(c) {
      function fld(label, val, unit) {
        const inp = T.el('input', { type: 'number', value: val, step: 'any' });
        return { wrap: T.el('div', { class: 'field' }, [T.el('label', { text: label }), inp, unit ? T.el('span', { class: 'suffix', text: unit }) : null]), inp };
      }
      const ctI1 = fld('CT 一次电流 I₁ₙ', '600', 'A');
      const ctI2 = fld('CT 二次电流 I₂ₙ', '5', 'A');
      const ctL = fld('二次导线长 L', '20', 'm');
      const ctA = fld('导线截面 A', '4', 'mm²');
      const ctSm = fld('仪表负荷 S_仪表', '2', 'VA');
      const ctSr = fld('额定二次负荷', '10', 'VA');
      const ptU1 = fld('PT 一次电压 U₁ₙ', '10000', 'V');
      const ptU2 = fld('PT 二次电压 U₂ₙ', '100', 'V');
      const ptL = fld('二次导线长 L', '200', 'm');
      const ptA = fld('导线截面 A', '2.5', 'mm²');
      const ptI2 = fld('二次电流 I₂', '0.1', 'A');
      const ptSr = fld('额定二次负荷', '50', 'VA');
      const ptLim = fld('压降限值', '0.5', '%');
      const out = T.el('div', {});

      function calc() {
        out.innerHTML = '';
        const I1 = parseFloat(ctI1.inp.value), I2 = parseFloat(ctI2.inp.value), L = parseFloat(ctL.inp.value), A = parseFloat(ctA.inp.value), Sm = parseFloat(ctSm.inp.value), Sr = parseFloat(ctSr.inp.value);
        if ([I1, I2, L, A, Sm, Sr].every(isFinite) && I1 > 0 && I2 > 0 && L > 0 && A > 0) {
          const K = I1 / I2;
          const R = 2 * L / (GAMMA_CU * A);
          const Sact = I2 * I2 * R + Sm;
          const ok = Sact <= Sr;
          const ctBox = T.el('div', { class: 'result-box' }, [
            T.el('div', { class: 'big', text: 'CT 变比 = ' + K.toFixed(0) }),
            T.el('div', { class: 'hint', text: 'I₁ₙ/I₂ₙ = ' + I1 + '/' + I2 })
          ]);
          const ctRows = [
            ['变比 K', K.toFixed(0) + ' : 1'],
            ['二次导线电阻 R', R.toFixed(4) + ' Ω'],
            ['实际二次负荷', Sact.toFixed(2) + ' VA'],
            ['额定二次负荷', Sr.toFixed(0) + ' VA'],
            ['负荷校核', ok ? '✓ 合格（' + Sact.toFixed(2) + '≤' + Sr + '）' : '✗ 超差（' + Sact.toFixed(2) + '>' + Sr + '）']
          ];
          const ctTbl = T.el('table', {}, [
            T.el('tr', {}, [T.el('th', { text: 'CT' }), T.el('th', { text: '数值' })]),
            ...ctRows.map(r => T.el('tr', {}, [T.el('td', { text: r[0] }), T.el('td', { text: r[1] })]))
          ]);
          out.appendChild(ctBox); out.appendChild(ctTbl);
        } else {
          out.appendChild(T.el('div', { class: 'error', text: 'CT：请输入有效一/二次电流、导线长与截面。' }));
        }
        const U1 = parseFloat(ptU1.inp.value), U2 = parseFloat(ptU2.inp.value), pL = parseFloat(ptL.inp.value), pA = parseFloat(ptA.inp.value), pI2 = parseFloat(ptI2.inp.value), pSr = parseFloat(ptSr.inp.value), pLim = parseFloat(ptLim.inp.value);
        if ([U1, U2, pL, pA, pI2, pSr, pLim].every(isFinite) && U1 > 0 && U2 > 0 && pL > 0 && pA > 0) {
          const K = U1 / U2;
          const R = 2 * pL / (GAMMA_CU * pA);
          const dU = pI2 * R;
          const dPct = dU / U2 * 100;
          const ok = dPct <= pLim;
          const ptRows = [
            ['变比 K', K.toFixed(0) + ' : 1'],
            ['二次导线电阻 R', R.toFixed(4) + ' Ω'],
            ['二次压降 ΔU', dU.toFixed(4) + ' V'],
            ['压降率', dPct.toFixed(3) + ' %'],
            ['限值', pLim.toFixed(2) + ' %'],
            ['精度校核', ok ? '✓ 合格（' + dPct.toFixed(3) + '≤' + pLim + '）' : '✗ 超差']
          ];
          const ptTbl = T.el('table', {}, [
            T.el('tr', {}, [T.el('th', { text: 'PT' }), T.el('th', { text: '数值' })]),
            ...ptRows.map(r => T.el('tr', {}, [T.el('td', { text: r[0] }), T.el('td', { text: r[1] })]))
          ]);
          out.appendChild(T.el('h4', { text: '电压互感器 PT' }));
          out.appendChild(ptTbl);
        } else {
          out.appendChild(T.el('div', { class: 'error', text: 'PT：请输入有效一/二次电压、导线长与截面。' }));
        }
      }
      const all = [ctI1.inp, ctI2.inp, ctL.inp, ctA.inp, ctSm.inp, ctSr.inp, ptU1.inp, ptU2.inp, ptL.inp, ptA.inp, ptI2.inp, ptSr.inp, ptLim.inp];
      all.forEach(e => e.addEventListener('input', calc));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: 'CT/PT 二次负荷与精度校核' }),
        T.el('div', { class: 'form-grid' }, [ctI1.wrap, ctI2.wrap, ctL.wrap, ctA.wrap, ctSm.wrap, ctSr.wrap, ptU1.wrap, ptU2.wrap, ptL.wrap, ptA.wrap, ptI2.wrap, ptSr.wrap, ptLim.wrap]),
        out
      ]));
      calc();
    }
  });
})();
