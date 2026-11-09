// 工程标准数据表：导线载流量 / 变压器短路阻抗 / 继保整定系数（典型参考值 + 严格边界声明）
(function () {
  const T = TB.util;
  const TABLES = [
    {
      id: 'ampacity', name: '导线载流量参考', unit: 'A',
      cols: ['截面 mm²', '铜芯 A', '铝芯 A'],
      rows: [
        [1.5, 18, 14], [2.5, 25, 19], [4, 34, 26], [6, 43, 33], [10, 60, 46],
        [16, 80, 61], [25, 105, 80], [35, 130, 99], [50, 160, 122], [70, 205, 156],
        [95, 250, 190], [120, 290, 220], [150, 335, 254], [185, 385, 292], [240, 455, 345], [300, 525, 398]
      ],
      xLabel: '截面 (mm²)', xDefault: '25',
      note: '典型明敷、环境温度 30°C、单回路、铜/铝芯绝缘导线的参考量级。实际载流量必须按敷设方式（桥架/穿管/直埋）、环境温度、土壤热阻、并列回路成组系数、谐波与短时过载能力逐项修正。',
      refs: ['GB/T 16895.15《低压电气装置 第5-52部分：布线系统》', 'GB/T 4706 系列电线电缆载流量试验与厂家样本', 'DL/T 5222《导体和电器选择设计技术规定》'],
      warn: '本表为选型初算的量级参考，不得直接作为保护整定或导线截面最终依据。'
    },
    {
      id: 'uk', name: '配电变压器短路阻抗', unit: '%',
      cols: ['容量 kVA', 'Uk% 常见值', '备注'],
      rows: [
        [50, 4, '10kV 级配变'], [100, 4, '10kV 级配变'], [160, 4, '10kV 级配变'],
        [250, 4, '10kV 级配变'], [315, 4, '10kV 级配变'], [400, 4, '10kV 级配变'],
        [500, 4, '10kV 级配变'], [630, 6, '常见分档'], [800, 6, '常见分档'],
        [1000, 6, '常见分档'], [1250, 6, '常见分档'], [1600, 6, '常见分档'], [2000, 6, '常见分档']
      ],
      xLabel: '容量 (kVA)', xDefault: '1000',
      note: '短路阻抗 Uk% 用于估算短路电流 Iₖ ≈ Iₙ·100/Uk%，并影响电压偏差与并列运行条件。实际值以铭牌和出厂试验报告为准，不同电压等级、联结组别与制造标准差异明显。',
      refs: ['GB/T 1094.1《电力变压器 第1部分：总则》', 'GB/T 1094.5《电力变压器 第5部分：承受短路的能力》', 'GB 20052《电力变压器能效限定值及能效等级》'],
      warn: '短路电流计算须用厂家实测 Uk% 与系统阻抗，禁止用本表值出正式短路校核报告。'
    },
    {
      id: 'relay', name: '继保整定常用系数', unit: '—',
      cols: ['系数 / 项目', '典型取值', '适用说明'],
      rows: [
        ['可靠系数 Krel', '1.2 ~ 1.3', '过电流保护，按保护类型与继电器特性选取'],
        ['返回系数 Kre', '0.85 ~ 0.95', '电磁型偏低、微机型可取高值'],
        ['灵敏系数 Ksen', '≥ 1.5 ~ 2.0', '主保护按保护区末端最小短路电流校核'],
        ['自启动系数 Kss', '1.5 ~ 2.5', '含大量电动机负荷时考虑'],
        ['接线系数 Kw', '1.0（三相星形）', '两相电流差接线可取 √3'],
        ['CT 变比选择', 'I₁ₙ ≥ 1.2~1.5·Iₘₐₓ', '兼顾准确级与动热稳定'],
        ['动作时限级差 Δt', '0.3 ~ 0.5 s', '上下级配合，微机型可取下限']
      ],
      xLabel: '', xDefault: '',
      note: '以上为整定计算中的典型取值区间，用于教学与估算。正式定值必须依据系统短路计算、保护配置、CT/PT 参数与调度下达的定值单。',
      refs: ['GB/T 14285《继电保护和安全自动装置技术规程》', 'DL/T 584《3kV~110kV 电网继电保护装置运行整定规程》', 'GB/T 50062《电力装置的继电保护和自动装置设计规范》'],
      warn: '系数取值随保护装置型号与电网结构变化，本表不可代替定值计算书。'
    }
  ];

  function interp(table, x) {
    if (table.id !== 'ampacity' && table.id !== 'uk') return null;
    const nums = table.rows.map(r => Number(r[0]));
    if (!isFinite(x) || x < nums[0] || x > nums[nums.length - 1]) return null;
    for (let i = 0; i < nums.length - 1; i++) {
      if (x >= nums[i] && x <= nums[i + 1]) {
        if (x === nums[i]) return { value: Number(table.rows[i][1]), exact: true, lo: table.rows[i], hi: table.rows[i + 1] };
        if (x === nums[i + 1]) return { value: Number(table.rows[i + 1][1]), exact: true, lo: table.rows[i], hi: table.rows[i + 1] };
        const t = (x - nums[i]) / (nums[i + 1] - nums[i]);
        return { value: Number(table.rows[i][1]) + t * (Number(table.rows[i + 1][1]) - Number(table.rows[i][1])), exact: false, lo: table.rows[i], hi: table.rows[i + 1] };
      }
    }
    return null;
  }
  function csvOf(t) {
    return [t.cols.join(',')].concat(t.rows.map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(','))).join('\n');
  }

  TB.register({
    id: 'hv-tables', name: '工程标准数据表', category: '高压电工',
    desc: '导线载流量、配电变压器短路阻抗、继保整定系数的典型参考表，带截面/容量插值估算与严格的适用边界声明。',
    tips: [
      '切换表格可查看三类常用工程数据，支持按截面或容量线性插值',
      '所有数值均为「量级参考」，表下附有必须修正的因素与标准出处',
      '可导出 CSV 带入自己的计算书，导出内容同样含边界声明',
      '插值仅用于相邻档位之间估算，超出表范围会明确拒绝'
    ],
    ref: [
      { k: '功率三角形', v: 'S² = P² + Q²' },
      { k: '短路电流估算', v: 'Iₖ ≈ Iₙ·100/Uk%' },
      { k: '额定电流', v: 'Iₙ = S/(√3·U)' }
    ],
    refs: [
      'GB/T 16895.15《低压电气装置 第5-52部分：电气设备的选择和安装 布线系统》',
      'GB/T 1094.1《电力变压器 第1部分：总则》',
      'GB/T 14285《继电保护和安全自动装置技术规程》',
      'DL/T 5222《导体和电器选择设计技术规定》'
    ],
    limits: [
      '输入范围：插值仅限表内相邻档位区间；载流量 1.5~300 mm²、容量 50~2000 kVA',
      '适用边界：参考值为典型工况量级，未计入敷设方式、环境温度、成组系数、谐波与厂家差异',
      '示例：25 mm² 铜芯参考载流量约 105 A；1000 kVA 配变 Uk 常见 6%',
      '警告：正式设计 / 定值 / 短路校核必须以现行标准原文、厂家样本与实测参数为准，本表不得直接引用为结论'
    ],
    render(c) {
      const sel = T.el('select', { id: 'ht_t', 'aria-label': '数据表' },
        TABLES.map((t, i) => T.el('option', { value: String(i), text: t.name })));
      sel.value = '0';
      const tableBox = T.el('div', { class: 'table-wrap', id: 'ht_table' });
      const noteBox = T.el('div', { class: 'hint', id: 'ht_note' });
      const xInp = T.el('input', { type: 'number', id: 'ht_x', step: 'any', value: '25', 'aria-label': '插值输入' });
      const xLabel = T.el('label', { id: 'ht_xlabel', text: '截面 (mm²)' });
      const outBox = T.el('div', { class: 'result-box', id: 'ht_out' });
      const msg = T.el('div', { class: 'hint', id: 'ht_msg' });
      function t() { return TABLES[parseInt(sel.value || '0', 10)] || TABLES[0]; }

      function drawTable() {
        const tb = t();
        tableBox.innerHTML = '';
        const head = T.el('tr', {}, tb.cols.map(h => T.el('th', { text: h })));
        const body = T.el('tbody', {}, tb.rows.map(r => T.el('tr', {}, r.map(x => T.el('td', { text: String(x) })))));
        tableBox.appendChild(T.el('table', { class: 'data-table' }, [T.el('thead', {}, [head]), body]));
        noteBox.textContent = tb.note;
        xLabel.textContent = tb.xLabel || '（本表不支持插值）';
        xInp.value = tb.xDefault || '';
        xInp.disabled = !tb.xLabel;
      }
      function runInterp() {
        const tb = t();
        outBox.innerHTML = '';
        if (!tb.xLabel) {
          outBox.appendChild(T.el('div', { class: 'big', text: tb.name + '：共 ' + tb.rows.length + ' 条参考项' }));
          outBox.appendChild(T.el('div', { class: 'hint', text: '本表为离散系数表，不适用数值插值；请按列说明结合定值计算书选取。' }));
          return;
        }
        const x = Number(xInp.value);
        const r = interp(tb, x);
        if (!r) {
          outBox.appendChild(T.el('div', { class: 'error', text: '输入超出表范围或无效（' + tb.rows[0][0] + ' ~ ' + tb.rows[tb.rows.length - 1][0] + '）。' }));
          return;
        }
        outBox.appendChild(T.el('div', { class: 'big', text: tb.xLabel.replace(/\s*\(.*\)/, '') + ' ' + x + ' → ' + (tb.id === 'ampacity' ? '铜芯载流量约 ' : 'Uk 约 ') + r.value.toFixed(1) + ' ' + tb.unit }));
        outBox.appendChild(T.el('div', { class: 'hint', text: r.exact
          ? '命中表内档位：' + r.lo[0] + ' → ' + r.lo[1]
          : '线性插值：' + r.lo[0] + ' → ' + r.lo[1] + '，' + r.hi[0] + ' → ' + r.hi[1] }));
        if (tb.id === 'uk' && r.value > 0) {
          const In = x * 1000 / (Math.sqrt(3) * 10000);
          outBox.appendChild(T.el('div', { class: 'success', text: '按 10kV 侧估算：Iₙ ≈ ' + In.toFixed(1) + ' A，Iₖ ≈ Iₙ·100/Uk% ≈ ' + (In * 100 / r.value).toFixed(0) + ' A（仅示意，未计系统阻抗）' }));
        }
      }
      function publishResult() {
        const tb = t();
        if (!TB.bus || !tb.xLabel) return;
        const x = Number(xInp.value), r = interp(tb, x);
        if (!r) return;
        TB.bus.publish('hv-tables', tb.name + '（' + x + ' ' + (tb.id === 'ampacity' ? 'mm²' : 'kVA') + '）',
          Number(r.value.toFixed(2)), tb.unit, { note: '典型参考值，需按 ' + tb.name + ' 边界条件修正' });
        msg.textContent = '已发布到「结果中转站」，可在右侧面板把该结果送入其它工具。';
      }
      function exportCSV() {
        const tb = t();
        const text = '# ' + tb.name + '\n# ' + tb.warn + '\n' + csvOf(tb);
        let done = false;
        if (typeof Blob === 'function' && typeof URL !== 'undefined' && URL.createObjectURL) {
          const a = document.createElement('a');
          if (a && typeof a.click === 'function') {
            a.href = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' }));
            a.download = 'hv-table-' + tb.id + '.csv';
            a.click(); done = true;
          }
        }
        msg.textContent = done ? '已导出 ' + tb.name + '（含边界声明）' : '当前环境不支持下载，可直接复制表格内容';
      }
      sel.addEventListener('change', () => { drawTable(); runInterp(); });
      xInp.addEventListener('input', runInterp);

      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '① 选择数据表' }),
        T.el('div', { class: 'row' }, [sel]), noteBox
      ]));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '② 插值估算' }),
        T.el('div', { class: 'form-grid' }, [T.el('div', { class: 'field' }, [xLabel, xInp])]),
        T.el('div', { class: 'row' }, [
          T.el('button', { class: 'btn primary', text: '估算并发布结果', onclick: () => { runInterp(); publishResult(); } }),
          T.el('button', { class: 'btn ghost', text: '导出 CSV', onclick: exportCSV })
        ]),
        outBox, msg
      ]));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '③ 参考数据' }), tableBox
      ]));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('div', { class: 'error', text: '⚠ ' + t().warn })
      ]));

      drawTable();
      runInterp();
    }
  });
})();
