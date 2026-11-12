// 电池储能系统 BESS：可用容量、储能时长、PCS 功率、DoD 对循环寿命与往返效率影响
(function () {
  const T = TB.util;
  TB.register({
    id: 'bess', name: '电池储能 BESS', category: '电力计算',
    desc: '输入储能额定能量、PCS 功率、SOC 区间与 DoD，计算可用能量、储能时长(h)、功率比、循环寿命与往返效率影响。',
    accepts: ['energy', 'apparent'],
    limits: [
      '输入范围：E_rated>0，P_PCS>0，0≤SOC₀<SOC₁≤100，0<DoD_max≤100，0<η_rt≤100',
      '适用边界：基于能量法估算，未计温度、倍率特性、一致性衰减与 PCS 效率曲线',
      '储能时长 = 可用能量 ÷ PCS 功率；DoD 对循环寿命为厂商曲线近似（线性参考）',
      '警告：实际选型须按电池厂商规格书的功率型/能量型特性与质保条款留裕量'
    ],
    refs: [
      '可用能量 E_use = E_rated × (SOC₁−SOC₀)/100；储能时长 T = E_use / P_PCS',
      '功率比 = P_PCS / E_rated（MW/MWh）；DoD 循环寿命近似 N ≈ N_ref·(DoD_ref/DoD_act)',
      '往返效率 η_rt 影响净上网能量：E_out ≈ E_use·η_rt；依据厂商规格与 GB/T 36276'
    ],
    render(c) {
      function fld(label, val, unit) {
        const inp = T.el('input', { type: 'number', value: val, step: 'any' });
        return { wrap: T.el('div', { class: 'field' }, [T.el('label', { text: label }), inp, unit ? T.el('span', { class: 'suffix', text: unit }) : null]), inp };
      }
      const eUnit = T.el('select', {}, [T.el('option', { value: 'MWh', text: 'MWh' }), T.el('option', { value: 'kWh', text: 'kWh' })]);
      eUnit.value = 'MWh';
      const eWrap = T.el('div', { class: 'field' }, [T.el('label', { text: '额定能量单位' }), eUnit]);
      const pUnit = T.el('select', {}, [T.el('option', { value: 'MW', text: 'MW' }), T.el('option', { value: 'kW', text: 'kW' })]);
      pUnit.value = 'MW';
      const pWrap = T.el('div', { class: 'field' }, [T.el('label', { text: 'PCS 功率单位' }), pUnit]);
      const eVal = fld('额定能量值', '10', '');
      const pVal = fld('PCS 功率值', '5', '');
      const soc0 = fld('起始 SOC₀', '10', '%');
      const soc1 = fld('终止 SOC₁', '90', '%');
      const dod = fld('最大 DoD_max', '90', '%');
      const rt = fld('往返效率 η_rt', '90', '%');
      const nref = fld('参考循环(DoD_ref)', '6000', '次');
      const dodref = fld('参考 DoD_ref', '90', '%');
      const out = T.el('div', {});

      function calc() {
        out.innerHTML = '';
        const unitE = eUnit.value, unitP = pUnit.value;
        const E = parseFloat(eVal.inp.value), P = parseFloat(pVal.inp.value);
        const s0 = parseFloat(soc0.inp.value), s1 = parseFloat(soc1.inp.value), dmax = parseFloat(dod.inp.value), rtv = parseFloat(rt.inp.value), n0 = parseFloat(nref.inp.value), dr = parseFloat(dodref.inp.value);
        if (![E, P, s0, s1, dmax, rtv].every(isFinite) || E <= 0 || P <= 0 || s0 < 0 || s1 > 100 || s1 <= s0 || dmax <= 0 || dmax > 100 || rtv <= 0 || rtv > 100) {
          out.appendChild(T.el('div', { class: 'error', text: '请检查输入：能量/功率>0，0≤SOC₀<SOC₁≤100，DoD/η 在 0~100%。' })); return;
        }
        const E_MWh = unitE === 'kWh' ? E / 1000 : E;
        const P_MW = unitP === 'kW' ? P / 1000 : P;
        const eUse = E_MWh * (s1 - s0) / 100;
        const dur = eUse / P_MW;
        const pr = P_MW / E_MWh;
        const dodAct = (s1 - s0);
        const nLife = (isFinite(n0) && isFinite(dr) && dr > 0) ? n0 * (dr / dodAct) : null;
        const eOut = eUse * (rtv / 100);
        const box = T.el('div', { class: 'result-box' }, [
          T.el('div', { class: 'big', text: '储能时长 = ' + dur.toFixed(2) + ' h' }),
          T.el('div', { class: 'hint', text: '可用能量 ' + eUse.toFixed(2) + ' MWh ÷ PCS ' + P_MW.toFixed(2) + ' MW' })
        ]);
        const rows = [
          ['可用能量 E_use', eUse.toFixed(2) + ' MWh'],
          ['储能时长', dur.toFixed(2) + ' h'],
          ['功率比 P/E', pr.toFixed(3) + ' MW/MWh'],
          ['放电深度(本区间)', dodAct.toFixed(0) + ' %' + (dodAct <= dmax ? ' (≤DoD_max ✓)' : ' (超出 DoD_max ✗)')],
          ['净上网能量(η_rt)', eOut.toFixed(2) + ' MWh']
        ];
        if (nLife !== null) rows.push(['预估循环次数', Math.round(nLife) + ' 次@' + dodAct.toFixed(0) + '%DoD']);
        const tbl = T.el('table', {}, [
          T.el('tr', {}, [T.el('th', { text: '项目' }), T.el('th', { text: '数值' })]),
          ...rows.map(r => T.el('tr', {}, [T.el('td', { text: r[0] }), T.el('td', { text: r[1] })]))
        ]);
        out.appendChild(box); out.appendChild(tbl);
      }
      const all = [eUnit, eVal.inp, pUnit, pVal.inp, soc0.inp, soc1.inp, dod.inp, rt.inp, nref.inp, dodref.inp];
      all.forEach(x => x.addEventListener(x.tagName === 'SELECT' ? 'change' : 'input', calc));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '电池储能系统 BESS' }),
        T.el('div', { class: 'form-grid' }, [eWrap, eVal.wrap, pWrap, pVal.wrap, soc0.wrap, soc1.wrap, dod.wrap, rt.wrap, nref.wrap, dodref.wrap]),
        out
      ]));
      calc();
    }
  });
})();
