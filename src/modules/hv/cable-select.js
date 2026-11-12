// 线缆选型反查：已知负载电流、敷设、环境温度，按载流量表反查最小导体截面（含温度/敷设校正）
(function () {
  const T = TB.util;
  // 铜芯 PVC 绝缘 300/500V、明敷 30°C 参考载流量表 (A)
  const CU = [[1.5, 18], [2.5, 25], [4, 32], [6, 42], [10, 57], [16, 76], [25, 101], [35, 125], [50, 152], [70, 192], [95, 232], [120, 269], [150, 311], [185, 353], [240, 416]];
  const AL = CU.map(([a, r]) => [a, Math.round(r * 0.78)]);
  TB.register({
    id: 'cable-select', name: '线缆选型反查', category: '高压电工',
    desc: '已知负载电流、导体材料、敷设方式与环境温度，按载流量表反查满足要求的最小导体截面（含温度与敷设校正）。',
    accepts: ['current'],
    limits: [
      '输入范围：负载电流>0，环境温度≥-20℃，校正系数 0~1.5',
      '适用边界：铜芯 PVC 绝缘明敷 30°C 参考表（GB/T 16895 / IEC 60364），实际以设计手册与敷设条件为准',
      '校正系数 k_t=√((θc−θa)/(θc−30))，θc=70℃(PVC)/90℃(XLPE)；埋地/穿管再乘敷设系数',
      '警告：仅校核载流量，未校核电压降、短路热稳定与机械强度，三者须另行核算'
    ],
    refs: [
      '最小截面：取载流量表满足 I_额定·k_t·k_敷设 ≥ I_负载 的最小截面',
      '温度校正 k_t = √((θc−θa)/(θc−30))；铝芯≈铜芯×0.78',
      '查阅 GB/T 16895.15《布线系统载流量》、IEC 60364-5-52'
    ],
    render(c) {
      function fld(label, val, unit) {
        const inp = T.el('input', { type: 'number', value: val, step: 'any' });
        return { wrap: T.el('div', { class: 'field' }, [T.el('label', { text: label }), inp, unit ? T.el('span', { class: 'suffix', text: unit }) : null]), inp };
      }
      const mat = T.el('select', {}, [T.el('option', { value: 'cu', text: '铜芯' }), T.el('option', { value: 'al', text: '铝芯' })]);
      const ins = T.el('select', {}, [T.el('option', { value: '70', text: 'PVC (θc=70℃)' }), T.el('option', { value: '90', text: 'XLPE (θc=90℃)' })]);
      const lay = T.el('select', {}, [T.el('option', { value: '1.0', text: '明敷/桥架' }), T.el('option', { value: '0.9', text: '埋地' }), T.el('option', { value: '0.8', text: '穿管' }), T.el('option', { value: '0.7', text: '成束' })]);
      mat.value = 'cu'; ins.value = '70'; lay.value = '1.0';
      const iLoad = fld('负载电流 I', '140', 'A');
      const ta = fld('环境温度 θa', '30', '℃');
      const out = T.el('div', {});

      if (TB.bus) {
        const rr = TB.bus.consume('cable-select', [{ el: iLoad.inp, family: 'current', unit: 'A', label: '负载电流 I' }]);
        if (rr && rr.filled && TB.toast) TB.toast('已引用「' + rr.label + '」= ' + rr.value + ' ' + rr.unit + ' 填入负载电流', 'ok');
      }

      function calc() {
        out.innerHTML = '';
        const I = parseFloat(iLoad.inp.value), theta = parseFloat(ta.inp.value);
        const table = mat.value === 'al' ? AL : CU;
        const thc = parseFloat(ins.value), kLay = parseFloat(lay.value);
        if (!isFinite(I) || I <= 0) { out.appendChild(T.el('div', { class: 'error', text: '请输入有效负载电流。' })); return; }
        const kt = isFinite(theta) ? Math.sqrt(Math.max(0, (thc - theta) / (thc - 30))) : 1;
        const kAll = kt * kLay;
        let pick = null, rated = 0;
        for (const r of table) { if (r[1] * kAll >= I) { pick = r[0]; rated = r[1]; break; } }
        const box = T.el('div', { class: 'result-box' }, [
          T.el('div', { class: 'big', text: pick ? ('选型截面 = ' + pick + ' mm²') : '无匹配（请选更大截面或并联）' }),
          T.el('div', { class: 'hint', text: pick ? ('该截面额定 ' + rated + ' A × 校正 ' + kAll.toFixed(3) + ' = ' + (rated * kAll).toFixed(1) + ' A ≥ ' + I + ' A') : '' })
        ]);
        const rows = [
          ['环境温度校正 k_t', kt.toFixed(3)],
          ['敷设校正 k_敷设', kLay.toFixed(2)],
          ['综合校正', kAll.toFixed(3)],
          ['所选截面额定(30℃)', rated + ' A'],
          ['校正后可用', (rated * kAll).toFixed(1) + ' A']
        ];
        const tbl = T.el('table', {}, [
          T.el('tr', {}, [T.el('th', { text: '项目' }), T.el('th', { text: '数值' })]),
          ...rows.map(r => T.el('tr', {}, [T.el('td', { text: r[0] }), T.el('td', { text: r[1] })]))
        ]);
        out.appendChild(box); out.appendChild(tbl);
        if (!pick) out.appendChild(T.el('div', { class: 'error', text: '⚠ 超出表中最大截面，建议并联或选电缆沟/母线。' }));
      }
      const all = [iLoad.inp, ta.inp, mat, ins, lay];
      all.forEach(x => x.addEventListener(x.tagName === 'SELECT' ? 'change' : 'input', calc));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '线缆选型反查' }),
        T.el('div', { class: 'form-grid' }, [iLoad.wrap, ta.wrap, T.el('div', { class: 'field' }, [T.el('label', { text: '导体材料' }), mat]), T.el('div', { class: 'field' }, [T.el('label', { text: '绝缘类型' }), ins]), T.el('div', { class: 'field' }, [T.el('label', { text: '敷设方式' }), lay])]),
        out
      ]));
      calc();
    }
  });
})();
