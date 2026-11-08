// 单位换算：多类别实时双向换算 + 全量对照表
(function () {
  const T = TB.util;

  const CATS = {
    '长度': { base: 'm', units: { 'mm': 0.001, 'cm': 0.01, 'm': 1, 'km': 1000, '英寸(in)': 0.0254, '英尺(ft)': 0.3048, '码(yd)': 0.9144, '英里(mi)': 1609.344 } },
    '质量': { base: 'kg', units: { 'mg': 1e-6, 'g': 1e-3, 'kg': 1, '吨(t)': 1000, '盎司(oz)': 0.0283495, '磅(lb)': 0.453592 } },
    '功率': { base: 'W', units: { 'W': 1, 'kW': 1000, 'MW': 1e6, '公制马力': 735.499, '英制马力': 745.7 } },
    '能量': { base: 'J', units: { 'J': 1, 'kJ': 1000, 'MJ': 1e6, 'Wh': 3600, 'kWh': 3.6e6, 'cal': 4.184, 'kcal': 4184 } },
    '数据': { base: 'B', units: { 'B': 1, 'KB': 1024, 'MB': 1048576, 'GB': 1073741824, 'TB': 1099511627776 } },
    '压力': { base: 'Pa', units: { 'Pa': 1, 'kPa': 1000, 'MPa': 1e6, 'bar': 1e5, 'atm': 101325, 'psi': 6894.76 } },
    '时间': { base: 's', units: { 'ms': 0.001, 's': 1, 'min': 60, 'h': 3600, '天': 86400 } },
    '角度': { base: '°', units: { '度(°)': 1, '弧度(rad)': 180 / Math.PI, '梯度(grad)': 0.9 } }
  };
  // 温度特殊处理
  const TEMP = {
    '°C': { toC: v => v, fromC: v => v },
    '°F': { toC: v => (v - 32) * 5 / 9, fromC: v => v * 9 / 5 + 32 },
    'K': { toC: v => v - 273.15, fromC: v => v + 273.15 }
  };

  function fmt(n) {
    if (!isFinite(n)) return '—';
    if (n === 0) return '0';
    const a = Math.abs(n);
    if (a >= 1e9 || a < 1e-6) return n.toExponential(6);
    return String(Math.round(n * 1e9) / 1e9);
  }

  TB.register({
    id: 'unitconv', name: '单位换算', category: '计算器',
    desc: '长度/质量/功率/能量/温度/数据/压力/时间/角度 实时双向换算，并列出全量对照。',
    render(c) {
      let cat = '长度';
      const valIn = T.el('input', { type: 'number', step: 'any', value: '1' });
      const fromSel = T.el('select', {});
      const toSel = T.el('select', {});
      const CAT_NAMES = Object.keys(CATS).concat(['温度']);
      const catSel = T.el('select', {}, CAT_NAMES.map(k => T.el('option', { value: k, text: k })));
      const out = T.el('div', {});
      const tableWrap = T.el('div', {});

      function loadUnits() {
        const units = Object.keys(cat === '温度' ? TEMP : CATS[cat].units);
        fromSel.innerHTML = ''; toSel.innerHTML = '';
        units.forEach((u, i) => {
          fromSel.appendChild(T.el('option', { value: u, text: u, selected: i === 0 ? 'selected' : null }));
          toSel.appendChild(T.el('option', { value: u, text: u, selected: i === 1 ? 'selected' : null }));
        });
      }
      function convert() {
        const v = parseFloat(valIn.value);
        out.innerHTML = ''; tableWrap.innerHTML = '';
        if (isNaN(v)) { out.appendChild(T.el('div', { class: 'error', text: '请输入数值。' })); return; }
        let result;
        if (cat === '温度') {
          const c = TEMP[fromSel.value].toC(v);
          result = TEMP[toSel.value].fromC(c);
        } else {
          const units = CATS[cat].units;
          result = v * units[fromSel.value] / units[toSel.value];
        }
        const box = T.el('div', { class: 'result-box' });
        box.appendChild(T.el('div', { class: 'big', text: fmt(v) + ' ' + fromSel.value + ' = ' + fmt(result) + ' ' + toSel.value }));
        out.appendChild(box);
        // 全量对照表
        const tbl = T.el('table', {});
        tbl.appendChild(T.el('tr', {}, [T.el('th', { text: '单位' }), T.el('th', { text: '换算值' })]));
        const unitKeys = cat === '温度' ? Object.keys(TEMP) : Object.keys(CATS[cat].units);
        unitKeys.forEach(u => {
          let r;
          if (cat === '温度') { const c = TEMP[fromSel.value].toC(v); r = TEMP[u].fromC(c); }
          else { const units = CATS[cat].units; r = v * units[fromSel.value] / units[u]; }
          tbl.appendChild(T.el('tr', {}, [T.el('td', { text: u }), T.el('td', { class: 'mono', text: fmt(r) })]));
        });
        tableWrap.appendChild(tbl);
      }

      catSel.addEventListener('change', () => { cat = catSel.value; loadUnits(); convert(); });
      [valIn, fromSel, toSel].forEach(el => el.addEventListener('input', convert));
      [fromSel, toSel].forEach(el => el.addEventListener('change', convert));

      loadUnits(); convert();

      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '单位换算' }),
        T.el('div', { class: 'form-grid' }, [
          T.el('div', { class: 'field' }, [T.el('label', { text: '类别' }), catSel]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '数值' }), valIn]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '从' }), fromSel]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '到' }), toSel])
        ]),
        out
      ]));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '全量对照（基于所填数值）' }), tableWrap
      ]));
    }
  });
})();
