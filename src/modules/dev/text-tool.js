// 文本处理：统计 / 去重 / 排序 / 去空行 / 大小写 / 裁切 / 反转
(function () {
  const T = TB.util;
  TB.register({
    id: 'text-tool', name: '文本处理', category: '开发常用',
    desc: '文本批量处理：字数 / 行数统计、去重、排序、去空行、大小写转换、首尾裁切、反转。',
    tips: ['去重 / 排序 / 去空行按"行"处理', '统计含字符数、非空白字符、行数、词数', '首字母大写：每个单词首字母转大写'],
    render(c) {
      const inp = T.el('textarea', { placeholder: '粘贴文本...', style: 'min-height:120px' });
      const out = T.el('textarea', { readonly: true, style: 'min-height:120px' });
      const stat = T.el('div', { class: 'hint', text: '' });
      function setStat() {
        const t = inp.value; const noWs = t.replace(/\s/g, '');
        const lines = t.split(/\r\n|\r|\n/);
        const words = t.trim() ? t.trim().split(/\s+/).length : 0;
        stat.textContent = '字符 ' + t.length + ' · 非空白 ' + noWs.length + ' · 行 ' + (t ? lines.length : 0) + ' · 词 ' + words;
      }
      function lines() { return inp.value.split(/\r\n|\r|\n/); }
      function show(arr) { out.value = arr.join('\n'); setStat(); }
      const actions = [
        ['统计', () => setStat()],
        ['去重行', () => { const s = new Set(); show(lines().filter(l => { if (s.has(l)) return false; s.add(l); return true; })); }],
        ['行排序↑', () => show([...lines()].sort((a, b) => a.localeCompare(b, 'zh')))],
        ['行排序↓', () => show([...lines()].sort((a, b) => b.localeCompare(a, 'zh')))],
        ['去空行', () => show(lines().filter(l => l.trim() !== ''))],
        ['裁切首尾', () => show(lines().map(l => l.trim()))],
        ['全大写', () => { out.value = inp.value.toUpperCase(); setStat(); }],
        ['全小写', () => { out.value = inp.value.toLowerCase(); setStat(); }],
        ['首字母大写', () => { out.value = inp.value.toLowerCase().replace(/(^|[\s]+)([a-z])/g, (m, p, ch) => p + ch.toUpperCase()); setStat(); }],
        ['行反转', () => show([...lines()].reverse())],
        ['复制', () => { if (out.value) T.copy(out.value); }]
      ];
      const row = T.el('div', { class: 'row' }, actions.map(([l, fn]) => T.el('button', { class: l === '复制' ? 'btn ghost' : 'btn', text: l, onclick: fn })));
      inp.addEventListener('input', setStat);

      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '文本批量处理' }),
        T.el('label', { text: '输入' }), inp,
        T.el('div', { style: 'height:10px' }), row, stat,
        T.el('label', { text: '输出', style: 'margin-top:12px;display:block' }), out
      ]));
      setStat();
    }
  });
})();
