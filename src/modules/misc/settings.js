// 设置与备份：主题三态、本机数据整体导出/恢复、运行环境、更新下载与 SHA256 校验。
// 这是应用级入口（不是计算工具），所有数据仍只留在 localStorage 与本机磁盘。
(function () {
  const T = TB.util;
  const APP = 'energy-test-toolbox';
  const SCHEMA = 1;
  const MAX_BACKUP = 4 * 1024 * 1024;
  const WIN_ASSET = 'EnergyTestToolbox.exe';
  const MAC_ASSET = 'EnergyTestToolbox-macos-universal.dmg';

  // 更新包必须与当前平台一致，否则 macOS 会下载到一个无法使用的 .exe。
  // 优先用后端 /api/app/info 的平台字段；浏览器直开时用 UA 兜底。
  function isMacPlatform() {
    try {
      const p = String((typeof navigator !== 'undefined' && (navigator.platform || navigator.userAgent)) || '').toLowerCase();
      return p.indexOf('mac') >= 0 || p.indexOf('iphone') >= 0 || p.indexOf('ipad') >= 0;
    } catch (e) { return false; }
  }
  function assetForPlatform() { return isMacPlatform() ? MAC_ASSET : WIN_ASSET; }

  // ---- localStorage 键枚举（兼容真实浏览器与测试用 DOM 桩）----
  function tbKeys() {
    const out = [];
    try {
      if (typeof localStorage.length === 'number') {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.indexOf('tb_') === 0) out.push(k);
        }
      } else {
        Object.keys(localStorage).forEach(k => { if (k.indexOf('tb_') === 0) out.push(k); });
      }
    } catch (e) {}
    return out;
  }

  function buildBackup() {
    const data = {};
    tbKeys().forEach(k => { try { data[k] = localStorage.getItem(k); } catch (e) {} });
    return {
      app: APP, schema: SCHEMA,
      version: (window.TB && TB.VERSION) || '?',
      exportedAt: new Date().toISOString(),
      note: '仅含本机收藏、最近使用、各工具历史、结果中转站与测试记录；不含任何账号或凭据。',
      data: data
    };
  }

  function validateBackup(b) {
    if (!b || b.app !== APP) return '不是本应用的备份文件';
    if (!b.schema || b.schema > SCHEMA) return '备份版本不兼容';
    if (!b.data || typeof b.data !== 'object' || Array.isArray(b.data)) return '备份内容为空或格式错误';
    const keys = Object.keys(b.data);
    if (!keys.length) return '备份中没有任何数据';
    if (keys.some(k => k.indexOf('tb_') !== 0)) return '备份含非本应用的键，已拒绝';
    if (keys.some(k => typeof b.data[k] !== 'string')) return '备份数据格式错误';
    if (JSON.stringify(b).length > MAX_BACKUP) return '备份文件超过 4 MB，已拒绝';
    return null;
  }

  function restoreBackup(b) {
    tbKeys().forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
    Object.keys(b.data).forEach(k => { try { localStorage.setItem(k, b.data[k]); } catch (e) {} });
  }

  function download(name, text) {
    if (typeof Blob === 'function' && typeof URL !== 'undefined' && URL.createObjectURL && document.createElement) {
      const a = document.createElement('a');
      if (a && typeof a.click === 'function') {
        a.href = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
        a.download = name;
        a.click();
        return true;
      }
    }
    return false;
  }

  function stamp() {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  TB.register({
    id: 'settings', name: '设置与备份', category: '综合工具', icon: '⚙️',
    desc: '主题外观、本机数据整体备份与恢复、版本更新下载与 SHA256 校验。',
    tips: [
      '备份文件包含收藏、最近使用、各工具历史、结果中转站与测试记录',
      '换机或重装前先导出备份，恢复时选择该文件即可原样还原',
      'Windows 数据固定在 %APPDATA%\\EnergyTestToolbox\\WebView2，macOS 在 ~/Library/Application Support/EnergyTestToolbox，应用改名不会再丢数据',
      '内置服务优先复用固定端口 39017，避免随机端口让 localStorage 换 origin 导致数据分家',
      '顶栏 🌓 按钮依次循环「跟随系统 → 深色 → 浅色」'
    ],
    refs: [
      '更新包下载后按 Release 附带的 SHA256SUMS.txt 逐字节校验，校验不通过立即删除',
      'GitHub 域名白名单与重定向逐跳校验在本机后端完成，仅主动检查更新时联网',
      '恢复备份采用覆盖语义：先清空本机 tb_ 开头的键，再写入备份内容'
    ],
    limits: [
      '适用范围：仅本机单用户数据，不含跨设备同步与云端账号',
      '容量上限：单个备份文件 4 MB；测试记录上限 30 条，工具历史上限 20 条',
      '警告：恢复会覆盖当前收藏与记录，请先导出一份当前数据作为回滚副本',
      '警告：不会自动替换正在运行的应用；下载校验通过后请手动双击安装包完成更新（macOS 为 .dmg）',
      'macOS 版为 WKWebView 原生窗口；纯 Go 兜底形态会在「运行环境」里提供退出按钮'
    ],
    render(c) {
      const msg = T.el('div', { class: 'hint', id: 'st_msg', text: '所有操作仅作用于本机数据。' });
      function say(t, warn) { msg.textContent = t; msg.className = 'hint' + (warn ? ' warn-text' : ''); }

      // ---------- 运行环境（桌面后端 / 平台 / 端口 / 优雅退出）----------
      let appInfo = null;
      const envBox = T.el('div', { class: 'result-box', id: 'st_env' });
      const envActions = T.el('div', { class: 'row', id: 'st_env_actions' });

      async function quitApp() {
        try {
          const r = await fetch('/api/app/quit', { method: 'POST' });
          const j = await r.json();
          say(j.ok ? '本机服务即将关闭，可以关闭此窗口了。' : ('退出失败：' + (j.error || '未知错误')), !j.ok);
        } catch (e) { say('退出失败：' + (e && e.message ? e.message : e), true); }
      }

      function paintEnv() {
        envBox.innerHTML = '';
        envActions.innerHTML = '';
        if (!appInfo) {
          envBox.appendChild(T.el('div', { class: 'hint', text: '未检测到桌面后端：当前为浏览器直开的纯前端模式，数据保存在当前站点的 localStorage。' }));
          return;
        }
        const modes = { native: '原生窗口', browser: '独立浏览器窗口', headless: '服务模式' };
        const mode = modes[appInfo.windowMode] || appInfo.windowMode;
        envBox.appendChild(T.el('div', { class: 'big', text: appInfo.platform + ' / ' + appInfo.arch + ' · ' + mode }));
        envBox.appendChild(T.el('div', { class: 'hint', text: '数据目录：' + (appInfo.dataDir || '—') }));
        envBox.appendChild(T.el('div', { class: 'hint', text: '本机服务：' + (appInfo.origin || '—') + (appInfo.port ? '（固定端口 ' + appInfo.port + '，保持 Web 存储的 origin 不变）' : '') }));
        if (appInfo.canQuit) {
          envActions.appendChild(T.el('button', { class: 'btn ghost', text: '退出应用', onclick: quitApp }));
        }
      }

      async function probeAppInfo() {
        if (typeof fetch !== 'function') return;
        try {
          const r = await fetch('/api/app/info', { headers: { Accept: 'application/json' } });
          if (!r.ok) return;
          const j = await r.json();
          if (j && j.ok) { appInfo = j; paintEnv(); refreshStat(); }
        } catch (e) {}
      }

      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '运行环境' }), envBox, envActions
      ]));
      paintEnv();
      probeAppInfo();

      // ---------- 外观 ----------
      const themeRow = T.el('div', { class: 'row', id: 'st_theme_row' });
      const THEMES = [
        { v: 'auto', label: '🖥 跟随系统' },
        { v: 'dark', label: '🌙 深色' },
        { v: 'light', label: '☀️ 浅色' }
      ];
      function paintTheme() {
        themeRow.innerHTML = '';
        const cur = typeof TB.getThemeMode === 'function' ? TB.getThemeMode() : 'auto';
        THEMES.forEach(t => themeRow.appendChild(T.el('button', {
          class: 'btn sm ' + (cur === t.v ? 'primary' : 'ghost'),
          text: t.label, 'aria-pressed': cur === t.v ? 'true' : 'false',
          onclick: () => {
            if (typeof TB.setTheme === 'function') TB.setTheme(t.v);
            paintTheme();
            say('已切换为「' + t.label.replace(/^\S+\s*/, '') + '」主题');
          }
        })));
      }
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '外观与主题' }),
        T.el('p', { class: 'hint', text: '跟随系统会读取操作系统的深/浅色偏好并实时响应变化；手动选择后不再随系统改变。' }),
        themeRow
      ]));
      paintTheme();

      // ---------- 备份 / 恢复 ----------
      const stat = T.el('div', { class: 'result-box', id: 'st_stat' });
      const pre = T.el('pre', { class: 'pre', id: 'st_pre', style: 'max-height:180px;overflow:auto;white-space:pre-wrap' });
      const confirmBtn = T.el('button', { class: 'btn primary', text: '确认覆盖并恢复', id: 'st_confirm', disabled: 'disabled' });
      let pending = null;

      function refreshStat() {
        const keys = tbKeys();
        let bytes = 0;
        keys.forEach(k => { try { bytes += (localStorage.getItem(k) || '').length; } catch (e) {} });
        stat.innerHTML = '';
        stat.appendChild(T.el('div', { class: 'big', text: keys.length + ' 项本机数据 · 约 ' + (bytes / 1024).toFixed(1) + ' KB' }));
        const dirText = appInfo && appInfo.dataDir
          ? '目录：' + appInfo.dataDir + '（桌面后端固定，与应用文件名无关；服务端口 ' + (appInfo.port || '?') + '）'
          : '目录：%APPDATA%\\EnergyTestToolbox\\WebView2（Windows）或 ~/Library/Application Support/EnergyTestToolbox（macOS），与应用文件名无关';
        stat.appendChild(T.el('div', { class: 'hint', text: dirText }));
      }

      function readFile(file, cb) {
        if (!file) return;
        if (typeof FileReader !== 'undefined') {
          const fr = new FileReader();
          fr.onload = () => cb(String(fr.result || ''));
          fr.onerror = () => say('文件读取失败', true);
          fr.readAsText(file);
        } else if (file && typeof file.text === 'function') {
          file.text().then(cb).catch(() => say('文件读取失败', true));
        } else {
          say('当前环境不支持读取本地文件', true);
        }
      }

      const fileInput = T.el('input', {
        type: 'file', accept: '.json,application/json', id: 'st_file', 'aria-label': '选择备份文件',
        style: 'display:none'
      });
      fileInput.addEventListener('change', () => {
        const f = fileInput.files && fileInput.files[0];
        readFile(f, txt => {
          let b = null;
          try { b = JSON.parse(txt); } catch (e) { say('不是合法的 JSON 备份文件', true); return; }
          const err = validateBackup(b);
          if (err) { pending = null; confirmBtn.setAttribute('disabled', 'disabled'); say(err, true); return; }
          pending = b;
          confirmBtn.removeAttribute('disabled');
          pre.textContent = '来源版本：v' + (b.version || '?') + '\n导出时间：' + (b.exportedAt || '—') +
            '\n数据项：' + Object.keys(b.data).length + ' 项\n键名：' + Object.keys(b.data).join(', ');
          say('备份校验通过。点击「确认覆盖并恢复」后会清空当前数据并写入备份，随后自动刷新。');
        });
      });

      confirmBtn.addEventListener('click', () => {
        if (!pending) return;
        restoreBackup(pending);
        say('恢复完成，正在刷新…');
        if (typeof TB.toast === 'function') TB.toast('本机数据已恢复', 'ok');
        if (typeof location !== 'undefined' && location.reload) setTimeout(() => location.reload(), 300);
      });

      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '本机数据备份与恢复' }), stat,
        T.el('div', { class: 'row' }, [
          T.el('button', {
            class: 'btn primary', text: '导出备份 JSON', onclick: () => {
              const b = buildBackup();
              const ok = download('energy-toolbox-backup-' + stamp() + '.json', JSON.stringify(b, null, 2));
              pre.textContent = ok ? JSON.stringify(b, null, 2).slice(0, 1200) : JSON.stringify(b, null, 2);
              say(ok ? '已导出备份文件，请妥善保存。' : '当前环境不支持下载，备份内容已显示在下方，可手动复制保存。', !ok);
            }
          }),
          T.el('button', { class: 'btn ghost', text: '选择备份文件…', onclick: () => { if (fileInput.click) fileInput.click(); } }),
          confirmBtn
        ]),
        fileInput, pre
      ]));
      refreshStat();

      // ---------- 版本与更新 ----------
      const updBox = T.el('div', { class: 'result-box', id: 'st_upd' });
      const updActions = T.el('div', { class: 'row', id: 'st_upd_actions' });
      const RELEASE = (window.TB && TB.RELEASE) || {};
      let latest = null, desktop = false, downloaded = null;

      function paintUpdate() {
        updBox.innerHTML = '';
        updActions.innerHTML = '';
        updBox.appendChild(T.el('div', { class: 'big', text: '当前版本 v' + ((window.TB && TB.VERSION) || '?') }));
        if (!latest) {
          updBox.appendChild(T.el('div', { class: 'hint', text: '尚未检查。点击「检查更新」获取 GitHub Releases 的最新版本信息。' }));
        } else if (latest.version === ((window.TB && TB.VERSION) || '')) {
          updBox.appendChild(T.el('div', { class: 'hint', text: '已是最新版本 ' + latest.tag }));
        } else {
          updBox.appendChild(T.el('div', { class: 'hint', text: '发现新版本 ' + latest.tag + '（' + (desktop ? '桌面版：可下载并自动校验' : '浏览器版：请到 Releases 手动下载') + '）' }));
          if (latest.asset) updBox.appendChild(T.el('div', { class: 'hint', text: '本平台更新包：' + latest.asset }));
        }
        updActions.appendChild(T.el('button', { class: 'btn primary', text: '检查更新', onclick: probeUpdate }));
        if (latest && latest.version !== ((window.TB && TB.VERSION) || '')) {
          if (desktop && latest.assetUrl) {
            updActions.appendChild(T.el('button', { class: 'btn ghost', text: '下载并校验', onclick: doDownload }));
          } else {
            updActions.appendChild(T.el('button', {
              class: 'btn ghost', text: '打开 Releases 页面',
              onclick: () => { if (typeof window !== 'undefined' && window.open) window.open(RELEASE.latestUrl || '', '_blank'); }
            }));
          }
        }
        if (downloaded) {
          updBox.appendChild(T.el('div', { class: 'hint', text: downloaded.message }));
          updBox.appendChild(T.el('div', { class: 'hint', text: 'SHA256：' + downloaded.sha256 }));
          updBox.appendChild(T.el('div', { class: 'hint', text: '文件：' + downloaded.path }));
          updActions.appendChild(T.el('button', { class: 'btn ghost', text: '打开所在文件夹', onclick: doReveal }));
        }
      }

      async function probeUpdate() {
        say('正在检查更新…');
        latest = null; desktop = false; downloaded = null;
        let info = null;
        try {
          const r = await fetch('/api/update/latest', { headers: { Accept: 'application/json' } });
          if (r.ok) {
            const j = await r.json();
            if (j && j.ok && j.tag) { info = j; desktop = true; }
          }
        } catch (e) {}
        if (!info) {
          try {
            const r = await fetch(RELEASE.apiUrl || '', { headers: { Accept: 'application/vnd.github+json' } });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const j = await r.json();
            const assets = Array.isArray(j.assets) ? j.assets : [];
            const want = appInfo && appInfo.platform ? (appInfo.platform === 'darwin' ? MAC_ASSET : WIN_ASSET) : assetForPlatform();
            const pick = n => {
              const a = assets.find(x => x && x.name === n);
              return a ? String(a.browser_download_url || '') : '';
            };
            info = {
              tag: String(j.tag_name || ''), version: String(j.tag_name || '').replace(/^v/, ''),
              asset: want, assetUrl: pick(want), sumsUrl: pick('SHA256SUMS.txt')
            };
          } catch (e) {
            say('检查更新失败（离线可忽略）：' + (e && e.message ? e.message : e), true);
            paintUpdate();
            return;
          }
        }
        latest = info;
        TB.updateInfo = info;
        say(info.version === ((window.TB && TB.VERSION) || '') ? '已是最新版本' : '发现新版本 ' + info.tag);
        paintUpdate();
      }

      async function doDownload() {
        if (!latest || !latest.assetUrl) return;
        say('正在下载更新包并校验 SHA256，请稍候…');
        try {
          const r = await fetch('/api/update/download', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag: latest.tag, url: latest.assetUrl, sumsUrl: latest.sumsUrl || '' })
          });
          const j = await r.json();
          if (!j.ok) { say('下载失败：' + (j.error || '未知错误'), true); return; }
          downloaded = j;
          say(j.message);
          paintUpdate();
        } catch (e) {
          say('下载失败：' + (e && e.message ? e.message : e), true);
        }
      }

      async function doReveal() {
        if (!downloaded) return;
        try {
          const r = await fetch('/api/update/reveal', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: downloaded.path })
          });
          const j = await r.json();
          say(j.ok ? '已在文件管理器中定位，请关闭应用后双击安装包完成更新。' : ('打开失败：' + (j.error || '未知错误')), !j.ok);
        } catch (e) {
          say('打开失败：' + (e && e.message ? e.message : e), true);
        }
      }

      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '版本与更新' }), updBox, updActions,
        T.el('p', { class: 'hint', text: '校验通过后不会自动替换正在运行的应用：请先关闭本程序，再双击已下载的安装包（Windows 的 .exe / macOS 的 .dmg）完成更新。日常使用全程离线，只有主动检查更新时才联网。' })
      ]));
      c.appendChild(msg);
      paintUpdate();
    }
  });
})();
