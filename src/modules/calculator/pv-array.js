// 光伏阵列设计：组件串联/并联、逆变器电压匹配与发电量估算（新能源场景）
(function () {
  const T = TB.util;
  TB.register({
    id: 'pv-array', name: '光伏阵列设计', category: '电力计算',
    desc: '输入组件参数与串/并联数，校验组串电压是否超过逆变器上限，估算日/月/年发电量。',
    refs: ["组串工作电压需落在逆变器 MPPT 范围内，开路电压按组件温度系数修正","Ns·Voc(低温) < 逆变器最大直流电压；Np·Isc 需满足直流侧载流能力","组件参数以厂商规格书为准，设计鉴定标准参考 IEC 61215 / IEC 61730"],
    render(c) {
      function fld(label, val, unit) {
        const inp = T.el('input', { type: 'number', value: val, step: 'any' });
        return { wrap: T.el('div', { class: 'field' }, [T.el('label', { text: label }), inp, unit ? T.el('span', { class: 'suffix', text: unit }) : null]), inp };
      }
      const pmpp = fld('组件峰值功率', '550', 'W');
      const voc = fld('组件开路电压 Voc', '49.5', 'V');
      const ns = fld('每串组件数 Ns', '20', '块');
      const np = fld('并联串数 Np', '10', '串');
      const vmax = fld('逆变器最大输入电压', '1100', 'V');
      const psh = fld('峰值日照 PSH', '4.2', 'h/天');
      const eff = fld('系统效率', '0.82', '');
      const out = T.el('div', {});

      function calc() {
        const P = +pmpp.inp.value, V = +voc.inp.value, Ns = +ns.inp.value, Np = +np.inp.value, Vm = +vmax.inp.value, H = +psh.inp.value, E = +eff.inp.value;
        out.innerHTML = '';
        if (![P, V, Ns, Np, Vm, H, E].every(isFinite) || Ns <= 0 || Np <= 0) {
          out.appendChild(T.el('div', { class: 'error', text: '请检查输入：组件数>0，电压/功率数值有效。' })); return;
        }
        const strVoc = Ns * V;
        const total = Ns * Np * P / 1000;            // kW
        const day = total * H * E;                    // kWh/day
        const okVolt = strVoc <= Vm;
        const box = T.el('div', { class: 'result-box' }, [
          T.el('div', { class: 'big', text: total.toFixed(2) + ' kWp' }),
          T.el('div', { class: 'hint', text: '系统总功率 = Ns×Np×Pmpp' })
        ]);
        const tbl = T.el('table', {}, [
          T.el('tr', {}, [T.el('th', { text: '项目' }), T.el('th', { text: '数值' })]),
          T.el('tr', {}, [T.el('td', { text: '组串开路电压' }), T.el('td', { text: strVoc.toFixed(1) + ' V（' + (okVolt ? '✓ ≤' + Vm + 'V' : '✗ 超过逆变器 ' + Vm + 'V') + '）' })]),
          T.el('tr', {}, [T.el('td', { text: '日发电量' }), T.el('td', { text: day.toFixed(1) + ' kWh' })]),
          T.el('tr', {}, [T.el('td', { text: '月发电量' }), T.el('td', { text: (day * 30).toFixed(0) + ' kWh' })]),
          T.el('tr', {}, [T.el('td', { text: '年发电量' }), T.el('td', { text: (day * 365).toFixed(0) + ' kWh' })])
        ]);
        out.appendChild(box); out.appendChild(tbl);
        if (!okVolt) out.appendChild(T.el('div', { class: 'error', text: '⚠ 建议减少每串组件数或选用更高耐压逆变器，避免低温时直流过压。' }));
      }
      [pmpp.inp, voc.inp, ns.inp, np.inp, vmax.inp, psh.inp, eff.inp].forEach(e => e.addEventListener('input', calc));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '光伏阵列设计' }),
        T.el('div', { class: 'form-grid' }, [pmpp.wrap, voc.wrap, ns.wrap, np.wrap, vmax.wrap, psh.wrap, eff.wrap]),
        out
      ]));
      calc();
    }
  });
})();
