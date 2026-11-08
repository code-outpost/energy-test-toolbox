// 声明式模块注册表 + 共享工具（通用前端模块体系）
// 每个工具模块通过 TB.register({...}) 注册，app.js 负责导航与渲染。
window.TB = window.TB || {};
TB.modules = [];

TB.register = function (mod) {
  if (!mod || !mod.id) return;
  // 防重复注册
  if (TB.modules.some(m => m.id === mod.id)) return;
  TB.modules.push(mod);
};

TB.util = {
  // 轻量 DOM 构建器
  el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null) continue;
        if (k === 'class') e.className = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'text') e.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v);
      }
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(c => {
        if (c == null) return;
        e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return e;
  },

  async copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(ta);
      return true;
    }
  },

  // 一键复制按钮（附加到某个值容器旁）
  copyBtn(getText) {
    return TB.util.el('button', {
      class: 'btn sm ghost copy-btn', text: '复制',
      onclick: async (ev) => {
        const ok = await TB.util.copy(typeof getText === 'function' ? getText() : getText);
        const b = ev.currentTarget;
        if (ok) { b.textContent = '已复制'; setTimeout(() => (b.textContent = '复制'), 1200); }
      }
    });
  },

  historyKey(id) { return 'tb_hist_' + id; },
  loadHistory(id) {
    try { return JSON.parse(localStorage.getItem(TB.util.historyKey(id)) || '[]'); } catch { return []; }
  },
  saveHistory(id, item) {
    let h = TB.util.loadHistory(id);
    h = h.filter(x => x !== item);
    h.unshift(item);
    h = h.slice(0, 20);
    try { localStorage.setItem(TB.util.historyKey(id), JSON.stringify(h)); } catch {}
    return h;
  }
};
