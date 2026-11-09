// 高压安全距离与安全参数查表（安规）
(function () {
  const T = TB.util;
  const DATA = [
    { lv: '0.4kV(低压)', d1: '0.10', d2: '0.10' },
    { lv: '10kV', d1: '0.70', d2: '0.35' },
    { lv: '20kV', d1: '1.00', d2: '0.60' },
    { lv: '35kV', d1: '1.00', d2: '0.60' },
    { lv: '66kV', d1: '1.50', d2: '1.50' },
    { lv: '110kV', d1: '1.50', d2: '1.50' },
    { lv: '220kV', d1: '3.00', d2: '3.00' },
    { lv: '330kV', d1: '4.00', d2: '4.00' },
    { lv: '500kV', d1: '5.00', d2: '5.00' },
    { lv: '750kV', d1: '8.00', d2: '8.00' },
    { lv: '1000kV', d1: '9.70', d2: '9.70' }
  ];
  TB.register({
    id: 'hv-safety', name: '高压安全距离查表', category: '高压电工',
    desc: '按电压等级查询《安规》设备不停电安全距离与工作中正常活动范围距离；附安全电压/安全电流速记。',
    refs: ["安全距离数值参照 GB 26860《电力安全工作规程》及《电业安全工作规程》相关表计","表中「不停电」与「正常活动范围」为不同作业条件下的要求，勿混用","现场作业必须以本单位现行规程、工作票与现场勘察结论为准"],
    tips: ['10kV：不停电 0.7m，活动范围 0.35m', '35kV：1.0m；110kV：1.5m；220kV：3.0m', '安全电压：42/36/24/12/6V（潮湿选更低）', '安全电流：交流 30mA、直流 50mA'],
    ref: [{ k: '不停电距离', v: '设备带电时的最小安全距离' }, { k: '活动范围', v: '人员正常活动与带电体距离' }],
    render(c) {
      const sel = T.el('select', {}, DATA.map(d => T.el('option', { value: d.lv, text: d.lv })));
      const out = T.el('div', {});
      function show() {
        const d = DATA.find(x => x.lv === sel.value) || DATA[1];
        out.innerHTML = '';
        out.appendChild(T.el('div', { class: 'result-box' }, [
          T.el('div', { class: 'big', text: d.lv + '：不停电 ' + d.d1 + ' m' }),
          T.el('div', { class: 'hint', text: '工作中正常活动范围距离：' + d.d2 + ' m' })
        ]));
      }
      sel.addEventListener('change', show);
      const full = T.el('table', {}, [
        T.el('tr', {}, [T.el('th', { text: '电压等级' }), T.el('th', { text: '不停电安全距离(m)' }), T.el('th', { text: '活动范围距离(m)' })])
      ].concat(DATA.map(d => T.el('tr', {}, [T.el('td', { text: d.lv }), T.el('td', { text: d.d1 }), T.el('td', { text: d.d2 })]))));
      const sv = T.el('div', { class: 'hint' }, [
        T.el('p', { text: '安全电压（GB/T 3805）：42V / 36V / 24V / 12V / 6V；特别潮湿或金属容器内选用 12V 或 6V。' }),
        T.el('p', { text: '安全电流（AC）：感知约 1mA、摆脱约 10mA、致命 30mA（RCD 动作值常取 30mA/0.1s）；直流电约 50mA。' })
      ]);
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '高压安全距离查询' }),
        T.el('div', { class: 'field' }, [T.el('label', { text: '选择电压等级' }), sel]),
        out,
        T.el('h4', { text: '各电压等级距离一览（来源：电力安全工作规程）' }),
        full,
        T.el('h4', { text: '安全电压 / 安全电流速记' }),
        sv
      ]));
      show();
    }
  });
})();
