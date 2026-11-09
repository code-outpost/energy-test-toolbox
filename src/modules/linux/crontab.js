// crontab 表达式生成器与解释：五字段解析、自然语言说明、未来执行时间推算
(function () {
  const T = TB.util;
  const NAMES = ['分钟', '小时', '日', '月', '星期'];
  const RANGES = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];
  const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const PRESETS = [
    { n: '每分钟', e: '* * * * *' },
    { n: '每 5 分钟', e: '*/5 * * * *' },
    { n: '每小时整点', e: '0 * * * *' },
    { n: '每天 02:00', e: '0 2 * * *' },
    { n: '工作日 08:30', e: '30 8 * * 1-5' },
    { n: '每周一 09:00', e: '0 9 * * 1' },
    { n: '每月 1 日 00:00', e: '0 0 1 * *' },
    { n: '每季度首日', e: '0 0 1 1,4,7,10 *' }
  ];

  function matchField(f, v) {
    if (f === '*') return true;
    return String(f).split(',').some(part => {
      let base = part, step = 1;
      const sm = part.match(/^(\*|\d+(?:-\d+)?)\/(\d+)$/);
      if (sm) { base = sm[1]; step = parseInt(sm[2], 10) || 1; }
      if (base === '*') return v % step === 0;
      const rm = base.match(/^(\d+)-(\d+)$/);
      if (rm) { const a = +rm[1], b = +rm[2]; return v >= a && v <= b && (v - a) % step === 0; }
      const n = parseInt(base, 10);
      return Number.isFinite(n) && v === n;
    });
  }
  function parts(expr) { return String(expr || '').trim().split(/\s+/); }
  function validate(expr) {
    const p = parts(expr);
    if (p.length !== 5) return '需要 5 个字段：分 时 日 月 周';
    for (let i = 0; i < 5; i++) {
      if (!/^(\*|\d+(-\d+)?|\*\/\d+|\d+(-\d+)?\/\d+|[\d,*-]+)$/.test(p[i])) return NAMES[i] + ' 字段格式不合法：' + p[i];
      for (const seg of p[i].split(',')) {
        for (const num of seg.replace(/\/.*$/, '').split('-')) {
          if (/^\d+$/.test(num)) {
            const n = +num, lo = RANGES[i][0], hi = RANGES[i][1];
            if (n < lo || n > hi) return NAMES[i] + ' 超出范围 ' + lo + '~' + hi + '：' + n;
          }
        }
      }
    }
    return '';
  }
  function explain(expr) {
    const p = parts(expr);
    const desc = (f, i) => {
      if (f === '*') return '每' + NAMES[i];
      if (/^\*\/\d+$/.test(f)) return '每 ' + f.split('/')[1] + ' ' + NAMES[i];
      if (i === 4) return WEEK[+f] || ('星期 ' + f);
      return NAMES[i] + ' = ' + f;
    };
    return p.map(desc).join('，') + '。';
  }
  function nextRuns(expr, count) {
    const p = parts(expr), out = [];
    const d = new Date();
    d.setSeconds(0, 0);
    d.setMinutes(d.getMinutes() + 1);
    const limit = 366 * 24 * 60;
    for (let i = 0; i < limit && out.length < count; i++) {
      const v = [d.getMinutes(), d.getHours(), d.getDate(), d.getMonth() + 1, d.getDay()];
      if (v.every((x, j) => matchField(p[j], x))) {
        out.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
          String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' +
          String(d.getMinutes()).padStart(2, '0'));
      }
      d.setMinutes(d.getMinutes() + 1);
    }
    return out;
  }
  function pad(n) { return String(n).padStart(2, '0'); }

  TB.register({
    id: 'crontab', name: 'crontab 表达式生成器', category: 'Linux 命令',
    desc: '可视化生成与解析 crontab 五字段表达式，给出自然语言解释并推算未来执行时间。',
    tips: ['字段顺序：分 时 日 月 周（0/7 都表示周日）', '支持 *、*/n、a-b、a,b,c 及其组合', '推算基于本机时区，最多向前搜索 366 天'],
    refs: ['crontab 五字段格式见 crontab(5) 手册（Vixie cron 语法）', '系统实际执行还受 cron 服务时区、DST 与 /etc/crontab 环境影响'],
    render(c) {
      const exprIn = T.el('input', { id: 'ct_expr', value: '*/5 * * * *', 'aria-label': 'crontab 表达式' });
      const exprBox = T.el('div', { class: 'result-box', id: 'ct_result' });
      const explainBox = T.el('div', { class: 'hint', id: 'ct_explain' });
      const runsBox = T.el('div', { class: 'pre', id: 'ct_runs' });
      const presets = T.el('div', { class: 'tool-chips' });
      const fields = T.el('div', { class: 'form-grid' });

      const ins = NAMES.map((n, i) => {
        const inp = T.el('input', { type: 'text', value: '*', id: 'ct_f' + i, 'aria-label': n });
        fields.appendChild(T.el('div', { class: 'field' }, [T.el('label', { text: n + '（' + RANGES[i][0] + '~' + RANGES[i][1] + '）' }), inp]));
        return inp;
      });

      function fromFields() {
        exprIn.value = ins.map(i => i.value.trim() || '*').join(' ');
        run();
      }
      function run() {
        const e = exprIn.value.trim();
        const err = validate(e);
        exprBox.innerHTML = '';
        if (err) {
          exprBox.className = 'result-box danger';
          exprBox.appendChild(T.el('div', { class: 'big', text: '✗ ' + err }));
          explainBox.textContent = '';
          return;
        }
        exprBox.className = 'result-box';
        exprBox.appendChild(T.el('div', { class: 'big', text: e }));
        exprBox.appendChild(T.el('div', { class: 'hint', text: '表达式合法 · 可执行命令示例：' + e + ' /opt/scripts/collect.sh' }));
        explainBox.textContent = '解释：' + explain(e);
        const p = parts(e);
        ins.forEach((i, j) => { i.value = p[j]; });
        const rs = nextRuns(e, 5);
        runsBox.textContent = rs.length ? '未来 5 次执行：\n' + rs.map((r, k) => '  ' + (k + 1) + '. ' + r).join('\n') : '未来 366 天内无匹配执行时间';
      }
      exprIn.addEventListener('input', run);
      ins.forEach(i => i.addEventListener('input', fromFields));
      PRESETS.forEach(p => presets.appendChild(T.el('button', {
        class: 'tool-chip', text: p.n,
        onclick: () => { exprIn.value = p.e; run(); }
      })));

      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '常用预设' }), presets
      ]));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '五字段编辑' }), fields,
        T.el('div', { class: 'row' }, [
          exprIn,
          T.el('button', { class: 'btn primary', text: '解析 / 校验', onclick: run }),
          T.copyBtn(() => exprIn.value)
        ])
      ]));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '结果' }), exprBox, explainBox, runsBox
      ]));
      run();
    }
  });
})();
