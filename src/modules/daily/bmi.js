// BMI 健康计算器（日常工具）
(function () {
  const T = TB.util;
  TB.register({
    id: 'bmi', name: 'BMI 健康', category: '日常工具',
    desc: '根据身高体重计算 BMI 与体型分类（中国标准），并给出理想体重与基础代谢估算，了解身体指标。',
    tips: [
      '中国成人标准：<18.5 偏瘦，18.5~24 正常，24~28 超重，≥28 肥胖。',
      '理想体重采用 Broca 改良公式：(身高cm−100)×0.9（女再减 2.5kg）。',
      '基础代谢按 Mifflin-St Jeor 估算，需填写年龄。'
    ],
    ref: [
      { k: 'BMI', v: '体重(kg) / 身高(m)²' },
      { k: '正常区间', v: '18.5 ≤ BMI < 24' },
      { k: '理想体重', v: '(身高−100)×0.9 kg' }
    ],
    render(c) {
      const h = T.el('input', { type: 'number', value: '170', step: 'any' });
      const w = T.el('input', { type: 'number', value: '65', step: 'any' });
      const age = T.el('input', { type: 'number', value: '30', step: 'any' });
      const sex = T.el('select', {}, [T.el('option', { value: 'm', text: '男' }), T.el('option', { value: 'f', text: '女' })]);
      const res = T.el('div', { class: 'result-box' });
      function calc() {
        const H = parseFloat(h.value) / 100;
        const W = parseFloat(w.value);
        const A = parseFloat(age.value);
        if (!H || !W) { res.className = 'result-box'; res.innerHTML = '<div class="hint">请填写身高与体重。</div>'; return; }
        const bmi = W / (H * H);
        let cat, cls;
        if (bmi < 18.5) { cat = '偏瘦'; cls = 'warn'; }
        else if (bmi < 24) { cat = '正常'; cls = ''; }
        else if (bmi < 28) { cat = '超重'; cls = 'warn'; }
        else { cat = '肥胖'; cls = 'danger'; }
        const ideal = (parseFloat(h.value) - 100) * 0.9 - (sex.value === 'f' ? 2.5 : 0);
        let bmr = '';
        if (A > 0) bmr = (sex.value === 'm' ? (10 * W + 6.25 * parseFloat(h.value) - 5 * A + 5) : (10 * W + 6.25 * parseFloat(h.value) - 5 * A - 161)).toFixed(0) + ' kcal/天';
        res.className = 'result-box ' + cls;
        res.innerHTML = '';
        res.appendChild(T.el('div', { class: 'big', text: 'BMI ' + bmi.toFixed(1) + '（' + cat + '）' }));
        res.appendChild(T.el('div', { class: 'kv' }, [
          T.el('span', { class: 'k', text: '理想体重' }), T.el('span', { class: 'v', text: ideal.toFixed(1) + ' kg' }),
          T.el('span', { class: 'k', text: '体重偏差' }), T.el('span', { class: 'v', text: (W - ideal >= 0 ? '+' : '') + (W - ideal).toFixed(1) + ' kg' }),
          T.el('span', { class: 'k', text: '基础代谢' }), T.el('span', { class: 'v', text: bmr || '—（填年龄可估算）' })
        ]));
      }
      [h, w, age, sex].forEach(i => { i.oninput = calc; i.onchange = calc; });
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '身体指标测算' }),
        T.el('div', { class: 'form-grid' }, [
          T.el('div', { class: 'field' }, [T.el('label', { text: '身高（cm）' }), h]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '体重（kg）' }), w]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '年龄' }), age]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '性别' }), sex])
        ]),
        res
      ]));
      calc();
    }
  });
})();
