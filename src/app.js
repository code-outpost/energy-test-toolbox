// 应用入口：仪表盘首页 + 侧边导航 + 模块渲染
(function () {
  const sidebar = document.getElementById('sidebar');
  const content = document.getElementById('content');
  const search = document.getElementById('globalSearch');
  const themeToggle = document.getElementById('themeToggle');
  const statusbar = document.getElementById('statusbar');

  // 分类顺序（决定仪表盘与导航的排列）
  const CATEGORY_ORDER = ['计算器', '电力计算', '高压电工', '日常工具', '通用编解码', '协议报文解析', 'Linux 命令', 'SQL 辅助', '开发常用', '综合工具'];
  // 分类图标
  const CAT_ICON = {
    '计算器': '🧮', '电力计算': '⚡', '高压电工': '🛡️', '日常工具': '🧩', '通用编解码': '🔤', '协议报文解析': '📡',
    'Linux 命令': '🐧', 'SQL 辅助': '🗄️', '开发常用': '🛠️', '综合工具': '🧰'
  };
  // 工具图标（按 id）
  const ICONS = {
    standard: '🧮', scientific: '🔬', programmer: '💻', ohm: '⚡', threephase: '🔌',
    resistor: '🎨', unitconv: '📐', calc: '🧾',
    'base-convert': '🔢', encoding: '🔤', timestamp: '🕒', endian: '🔁', checksum: '✅',
    chmod: '🔐', 'cmd-ref': '📖', 'cmd-parse': '🧩',
    iec104: '📡', modbus: '🔌', goose: '⚡', sv: '〰️', dlt645: '💡', dnp3: '🛰️',
    iec101103: '📠', cdt: '📺', 'mms-mqtt-opcua': '☁️',
    sql: '🗄️', hexdiff: '🔍', hexdump: '📋',
    'json-tool': '🧩', 'regex-tester': '🔎', 'color-convert': '🎨', 'text-tool': '📝',
    'base64-url': '🔗', passgen: '🔑',
    'unit-converter': '🔄', 'income-tax': '💴', mortgage: '🏠', bmi: '⚖️', geometry: '📐', 'random': '🎲',
    'hv-transformer': '🔧', 'hv-motor': '⚙️', 'hv-reactance': '🌊', 'hv-safety': '🛡️', 'hv-ampacity': '🔌', 'hv-cheatsheet': '📘'
  };
  const iconOf = (m) => m.icon || ICONS[m.id] || '🔧';

  // ---- 主题 ----
  const savedTheme = localStorage.getItem('tb_theme') || 'dark';
  document.body.setAttribute('data-theme', savedTheme);
  themeToggle.addEventListener('click', () => {
    const t = document.body.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', t);
    localStorage.setItem('tb_theme', t);
  });

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

  function renderSidebar(filter) {
    sidebar.innerHTML = '';
    // 首页入口
    const home = TB.util.el('button', {
      class: 'nav-home' + (isHome() ? ' active' : ''),
      onclick: () => { location.hash = '#/home'; }
    }, [
      TB.util.el('span', { class: 'ico', text: '🏠' }),
      TB.util.el('span', { text: '工具箱首页' })
    ]);
    sidebar.appendChild(home);

    const map = groups(filter);
    sortedCategories(map).forEach(cat => {
      sidebar.appendChild(TB.util.el('div', { class: 'nav-group-title', text: cat }));
      map[cat].forEach(m => {
        const a = TB.util.el('button', {
          class: 'nav-item' + (!isHome() && currentId() === m.id ? ' active' : ''),
          onclick: () => { location.hash = '#/m/' + encodeURIComponent(m.id); }
        }, [
          TB.util.el('span', { class: 'ico', text: iconOf(m) }),
          TB.util.el('span', { text: m.name })
        ]);
        sidebar.appendChild(a);
      });
    });
    if (!Object.keys(map).length) {
      sidebar.appendChild(TB.util.el('div', { class: 'nav-empty', text: '无匹配工具' }));
    }
  }

  function renderDashboard() {
    content.innerHTML = '';
    const stage = TB.util.el('div', { class: 'module-stage stage-home' });
    const main = TB.util.el('div', { class: 'stage-main' });
    const inner = TB.util.el('div', { class: 'content-inner' });
    inner.appendChild(TB.util.el('div', { class: 'dash-head' }, [
      TB.util.el('h1', { text: '能源测试工具箱' }),
      TB.util.el('p', { text: '面向电力 / 新能源开发测试的一站式桌面工具集 · 共 ' + TB.modules.length + ' 个工具' })
    ]));
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

  // 右侧"剩余内容"面板：默认填充模块说明 / 提示 / 速查；计算器额外提供切换入口
  function buildAside(m, aside) {
    aside.appendChild(TB.util.el('div', { class: 'aside-card' }, [
      TB.util.el('div', { class: 'aside-title' }, [
        TB.util.el('span', { class: 'dot' }),
        TB.util.el('span', { text: '关于本工具' })
      ]),
      TB.util.el('p', { text: m.desc || '' })
    ]));
    if (m.category === '计算器') {
      const others = TB.modules.filter(x => x.category === '计算器' && x.id !== m.id);
      const links = TB.util.el('div', { class: 'aside-links' });
      others.forEach(x => links.appendChild(TB.util.el('button', {
        class: '', text: iconOf(x) + ' ' + x.name,
        onclick: () => { location.hash = '#/m/' + encodeURIComponent(x.id); }
      })));
      aside.appendChild(TB.util.el('div', { class: 'aside-card' }, [
        TB.util.el('div', { class: 'aside-title' }, [TB.util.el('span', { class: 'dot' }), TB.util.el('span', { text: '切换计算器' })]),
        links
      ]));
    }
    if (Array.isArray(m.tips) && m.tips.length) {
      aside.appendChild(TB.util.el('div', { class: 'aside-card' }, [
        TB.util.el('div', { class: 'aside-title' }, [TB.util.el('span', { class: 'dot' }), TB.util.el('span', { text: '使用提示' })]),
        TB.util.el('ul', { class: 'tip-list' }, m.tips.map(t => TB.util.el('li', { text: t })))
      ]));
    }
    if (Array.isArray(m.ref) && m.ref.length) {
      aside.appendChild(TB.util.el('div', { class: 'aside-card' }, [
        TB.util.el('div', { class: 'aside-title' }, [TB.util.el('span', { class: 'dot' }), TB.util.el('span', { text: '速查参考' })]),
        TB.util.el('div', { class: 'ref-list' }, m.ref.map(r => TB.util.el('div', { class: 'ref-row' }, [
          TB.util.el('span', { class: 'rk', text: r.k }), TB.util.el('span', { class: 'rv', text: r.v })
        ])))
      ]));
    }
    aside.appendChild(TB.util.el('div', { class: 'aside-card' }, [
      TB.util.el('div', { class: 'aside-title' }, [TB.util.el('span', { class: 'dot' }), TB.util.el('span', { text: '小贴士' })]),
      TB.util.el('p', { text: '结果可点击「复制」按钮拷贝；顶部搜索框可快速定位任意工具；右上角可切换亮/暗主题。' })
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
    inner.appendChild(TB.util.el('div', { class: 'tool-header' }, [
      TB.util.el('div', { class: 'row', style: 'gap:10px;align-items:center' }, [
        TB.util.el('span', { style: 'font-size:22px', text: iconOf(m) }),
        TB.util.el('div', {}, [
          TB.util.el('h2', { class: 'tool-title', style: 'margin:0', text: m.name }),
          m.desc ? TB.util.el('div', { class: 'tool-desc', text: m.desc }) : null
        ])
      ])
    ]));
    const body = TB.util.el('div', { class: 'tool-body' });
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
    statusbar.appendChild(TB.util.el('span', { class: 'sp', text: '能源测试工具箱 · 原生桌面应用' }));
  }

  function route() {
    if (isHome()) { renderDashboard(); }
    else { renderContent(currentId()); }
    renderSidebar(search.value);
    renderStatus();
  }

  search.addEventListener('input', () => renderSidebar(search.value));
  window.addEventListener('hashchange', route);

  // 初始
  route();
})();
