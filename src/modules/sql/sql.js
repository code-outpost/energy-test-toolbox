// SQL 辅助工具组：格式化 / 大小写 / 表结构提取 / 语法检查（多方言）
(function () {
  const T = TB.util;
  const KWSET = new Set(['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'UNION ALL', 'UNION', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 'CROSS JOIN', 'JOIN', 'ON', 'AND', 'OR', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'AS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'ASC', 'DESC', 'DISTINCT', 'BY', 'IN', 'NOT', 'NULL', 'IS', 'LIKE', 'BETWEEN', 'EXISTS', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CREATE', 'TABLE', 'ALTER', 'DROP', 'INDEX', 'VIEW']);

  function format(sql) {
    let s = (sql || '').replace(/\s+/g, ' ').trim();
    // 关键字大写
    s = s.replace(/\b([a-zA-Z_][\w]*)\b/g, m => KWSET.has(m.toUpperCase()) ? m.toUpperCase() : m);
    // 主子句换行
    const nl = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'UNION ALL', 'UNION', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 'CROSS JOIN', 'JOIN', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM'];
    nl.sort((a, b) => b.length - a.length);
    nl.forEach(k => { s = s.split(' ' + k + ' ').join('\n' + k + ' '); });
    // AND/OR/ON 缩进换行
    s = s.replace(/\bAND\b/g, '\n  AND').replace(/\bOR\b/g, '\n  OR').replace(/\bON\b/g, '\n  ON');
    return s.split('\n').map(l => l.trim()).filter(l => l).join('\n');
  }
  function toCase(sql, mode) {
    if (mode === 'upper') return sql.toUpperCase();
    if (mode === 'lower') return sql.toLowerCase();
    // 关键字大写、标识符保持
    return sql.replace(/\b([a-zA-Z_][\w]*)\b/g, m => KWSET.has(m.toUpperCase()) ? m.toUpperCase() : m);
  }
  function extract(sql) {
    const s = (sql || '').replace(/\s+/g, ' ').trim();
    const tables = [], cols = [];
    const tRe = /\b(?:FROM|JOIN)\s+([`"\w.]+)(?:\s+(?:AS\s+)?(\w+))?/gi;
    let m; while ((m = tRe.exec(s))) tables.push(m[1] + (m[2] ? ' AS ' + m[2] : ''));
    const selM = s.match(/\bSELECT\b([\s\S]*?)\bFROM\b/i);
    if (selM) {
      let depth = 0; const items = [];
      for (const ch of selM[1]) { if (ch === '(') depth++; else if (ch === ')') depth--; if (ch === ',' && depth === 0) items.push('|'); else items.push(ch); }
      items.join('').split('|').forEach(it => { const t = it.trim(); if (t && t !== '*') cols.push(t); else if (t === '*') cols.push('* (所有列)'); });
    }
    return { tables, cols };
  }
  function lint(sql) {
    const errs = [];
    let line = 1, col = 1; const stack = [];
    const matchParen = { ')': '(', ']': '[', '}': '{' };
    for (let i = 0; i < sql.length; i++) {
      const ch = sql[i];
      if (ch === '\n') { line++; col = 1; continue; }
      col++;
      if (ch === '(' || ch === '[' || ch === '{') stack.push({ ch, line, col });
      else if (matchParen[ch]) { if (!stack.length) errs.push(`第 ${line} 行多出 '${ch}'`); else { const top = stack.pop(); if (top.ch !== matchParen[ch]) errs.push(`第 ${line} 行 '${ch}' 与第 ${top.line} 行 '${top.ch}' 不匹配`); } }
      else if (ch === "'") { let j = i + 1, closed = false; while (j < sql.length) { if (sql[j] === "'" && sql[j - 1] !== '\\') { closed = true; break; } if (sql[j] === '\n') break; j++; } if (!closed) errs.push(`第 ${line} 行单引号未闭合`); else i = j; }
    }
    if (stack.length) errs.push(`第 ${stack[0].line} 行 '${stack[0].ch}' 未闭合`);
    return errs;
  }

  TB.register({
    id: 'sql', name: 'SQL 工具', category: 'SQL 辅助',
    desc: 'SQL 格式化/美化、大小写转换、表名与字段提取、语法检查（多方言）',
    render(c) {
      const modeSel = T.el('select', {}, [
        T.el('option', { value: 'fmt', text: '格式化' }), T.el('option', { value: 'case', text: '大小写转换' }),
        T.el('option', { value: 'extract', text: '表/字段提取' }), T.el('option', { value: 'lint', text: '语法检查' })
      ]);
      const caseSel = T.el('select', {}, [T.el('option', { value: 'upper', text: '全大写' }), T.el('option', { value: 'lower', text: '全小写' }), T.el('option', { value: 'kw', text: '关键字大写' })]);
      const dialectSel = T.el('select', {}, ['MySQL', 'PostgreSQL', 'SQLServer', 'SQLite', 'Oracle'].map(d => T.el('option', { value: d, text: d })));
      const inArea = T.el('textarea', { class: 'mono', placeholder: '粘贴 SQL...' });
      const out = T.el('div', { class: 'col' });

      function run() {
        out.innerHTML = '';
        const mode = modeSel.value;
        if (mode === 'fmt') { out.appendChild(T.el('div', { class: 'hint', text: '格式化结果（' + dialectSel.value + '）' })); const r = T.el('div', { class: 'pre' }); r.textContent = format(inArea.value); out.appendChild(r); out.appendChild(T.util.copyBtn(() => r.textContent)); }
        else if (mode === 'case') { out.appendChild(T.el('div', { class: 'hint', text: '大小写转换（' + caseSel.value + '）' })); const r = T.el('div', { class: 'pre' }); r.textContent = toCase(inArea.value, caseSel.value); out.appendChild(r); out.appendChild(T.util.copyBtn(() => r.textContent)); }
        else if (mode === 'extract') { const e = extract(inArea.value); const t = T.el('div', { class: 'kv' }); t.appendChild(T.el('div', { class: 'k', text: '表' })); t.appendChild(T.el('div', { class: 'v', text: e.tables.join(', ') || '(无)' })); t.appendChild(T.el('div', { class: 'k', text: '字段' })); t.appendChild(T.el('div', { class: 'v', text: e.cols.join(', ') || '(无)' })); out.appendChild(t); }
        else if (mode === 'lint') { const errs = lint(inArea.value); if (!errs.length) out.appendChild(T.el('div', { class: 'tag', text: '✓ 未发现括号/引号不平衡' })); else errs.forEach(e => out.appendChild(T.el('div', { class: 'error', text: '• ' + e }))); }
      }
      inArea.addEventListener('input', run); modeSel.addEventListener('change', () => { caseSel.style.display = modeSel.value === 'case' ? '' : 'none'; dialectSel.style.display = modeSel.value === 'fmt' ? '' : 'none'; run(); });
      caseSel.style.display = 'none'; dialectSel.style.display = 'none';

      inArea.value = "select id,name,count(*) from users u left join orders o on u.id=o.uid where u.age>18 group by u.id order by name desc limit 10";
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: 'SQL 辅助工具' }),
        T.el('div', { class: 'row' }, [T.el('label', { text: '模式' }), modeSel, T.el('span', { id: 'optCase' }, [caseSel]), T.el('span', { id: 'optDialect' }, [dialectSel])]),
        inArea, out
      ]));
      run();
    }
  });
})();
