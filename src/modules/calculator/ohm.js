// 欧姆定律计算器：已知 V I R P 中任意两项，求解其余两项
(function () {
  const T = TB.util;

  TB.register({
    id: 'ohm', name: '欧姆定律', category: '计算器',
    desc: '已知电压/电流/电阻/功率中任意两项，自动求解其余两项（V=IR，P=VI=V²/R=I²R）。',
    render(c) {
      const fields = {};
      const defs = [
        ['V', '电压 V', 'V'],
        ['I', '电流 I', 'A'],
        ['R', '电阻 R', 'Ω'],
        ['P', '功率 P', 'W']
      ];
      const grid = T.el('div', { class: 'form-grid' });
      defs.forEach(([key, label, unit]) => {
        const inp = T.el('input', { type: 'number', step: 'any', placeholder: '输入' });
        fields[key] = inp;
        grid.appendChild(T.el('div', { class: 'field' }, [
          T.el('label', { text: label }),
          T.el('div', { class: 'row', style: 'gap:6px' }, [inp, T.el('span', { class: 'suffix', text: unit })])
        ]));
      });
      const out = T.el('div', {});

      function compute() {
        out.innerHTML = '';
        const g = {};
        let provided = 0;
        for (const k of ['V', 'I', 'R', 'P']) {
          const v = parseFloat(fields[k].value);
          if (!isNaN(v) && fields[k].value.trim() !== '') { g[k] = v; provided++; }
          else g[k] = null;
        }
        if (provided < 2) { out.appendChild(T.el('div', { class: 'error', text: '请至少填写其中两项。' })); return; }
        if (provided > 2) { out.appendChild(T.el('div', { class: 'hint', text: '已填写 ' + provided + ' 项，将按公式反推未填写项（已填项以您输入为准）。' })); }

        const set = (k, v) => { if (g[k] === null) { g[k] = v; fields[k].value = (Math.round(v * 1e6) / 1e6); } };

        if (g.V !== null && g.I !== null) { set('R', g.V / g.I); set('P', g.V * g.I); }
        else if (g.V !== null && g.R !== null) { set('I', g.V / g.R); set('P', g.V * g.V / g.R); }
        else if (g.V !== null && g.P !== null) { set('I', g.P / g.V); set('R', g.V * g.V / g.P); }
        else if (g.I !== null && g.R !== null) { set('V', g.I * g.R); set('P', g.I * g.I * g.R); }
        else if (g.I !== null && g.P !== null) { set('V', g.P / g.I); set('R', g.P / (g.I * g.I)); }
        else if (g.R !== null && g.P !== null) { set('V', Math.sqrt(g.P * g.R)); set('I', Math.sqrt(g.P / g.R)); }
        else { out.appendChild(T.el('div', { class: 'error', text: '需已知两项才能求解。' })); return; }

        const box = T.el('div', { class: 'result-box' });
        box.appendChild(T.el('div', { class: 'big', text: 'V=' + fmt(g.V) + ' V   I=' + fmt(g.I) + ' A' }));
        box.appendChild(T.el('div', { text: 'R=' + fmt(g.R) + ' Ω   P=' + fmt(g.P) + ' W' }));
        out.appendChild(box);
        out.appendChild(T.el('div', { class: 'hint', style: 'margin-top:8px', text: '公式：V=IR，P=VI=V²/R=I²R' }));
      }
      function fmt(n) { return Math.round(n * 1e6) / 1e6; }

      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '欧姆定律 V / I / R / P' }),
        grid,
        T.el('div', { class: 'row', style: 'margin-top:6px' }, [
          T.el('button', { class: 'btn primary', text: '计算', onclick: compute }),
          T.el('button', { class: 'btn ghost', text: '清空', onclick: () => { defs.forEach(([k]) => fields[k].value = ''); out.innerHTML = ''; } })
        ]),
        out
      ]));
    }
  });
})();
