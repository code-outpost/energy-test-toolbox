// 批量计算台：CSV 导入 → 公式模板批量计算 → 结果表 / 趋势曲线 → CSV / Excel / 可打印 PDF 报告 → 测试记录留痕
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
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function download(name, text, mime, bom) {
    let done = false;
    if (typeof Blob === 'function' && typeof URL !== 'undefined' && URL.createObjectURL && document.createElement) {
      const a = document.createElement('a');
      if (a && typeof a.click === 'function') {
        a.href = URL.createObjectURL(new Blob([(bom === false ? '' : '\ufeff') + text], { type: (mime || 'text/csv') + ';charset=utf-8' }));
        a.download = name; a.click(); done = true;
      }
    }
    return done;
  }
  function nowText() {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  TB.register({
    id: 'batch-calc', name: '批量计算台 / CSV 报表', category: '综合工具',
    desc: 'CSV 批量计算 + 结果趋势曲线 + CSV / Excel / 可打印 PDF 报告 + 本机测试记录留痕。',
    accepts: ['active', 'reactive', 'apparent', 'voltage', 'current', 'ratio'],
    tips: [
      '首行可直接写表头（非数值行会自动标记为跳过）',
      '分隔符支持逗号、分号、制表符，按模板变量顺序排列列',
      '导出 CSV / Excel 均为 UTF-8，Excel 直接打开不乱码',
      '「生成报告 / 打印 PDF」会排版一份含公式、结果表与趋势图的计算书，在打印对话框选择「另存为 PDF」',
      '每次「开始计算」都会留一条本机测试记录，可在「测试记录」中回看与恢复'
    ],
    refs: [
      '各模板公式与单工具保持一致，详见对应工具的「公式依据与标准」卡片',
      '电缆压降为简化电阻模型，未计电抗与集肤效应，仅供初算',
      '正式出报告请以设计软件计算书与现行规范校核结果为准'
    ],
    limits: [
      '输入范围：每行数值个数须 ≥ 模板变量数；非数值或列数不足自动跳过并标注',
      '适用边界：模板为稳态简化公式，不含谐波、温度修正、三相不平衡与动态过程',
      '示例：400 V / 10 A / cosφ 0.8 → 5.5426 kW；800 kVA / 400 V → 1154.7 A',
      '警告：CSV 建议不超过 5000 行，超大数据请分批；结果不得直接作为设计结论'
    ],
    render(c) {
      const sel = T.el('select', { id: 'bc_tpl', 'aria-label': '公式模板' },
        TPL.map((t, i) => T.el('option', { value: String(i), text: t.name + '（' + t.unit + '）' })));
      sel.value = '0';
      const exprBox = T.el('div', { class: 'formula', id: 'bc_expr' });
      const sampleHint = T.el('div', { class: 'hint', id: 'bc_vars' });
      const csvInput = T.el('textarea', {
        id: 'bc_csv', class: 'pre', rows: '8', 'aria-label': 'CSV 数据',
        placeholder: '每行一组数据，列顺序与模板变量一致'
      });
      const statBox = T.el('div', { class: 'result-box', id: 'bc_stat' });
      const tableBox = T.el('div', { class: 'table-wrap', id: 'bc_table' });
      const trendBox = T.el('div', { class: 'trend-box', id: 'bc_trend' });
      const reportBox = T.el('div', { class: 'print-report', id: 'bc_report' });
      const msg = T.el('div', { class: 'hint', id: 'bc_msg' });
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
      function okValues() { return rows.filter(r => r.ok).map(r => Number(r.value)).filter(n => isFinite(n)); }
      function trendSvg() {
        const pts = okValues();
        const W = 640, H = 210, pad = 44;
        const svg = T.svg('svg', {
          viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: '210',
          class: 'trend-svg', role: 'img', 'aria-label': '批量计算结果趋势曲线',
          style: 'color:var(--accent)'
        });
        if (pts.length < 2) {
          svg.appendChild(T.svg('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', fill: 'currentColor', 'font-size': '13' }, [], '至少 2 行有效结果才能绘制趋势'));
          return svg;
        }
        const min = Math.min.apply(null, pts), max = Math.max.apply(null, pts), span = (max - min) || Math.abs(max) || 1;
        const X = i => pad + i * (W - 2 * pad) / (pts.length - 1);
        const Y = v => H - pad - (v - min) / span * (H - 2 * pad);
        for (let g = 0; g <= 4; g++) {
          const y = pad + g * (H - 2 * pad) / 4;
          svg.appendChild(T.svg('line', { x1: pad, y1: y, x2: W - pad, y2: y, stroke: 'currentColor', 'stroke-opacity': '.18', 'stroke-dasharray': '4 4' }));
          const lv = max - g * span / 4;
          svg.appendChild(T.svg('text', { x: pad - 6, y: y + 4, 'text-anchor': 'end', fill: 'currentColor', 'font-size': '10', 'fill-opacity': '.75' }, [], fmt(lv)));
        }
        svg.appendChild(T.svg('polyline', {
          points: pts.map((v, i) => X(i).toFixed(1) + ',' + Y(v).toFixed(1)).join(' '),
          fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linejoin': 'round'
        }));
        pts.forEach((v, i) => {
          svg.appendChild(T.svg('circle', { cx: X(i), cy: Y(v), r: '3.5', fill: 'currentColor' }));
          if (pts.length <= 12) svg.appendChild(T.svg('text', { x: X(i), y: Y(v) - 9, 'text-anchor': 'middle', fill: 'currentColor', 'font-size': '10' }, [], fmt(v)));
        });
        svg.appendChild(T.svg('text', { x: W / 2, y: H - 8, 'text-anchor': 'middle', fill: 'currentColor', 'font-size': '11', 'fill-opacity': '.8' }, [], '行号 1 → ' + pts.length + '　单位：' + tpl().unit));
        return svg;
      }
      function drawTrend() { trendBox.innerHTML = ''; trendBox.appendChild(trendSvg()); }
      function csvText() {
        const t = tpl();
        const lines = ['行号,' + t.vars.join(',') + ',结果(' + t.unit + '),状态'];
        rows.forEach(r => lines.push([r.line].concat(r.cells).concat([r.value, r.ok ? 'OK' : r.note]).join(',')));
        return lines.join('\n');
      }
      function saveRecord(where) {
        if (!TB.records) return null;
        const t = tpl(), ok = rows.filter(r => r.ok).length;
        return TB.records.add({
          type: '批量计算', title: t.name + '（' + where + '）',
          rows: rows.length, ok: ok, tpl: t.id,
          summary: t.expr + ' · 成功 ' + ok + '/' + rows.length,
          csv: csvText()
        });
      }
      function run(save) {
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
        drawTrend();
        reportBox.innerHTML = '';
        if (save) {
          const rec = saveRecord('开始计算');
          msg.textContent = rec ? '已保存测试记录（' + rec.title + '），可在「测试记录」中回看。' : '本次计算完成。';
        }
        if (save && TB.bus && ok) {
          const vals = okValues();
          const avg = vals.reduce((s, x) => s + x, 0) / vals.length;
          TB.bus.publish('batch-calc', t.name + ' 均值（' + ok + ' 行）', Number(avg.toFixed(4)), t.unit,
            { note: '批量计算 ' + ok + ' 行结果均值，可在右侧「结果中转站」送入其它工具' });
        }
      }
      function exportCSV() {
        if (!rows.length) { msg.textContent = '请先点击「开始计算」。'; return; }
        const done = download('batch-result-' + tpl().id + '.csv', csvText(), 'text/csv');
        saveRecord('导出 CSV');
        msg.textContent = done ? '已导出 CSV 报表，并保存一条测试记录。' : '当前环境不支持下载，请用「复制结果」';
      }
      function excelHTML() {
        const t = tpl(), ok = rows.filter(r => r.ok).length;
        let h = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><style>td,th{border:1px solid #999;padding:4px 8px}th{background:#e8f1fb;font-weight:bold}</style></head><body>';
        h += '<h2>能源测试工具箱 · 批量计算报表</h2>';
        h += '<p>模板：' + esc(t.name) + '　单位：' + esc(t.unit) + '　公式：' + esc(t.expr) + '</p>';
        h += '<p>生成时间：' + esc(nowText()) + '　总行数：' + rows.length + '　成功：' + ok + '</p>';
        h += '<table><tr><th>行号</th>' + t.vars.map(v => '<th>' + esc(v) + '</th>').join('') + '<th>结果(' + esc(t.unit) + ')</th><th>状态</th></tr>';
        rows.forEach(r => { h += '<tr><td>' + r.line + '</td>' + r.cells.map(x => '<td>' + esc(x) + '</td>').join('') + '<td>' + esc(r.value) + '</td><td>' + esc(r.ok ? 'OK' : r.note) + '</td></tr>'; });
        h += '</table><p>说明：参考值仅供初算，正式结论以现行规范校核为准。</p></body></html>';
        return h;
      }
      function exportExcel() {
        if (!rows.length) { msg.textContent = '请先点击「开始计算」。'; return; }
        const done = download('batch-result-' + tpl().id + '.xls', excelHTML(), 'application/vnd.ms-excel', false);
        saveRecord('导出 Excel');
        msg.textContent = done ? '已导出 Excel 报表（.xls），并保存一条测试记录。' : '当前环境不支持下载。';
      }
      function buildReport() {
        const t = tpl(), ok = rows.filter(r => r.ok).length, vals = okValues();
        const avg = vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : 0;
        const mn = vals.length ? Math.min.apply(null, vals) : 0, mx = vals.length ? Math.max.apply(null, vals) : 0;
        reportBox.innerHTML = '';
        reportBox.appendChild(T.el('div', { class: 'rp-head' }, [
          T.el('h1', { text: '能源测试工具箱 · 批量计算报告' }),
          T.el('div', { class: 'hint', text: '生成时间：' + nowText() + '　|　工具版本：v' + ((window.TB && TB.VERSION) || '0.4.0') })
        ]));
        reportBox.appendChild(T.el('table', { class: 'data-table rp-meta' }, [
          T.el('tr', {}, [T.el('th', { text: '计算模板' }), T.el('td', { text: t.name }), T.el('th', { text: '结果单位' }), T.el('td', { text: t.unit })]),
          T.el('tr', {}, [T.el('th', { text: '总行数' }), T.el('td', { text: String(rows.length) }), T.el('th', { text: '成功 / 跳过' }), T.el('td', { text: ok + ' / ' + (rows.length - ok) })]),
          T.el('tr', {}, [T.el('th', { text: '均值' }), T.el('td', { text: fmt(avg) }), T.el('th', { text: '最小 / 最大' }), T.el('td', { text: fmt(mn) + ' / ' + fmt(mx) })])
        ]));
        reportBox.appendChild(T.el('div', { class: 'card' }, [
          T.el('h3', { text: '计算公式' }), T.el('div', { class: 'formula', text: t.expr }),
          T.el('p', { class: 'hint', text: '变量列：' + t.vars.join(' , ') })
        ]));
        const rh = T.el('tr', {}, [T.el('th', { text: '行' })].concat(t.vars.map(v => T.el('th', { text: v }))).concat([T.el('th', { text: '结果 (' + t.unit + ')' }), T.el('th', { text: '状态' })]));
        const rb = T.el('tbody', {}, rows.map(r => T.el('tr', {}, [T.el('td', { text: String(r.line) })]
          .concat(r.cells.map(x => T.el('td', { text: x })))
          .concat([T.el('td', { text: r.value }), T.el('td', { text: r.ok ? 'OK' : r.note })]))));
        reportBox.appendChild(T.el('div', { class: 'card' }, [
          T.el('h3', { text: '计算结果明细' }),
          T.el('div', { class: 'table-wrap' }, [T.el('table', { class: 'data-table' }, [T.el('thead', {}, [rh]), rb])])
        ]));
        reportBox.appendChild(T.el('div', { class: 'card' }, [
          T.el('h3', { text: '结果趋势' }), trendSvg()
        ]));
        reportBox.appendChild(T.el('div', { class: 'card rp-sign' }, [
          T.el('p', { class: 'hint', text: '说明：本报告由本机批量计算生成，公式为稳态简化模型，未计谐波、温度与敷设修正；正式设计结论以现行规范校核及设计计算书为准。' }),
          T.el('div', { class: 'rp-sign-row' }, [
            T.el('span', { text: '计算：____________' }), T.el('span', { text: '校核：____________' }), T.el('span', { text: '日期：____________' })
          ])
        ]));
      }
      function printReport() {
        if (!rows.length) { msg.textContent = '请先点击「开始计算」。'; return; }
        buildReport();
        reportBox.className = 'print-report visible';
        saveRecord('生成报告');
        msg.textContent = '报告已生成，请在打印对话框中选择「另存为 PDF」；同时已保存一条测试记录。';
        if (typeof window !== 'undefined' && typeof window.print === 'function') window.print();
      }
      function copyResult() {
        if (!rows.length) return;
        T.copy(csvText()).then(() => { msg.textContent = '结果 CSV 已复制到剪贴板。'; });
      }
      function loadFile(input) {
        if (!input || !input.files || !input.files[0] || typeof FileReader === 'undefined') return;
        const fr = new FileReader();
        fr.onload = () => { csvInput.value = String(fr.result || ''); run(false); msg.textContent = '已导入 CSV 文件。'; };
        fr.readAsText(input.files[0], 'utf-8');
      }

      // 从「测试记录」恢复数据
      if (TB.__batchPrefill && TB.__batchPrefill.csv) {
        const p = TB.__batchPrefill;
        if (p.tpl) { const i = TPL.findIndex(t => t.id === p.tpl); if (i >= 0) sel.value = String(i); }
        csvInput.value = p.csv;
        msg.textContent = '已从测试记录恢复数据，可直接复算。';
        TB.__batchPrefill = null;
      }
      // 接收其它工具「送入」的结果（作为首个数值填入 CSV 首行）
      if (TB.bus) {
        const r = TB.bus.consume('batch-calc', [{ el: csvInput, family: '*', unit: '', label: 'CSV 数据' }]);
        if (r && r.filled && r.entry) {
          const t = tpl();
          csvInput.value = [r.value].concat(t.vars.slice(1).map(() => '1')).join(',');
          msg.textContent = '已引用「' + r.label + '」= ' + r.value + ' ' + (r.entry.unit || '') + ' 作为首行首列，请补齐其余变量后计算。';
        } else if (r && r.reason) msg.textContent = r.reason;
      }

      sel.addEventListener('change', () => { showTpl(); csvInput.value = tpl().sample; run(false); });
      const fileInput = T.el('input', { type: 'file', accept: '.csv,.txt', id: 'bc_file', 'aria-label': '导入 CSV 文件' });
      fileInput.addEventListener('change', () => loadFile(fileInput));

      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '① 选择公式模板' }), T.el('div', { class: 'row' }, [sel]), exprBox, sampleHint
      ]));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '② 输入批量数据' }), T.el('div', { class: 'row' }, [fileInput]), csvInput,
        T.el('div', { class: 'row' }, [
          T.el('button', { class: 'btn primary', text: '开始计算', onclick: () => run(true) }),
          T.el('button', { class: 'btn ghost', text: '导出 CSV', onclick: exportCSV }),
          T.el('button', { class: 'btn ghost', text: '导出 Excel', onclick: exportExcel }),
          T.el('button', { class: 'btn ghost', text: '生成报告 / 打印 PDF', onclick: printReport }),
          T.el('button', { class: 'btn ghost', text: '复制结果', onclick: copyResult })
        ]), msg
      ]));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '③ 结果报表' }), statBox, tableBox
      ]));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '④ 结果趋势曲线' }), trendBox
      ]));
      c.appendChild(reportBox);

      showTpl();
      run(false);
    }
  });
})();
