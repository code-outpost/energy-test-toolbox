// 测试记录：本地留痕 —— 批量计算 / 设备联调结果的保存、回看、恢复与导出
(function () {
  const T = TB.util;
  const R = TB.records;

  function stamp(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso || '—');
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function download(name, text, mime) {
    let done = false;
    if (typeof Blob === 'function' && typeof URL !== 'undefined' && URL.createObjectURL && document.createElement) {
      const a = document.createElement('a');
      if (a && typeof a.click === 'function') {
        a.href = URL.createObjectURL(new Blob(['\ufeff' + text], { type: (mime || 'text/csv') + ';charset=utf-8' }));
        a.download = name;
        a.click();
        done = true;
      }
    }
    return done;
  }

  TB.register({
    id: 'test-records', name: '测试记录', category: '综合工具',
    desc: '本机留存的测试 / 批量计算记录：按时间回看、恢复数据到批量计算台、导出 CSV 或清空。',
    tips: [
      '在「批量计算台」点击开始计算或导出报表时会自动生成一条记录',
      '记录仅保存在本机 localStorage，不上传、不随 exe 分发',
      '最多保留最近 30 条，超出自动淘汰最旧记录',
      '「恢复」会把当时的 CSV 原样送回批量计算台，便于复算'
    ],
    refs: [
      '所有记录含时间戳、模板、行数与成功数，便于形成测试台账',
      '导出的 CSV 带 UTF-8 BOM，Excel 直接打开不乱码',
      '正式测试报告请以设计计算书与现行规范校核结果为准'
    ],
    limits: [
      '适用范围：仅记录本机操作，不具备多人协作与签名效力',
      '容量上限：30 条，单条 CSV 建议不超过 5000 行',
      '警告：清除浏览器站点数据或卸载应用会一并清除记录，重要数据请先导出'
    ],
    render(c) {
      const stat = T.el('div', { class: 'result-box', id: 'tr_stat' });
      const listBox = T.el('div', { class: 'log-list', id: 'tr_list' });
      const detail = T.el('pre', { class: 'pre', id: 'tr_detail', style: 'max-height:280px;overflow:auto;white-space:pre-wrap' });
      const msg = T.el('div', { class: 'hint', id: 'tr_msg' });

      function refresh() {
        const s = R.stats();
        stat.innerHTML = '';
        stat.appendChild(T.el('div', { class: 'big', text: s.count + ' 条记录 · 累计 ' + s.rows + ' 行 · 成功 ' + s.ok + ' 行' }));
        stat.appendChild(T.el('div', { class: 'hint', text: '记录上限 ' + R.LIMIT + ' 条，全部仅存于本机' }));
        listBox.innerHTML = '';
        const all = R.all();
        if (!all.length) {
          listBox.appendChild(T.el('div', { class: 'log-row', text: '暂无记录。到「批量计算台」跑一次计算即可生成。' }));
          detail.textContent = '';
          return;
        }
        all.forEach(r => {
          const row = T.el('div', { class: 'log-row' }, [
            T.el('div', { text: stamp(r.time) + ' · ' + r.type + ' · ' + r.title }),
            T.el('div', { class: 'hint', text: r.rows + ' 行 / 成功 ' + r.ok + ' 行' })
          ]);
          const bar = T.el('div', { class: 'row', style: 'margin-top:6px' }, [
            T.el('button', { class: 'btn sm ghost', text: '查看', onclick: () => { detail.textContent = r.csv || r.summary || '（无数据）'; msg.textContent = '正在查看：' + r.title; } }),
            T.el('button', { class: 'btn sm ghost', text: '恢复', onclick: () => {
              TB.__batchPrefill = { csv: r.csv, tpl: r.tpl };
              msg.textContent = '已载入「' + r.title + '」的数据，正在跳转到批量计算台…';
              if (typeof location !== 'undefined') location.hash = '#/m/batch-calc';
            } }),
            T.el('button', { class: 'btn sm ghost', text: '导出', onclick: () => {
              const ok = download('test-record-' + r.id + '.csv', r.csv || r.summary || '', 'text/csv');
              msg.textContent = ok ? '已导出 CSV' : '当前环境不支持下载，请用「查看」手动复制';
            } }),
            T.el('button', { class: 'btn sm ghost', text: '删除', onclick: () => { R.remove(r.id); detail.textContent = ''; msg.textContent = '已删除一条记录'; refresh(); } })
          ]);
          row.appendChild(bar);
          listBox.appendChild(row);
        });
      }

      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '测试台账' }), stat,
        T.el('div', { class: 'row' }, [
          T.el('button', { class: 'btn primary', text: '刷新', onclick: refresh }),
          T.el('button', { class: 'btn ghost', text: '清空全部', onclick: () => { R.clear(); detail.textContent = ''; msg.textContent = '已清空全部记录'; refresh(); } })
        ])
      ]));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '记录明细' }), listBox
      ]));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '数据预览' }), detail, msg
      ]));
      refresh();
    }
  });
})();
