// 谐波与电能质量：THD 总畸变率、各次谐波含有率、cosφ↔有功/无功换算（电能质量评估）
(function () {
  const T = TB.util;
  TB.register({
    id: 'power-quality', name: '谐波与电能质量', category: '电力计算',
    desc: '输入基波与主要谐波分量，计算电压/电流总谐波畸变率 THD 与各次含有率；并提供 cosφ↔有功/无功换算。',
    limits: [
      '输入范围：基波与各次谐波均为非负实数（单位一致，V 或 A）',
      '适用边界：THD 按 GB/T 14549 / IEC 61000 定义 U_thd = √(ΣU_h²)/U_1，未计间谐波与直流分量',
      '谐波含有率 HR_n = U_n/U_1，限值参照 GB/T 14549 注入公共连接点允许值',
      '警告：cosφ↔无功换算为总有功下的近似，未计不平衡与谐波功率'
    ],
    refs: [
      'THD = √(Σ_{h≥2} U_h²) / U_1 × 100%（电压总谐波畸变率，GB/T 14549 / IEC 61000）',
      '谐波含有率 HR_n = U_n / U_1 × 100%；cosφ 换算 Q = P·tanφ，S = P/cosφ',
      '电能质量标准参见 GB/T 14549《电能质量 公用电网谐波》、GB/T 12325 供电电压偏差'
    ],
    render(c) {
      function fld(label, val, unit) {
        const inp = T.el('input', { type: 'number', value: val, step: 'any' });
        return { wrap: T.el('div', { class: 'field' }, [T.el('label', { text: label }), inp, unit ? T.el('span', { class: 'suffix', text: unit }) : null]), inp };
      }
      const v1 = fld('基波 U₁', '230', 'V');
      const hs = {};
      ['H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H9', 'H11', 'H13'].forEach(n => {
        hs[n] = fld(n, n === 'H3' ? '23' : n === 'H5' ? '11.5' : '0', 'V');
      });
      const p = fld('有功 P', '100', 'kW');
      const cosf = fld('功率因数 cosφ', '0.85', '');
      const out = T.el('div', {});

      function calc() {
        out.innerHTML = '';
        const U1 = parseFloat(v1.inp.value);
        const H = {};
        let sumSq = 0;
        for (const n in hs) { const v = parseFloat(hs[n].inp.value); H[n] = isFinite(v) ? v : 0; sumSq += H[n] * H[n]; }
        if (!isFinite(U1) || U1 <= 0) { out.appendChild(T.el('div', { class: 'error', text: '请输入有效基波电压。' })); return; }
        const thd = Math.sqrt(sumSq) / U1 * 100;
        const box = T.el('div', { class: 'result-box' }, [
          T.el('div', { class: 'big', text: 'THD = ' + thd.toFixed(2) + ' %' }),
          T.el('div', { class: 'hint', text: '总谐波畸变率 = √(ΣUₙ²)/U₁' })
        ]);
        const rows = [];
        for (const n in hs) { if (H[n] > 0) rows.push([n + ' 含有率', (H[n] / U1 * 100).toFixed(2) + ' %']); }
        rows.push(['各次平方和', sumSq.toFixed(1) + ' V²']);
        const tbl = T.el('table', {}, [
          T.el('tr', {}, [T.el('th', { text: '项目' }), T.el('th', { text: '数值' })]),
          ...rows.map(r => T.el('tr', {}, [T.el('td', { text: r[0] }), T.el('td', { text: r[1] })]))
        ]);
        const P = parseFloat(p.inp.value), cf = parseFloat(cosf.inp.value);
        let qText = '—';
        if (isFinite(P) && isFinite(cf) && cf > 0 && cf <= 1) {
          const tan = Math.sqrt(1 - cf * cf) / cf;
          const Q = P * tan, S = P / cf;
          qText = 'Q = ' + Q.toFixed(2) + ' kvar，S = ' + S.toFixed(2) + ' kVA（tanφ=' + tan.toFixed(4) + '）';
        }
        out.appendChild(box); out.appendChild(tbl);
        out.appendChild(T.el('div', { class: 'hint', text: 'cosφ 换算：' + qText }));
      }
      const all = [v1.inp, ...Object.values(hs).map(x => x.inp), p.inp, cosf.inp];
      all.forEach(e => e.addEventListener('input', calc));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '谐波与电能质量' }),
        T.el('div', { class: 'form-grid' }, [v1.wrap, hs.H2.wrap, hs.H3.wrap, hs.H4.wrap, hs.H5.wrap, hs.H6.wrap, hs.H7.wrap, hs.H9.wrap, hs.H11.wrap, hs.H13.wrap, p.wrap, cosf.wrap]),
        out
      ]));
      calc();
    }
  });
})();
