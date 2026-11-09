// SQL 格式化美化：关键字规范化、子句换行、逗号与分号整理
(function () {
  const T = TB.util;
  const KW = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET',
    'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE', 'ALTER TABLE',
    'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'JOIN', 'UNION ALL', 'UNION', 'WITH',
    'ON', 'AND', 'OR', 'AS', 'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'IS NULL', 'IS NOT NULL'];
  const BREAK = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT',
    'UNION ALL', 'UNION', 'VALUES', 'SET', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'JOIN'];

  function format(sql, upper) {
    let s = ' ' + String(sql || '').replace(/\s+/g, ' ').trim() + ' ';
    if (!s.trim()) return '';
    KW.slice().sort((a, b) => b.length - a.length).forEach(k => {
      const re = new RegExp('\\b(' + k.replace(/ /g, '\\s+') + ')\\b', 'gi');
      s = s.replace(re, () => ' ' + (upper ? k : k.toLowerCase()) + ' ');
    });
    s = s.replace(/\s+/g, ' ').trim();
    BREAK.slice().sort((a, b) => b.length - a.length).forEach(k => {
      const re = new RegExp('\\s+(' + k.replace(/ /g, '\\s+') + ')\\s', 'gi');
      s = s.replace(re, '\n' + (upper ? k : k.toLowerCase()) + ' ');
    });
    s = s.replace(/\s*,\s*/g, ',\n  ').replace(/;\s*/g, ';\n\n');
    return s.split('\n').map(l => l.replace(/\s+$/, '')).join('\n').trim();
  }

  TB.register({
    id: 'sql-format', name: 'SQL 格式化美化', category: 'SQL 辅助',
    desc: '把挤成一行的 SQL 整理成可读格式：关键字大小写统一、主要子句换行、字段列表逐行对齐。',
    tips: ['按「格式化」生成结果，可直接复制回编辑器', '简易词法格式化，不改写字符串与标识符', '含存储过程、CTE 嵌套的复杂 SQL 建议用专业 IDE 格式化'],
    render(c) {
      const inp = T.el('textarea', { id: 'sf_in', class: 'pre', rows: '9', 'aria-label': '原始 SQL', placeholder: '粘贴一行 SQL…' });
      const out = T.el('pre', { class: 'pre', id: 'sf_out' });
      const upper = T.el('input', { type: 'checkbox', id: 'sf_upper' });
      upper.checked = true;
      const compact = T.el('input', { type: 'checkbox', id: 'sf_compact' });
      const sample = "select id,name,created_at from device where status='online' and voltage>220 order by created_at desc limit 20;";
      inp.value = sample;

      function run() {
        let s = format(inp.value, upper.checked);
        if (compact.checked) s = s.replace(/\n\s*/g, ' ').replace(/\n{2,}/g, '\n');
        out.textContent = s || '（无输出）';
      }
      upper.addEventListener('change', run);
      compact.addEventListener('change', run);
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '原始 SQL' }), inp,
        T.el('div', { class: 'row' }, [
          T.el('label', { class: 'check-label' }, [upper, T.el('span', { text: '关键字大写' })]),
          T.el('label', { class: 'check-label' }, [compact, T.el('span', { text: '紧凑模式（不换行）' })]),
          T.el('button', { class: 'btn primary', text: '格式化', onclick: run }),
          T.copyBtn(() => out.textContent)
        ])
      ]));
      c.appendChild(T.el('div', { class: 'card' }, [T.el('h3', { text: '格式化结果' }), out]));
      run();
    }
  });
})();
