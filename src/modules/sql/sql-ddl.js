// 建表语句生成器：字段清单 → CREATE TABLE / INSERT 模板 / 索引（多方言）
(function () {
  const T = TB.util;
  const DIALECTS = ['MySQL', 'PostgreSQL', 'SQLite'];

  function build(table, lines, dialect) {
    const cols = String(lines || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map((l, i) => {
      const m = l.match(/^(\S+)\s+(\S+)(.*)$/);
      if (!m) return null;
      const name = m[1], type = m[2], rest = m[3] || '';
      const pk = /\bPK\b|\bPRIMARY\s*KEY\b/i.test(rest);
      const notNull = /\bNOT\s*NULL\b/i.test(rest) || pk;
      const auto = /\bAUTO_INCREMENT\b|\bAUTOINCREMENT\b|\bSERIAL\b/i.test(rest);
      const cm = rest.match(/COMMENT\s+'([^']*)'/i) || rest.match(/--\s*(.+)$/);
      return { i, name, type, pk, notNull, auto, comment: cm ? cm[1] : '' };
    }).filter(Boolean);
    if (!table || !cols.length) return { error: '请填写表名与至少一行字段定义' };

    const q = dialect === 'PostgreSQL' ? '"' : '`';
    const qq = dialect === 'SQLite' ? '"' : q;
    const linesSql = cols.map(col => {
      let type = col.type;
      if (dialect === 'PostgreSQL' && col.auto) type = 'SERIAL';
      if (dialect === 'SQLite' && col.auto) type = 'INTEGER';
      let s = '  ' + q + col.name + q + ' ' + type;
      if (col.pk) s += ' PRIMARY KEY';
      if (col.auto) {
        if (dialect === 'MySQL') s += ' AUTO_INCREMENT';
        else if (dialect === 'SQLite') s += ' AUTOINCREMENT';
      }
      if (col.notNull && !col.pk && !col.auto) s += ' NOT NULL';
      if (col.comment && dialect === 'MySQL') s += " COMMENT '" + col.comment.replace(/'/g, "''") + "'";
      return s;
    });
    const qt = dialect === 'PostgreSQL' ? '"' : (dialect === 'SQLite' ? '"' : '`');
    let ddl = 'CREATE TABLE ' + qt + table + qt + ' (\n' + linesSql.join(',\n') + '\n)';
    if (dialect === 'MySQL') ddl += ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
    ddl += ';';
    const insert = 'INSERT INTO ' + qt + table + qt + ' (' + cols.map(x => q + x.name + q).join(', ') + ')\nVALUES (' + cols.map(() => '?').join(', ') + ');';
    const comments = cols.filter(x => x.comment && dialect !== 'MySQL').map(x =>
      'COMMENT ON COLUMN ' + qt + table + qt + '.' + q + x.name + q + " IS '" + x.comment.replace(/'/g, "''") + "';");
    return { ddl, insert, comments, count: cols.length };
  }

  TB.register({
    id: 'sql-ddl', name: '建表语句生成器', category: 'SQL 辅助',
    desc: '用简写的字段清单快速生成 CREATE TABLE、INSERT 模板与字段注释（MySQL / PostgreSQL / SQLite）。',
    tips: ['每行格式：字段名 类型 [PK] [NOT NULL] [AUTO_INCREMENT] [COMMENT \'说明\']', 'PK 会自动带上 NOT NULL；PostgreSQL 的 AUTO_INCREMENT 自动转 SERIAL', '生成的是模板，上线前请按实际约束与索引复核'],
    render(c) {
      const table = T.el('input', { id: 'sd_table', value: 'device_metric', 'aria-label': '表名' });
      const dial = T.el('select', { id: 'sd_dialect', 'aria-label': '数据库方言' },
        DIALECTS.map(d => T.el('option', { value: d, text: d })));
      dial.value = 'MySQL';
      const fields = T.el('textarea', { id: 'sd_fields', class: 'pre', rows: '8', 'aria-label': '字段定义' });
      fields.value = "id BIGINT PK AUTO_INCREMENT\ndevice_id VARCHAR(64) NOT NULL COMMENT '设备编号'\nvoltage DECIMAL(10,2) COMMENT '电压 V'\ncurrent DECIMAL(10,2) COMMENT '电流 A'\nsampled_at DATETIME NOT NULL COMMENT '采样时间'";
      const out = T.el('pre', { class: 'pre', id: 'sd_out' });

      function run() {
        const r = build(table.value.trim(), fields.value, dial.value || 'MySQL');
        if (r.error) { out.textContent = r.error; return; }
        out.textContent = '-- ' + dial.value + ' · ' + r.count + ' 个字段\n' + r.ddl +
          '\n\n-- 参数化 INSERT 模板\n' + r.insert +
          (r.comments.length ? '\n\n-- 字段注释\n' + r.comments.join('\n') : '');
      }
      [table, fields, dial].forEach(e => e.addEventListener('input', run));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '表定义' }),
        T.el('div', { class: 'form-grid' }, [
          T.el('div', { class: 'field' }, [T.el('label', { text: '表名' }), table]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '方言' }), dial])
        ]),
        fields,
        T.el('div', { class: 'row' }, [
          T.el('button', { class: 'btn primary', text: '生成 DDL', onclick: run }),
          T.copyBtn(() => out.textContent)
        ])
      ]));
      c.appendChild(T.el('div', { class: 'card' }, [T.el('h3', { text: '生成结果' }), out]));
      run();
    }
  });
})();
