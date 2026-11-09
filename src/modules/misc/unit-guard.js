// 量纲校验台：统一量纲层的交互前端 —— 单位换算、混用告警、功率三角形合成
(function () {
  const T = TB.util;
  const U = TB.units;
  const ALL = U.allUnits();
  function unitOptions(sel) { return ALL.map(x => T.el('option', { value: x.unit, text: x.unit + ' · ' + x.label })); }

  TB.register({
    id: 'unit-guard', name: '量纲校验台', category: '综合工具',
    desc: '统一量纲层：任意单位换算、量纲一致性校验，并专门拦截 kW / kvar / kVA 混加这类工程常见错误。',
    accepts: ['active', 'reactive', 'apparent', 'voltage', 'current', 'resistance', 'energy', 'length', 'area', 'time', 'frequency', 'capacitance', 'inductance', 'ratio', 'temperature'],
    tips: [
      '同一物理量不同前缀（kV / V / mV）可换算后相加，工具会自动统一到 SI 基准',
      '有功 kW、无功 kvar、视在 kVA 不能直接相加，必须按 S = √(P²+Q²) 关联',
      '温度 °C / °F / K 为仿射换算，不能按倍数处理',
      '支持接收其它工具「送入」的结果，自动带单位填入换算区'
    ],
    refs: [
      'SI 基本单位与导出单位：GB 3100《国际单位制及其应用》',
      '功率三角形 S² = P² + Q²、cosφ = P/S，出自正弦交流电路功率理论',
      '无功补偿配置原则：GB 50052《供配电系统设计规范》',
      '量纲一致性是计算书校核的第一道关口，计算结果仍需按现行规范复核'
    ],
    limits: [
      '输入范围：数值必须为有限实数；单位须从下拉框选择',
      '适用边界：仅做量纲与前缀换算，不替代带温度系数、敷设条件修正的工程计算',
      '示例：1 kV = 1000 V；P=3 kW 与 Q=4 kvar ⇒ S=5 kVA、cosφ=0.6',
      '警告：kWh 属能量（J），kW 属功率（W），二者不可相加'
    ],
    render(c, ctx) {
      const valInp = T.el('input', { type: 'number', id: 'ug_val', step: 'any', value: '1', 'aria-label': '换算数值' });
      const srcSel = T.el('select', { id: 'ug_from', 'aria-label': '源单位' }, unitOptions());
      const dstSel = T.el('select', { id: 'ug_to', 'aria-label': '目标单位' }, unitOptions());
      srcSel.value = 'kV'; dstSel.value = 'V';
      const convOut = T.el('div', { class: 'result-box', id: 'ug_conv' });

      function doConvert() {
        const v = Number(valInp.value);
        const from = srcSel.value || 'kV', to = dstSel.value || 'V';
        convOut.innerHTML = '';
        const cv = U.convert(v, from, to);
        if (cv === null || !isFinite(v)) {
          const why = U.reason(from, to) || '数值无效';
          convOut.appendChild(T.el('div', { class: 'error', text: why }));
          convOut.appendChild(T.el('div', { class: 'hint', text: '提示：' + (U.info(from) ? U.info(from).label : '?') + ' → ' + (U.info(to) ? U.info(to).label : '?') }));
        } else {
          convOut.appendChild(T.el('div', { class: 'big', text: U.fmt(v) + ' ' + from + ' = ' + U.fmt(cv) + ' ' + to }));
          convOut.appendChild(T.el('div', { class: 'hint', text: '基准单位 ' + U.info(from).base + '：' + U.fmt(U.toBase(v, from)) + ' → ' + U.fmt(cv) + ' ' + to }));
        }
      }
      [valInp, srcSel, dstSel].forEach(e => { e.addEventListener('input', doConvert); e.addEventListener('change', doConvert); });

      // ---- 量纲校验：三行数值 + 单位 ----
      const lineDefs = [
        { v: '3', u: 'kW' }, { v: '4', u: 'kvar' }, { v: '', u: 'kVA' }
      ];
      const lines = lineDefs.map((d, i) => {
        const vi = T.el('input', { type: 'number', step: 'any', id: 'ug_v' + i, value: d.v, 'aria-label': '数值 ' + (i + 1) });
        const ui = T.el('select', { id: 'ug_u' + i, 'aria-label': '单位 ' + (i + 1) }, unitOptions());
        ui.value = d.u;
        return { vi, ui };
      });
      const checkOut = T.el('div', { class: 'result-box', id: 'ug_check' });
      function doCheck(mode) {
        const items = lines.map((l, i) => ({ value: l.vi.value, unit: l.ui.value, label: '第 ' + (i + 1) + ' 项' }));
        checkOut.innerHTML = '';
        if (mode === 'triangle') {
          let P = 0, Q = 0;
          items.forEach(x => {
            const k = U.familyOf(x.unit), b = U.toBase(x.value, x.unit);
            if (!isFinite(Number(x.value)) || String(x.value).trim() === '' || b === null) return;
            if (k === 'active') P += b;
            if (k === 'reactive') Q += b;
          });
          if (!P || !Q) {
            checkOut.appendChild(T.el('div', { class: 'error', text: '请至少填一项有功功率（W/kW）与一项无功功率（var/kvar）。' }));
            return;
          }
          const tri = U.powerTriangle(P, Q);
          checkOut.appendChild(T.el('div', { class: 'big', text: 'S = ' + U.fmt(tri.S / 1000) + ' kVA　cosφ = ' + tri.cosPhi.toFixed(4) }));
          checkOut.appendChild(T.el('div', { class: 'hint', text: 'P = ' + U.fmt(P / 1000) + ' kW，Q = ' + U.fmt(Q / 1000) + ' kvar；S = √(P²+Q²)，不是 P+Q' }));
          const Qc95 = U.powerTriangle(P, Q, 0.95);
          if (Qc95 && Qc95.Qc !== null) {
            checkOut.appendChild(T.el('div', { class: 'success', text: '若目标 cosφ=0.95，需补偿约 ' + U.fmt(Qc95.Qc / 1000) + ' kvar（正值需容性补偿，负值说明已过补偿）' }));
          }
        } else {
          const r = U.check(items);
          checkOut.appendChild(T.el('div', { class: r.ok ? 'big' : 'error', text: r.ok ? ('合计 = ' + U.fmt(r.sum) + ' ' + r.unit) : '量纲校验未通过' }));
          r.messages.forEach(msg => checkOut.appendChild(T.el('div', { class: msg.indexOf('✗') === 0 ? 'error' : (msg.indexOf('✓') === 0 ? 'success' : 'hint'), text: msg })));
        }
      }
      lines.forEach(l => { l.vi.addEventListener('input', () => doCheck('sum')); l.ui.addEventListener('change', () => doCheck('sum')); });

      // ---- 接收其它工具「送入」的结果 ----
      const fillNote = T.el('div', { class: 'hint', id: 'ug_fill' });
      if (TB.bus) {
        const r = TB.bus.consume('unit-guard', [{ el: valInp, family: '*', unit: '', label: '换算数值' }]);
        if (r && r.filled) {
          if (r.entry && r.entry.unit && ALL.some(x => x.unit === r.entry.unit)) {
            srcSel.value = r.entry.unit;
            dstSel.value = U.info(r.entry.unit) ? U.info(r.entry.unit).base : dstSel.value;
          }
          fillNote.textContent = '已引用「' + r.label + '」：' + U.fmt(Number(r.value)) + ' ' + (r.entry ? r.entry.unit : '');
          doConvert();
        } else if (r && r.reason) {
          fillNote.textContent = r.reason;
        }
      }

      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '① 单位换算（全量纲）' }),
        T.el('div', { class: 'form-grid' }, [
          T.el('div', { class: 'field' }, [T.el('label', { text: '数值' }), valInp]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '源单位' }), srcSel]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '目标单位' }), dstSel])
        ]),
        convOut,
        T.el('div', { class: 'row' }, [
          T.el('button', { class: 'btn primary', text: '换算', onclick: doConvert }),
          T.el('button', { class: 'btn ghost', text: '交换', onclick: () => { const a = srcSel.value; srcSel.value = dstSel.value; dstSel.value = a; doConvert(); } })
        ])
      ]));
      const lineRows = T.el('div', { class: 'form-grid' }, lines.map((l, i) => T.el('div', { class: 'field' }, [
        T.el('label', { text: '第 ' + (i + 1) + ' 项' }), l.vi, l.ui
      ])));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '② 量纲一致性校验' }),
        T.el('p', { class: 'hint', text: '默认示例：3 kW + 4 kvar —— 直接相加会被拦截，请用「功率三角形合成」。' }),
        lineRows,
        T.el('div', { class: 'row' }, [
          T.el('button', { class: 'btn primary', text: '校验并求和', onclick: () => doCheck('sum') }),
          T.el('button', { class: 'btn ghost', text: '功率三角形合成 P/Q', onclick: () => doCheck('triangle') })
        ]),
        checkOut, fillNote
      ]));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '③ 常见混用陷阱' }),
        T.el('div', { class: 'ref-list' }, [
          ['kW + kvar', '✗ 不可相加 → S = √(P²+Q²)'],
          ['kVA + kW', '✗ 不可相加 → 视在功率含无功分量'],
          ['kWh + kW', '✗ 能量与功率量纲不同'],
          ['mm² + cm²', '✓ 同族可换算（1 cm² = 100 mm²）'],
          ['°C + °F', '✗ 仿射温标不能直接相加'],
          ['V + A', '✗ 电压与电流量纲不同']
        ].map(r => T.el('div', { class: 'ref-row' }, [
          T.el('span', { class: 'rk', text: r[0] }), T.el('span', { class: 'rv', text: r[1] })
        ])))
      ]));

      doConvert();
      doCheck('triangle');
    }
  });
})();
