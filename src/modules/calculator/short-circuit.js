// 短路电流估算：系统短路容量法 / 变压器低压侧法，三相·两相·单相短路电流、冲击系数、分断校核
(function () {
  const T = TB.util;
  const r3 = Math.sqrt(3);
  TB.register({
    id: 'short-circuit', name: '短路电流估算', category: '电力计算',
    desc: '由系统短路容量或变压器参数估算三相/两相/单相短路电流与冲击电流，并校核断路器分断能力。',
    limits: [
      '输入范围：Un、Sk、S、Uk%、U2 为正，冲击系数 k 取 1.0~2.0（近发电机取 1.8，配电网络常取 1.3~1.8）',
      '适用边界：对称短路初始值（有效值），未计系统 X/R 与短路点的过渡电阻',
      '两相短路电流 I₂ ≈ 0.866·I₃；单相短路电流为估算值（按系数 0.5~0.6×I₃，需以序网计算为准）',
      '警告：分断能力校核以 I₃ 为基准，实际应选 I_cu ≥ 安装处预期短路电流'
    ],
    refs: [
      '三相短路电流 I₃ = S_k / (√3·U_n)（系统法，S_k 单位 MVA、U_n 单位 kV 时结果单位为 kA）',
      '变压器低压侧 I₃ ≈ S / (√3·U₂·U_k%/100)（S 单位 kVA 须×1000 化为 VA）',
      '冲击电流 i_p = √2·k·I₃；断路器分断能力 I_cu ≥ I₃；依据 GB/T 11022 / IEC 60909'
    ],
    render(c) {
      function fld(label, val, unit) {
        const inp = T.el('input', { type: 'number', value: val, step: 'any' });
        return { wrap: T.el('div', { class: 'field' }, [T.el('label', { text: label }), inp, unit ? T.el('span', { class: 'suffix', text: unit }) : null]), inp };
      }
      const un = fld('系统标称电压 Uₙ', '10', 'kV');
      const sk = fld('系统短路容量 Sₖ', '200', 'MVA');
      const k = fld('冲击系数 k', '1.8', '');
      const icu = fld('断路器分断 I_cu', '25', 'kA');
      const ts = fld('变压器容量 S', '800', 'kVA');
      const tuk = fld('阻抗电压 Uₖ%', '6', '%');
      const tu2 = fld('低压侧电压 U₂', '0.4', 'kV');
      const i1coef = fld('单相系数', '0.58', '');
      const out = T.el('div', {});
      let lastI3 = null;

      function fmtK(n) { return n.toFixed(3); }
      function calc() {
        out.innerHTML = '';
        const Un = parseFloat(un.inp.value), Sk = parseFloat(sk.inp.value), K = parseFloat(k.inp.value), Icu = parseFloat(icu.inp.value), coef = parseFloat(i1coef.inp.value);
        if (!isFinite(Un) || !isFinite(Sk) || Un <= 0 || Sk <= 0) {
          out.appendChild(T.el('div', { class: 'error', text: '系统法：请输入有效 Uₙ、Sₖ。' }));
        } else {
          const I3 = Sk / (r3 * Un);
          lastI3 = I3;
          const I2 = I3 * 0.866025;
          const I1 = I3 * (isFinite(coef) ? coef : 0.58);
          const ip = Math.SQRT2 * K * I3;
          const ok = I3 <= Icu;
          const box = T.el('div', { class: 'result-box' }, [
            T.el('div', { class: 'big', text: 'I₃ = ' + fmtK(I3) + ' kA' }),
            T.el('div', { class: 'hint', text: '系统短路容量法（Sₖ/√3·Uₙ）' })
          ]);
          const rows = [
            ['三相短路电流 I₃', fmtK(I3) + ' kA'],
            ['两相短路电流 I₂', fmtK(I2) + ' kA'],
            ['单相短路电流 I₁(估算)', fmtK(I1) + ' kA'],
            ['冲击电流 i_p', fmtK(ip) + ' kA'],
            ['分断校核 (' + Icu + 'kA)', ok ? '✓ 合格（I₃≤I_cu）' : '✗ 不足（需≥' + fmtK(I3) + 'kA）']
          ];
          const tbl = T.el('table', {}, [
            T.el('tr', {}, [T.el('th', { text: '项目' }), T.el('th', { text: '数值' })]),
            ...rows.map(r => T.el('tr', {}, [T.el('td', { text: r[0] }), T.el('td', { text: r[1] })]))
          ]);
          out.appendChild(box); out.appendChild(tbl);
        }
        const S2 = parseFloat(ts.inp.value), Uk = parseFloat(tuk.inp.value), U2 = parseFloat(tu2.inp.value);
        if (isFinite(S2) && isFinite(Uk) && isFinite(U2) && S2 > 0 && Uk > 0 && U2 > 0) {
          const I3t = S2 * 100 / (r3 * (U2 * 1000) * Uk);
          const ipt = Math.SQRT2 * K * I3t;
          const row2 = T.el('table', {}, [
            T.el('tr', {}, [T.el('th', { text: '变压器低压侧' }), T.el('th', { text: '数值' })]),
            T.el('tr', {}, [T.el('td', { text: 'I₃(低压侧)' }), T.el('td', { text: fmtK(I3t) + ' kA' })]),
            T.el('tr', {}, [T.el('td', { text: '冲击电流 i_p' }), T.el('td', { text: fmtK(ipt) + ' kA' })])
          ]);
          out.appendChild(T.el('h4', { text: '变压器低压侧短路' }));
          out.appendChild(row2);
        }
      }
      const all = [un.inp, sk.inp, k.inp, icu.inp, ts.inp, tuk.inp, tu2.inp, i1coef.inp];
      all.forEach(e => e.addEventListener('input', calc));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '短路电流估算' }),
        T.el('div', { class: 'form-grid' }, [un.wrap, sk.wrap, k.wrap, icu.wrap, i1coef.wrap, ts.wrap, tuk.wrap, tu2.wrap]),
        out
      ]));
      calc();
    }
  });
})();
