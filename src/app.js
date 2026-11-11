// 应用入口：仪表盘首页 + 侧边导航 + 模块渲染 + 个性化 + 版本/更新
(function () {
  const sidebar = document.getElementById('sidebar');
  const content = document.getElementById('content');
  const search = document.getElementById('globalSearch');
  const themeToggle = document.getElementById('themeToggle');
  const statusbar = document.getElementById('statusbar');
  const versionEl = document.getElementById('appVersion');
  const updateBtn = document.getElementById('updateBtn');

  const META = window.TB || {};
  const VERSION = META.VERSION || '0.1.0';
  const RELEASE = META.RELEASE || {};

  // 分类顺序（决定仪表盘与导航的排列）
  const CATEGORY_ORDER = ['计算器', '电力计算', '高压电工', '日常工具', '通用编解码', '协议报文解析', 'Linux 命令', 'SQL 辅助', '开发常用', '综合工具'];
  const CAT_ICON = {
    '计算器': '🧮', '电力计算': '⚡', '高压电工': '🛡️', '日常工具': '🧩', '通用编解码': '🔤', '协议报文解析': '📡',
    'Linux 命令': '🐧', 'SQL 辅助': '🗄️', '开发常用': '🛠️', '综合工具': '🧰'
  };
  const ICONS = {
    standard: '🧮', scientific: '🔬', programmer: '💻', ohm: '⚡', threephase: '🔌',
    resistor: '🎨', unitconv: '📐', calc: '🧾',
    'base-convert': '🔢', encoding: '🔤', timestamp: '🕒', endian: '🔁', checksum: '✅',
    chmod: '🔐', 'cmd-ref': '📖', 'cmd-parse': '🧩',
    iec104: '📡', modbus: '🔌', goose: '⚡', sv: '〰️', dlt645: '💡', dnp3: '🛰️',
    iec101103: '📠', cdt: '📺', 'mms-mqtt-opcua': '☁️', 'device-bridge': '🛰️',
    sql: '🗄️', 'sql-format': '📝', 'sql-ddl': '🏗️', hexdiff: '🔍', hexdump: '📋',
    'json-tool': '🧩', 'regex-tester': '🔎', 'color-convert': '🎨', 'text-tool': '📝',
    'base64-url': '🔗', passgen: '🔑',
    'unit-converter': '🔄', 'income-tax': '💴', mortgage: '🏠', bmi: '⚖️', geometry: '📐', 'random': '🎲',
    'hv-transformer': '🔧', 'hv-motor': '⚙️', 'hv-reactance': '🌊', 'hv-safety': '🛡️', 'hv-ampacity': '🔌', 'hv-cheatsheet': '📘',
    'batch-calc': '📊', crontab: '⏰', settings: '⚙️'
  };
  const iconOf = (m) => m.icon || ICONS[m.id] || '🔧';

  // ---- 本地持久化（收藏 / 最近使用）----
  function readJSON(key, def) { try { return JSON.parse(localStorage.getItem(key)) || def; } catch { return def; } }
  function writeJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }
  const favs = () => readJSON('tb_favs', []);
  const recents = () => readJSON('tb_recent', []);
  function resolveIds(ids) { return ids.map(id => TB.modules.find(m => m.id === id)).filter(Boolean); }
  function toggleFav(id) {
    const f = favs();
    writeJSON('tb_favs', f.includes(id) ? f.filter(x => x !== id) : [id, ...f]);
  }
  function pushRecent(id) { writeJSON('tb_recent', [id, ...recents().filter(x => x !== id)].slice(0, 8)); }

  // ---- 轻提示 ----
  let toastTimer = null;
  function toast(msg, kind) {
    if (!document.body || !document.body.appendChild) return;
    let t = document.getElementById('tbToast');
    if (!t || !t.setAttribute) {
      t = TB.util.el('div', { id: 'tbToast', class: 'toast' });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = 'toast' + (kind ? ' ' + kind : '');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (t.parentNode && t.parentNode.removeChild) t.parentNode.removeChild(t);
    }, 6000);
  }
  TB.toast = toast; // 供模块提示（如跨工具引用结果）
  let currentBody = null;

  // ---- 主题：跟随系统 / 深色 / 浅色 三态 ----
  const THEME_MODES = ['auto', 'dark', 'light'];
  const THEME_LABEL = { auto: '🖥 跟随', dark: '🌙 深色', light: '☀️ 浅色' };
  function systemDark() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }
    catch (e) { return true; }
  }
  function themeMode() { return localStorage.getItem('tb_theme') || 'auto'; }
  function applyTheme() {
    const mode = themeMode();
    const resolved = mode === 'auto' ? (systemDark() ? 'dark' : 'light') : (mode === 'light' ? 'light' : 'dark');
    document.body.setAttribute('data-theme', resolved);
    if (themeToggle) {
      themeToggle.textContent = THEME_LABEL[mode] || THEME_LABEL.auto;
      themeToggle.setAttribute('title', '当前：' + (THEME_LABEL[mode] || '').replace(/^\S+\s*/, '') + '（点击切换）');
      themeToggle.setAttribute('aria-label', '切换主题，当前' + (THEME_LABEL[mode] || '').replace(/^\S+\s*/, ''));
    }
  }
  TB.getThemeMode = themeMode;
  TB.setTheme = function (mode) {
    if (THEME_MODES.indexOf(mode) < 0) return;
    try { localStorage.setItem('tb_theme', mode); } catch (e) {}
    applyTheme();
  };
  applyTheme();
  themeToggle.addEventListener('click', () => {
    const next = THEME_MODES[(THEME_MODES.indexOf(themeMode()) + 1) % THEME_MODES.length];
    TB.setTheme(next);
  });
  // 系统偏好变化时，只有「跟随系统」模式自动响应。
  try {
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => { if (themeMode() === 'auto') applyTheme(); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  } catch (e) {}

  // ---- 版本与更新检查 ----
  if (versionEl) { versionEl.textContent = 'v' + VERSION; versionEl.addEventListener('click', checkUpdate); }
  if (updateBtn) updateBtn.addEventListener('click', checkUpdate);
  if (document.title !== undefined) document.title = '能源测试工具箱 v' + VERSION;

  async function checkUpdate() {
    if (typeof fetch !== 'function') { toast('当前环境不支持联网检查更新', 'warn'); return; }
    toast('正在检查更新…');
    let info = null;
    // 桌面版优先走本机后端（能顺带拿到附件地址与哈希清单）；浏览器版自动回退直连 GitHub API。
    try {
      const r = await fetch('/api/update/latest', { headers: { Accept: 'application/json' } });
      if (r.ok) {
        const j = await r.json();
        if (j && j.ok && j.tag) info = j;
      }
    } catch (e) {}
    if (!info) {
      try {
        const r = await fetch(RELEASE.apiUrl || '', { headers: { Accept: 'application/vnd.github+json' } });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        info = { tag: String(j.tag_name || ''), version: String(j.tag_name || '').replace(/^v/, ''), assetUrl: '', sumsUrl: '' };
      } catch (e) {
        toast('检查更新失败（离线可忽略）：' + (e && e.message ? e.message : e), 'warn');
        return;
      }
    }
    TB.updateInfo = info;
    if (info.version && info.version !== VERSION) {
      toast('发现新版本 ' + info.tag + '：桌面版可在「设置与备份」一键下载并校验 SHA256，或到 ' + (RELEASE.latestUrl || '') + ' 手动下载', 'ok');
    } else {
      toast('已是最新版本 v' + VERSION, 'ok');
    }
  }

  function currentId() {
    const m = (location.hash || '').match(/^#\/m\/(.+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  }
  function isHome() { return !location.hash || location.hash === '#/' || location.hash === '#/home'; }

  function sortedCategories(map) {
    const keys = Object.keys(map);
    keys.sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a), ib = CATEGORY_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return keys;
  }

  function groups(filter) {
    const map = {};
    const f = (filter || '').trim().toLowerCase();
    TB.modules.forEach(m => {
      if (f && !(m.name + ' ' + (m.desc || '') + ' ' + (m.id || '')).toLowerCase().includes(f)) return;
      const c = m.category || '其他';
      (map[c] = map[c] || []).push(m);
    });
    return map;
  }

  function navButton(m, prefix) {
    return TB.util.el('button', {
      class: 'nav-item' + (!isHome() && currentId() === m.id ? ' active' : ''),
      'aria-label': m.name,
      onclick: () => { location.hash = '#/m/' + encodeURIComponent(m.id); }
    }, [
      TB.util.el('span', { class: 'ico', text: prefix || iconOf(m), 'aria-hidden': 'true' }),
      TB.util.el('span', { text: m.name })
    ]);
  }

  function renderSidebar(filter) {
    sidebar.innerHTML = '';
    const home = TB.util.el('button', {
      class: 'nav-home' + (isHome() ? ' active' : ''),
      'aria-label': '工具箱首页',
      onclick: () => { location.hash = '#/home'; }
    }, [
      TB.util.el('span', { class: 'ico', text: '🏠', 'aria-hidden': 'true' }),
      TB.util.el('span', { text: '工具箱首页' })
    ]);
    sidebar.appendChild(home);

    if (!filter) {
      const f = resolveIds(favs());
      if (f.length) {
        sidebar.appendChild(TB.util.el('div', { class: 'nav-group-title', text: '★ 我的收藏' }));
        f.forEach(m => sidebar.appendChild(navButton(m, '★')));
      }
      const r = resolveIds(recents());
      if (r.length) {
        sidebar.appendChild(TB.util.el('div', { class: 'nav-group-title', text: '🕒 最近使用' }));
        r.forEach(m => sidebar.appendChild(navButton(m, '•')));
      }
    }

    const map = groups(filter);
    sortedCategories(map).forEach(cat => {
      sidebar.appendChild(TB.util.el('div', { class: 'nav-group-title', text: cat }));
      map[cat].forEach(m => sidebar.appendChild(navButton(m)));
    });
    if (!Object.keys(map).length) {
      sidebar.appendChild(TB.util.el('div', { class: 'nav-empty', text: '无匹配工具' }));
    }
  }

  function quickCard(title, list) {
    if (!list.length) return null;
    const chips = TB.util.el('div', { class: 'tool-chips' });
    list.forEach(m => chips.appendChild(TB.util.el('button', {
      class: 'tool-chip', title: m.desc || '',
      onclick: () => { location.hash = '#/m/' + encodeURIComponent(m.id); }
    }, [
      TB.util.el('span', { class: 'ico', text: iconOf(m) }),
      TB.util.el('span', { text: m.name })
    ])));
    return TB.util.el('div', { class: 'cat-card quick-card' }, [
      TB.util.el('div', { class: 'cat-title' }, [
        TB.util.el('span', { class: 'ico', text: title.indexOf('收藏') >= 0 ? '★' : '🕒' }),
        TB.util.el('span', { text: title })
      ]),
      chips
    ]);
  }

  function renderDashboard() {
    currentBody = null;
    content.innerHTML = '';
    const stage = TB.util.el('div', { class: 'module-stage stage-home' });
    const main = TB.util.el('div', { class: 'stage-main' });
    const inner = TB.util.el('div', { class: 'content-inner' });
    inner.appendChild(TB.util.el('div', { class: 'dash-head' }, [
      TB.util.el('h1', { text: '能源测试工具箱' }),
      TB.util.el('p', { text: '面向电力 / 新能源开发测试的一站式桌面工具集 · 共 ' + TB.modules.length + ' 个工具 · v' + VERSION })
    ]));
    const quick = TB.util.el('div', { class: 'quick-row' });
    [quickCard('我的收藏', resolveIds(favs())), quickCard('最近使用', resolveIds(recents()))].forEach(c => { if (c) quick.appendChild(c); });
    if (quick._children && quick._children.length) inner.appendChild(quick);
    else if (quick.childNodes && quick.childNodes.length) inner.appendChild(quick);
    else inner.appendChild(quick);

    const grid = TB.util.el('div', { class: 'cat-grid' });
    const map = groups('');
    sortedCategories(map).forEach(cat => {
      const card = TB.util.el('div', { class: 'cat-card' }, [
        TB.util.el('div', { class: 'cat-title' }, [
          TB.util.el('span', { class: 'ico', text: CAT_ICON[cat] || '📦' }),
          TB.util.el('span', { text: cat }),
          TB.util.el('span', { class: 'cnt', text: map[cat].length + ' 个' })
        ])
      ]);
      const chips = TB.util.el('div', { class: 'tool-chips' });
      map[cat].forEach(m => {
        chips.appendChild(TB.util.el('button', {
          class: 'tool-chip', title: m.desc || '',
          onclick: () => { location.hash = '#/m/' + encodeURIComponent(m.id); }
        }, [
          TB.util.el('span', { class: 'ico', text: iconOf(m) }),
          TB.util.el('span', { text: m.name })
        ]));
      });
      card.appendChild(chips);
      grid.appendChild(card);
    });
    inner.appendChild(grid);
    main.appendChild(inner);
    stage.appendChild(main);
    content.appendChild(stage);
  }

  // 右侧"剩余内容"面板：说明 / 提示 / 速查 / 公式依据
  function asideCard(title, children) {
    return TB.util.el('div', { class: 'aside-card' }, [
      TB.util.el('div', { class: 'aside-title' }, [TB.util.el('span', { class: 'dot' }), TB.util.el('span', { text: title })]),
      ...children
    ]);
  }
  function buildAside(m, aside) {
    aside.appendChild(asideCard('关于本工具', [TB.util.el('p', { text: m.desc || '' })]));
    if (m.category === '计算器') {
      const others = TB.modules.filter(x => x.category === '计算器' && x.id !== m.id);
      const links = TB.util.el('div', { class: 'aside-links' });
      others.forEach(x => links.appendChild(TB.util.el('button', {
        class: '', text: iconOf(x) + ' ' + x.name,
        onclick: () => { location.hash = '#/m/' + encodeURIComponent(x.id); }
      })));
      aside.appendChild(asideCard('切换计算器', [links]));
    }
    if (Array.isArray(m.tips) && m.tips.length) {
      aside.appendChild(asideCard('使用提示', [TB.util.el('ul', { class: 'tip-list' }, m.tips.map(t => TB.util.el('li', { text: t })))]));
    }
    if (Array.isArray(m.ref) && m.ref.length) {
      aside.appendChild(asideCard('速查参考', [TB.util.el('div', { class: 'ref-list' }, m.ref.map(r => TB.util.el('div', { class: 'ref-row' }, [
        TB.util.el('span', { class: 'rk', text: r.k }), TB.util.el('span', { class: 'rv', text: r.v })
      ])))]));
    }
    if (Array.isArray(m.refs) && m.refs.length) {
      aside.appendChild(asideCard('公式依据与标准', [
        TB.util.el('ul', { class: 'tip-list' }, m.refs.map(t => TB.util.el('li', { text: t }))),
        TB.util.el('p', { class: 'hint', text: '以现行标准原文与现场规程为准；计算结果仅供校核参考。' })
      ]));
    }
    if (Array.isArray(m.limits) && m.limits.length) {
      aside.appendChild(asideCard('适用边界与校核提示', [
        TB.util.el('ul', { class: 'tip-list limit-list' }, m.limits.map(t => TB.util.el('li', { text: t })))
      ]));
    }
    if (TB.bus) {
      const items = TB.bus.all().slice(0, 5);
      const box = TB.util.el('div', { class: 'bus-list' });
      if (!items.length) {
        box.appendChild(TB.util.el('p', { class: 'hint', text: '暂无结果。在支持的工具里点击「计算 / 估算并发布结果」，结果会出现在这里，可一键送入其它工具继续计算。' }));
      }
      items.forEach(e => {
        const row = TB.util.el('div', { class: 'bus-row' });
        row.appendChild(TB.util.el('div', { class: 'bus-main' }, [
          TB.util.el('span', { class: 'bus-label', text: e.label }),
          TB.util.el('span', { class: 'bus-val', text: String(e.value) + ' ' + (e.unit || '') })
        ]));
        row.appendChild(TB.util.el('div', { class: 'hint', text: '来自 ' + ((TB.modules.find(x => x.id === e.modId) || {}).name || e.modId) }));
        const targets = TB.bus.targets().filter(t => t.id !== m.id && (!e.family || t.accepts.indexOf(e.family) >= 0 || t.accepts.indexOf('*') >= 0));
        if (targets.length) {
          const sel = TB.util.el('select', { 'aria-label': '送入目标工具' },
            targets.map(t => TB.util.el('option', { value: t.id, text: t.name })));
          sel.value = targets[0].id;
          row.appendChild(TB.util.el('div', { class: 'row' }, [
            sel,
            TB.util.el('button', {
              class: 'btn sm ghost', text: '送入 →',
              onclick: () => {
                TB.bus.requestFill(e, sel.value);
                const t = TB.modules.find(x => x.id === sel.value);
                toast('已引用「' + e.label + '」，正在送入 ' + (t ? t.name : sel.value), 'ok');
                location.hash = '#/m/' + encodeURIComponent(sel.value);
              }
            })
          ]));
        } else {
          row.appendChild(TB.util.el('p', { class: 'hint', text: '当前没有可接收该量纲的工具。' }));
        }
        box.appendChild(row);
      });
      const children = [box];
      if (items.length) {
        children.push(TB.util.el('button', {
          class: 'btn sm ghost', text: '清空结果',
          onclick: () => { TB.bus.clear(); renderContent(m.id); toast('结果中转站已清空', 'ok'); }
        }));
      }
      aside.appendChild(asideCard('结果中转站（跨工具串联）', children));
    }
    aside.appendChild(asideCard('小贴士', [
      TB.util.el('p', { text: '结果可点击「复制」按钮拷贝；按 / 或 Ctrl+K 聚焦搜索、Enter 触发计算、Esc 返回首页；右上角可切换主题、查看版本与检查更新。右侧「结果中转站」可把上一次结果送入其它工具继续算。' })
    ]));
  }

  function renderContent(id) {
    content.innerHTML = '';
    const m = TB.modules.find(x => x.id === id) || TB.modules[0];
    if (!m) {
      content.appendChild(TB.util.el('div', { class: 'hint', text: '暂无模块。' }));
      return;
    }
    const stage = TB.util.el('div', { class: 'module-stage' });
    const main = TB.util.el('div', { class: 'stage-main' });
    const aside = TB.util.el('div', { class: 'stage-aside' });
    buildAside(m, aside);

    const inner = TB.util.el('div', { class: 'content-inner' });
    const favBtn = TB.util.el('button', {
      class: 'btn sm ghost fav-btn',
      'aria-label': '收藏或取消收藏',
      text: favs().includes(m.id) ? '★ 已收藏' : '☆ 收藏',
      onclick: () => { toggleFav(m.id); renderContent(m.id); renderSidebar(search.value); }
    });
    inner.appendChild(TB.util.el('div', { class: 'tool-header' }, [
      TB.util.el('div', { class: 'row', style: 'gap:10px;align-items:center' }, [
        TB.util.el('span', { style: 'font-size:22px', text: iconOf(m), 'aria-hidden': 'true' }),
        TB.util.el('div', {}, [
          TB.util.el('h2', { class: 'tool-title', style: 'margin:0', text: m.name }),
          m.desc ? TB.util.el('div', { class: 'tool-desc', text: m.desc }) : null
        ])
      ]),
      favBtn
    ]));
    const body = TB.util.el('div', { class: 'tool-body' });
    currentBody = body;
    inner.appendChild(body);
    main.appendChild(inner);
    stage.appendChild(main);
    stage.appendChild(aside);
    content.appendChild(stage);

    try { m.render(body, { aside }); }
    catch (e) {
      body.appendChild(TB.util.el('div', { class: 'error', text: '模块渲染错误：' + e.message }));
      console.error(e);
    }
  }

  function renderStatus() {
    statusbar.innerHTML = '';
    const id = currentId();
    const m = TB.modules.find(x => x.id === id);
    statusbar.appendChild(TB.util.el('span', { text: m ? ('当前：' + m.name) : '工具箱首页' }));
    statusbar.appendChild(TB.util.el('span', { text: TB.modules.length + ' 个工具' }));
    statusbar.appendChild(TB.util.el('span', { class: 'sp', text: '能源测试工具箱 v' + VERSION + ' · 原生桌面应用' }));
  }

  function route() {
    const id = currentId();
    if (!isHome() && id) pushRecent(id);
    if (isHome()) { renderDashboard(); }
    else { renderContent(id); }
    renderSidebar(search.value);
    renderStatus();
  }

  search.addEventListener('input', () => renderSidebar(search.value));
  if (window.addEventListener) {
    window.addEventListener('hashchange', route);
    window.addEventListener('keydown', (e) => {
      const k = e.key || '';
      const tag = ((e.target && e.target.tagName) || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
      if ((k === '/' || (k.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) && !typing) {
        if (e.preventDefault) e.preventDefault();
        if (search.focus) search.focus();
      } else if (k === 'Escape') {
        if (typing && search.value) { search.value = ''; renderSidebar(''); }
        else location.hash = '#/home';
      } else if (k === 'Enter' && tag !== 'textarea' && tag !== 'select' && tag !== 'button') {
        // 输入框内回车 = 触发当前模块的主计算按钮（不翻页、不动鼠标）
        const b = currentBody;
        if (b && b.querySelectorAll) {
          const btns = b.querySelectorAll('.btn.primary, button.primary');
          if (btns && btns.length && typeof btns[0].click === 'function') {
            if (e.preventDefault) e.preventDefault();
            btns[0].click();
          }
        }
      }
    });
  }

  // 初始
  route();
})();
