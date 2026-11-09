// 批量计算台：粘贴/导入 CSV → 套用公式模板逐行计算 → 结果表格 → 导出 CSV 报告
(function () {
  const T = TB.util;
  const SQ3 = Math.sqrt(3);
  const TPL = [
    {
      id: 'p3', name: '三相有功功率 P', unit: 'kW', vars: ['U', 'I', 'cosφ'],
      expr: 'P = √3 · U · I · cosφ / 1000',
      sample: '400,10,0.8\n380,20,0.85\n10000,46.2,0.9',
      calc: v => SQ3 * v[0] * v[1] * v[2] / 1000
    },
    {
      id: 'qc', name: '无功补偿容量 Qc', unit: 'kvar', vars: ['P', 'cos1', 'cos2'],
      expr: 'Qc = P · (tanφ₁ − tanφ₂)，tanφ = √(1−cos²φ)/cosφ',
      sample: '100,0.8,0.95\n200,0.8,0.95\n500,0.75,0.9',
      calc: v => v[0] * (Math.tan(Math.acos(v[1])) - Math.tan(Math.acos(v[2])))
    },
    {
      id: 'i2', name: '变压器二次额定电流 I₂', unit: 'A', vars: ['S(kVA)', 'U₂(V)'],
      expr: 'I₂ = S · 1000 / (√3 · U₂)',
      sample: '800,400\n1000,400\n630,10000',
      calc: v => v[0] * 1000 / (SQ3 * v[1])
    },
    {
      id: 'ohm', name: '欧姆定律电流 I', unit: 'A', vars: ['U', 'R'],
      expr: 'I = U / R',
      sample: '220,10\n380,50\n48,4.7',
      calc: v => v[0] / v[1]
    },
    {
      id: 'du', name: '电缆压降估算 ΔU', unit: '%', vars: ['I', 'L(m)', 'S(mm²)', 'U(V)', 'cosφ'],
      expr: 'ΔU% = √3 · I · ρ · L · cosφ / (S · U) · 100，铜 ρ=0.0175 Ω·mm²/m',
      sample: '30,150,16,400,0.85\n50,100,25,400,0.9',
      calc: v => SQ3 * v[0] * 0.0175 * v[1] * v[4] / (v[2] * v[3]) * 100
    },
    {
      id: 'bat', name: '储能电池容量 C', unit: 'Ah', vars: ['P(W)', 't(h)', 'U(V)', 'DoD', 'η'],
      expr: 'C = P · t / (U · DoD · η)',
      sample: '500,4,48,0.8,0.9\n2000,8,96,0.9,0.92',
      calc: v => v[0] * v[1] / (v[2] * v[3] * v[4])
    },
    {
      id: 'pv', name: '光伏阵列总功率', unit: 'kWp', vars: ['Ns', 'Np', 'Pmpp(W)'],
      expr: 'P = Ns · Np · Pmpp / 1000',
      sample: '20,10,550\n22,8,585',
      calc: v => v[0] * v[1] * v[2] / 1000
    }
  ];

  function parseCSV(t) {
    return String(t || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      .map((l, i) => ({ line: i + 1, cells: l.split(/[,;\t]+/).map(s => s.trim()) }));
  }
  function fmt(n) {
    if (!isFinite(n)) return '—';
    const a = Math.abs(n);
    if (a >= 100000) return n.toFixed(1);
    if (a >= 1) return n.toFixed(4);
    return n.toPrecision(5);
  }

  TB.register({
    id: 'batch-calc', name: '批量计算台 / CSV 报表', category: '综合工具',
    desc: '把重复的工程计算变成批量任务：粘贴或导入 CSV，套用公式模板一次算完，导出带状态列的结果报表。',
    tips: [
      '首行可直接写表头（非数值行会自动标记为跳过）',
      '分隔符支持逗号、分号、制表符，按模板变量顺序排列列',
      '导出为 UTF-8 BOM 的 CSV，Excel 直接打开不乱码',
      '所有数据只在本机处理，不上传'
    ],
    refs: [
      '各模板公式与单工具保持一致，详见对应工具的「公式依据与标准」卡片',
      '电缆压降为简化电阻模型，未计电抗与集肤效应，仅供初算',
      '正式出报告请以设计软件计算书与现行规范校核结果为准'
    ],
    render(c) {
      const sel = T.el('select', { id: 'bc_tpl', 'aria-label': '公式模板' },
        TPL.map((t, i) => T.el('option', { value: String(i), text: t.name + '（' + t.unit + '）' })));
      const exprBox = T.el('div', { class: 'formula', id: 'bc_expr' });
      const sampleHint = T.el('div', { class: 'hint', id: 'bc_vars' });
      const csvInput = T.el('textarea', {
        id: 'bc_csv', class: 'pre', rows: '8', 'aria-label': 'CSV 数据',
        placeholder: '每行一组数据，列顺序与模板变量一致'
      });
      const statBox = T.el('div', { class: 'result-box', id: 'bc_stat' });
      const tableBox = T.el('div', { class: 'table-wrap', id: 'bc_table' });
      let rows = [];

      function tpl() { return TPL[parseInt(sel.value || '0', 10)] || TPL[0]; }
      function showTpl() {
        const t = tpl();
        exprBox.textContent = t.expr;
        sampleHint.textContent = '变量列：' + t.vars.join(' , ') + '　结果单位：' + t.unit + '　示例：' + t.sample.split('\n')[0];
        if (!csvInput.value.trim()) csvInput.value = t.sample;
      }
      function setStat(nodes) { statBox.innerHTML = ''; nodes.forEach(n => statBox.appendChild(n)); }
      function renderTable() {
        tableBox.innerHTML = '';
        const head = T.el('tr', {}, [T.el('th', { text: '行' })]
          .concat(tpl().vars.map(v => T.el('th', { text: v })))
          .concat([T.el('th', { text: '结果 (' + tpl().unit + ')' }), T.el('th', { text: '状态' })]));
        const body = T.el('tbody', {}, rows.map(r => T.el('tr', {}, [T.el('td', { text: String(r.line) })]
          .concat(r.cells.map(x => T.el('td', { text: x })))
          .concat([
            T.el('td', { class: r.ok ? 'success' : 'hint', text: r.value }),
            T.el('td', { class: r.ok ? 'success' : 'error', text: r.ok ? '✓' : r.note })
          ]))));
        tableBox.appendChild(T.el('table', { class: 'data-table' }, [T.el('thead', {}, [head]), body]));
      }
      function run() {
        const t = tpl();
        rows = parseCSV(csvInput.value).map(r => {
          const nums = r.cells.map(Number);
          if (r.cells.length < t.vars.length || nums.slice(0, t.vars.length).some(n => !isFinite(n))) {
            return { line: r.line, cells: r.cells, value: '—', ok: false, note: '跳过（表头/列数不足/非数值）' };
          }
          try {
            const v = t.calc(nums);
            if (!isFinite(v)) throw new Error('结果非有限数');
            return { line: r.line, cells: r.cells, value: fmt(v), ok: true, note: '' };
          } catch (e) { return { line: r.line, cells: r.cells, value: '—', ok: false, note: '计算失败：' + e.message }; }
        });
        const ok = rows.filter(r => r.ok).length;
        setStat([
          T.el('div', { class: 'big', text: ok + ' / ' + rows.length + ' 行计算成功' }),
          T.el('div', { class: 'hint', text: '模板：' + t.name + ' · ' + t.expr })
        ]);
        renderTable();
      }
      function csvText() {
        const t = tpl();
        const lines = ['行号,' + t.vars.join(',') + ',结果(' + t.unit + '),状态'];
        rows.forEach(r => lines.push([r.line].concat(r.cells).concat([r.value, r.ok ? 'OK' : r.note]).join(',')));
        return '\ufeff' + lines.join('\n');
      }
      function exportCSV() {
        if (!rows.length) { setStat([T.el('div', { class: 'error', text: '请先点击「开始计算」。' })]); return; }
        const text = csvText();
        let done = false;
        if (typeof Blob === 'function' && typeof URL !== 'undefined' && URL.createObjectURL && document.createElement) {
          const a = document.createElement('a');
          if (a && typeof a.click === 'function') {
            a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
            a.download = 'batch-result-' + tpl().id + '.csv';
            a.click();
            done = true;
          }
        }
        setStat([
          T.el('div', { class: 'big', text: done ? '已导出 CSV 报表' : '当前环境不支持下载，请用「复制结果」' }),
          T.el('div', { class: 'hint', text: done ? '文件名：batch-result-' + tpl().id + '.csv（UTF-8 BOM）' : '可直接复制以下内容' })
        ]);
      }
      function copyResult() {
        if (!rows.length) return;
        T.copy(csvText()).then(() => {});
      }
      function loadFile(input) {
        if (!input || !input.files || !input.files[0] || typeof FileReader === 'undefined') return;
        const fr = new FileReader();
        fr.onload = () => { csvInput.value = String(fr.result || ''); run(); };
        fr.readAsText(input.files[0], 'utf-8');
      }

      sel.addEventListener('change', showTpl);
      const fileInput = T.el('input', { type: 'file', accept: '.csv,.txt', id: 'bc_file', 'aria-label': '导入 CSV 文件' });
      fileInput.addEventListener('change', () => loadFile(fileInput));

      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '① 选择公式模板' }),
        T.el('div', { class: 'row' }, [sel]),
        exprBox, sampleHint
      ]));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '② 输入批量数据' }),
        T.el('div', { class: 'row' }, [fileInput]),
        csvInput,
        T.el('div', { class: 'row' }, [
          T.el('button', { class: 'btn primary', text: '开始计算', onclick: run }),
          T.el('button', { class: 'btn ghost', text: '导出 CSV 报表', onclick: exportCSV }),
          T.el('button', { class: 'btn ghost', text: '复制结果', onclick: copyResult })
        ])
      ]));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '③ 结果报表' }), statBox, tableBox
      ]));

      showTpl();
      run();
    }
  });
})();
