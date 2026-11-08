// 几何计算（日常工具）
(function () {
  const T = TB.util;
  const SHAPES = {
    '圆': { fields: { '半径 r': 'r' }, calc: f => ({ '周长': 2 * Math.PI * f.r, '面积': Math.PI * f.r * f.r }), formula: 'C=2πr，A=πr²' },
    '矩形': { fields: { '长 a': 'a', '宽 b': 'b' }, calc: f => ({ '周长': 2 * (f.a + f.b), '面积': f.a * f.b }), formula: 'C=2(a+b)，A=ab' },
    '三角形': { fields: { '底 a': 'a', '高 h': 'h' }, calc: f => ({ '面积': f.a * f.h / 2 }), formula: 'A=ah/2' },
    '梯形': { fields: { '上底 a': 'a', '下底 b': 'b', '高 h': 'h' }, calc: f => ({ '面积': (f.a + f.b) * f.h / 2 }), formula: 'A=(a+b)h/2' },
    '球': { fields: { '半径 r': 'r' }, calc: f => ({ '表面积': 4 * Math.PI * f.r * f.r, '体积': 4 / 3 * Math.PI * f.r ** 3 }), formula: 'S=4πr²，V=4/3πr³' },
    '圆柱': { fields: { '半径 r': 'r', '高 h': 'h' }, calc: f => ({ '侧面积': 2 * Math.PI * f.r * f.h, '表面积': 2 * Math.PI * f.r * (f.r + f.h), '体积': Math.PI * f.r * f.r * f.h }), formula: 'V=πr²h，S=2πr(r+h)' },
    '圆锥': { fields: { '半径 r': 'r', '高 h': 'h' }, calc: f => ({ '体积': Math.PI * f.r * f.r * f.h / 3 }), formula: 'V=πr²h/3' },
    '正方体': { fields: { '边长 a': 'a' }, calc: f => ({ '表面积': 6 * f.a * f.a, '体积': f.a ** 3 }), formula: 'V=a³，S=6a²' },
    '长方体': { fields: { '长 a': 'a', '宽 b': 'b', '高 c': 'c' }, calc: f => ({ '表面积': 2 * (f.a * f.b + f.b * f.c + f.a * f.c), '体积': f.a * f.b * f.c }), formula: 'V=abc，S=2(ab+bc+ac)' }
  };
  TB.register({
    id: 'geometry', name: '几何计算', category: '日常工具',
    desc: '常见平面图形与立体图形的周长、面积、表面积、体积一键计算，并给出对应公式。',
    tips: [
      '选择图形后自动显示所需参数输入项。',
      '所有结果按输入单位的平方/立方输出（如输入 cm，面积 cm²、体积 cm³）。',
      '圆/球/圆柱/圆锥使用 π≈3.14159。'
    ],
    ref: [
      { k: '圆面积', v: 'πr²' }, { k: '球体积', v: '4/3·πr³' },
      { k: '圆柱体积', v: 'πr²h' }, { k: '长方体', v: 'V=abc' }
    ],
    render(c) {
      const shapeSel = T.el('select', {});
      Object.keys(SHAPES).forEach(k => shapeSel.appendChild(T.el('option', { value: k, text: k })));
      shapeSel.value = Object.keys(SHAPES)[0];
      const fieldsBox = T.el('div', { class: 'form-grid' });
      const res = T.el('div', { class: 'result-box' });
      const fInputs = {};
      function buildFields() {
        const s = SHAPES[shapeSel.value];
        fieldsBox.innerHTML = ''; for (const k in fInputs) delete fInputs[k];
        Object.keys(s.fields).forEach(label => {
          const inp = T.el('input', { type: 'number', value: '1', step: 'any' });
          fInputs[s.fields[label]] = inp;
          inp.oninput = calc;
          fieldsBox.appendChild(T.el('div', { class: 'field' }, [T.el('label', { text: label }), inp]));
        });
        calc();
      }
      function calc() {
        const s = SHAPES[shapeSel.value];
        const f = {};
        for (const k in fInputs) { const v = parseFloat(fInputs[k].value); f[k] = isNaN(v) ? 0 : v; }
        const out = s.calc(f);
        res.innerHTML = '';
        res.appendChild(T.el('div', { class: 'formula', html: '公式：<b>' + s.formula + '</b>' }));
        const kv = T.el('div', { class: 'kv' });
        Object.keys(out).forEach(k => {
          kv.appendChild(T.el('span', { class: 'k', text: k }));
          kv.appendChild(T.el('span', { class: 'v', text: round(out[k]) }));
        });
        res.appendChild(kv);
      }
      function round(n) { return (Math.round(n * 1e4) / 1e4).toString(); }
      shapeSel.onchange = buildFields;
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '几何图形计算' }),
        T.el('div', { class: 'field' }, [T.el('label', { text: '选择图形' }), shapeSel]),
        fieldsBox, res
      ]));
      buildFields();
    }
  });
})();
