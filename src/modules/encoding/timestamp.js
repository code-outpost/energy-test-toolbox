// 时间戳转换：Unix 时间戳 ↔ 日期（秒/毫秒/时区）
TB.register({
  id: 'timestamp',
  name: '时间戳转换',
  category: '通用编解码',
  desc: 'Unix 时间戳与日期互转，支持秒/毫秒、本地/UTC/ISO',
  render(c) {
    function pad(n) { return String(n).padStart(2, '0'); }
    function fmt(d) {
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
        pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    }

    // --- 时间戳 → 日期 ---
    const tsInput = TB.util.el('input', { type: 'text', class: 'mono', placeholder: '如 1762212000 或 1762212000000', style: 'width:280px' });
    const tsUnit = TB.util.el('select', {}, [
      TB.util.el('option', { value: 'auto', text: '自动判断' }),
      TB.util.el('option', { value: 's', text: '秒' }),
      TB.util.el('option', { value: 'ms', text: '毫秒' })
    ]);
    const tsOut = TB.util.el('div', { class: 'kv' });

    function tsToDate() {
      const n = parseInt((tsInput.value || '').trim(), 10);
      tsOut.innerHTML = '';
      const put = (k, v) => { tsOut.appendChild(TB.util.el('div', { class: 'k', text: k })); tsOut.appendChild(TB.util.el('div', { class: 'v' }, [v, TB.util.copyBtn(v)])); };
      if (isNaN(n)) { put('提示', '请输入有效数字'); return; }
      let ms;
      if (tsUnit.value === 's') ms = n * 1000;
      else if (tsUnit.value === 'ms') ms = n;
      else ms = (String(n).length >= 13) ? n : n * 1000;
      const d = new Date(ms);
      if (isNaN(d.getTime())) { put('错误', '时间戳无效'); return; }
      put('本地时间', fmt(d));
      put('UTC', d.toUTCString());
      put('ISO 8601', d.toISOString());
      put('星期', '周' + '日一二三四五六'[d.getDay()]);
    }
    tsInput.addEventListener('input', tsToDate);
    tsUnit.addEventListener('change', tsToDate);

    // --- 日期 → 时间戳 ---
    const dtInput = TB.util.el('input', { type: 'datetime-local', style: 'width:240px' });
    const dtUnit = TB.util.el('select', {}, [
      TB.util.el('option', { value: 's', text: '秒' }),
      TB.util.el('option', { value: 'ms', text: '毫秒', selected: 'selected' })
    ]);
    const dtOut = TB.util.el('div', { class: 'kv' });
    function dateToTs() {
      dtOut.innerHTML = '';
      const v = dtInput.value;
      const put = (k, val) => { dtOut.appendChild(TB.util.el('div', { class: 'k', text: k })); dtOut.appendChild(TB.util.el('div', { class: 'v' }, [val, TB.util.copyBtn(val)])); };
      if (!v) { put('提示', '请选择日期时间'); return; }
      const t = new Date(v).getTime();
      if (isNaN(t)) { put('错误', '日期无效'); return; }
      put(dtUnit.value === 's' ? '时间戳(秒)' : '时间戳(毫秒)', dtUnit.value === 's' ? String(Math.floor(t / 1000)) : String(t));
    }
    dtInput.addEventListener('input', dateToTs);
    dtUnit.addEventListener('change', dateToTs);

    c.appendChild(TB.util.el('div', { class: 'card' }, [
      TB.util.el('h3', { text: '时间戳 → 日期' }),
      TB.util.el('div', { class: 'row' }, [TB.util.el('label', { text: '时间戳' }), tsInput, TB.util.el('label', { text: '单位' }), tsUnit]),
      tsOut
    ]));
    c.appendChild(TB.util.el('div', { class: 'card' }, [
      TB.util.el('h3', { text: '日期 → 时间戳' }),
      TB.util.el('div', { class: 'row' }, [TB.util.el('label', { text: '日期时间' }), dtInput, TB.util.el('label', { text: '输出单位' }), dtUnit]),
      dtOut
    ]));

    tsInput.value = String(Math.floor(Date.now() / 1000));
    tsToDate();
  }
});
