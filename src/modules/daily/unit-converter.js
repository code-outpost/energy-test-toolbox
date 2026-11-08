// 通用单位换算（日常工具）
(function () {
  const T = TB.util;
  // 以基准单位换算系数（温度特殊处理）
  const CATS = {
    '长度': { base: 'm', u: { '米 m': 1, '千米 km': 1000, '分米 dm': 0.1, '厘米 cm': 0.01, '毫米 mm': 0.001, '微米 µm': 1e-6, '英里 mi': 1609.344, '码 yd': 0.9144, '英尺 ft': 0.3048, '英寸 in': 0.0254, '海里 nmi': 1852 } },
    '质量': { base: 'kg', u: { '千克 kg': 1, '克 g': 0.001, '毫克 mg': 1e-6, '吨 t': 1000, '市斤': 0.5, '磅 lb': 0.45359237, '盎司 oz': 0.0283495231 } },
    '面积': { base: 'm²', u: { '平方米 m²': 1, '平方千米 km²': 1e6, '公顷 ha': 10000, '亩': 666.6667, '平方厘米 cm²': 0.0001, '平方英尺 ft²': 0.092903, '平方英里 mi²': 2589988.11, '英亩 acre': 4046.8564 } },
    '体积': { base: 'L', u: { '升 L': 1, '毫升 mL': 0.001, '立方米 m³': 1000, '立方厘米 cm³': 0.001, '加仑(美) gal': 3.7854118, '加仑(英) gal': 4.54609, '品脱 pt': 0.4731765 } },
    '速度': { base: 'm/s', u: { '米/秒 m/s': 1, '千米/时 km/h': 0.277778, '英里/时 mph': 0.44704, '节 knot': 0.514444, '英尺/秒 ft/s': 0.3048 } },
    '时间': { base: 's', u: { '秒 s': 1, '分 min': 60, '小时 h': 3600, '天 d': 86400, '周 wk': 604800, '毫秒 ms': 0.001 } },
    '数据存储': { base: 'B', u: { '字节 B': 1, '千字节 KB': 1024, '兆字节 MB': 1048576, '吉字节 GB': 1073741824, '太字节 TB': 1099511627776, '比特 bit': 0.125 } },
    '温度': { temp: true, u: { '摄氏度 ℃': 'C', '华氏度 ℉': 'F', '开尔文 K': 'K' } }
  };
  function toBase(v, from, cat) {
    if (CATS[cat].temp) {
      if (from === 'C') return v;
      if (from === 'F') return (v - 32) * 5 / 9;
      return v - 273.15; // K
    }
    return v * CATS[cat].u[from];
  }
  function fromBase(v, to, cat) {
    if (CATS[cat].temp) {
      if (to === 'C') return v;
      if (to === 'F') return v * 9 / 5 + 32;
      return v + 273.15; // K
    }
    return v / CATS[cat].u[to];
  }
  TB.register({
    id: 'unit-converter', name: '通用单位换算', category: '日常工具',
    desc: '长度 / 质量 / 面积 / 体积 / 速度 / 时间 / 数据 / 温度 等常用单位的实时双向换算，附全部单位对照表。',
    tips: [
      '切换类别会自动重载上下单位下拉框；输入即实时换算。',
      '温度采用国际标准换算（℃/℉/K），其余按基准单位系数计算。',
      '对照表可快速查看同一数值在各单位下的结果。'
    ],
    ref: [
      { k: '1 英里', v: '1609.344 米' }, { k: '1 海里', v: '1852 米' },
      { k: '1 市斤', v: '0.5 千克' }, { k: '1 亩', v: '≈666.67 平方米' }, { k: '1 英亩', v: '4046.86 平方米' }
    ],
    render(c) {
      const catSel = T.el('select', {});
      Object.keys(CATS).forEach(k => catSel.appendChild(T.el('option', { value: k, text: k })));
      catSel.value = Object.keys(CATS)[0];
      const fromSel = T.el('select', {});
      const toSel = T.el('select', {});
      const valIn = T.el('input', { type: 'number', value: '1', step: 'any' });
      const res = T.el('div', { class: 'result-box' });

      function fillUnits() {
        const cat = catSel.value;
        fromSel.innerHTML = ''; toSel.innerHTML = '';
        const keys = Object.keys(CATS[cat].u);
        keys.forEach(k => {
          fromSel.appendChild(T.el('option', { value: k, text: k }));
          toSel.appendChild(T.el('option', { value: k, text: k }));
        });
        fromSel.value = keys[0];
        toSel.value = keys[Math.min(1, keys.length - 1)];
        calc();
      }
      function calc() {
        const cat = catSel.value;
        const v = parseFloat(valIn.value);
        if (isNaN(v)) { res.innerHTML = ''; return; }
        const base = toBase(v, fromSel.value, cat);
        const out = fromBase(base, toSel.value, cat);
        res.innerHTML = '';
        res.appendChild(T.el('div', { class: 'big', text: fmt(out) + ' ' + toSel.value }));
        // 对照表
        const tbl = T.el('table', {});
        const head = T.el('tr', {}, [T.el('th', { text: '单位' }), T.el('th', { text: '数值' })]);
        tbl.appendChild(head);
        Object.keys(CATS[cat].u).forEach(k => {
          tbl.appendChild(T.el('tr', {}, [T.el('td', { text: k }), T.el('td', { text: fmt(fromBase(base, k, cat)) })]));
        });
        res.appendChild(T.el('div', { style: 'margin-top:10px;font-size:12px;color:var(--text-2)', text: '全部单位对照（' + fmt(v) + ' ' + fromSel.value + '）：' }));
        res.appendChild(tbl);
      }
      function fmt(n) {
        if (!isFinite(n)) return '—';
        const a = Math.abs(n);
        let s;
        if (a !== 0 && (a < 1e-4 || a >= 1e9)) s = n.toExponential(4);
        else s = (Math.round(n * 1e6) / 1e6).toString();
        return s;
      }
      catSel.onchange = fillUnits;
      fromSel.onchange = calc; toSel.onchange = calc; valIn.oninput = calc;
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '实时换算' }),
        T.el('div', { class: 'form-grid' }, [
          T.el('div', { class: 'field' }, [T.el('label', { text: '类别' }), catSel]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '数值' }), valIn]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '从' }), fromSel]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '到' }), toSel])
        ]),
        res
      ]));
      fillUnits();
    }
  });
})();
