// 跨工具数据流：结果中转总线（发布 → 引用填入其它工具）+ 本地测试记录留痕
// 纯 localStorage 持久化，全部数据仅留在本机。
(function () {
  window.TB = window.TB || {};
  const KEY = 'tb_bus_items';       // 最近发布的结果
  const PKEY = 'tb_bus_pending';    // 待填入目标模块的一次性引用
  const RKEY = 'tb_records';        // 测试 / 批量计算记录
  const LIMIT = 12, RLIMIT = 30, PENDING_TTL = 5 * 60 * 1000;

  function readArr(k) { try { const v = JSON.parse(localStorage.getItem(k)); return Array.isArray(v) ? v : []; } catch { return []; } }
  function readObj(k) { try { const v = JSON.parse(localStorage.getItem(k)); return v && typeof v === 'object' ? v : null; } catch { return null; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  function uid(p) { return p + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); }
  const listeners = [];
  function notify() { listeners.forEach(fn => { try { fn(); } catch {} }); }

  TB.bus = {
    KEY: KEY, LIMIT: LIMIT,
    publish(modId, label, value, unit, extra) {
      const num = Number(value);
      const entry = {
        id: uid('b'), modId: modId, label: String(label || '结果'),
        value: (value !== '' && isFinite(num)) ? num : String(value),
        unit: unit || '',
        family: (TB.units && unit) ? TB.units.familyOf(unit) : ((extra && extra.family) || null),
        note: (extra && extra.note) || '',
        time: new Date().toISOString()
      };
      write(KEY, [entry, ...readArr(KEY)].slice(0, LIMIT));
      notify();
      return entry;
    },
    all() { return readArr(KEY); },
    latest(modId) { const a = readArr(KEY); return modId ? (a.find(x => x.modId === modId) || null) : (a[0] || null); },
    remove(id) { write(KEY, readArr(KEY).filter(x => x.id !== id)); notify(); },
    clear() { write(KEY, []); write(PKEY, null); notify(); },
    on(fn) { if (typeof fn === 'function') listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },

    // 哪些模块声明了可接收的量纲（用于「送入」目标下拉）
    targets() { return (TB.modules || []).filter(m => Array.isArray(m.accepts) && m.accepts.length); },
    requestFill(entry, targetModId) { write(PKEY, { entry: entry, target: targetModId, at: Date.now() }); },
    peekPending() { return readObj(PKEY); },
    takePending() { const p = readObj(PKEY); write(PKEY, null); return p; },

    // 模块 render 时调用：targets = [{ el, family, unit, label }]
    // 命中则自动换算单位、填入 input 并派发 input/change 事件，返回填充说明。
    consume(modId, targets) {
      const p = this.peekPending();
      if (!p || !p.entry || p.target !== modId) return null;
      this.takePending();
      if (!p.at || Date.now() - p.at > PENDING_TTL) return { filled: false, reason: '引用已过期（超过 5 分钟），请重新点击「送入」。' };
      const e = p.entry, list = targets || [];
      let hit = list.find(t => e.family && t.family === e.family)
        || list.find(t => e.unit && t.unit && t.unit === e.unit)
        || list.find(t => e.family && t.family === (TB.units && TB.units.familyOf(t.unit)))
        || list.find(t => t.family === '*'); // 通配接收（如量纲校验台）
      if (!hit || !hit.el) {
        return { filled: false, reason: '目标模块没有匹配的输入字段（需 ' + (e.unit || e.family || '同量纲') + '）：' + list.map(t => t.label || t.unit).join('、') };
      }
      let v = e.value;
      if (typeof v === 'number' && e.unit && hit.unit && e.unit !== hit.unit && TB.units) {
        const cv = TB.units.convert(v, e.unit, hit.unit);
        if (cv !== null && isFinite(cv)) v = cv;
      }
      if (typeof v === 'number' && isFinite(v)) {
        hit.el.value = String(v);
        if (hit.el.dispatchEvent) {
          hit.el.dispatchEvent({ type: 'input' });
          hit.el.dispatchEvent({ type: 'change' });
        }
        return { filled: true, label: e.label, value: v, unit: hit.unit || e.unit, target: hit.label || '', entry: e };
      }
      return { filled: false, reason: '结果不是数值，无法填入输入框。' };
    }
  };

  // ---- 本地测试记录（批量计算 / 设备联调留痕）----
  TB.records = {
    KEY: RKEY, LIMIT: RLIMIT,
    add(rec) {
      const item = {
        id: uid('r'), time: new Date().toISOString(),
        type: (rec && rec.type) || '批量计算',
        title: (rec && rec.title) || '未命名记录',
        rows: Number((rec && rec.rows) || 0), ok: Number((rec && rec.ok) || 0),
        summary: (rec && rec.summary) || '', csv: (rec && rec.csv) || '',
        tpl: (rec && rec.tpl) || ''
      };
      write(RKEY, [item, ...readArr(RKEY)].slice(0, RLIMIT));
      return item;
    },
    all() { return readArr(RKEY); },
    get(id) { return readArr(RKEY).find(x => x.id === id) || null; },
    remove(id) { write(RKEY, readArr(RKEY).filter(x => x.id !== id)); },
    clear() { write(RKEY, []); },
    stats() {
      const a = readArr(RKEY);
      return { count: a.length, rows: a.reduce((s, x) => s + (Number(x.rows) || 0), 0), ok: a.reduce((s, x) => s + (Number(x.ok) || 0), 0) };
    }
  };
})();
