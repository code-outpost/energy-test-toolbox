// 房贷月供计算器（日常工具）
(function () {
  const T = TB.util;
  TB.register({
    id: 'mortgage', name: '房贷月供', category: '日常工具',
    desc: '计算等额本息 / 等额本金两种还款方式的月供、总利息与总还款额，便于对比选贷。',
    tips: [
      '等额本息：每月还款额固定，前期利息占比高。',
      '等额本金：每月本金固定，月供逐月递减，总利息更少。',
      '利率填「年化百分比」，例如 4.2 表示 4.2%。'
    ],
    ref: [
      { k: '等额本息', v: 'M = P·r·(1+r)ⁿ / ((1+r)ⁿ−1)' },
      { k: '等额本金', v: '月供 = P/n + 剩余本金·r' },
      { k: 'r / n', v: '月利率 = 年利率/12；期数 = 年限×12' }
    ],
    render(c) {
      const total = T.el('input', { type: 'number', value: '100', step: 'any' });     // 万元
      const rate = T.el('input', { type: 'number', value: '4.2', step: 'any' });       // 年化 %
      const years = T.el('input', { type: 'number', value: '30', step: 'any' });
      const mode = T.el('select', {}, [
        T.el('option', { value: 'bx', text: '等额本息' }),
        T.el('option', { value: 'bj', text: '等额本金' })
      ]);
      const res = T.el('div', { class: 'result-box' });
      function calc() {
        const P = (parseFloat(total.value) || 0) * 10000;
        const annual = parseFloat(rate.value) || 0;
        const y = parseFloat(years.value) || 0;
        const r = annual / 100 / 12;
        const n = Math.round(y * 12);
        if (P <= 0 || n <= 0) { res.innerHTML = '<div class="hint">请填写有效的贷款金额与年限。</div>'; return; }
        let rows = [];
        if (mode.value === 'bx') {
          const f = Math.pow(1 + r, n);
          const M = r === 0 ? P / n : P * r * f / (f - 1);
          const totalPay = M * n;
          const interest = totalPay - P;
          rows = [
            ['每月月供', yuan(M)],
            ['还款总期数', n + ' 期（' + y + ' 年）'],
            ['支付利息总额', yuan(interest)],
            ['还款总额', yuan(totalPay)]
          ];
          res.className = 'result-box';
          res.innerHTML = '';
          res.appendChild(T.el('div', { class: 'big', text: '月供 ' + yuan(M) }));
          res.appendChild(kv(rows));
        } else {
          const principalMonth = P / n;
          const first = principalMonth + P * r;
          const last = principalMonth + (P - principalMonth * (n - 1)) * r;
          const interest = P * r * (n + 1) / 2;
          const totalPay = P + interest;
          rows = [
            ['首月月供', yuan(first)],
            ['末月月供', yuan(last)],
            ['每月递减', yuan(principalMonth * r)],
            ['支付利息总额', yuan(interest)],
            ['还款总额', yuan(totalPay)]
          ];
          res.className = 'result-box';
          res.innerHTML = '';
          res.appendChild(T.el('div', { class: 'big', text: '首月月供 ' + yuan(first) }));
          res.appendChild(kv(rows));
        }
      }
      function kv(rows) {
        const el = T.el('div', { class: 'kv' });
        rows.forEach(([k, v]) => { el.appendChild(T.el('span', { class: 'k', text: k })); el.appendChild(T.el('span', { class: 'v', text: v })); });
        return el;
      }
      function yuan(n) { return (Math.round(n * 100) / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 }) + ' 元'; }
      [total, rate, years, mode].forEach(i => { i.oninput = calc; i.onchange = calc; });
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '房贷还款测算' }),
        T.el('div', { class: 'form-grid' }, [
          T.el('div', { class: 'field' }, [T.el('label', { text: '贷款总额（万元）' }), total]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '年利率（%）' }), rate]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '贷款年限（年）' }), years]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '还款方式' }), mode])
        ]),
        res
      ]));
      calc();
    }
  });
})();
