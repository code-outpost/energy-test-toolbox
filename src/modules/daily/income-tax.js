// 个人所得税计算器（日常工具 · 中国大陆综合所得）
(function () {
  const T = TB.util;
  // 年度综合所得税率表（应纳税所得额）
  const BRACKETS = [
    { up: 36000, rate: 0.03, q: 0 },
    { up: 144000, rate: 0.10, q: 2520 },
    { up: 300000, rate: 0.20, q: 16920 },
    { up: 420000, rate: 0.25, q: 31920 },
    { up: 660000, rate: 0.30, q: 52920 },
    { up: 960000, rate: 0.35, q: 85920 },
    { up: Infinity, rate: 0.45, q: 181920 }
  ];
  function taxOf(taxable) {
    if (taxable <= 0) return { tax: 0, rate: 0, q: 0 };
    for (const b of BRACKETS) {
      if (taxable <= b.up) return { tax: taxable * b.rate - b.q, rate: b.rate, q: b.q };
    }
    return { tax: 0, rate: 0, q: 0 };
  }
  TB.register({
    id: 'income-tax', name: '个人所得税', category: '日常工具',
    desc: '按年度综合所得计算个税：输入税前年收入、三险一金与专项附加扣除，自动套用 7 级超额累进税率，给出应纳税额与税后到手。',
    tips: [
      '采用年度综合所得计税（工资薪金、劳务报酬等并入），起征点 60000 元/年。',
      '三险一金与专项附加扣除填「年」额；专项附加含子女教育、房贷利息、赡养老人等。',
      '结果中的「月到手」= 税后年收入 / 12（未考虑月度预缴差异）。'
    ],
    ref: [
      { k: '起征点', v: '60000 元/年' },
      { k: '税率级距', v: '3%~45% 共7级' },
      { k: '速算扣除', v: '0 / 2520 / 16920 / 31920 / 52920 / 85920 / 181920' }
    ],
    render(c) {
      const gross = T.el('input', { type: 'number', value: '200000', step: 'any' });
      const ins = T.el('input', { type: 'number', value: '24000', step: 'any' });
      const add = T.el('input', { type: 'number', value: '12000', step: 'any' });
      const res = T.el('div', { class: 'result-box' });
      function calc() {
        const G = parseFloat(gross.value) || 0;
        const I = parseFloat(ins.value) || 0;
        const A = parseFloat(add.value) || 0;
        const taxable = Math.max(0, G - 60000 - I - A);
        const { tax, rate, q } = taxOf(taxable);
        const net = G - I - tax;
        res.innerHTML = '';
        res.appendChild(T.el('div', { class: 'big', text: '应纳税额 ' + yuan(tax) }));
        res.appendChild(T.el('div', { class: 'kv' }, [
          T.el('span', { class: 'k', text: '应纳税所得额' }), T.el('span', { class: 'v', text: yuan(taxable) }),
          T.el('span', { class: 'k', text: '适用税率' }), T.el('span', { class: 'v', text: (rate * 100).toFixed(0) + '% （速算扣除 ' + yuan(q) + '）' }),
          T.el('span', { class: 'k', text: '税后年收入' }), T.el('span', { class: 'v', text: yuan(net) }),
          T.el('span', { class: 'k', text: '月均到手' }), T.el('span', { class: 'v', text: yuan(net / 12) }),
          T.el('span', { class: 'k', text: '综合税负率' }), T.el('span', { class: 'v', text: (G > 0 ? (tax / G * 100).toFixed(2) : '0') + '%' })
        ]));
      }
      function yuan(n) { return (Math.round(n * 100) / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 }) + ' 元'; }
      [gross, ins, add].forEach(i => i.oninput = calc);
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '年度综合所得个税' }),
        T.el('div', { class: 'form-grid' }, [
          T.el('div', { class: 'field' }, [T.el('label', { text: '税前年收入' }), gross]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '三险一金（年）' }), ins]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '专项附加扣除（年）' }), add])
        ]),
        res
      ]));
      calc();
    }
  });
})();
