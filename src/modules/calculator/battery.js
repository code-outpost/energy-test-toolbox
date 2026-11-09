// 蓄电池容量 / 后备时间：根据负载与后备时长求所需容量与电池数量（新能源/UPS 场景）
(function () {
  const T = TB.util;
  TB.register({
    id: 'battery', name: '蓄电池容量', category: '电力计算',
    desc: '输入负载功率、后备时间与系统电压，计算所需电池能量(Ah/Wh)、放电深度与电池串并联数量。',
    limits: ["输入范围：P、t、U 为正，0 < DoD ≤ 1，0 < η ≤ 1","适用边界：简化能量法，未计放电倍率、老化、温度与可用容量衰减","示例：500 W / 4 h / 48 V / DoD 0.8 / η 0.9 ⇒ 约 58 Ah","警告：实际选型需按倍率特性、循环寿命与备电标准留裕量"],
    refs: ["储能容量 C(Ah) = P·t / (U·DoD·η)，其中 DoD 为放电深度、η 为系统效率","本工具为通用工程估算，未计入温度衰减、寿命末期容量与逆变器效率曲线","DoD 与循环寿命取值应以电池厂商规格书为准"],
    render(c) {
      function fld(label, val, unit) {
        const inp = T.el('input', { type: 'number', value: val, step: 'any' });
        return { wrap: T.el('div', { class: 'field' }, [T.el('label', { text: label }), inp, unit ? T.el('span', { class: 'suffix', text: unit }) : null]), inp };
      }
      const pw = fld('负载功率 P', '500', 'W');
      const t = fld('后备时间', '4', 'h');
      const u = fld('系统电压 U', '48', 'V');
      const dod = fld('放电深度 DoD', '80', '%');
      const eff = fld('转换效率', '90', '%');
      const single = fld('单只电池容量', '100', 'Ah(可选)');
      const battV = T.el('select', {}, [T.el('option', { value: '12', text: '12V 单体' }), T.el('option', { value: '2', text: '2V 单体' })]);
      const bvWrap = T.el('div', { class: 'field' }, [T.el('label', { text: '电池单体电压' }), battV]);
      const out = T.el('div', {});

      function calc() {
        const P = +pw.inp.value, Tt = +t.inp.value, U = +u.inp.value, D = +dod.inp.value, E = +eff.inp.value, Sb = single.inp.value === '' ? NaN : +single.inp.value;
        out.innerHTML = '';
        if (![P, Tt, U, D, E].every(isFinite) || D <= 0 || D > 100 || E <= 0 || E > 100) {
          out.appendChild(T.el('div', { class: 'error', text: '请检查输入：DoD 0–100%，效率 0–100%，其余>0。' })); return;
        }
        const wh = P * Tt / (D / 100) / (E / 100);
        const ah = wh / U;
        const ser = Math.max(1, Math.round(U / +battV.value));
        let bank = null;
        if (isFinite(Sb) && Sb > 0) {
          const par = Math.ceil(ah / Sb);
          bank = { ser, par, total: ser * par, useAh: par * Sb };
        }
        const box = T.el('div', { class: 'result-box' }, [
          T.el('div', { class: 'big', text: ah.toFixed(0) + ' Ah' }),
          T.el('div', { class: 'hint', text: '所需容量 = P·t ÷ DoD ÷ 效率 = ' + wh.toFixed(0) + ' Wh' })
        ]);
        const rows = [
          ['所需能量', wh.toFixed(0) + ' Wh'],
          ['所需容量', ah.toFixed(1) + ' Ah @ ' + U + 'V'],
          ['串联只数', ser + ' 只（' + battV.value + 'V/只）']
        ];
        if (bank) {
          rows.push(['并联组数', bank.par + ' 组']);
          rows.push(['电池总数', bank.total + ' 只（实际可用 ' + bank.useAh + ' Ah）']);
        }
        const tbl = T.el('table', {}, [
          T.el('tr', {}, [T.el('th', { text: '项目' }), T.el('th', { text: '数值' })]),
          ...rows.map(r => T.el('tr', {}, [T.el('td', { text: r[0] }), T.el('td', { text: r[1] })]))
        ]);
        out.appendChild(box); out.appendChild(tbl);
        out.appendChild(T.el('div', { class: 'hint', text: '提示：低温、老化会进一步降低可用容量，工程上建议在结果上预留 10–20% 余量。' }));
      }
      [pw.inp, t.inp, u.inp, dod.inp, eff.inp, single.inp, battV].forEach(e => {
        if (e.addEventListener) { e.addEventListener(e.tagName === 'SELECT' ? 'change' : 'input', calc); }
      });
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '蓄电池容量 / 后备时间' }),
        T.el('div', { class: 'form-grid' }, [pw.wrap, t.wrap, u.wrap, dod.wrap, eff.wrap, single.wrap, bvWrap]),
        out
      ]));
      calc();
    }
  });
})();
