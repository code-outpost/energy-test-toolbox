// 电阻色环计算器：4/5 色环解码（含可视化）+ 反推编码
(function () {
  const T = TB.util;

  const DIGIT = [['black', '黑', 0], ['brown', '棕', 1], ['red', '红', 2], ['orange', '橙', 3], ['yellow', '黄', 4], ['green', '绿', 5], ['blue', '蓝', 6], ['violet', '紫', 7], ['gray', '灰', 8], ['white', '白', 9]];
  const MULT = [['black', 1], ['brown', 10], ['red', 100], ['orange', 1000], ['yellow', 10000], ['green', 100000], ['blue', 1000000], ['gold', 0.1], ['silver', 0.01]];
  const TOL = [['brown', 1], ['red', 2], ['green', 0.5], ['blue', 0.25], ['violet', 0.1], ['gray', 0.05], ['gold', 5], ['silver', 10], ['none', 20]];
  const CSSC = { black: '#1a1a1a', brown: '#8B4513', red: '#D22B2B', orange: '#E8821E', yellow: '#F2D024', green: '#1F9E4A', blue: '#2A6FDB', violet: '#7B3FB5', gray: '#8A8A8A', white: '#f3f3f3', gold: '#CFB53B', silver: '#C0C0C0' };
  const colorName = (arr, key) => (arr.find(x => x[0] === key) || [])[1] || key;

  function fmtR(v) {
    if (v >= 1e6) return (Math.round(v / 1e6 * 1e4) / 1e4) + ' MΩ';
    if (v >= 1e3) return (Math.round(v / 1e3 * 1e4) / 1e4) + ' kΩ';
    return (Math.round(v * 1e4) / 1e4) + ' Ω';
  }
  function opt(arr, sel) {
    return arr.map(([k, label]) => T.el('option', { value: k, text: label, selected: k === sel ? 'selected' : null }));
  }

  TB.register({
    id: 'resistor', name: '电阻色环', category: '计算器',
    desc: '4 环 / 5 环电阻色环解码（带可视化色带）与反推编码。',
    render(c) {
      let bands = 4;
      const sel = { d1: 'brown', d2: 'black', d3: 'black', m: 'red', t: 'gold' };

      const d1s = T.el('select', {}, opt(DIGIT, sel.d1));
      const d2s = T.el('select', {}, opt(DIGIT, sel.d2));
      const d3s = T.el('select', {}, opt(DIGIT, sel.d3));
      const ms = T.el('select', {}, opt(MULT, sel.m));
      const ts = T.el('select', {}, opt(TOL, sel.t));
      [d1s, d2s, d3s, ms, ts].forEach(s => s.addEventListener('change', () => {
        sel.d1 = d1s.value; sel.d2 = d2s.value; sel.d3 = d3s.value; sel.m = ms.value; sel.t = ts.value; decode();
      }));

      const vis = T.el('div', { class: 'resistor' });
      const out = T.el('div', {});

      function bandCountRadio() {
        const wrap = T.el('div', { class: 'row' });
        [4, 5].forEach(n => {
          const b = T.el('button', { class: 'btn sm' + (n === bands ? ' primary' : ''), text: n + ' 色环', onclick: () => { bands = n; decode(); bandCountRadio._refresh && bandCountRadio._refresh(); } });
          wrap.appendChild(b);
        });
        return wrap;
      }

      function decode() {
        const d1 = DIGIT.find(x => x[0] === sel.d1)[2];
        const d2 = DIGIT.find(x => x[0] === sel.d2)[2];
        const m = MULT.find(x => x[0] === sel.m)[1];
        const t = TOL.find(x => x[0] === sel.t)[1];
        let sig, val;
        if (bands === 4) { sig = d1 * 10 + d2; val = sig * m; }
        else { const d3 = DIGIT.find(x => x[0] === sel.d3)[2]; sig = d1 * 100 + d2 * 10 + d3; val = sig * m; }
        const lo = val * (1 - t / 100), hi = val * (1 + t / 100);

        // 可视化色带
        vis.innerHTML = '';
        vis.appendChild(T.el('div', { class: 'lead' }));
        const body = T.el('div', { class: 'body' });
        const bandKeys = bands === 4 ? [sel.d1, sel.d2, sel.m, sel.t] : [sel.d1, sel.d2, sel.d3, sel.m, sel.t];
        bandKeys.forEach(k => body.appendChild(T.el('div', { class: 'band', style: 'background:' + (CSSC[k] || '#999') + (k === 'white' ? ';border:1px solid #ccc' : '') })));
        vis.appendChild(body);
        vis.appendChild(T.el('div', { class: 'lead' }));

        out.innerHTML = '';
        const box = T.el('div', { class: 'result-box' });
        box.appendChild(T.el('div', { class: 'big', text: fmtR(val) }));
        box.appendChild(T.el('div', { text: '容差 ±' + t + '%　范围 ' + fmtR(lo) + ' ~ ' + fmtR(hi) }));
        out.appendChild(box);
        out.appendChild(T.el('div', { class: 'hint', style: 'margin-top:8px', text: '色环顺序（左→右）：' + bandKeys.map(k => colorName(DIGIT.concat(MULT, TOL), k)).join(' · ') }));
      }

      // 反推编码
      const encInput = T.el('input', { type: 'number', step: 'any', placeholder: '如 4700' });
      const encTol = T.el('select', {}, opt(TOL.filter(x => x[0] !== 'none'), 'gold'));
      const encOut = T.el('div', {});
      function encode() {
        encOut.innerHTML = '';
        const v = parseFloat(encInput.value);
        if (isNaN(v) || v <= 0) { encOut.appendChild(T.el('div', { class: 'error', text: '请输入正数阻值(Ω)。' })); return; }
        let k = Math.floor(Math.log10(v)) - 1;
        let mult = Math.pow(10, k);
        let sig = Math.round(v / mult);
        if (sig >= 100) { mult *= 10; sig = Math.round(v / mult); }
        // 选最接近乘法档
        const mKey = (MULT.find(x => x[1] === mult) || MULT[1])[0];
        const d1 = Math.floor(sig / 10) % 10, d2 = sig % 10;
        const digKey = (n) => DIGIT.find(x => x[2] === n)[0];
        const tolKey = encTol.value;
        const box = T.el('div', { class: 'result-box' });
        box.appendChild(T.el('div', { class: 'big', text: fmtR(v) + ' ≈ ' + colorName(DIGIT, digKey(d1)) + ' ' + colorName(DIGIT, digKey(d2)) + ' ' + colorName(MULT, mKey) + ' ' + colorName(TOL, tolKey) }));
        box.appendChild(T.el('div', { text: '即：' + digKey(d1).toUpperCase() + ' ' + digKey(d2).toUpperCase() + ' ' + mKey.toUpperCase() + ' ' + tolKey.toUpperCase() }));
        encOut.appendChild(box);
        // 回填选择器
        sel.d1 = digKey(d1); sel.d2 = digKey(d2); sel.m = mKey; sel.t = tolKey;
        d1s.value = sel.d1; d2s.value = sel.d2; ms.value = sel.m; ts.value = sel.t; decode();
      }

      const d3field = T.el('div', { class: 'field' }, [T.el('label', { text: '第3数字环' }), d3s]);
      function rebuildBandUI() {
        bandUI.innerHTML = '';
        bandUI.appendChild(T.el('div', { class: 'band-selectors' }, [
          T.el('div', { class: 'field' }, [T.el('label', { text: '第1数字环' }), d1s]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '第2数字环' }), d2s]),
          bands === 5 ? d3field : null,
          T.el('div', { class: 'field' }, [T.el('label', { text: '倍率环' }), ms]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '容差环' }), ts])
        ]));
      }
      const bandUI = T.el('div', {});

      // 初始化
      const bcWrap = bandCountRadio();
      bandCountRadio._refresh = () => {
        bcWrap.innerHTML = '';
        [4, 5].forEach(n => bcWrap.appendChild(T.el('button', { class: 'btn sm' + (n === bands ? ' primary' : ''), text: n + ' 色环', onclick: () => { bands = n; decode(); bandCountRadio._refresh(); } })));
      };

      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '电阻色环解码' }),
        bcWrap,
        bandUI,
        T.el('h4', { text: '示意图' }), vis,
        out
      ]));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '阻值反推色环' }),
        T.el('div', { class: 'form-grid' }, [
          T.el('div', { class: 'field' }, [T.el('label', { text: '阻值 (Ω)' }), encInput]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '容差' }), encTol])
        ]),
        T.el('div', { class: 'row', style: 'margin-top:6px' }, [T.el('button', { class: 'btn primary', text: '转为色环', onclick: encode })]),
        encOut
      ]));

      rebuildBandUI();
      decode();
    }
  });
})();
