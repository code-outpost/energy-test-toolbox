// v0.3.0 回归：主题三态、本机备份导出/校验/恢复、运行环境 / macOS 平台感知、更新下载与 SHA256 校验闭环
import { installDOM, loadAllScripts, renderModule, findId, findAll, textOf } from './dom-stub.mjs';

installDOM();
let systemDark = true;
let schemeListener = null;
global.matchMedia = q => ({
  media: q, matches: systemDark,
  addEventListener(_t, fn) { schemeListener = fn; },
  addListener(fn) { schemeListener = fn; }
});
loadAllScripts();

const TB = globalThis.TB;
let pass = 0, fail = 0;
function eq(name, got, want) {
  const ok = String(got) === String(want);
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + '  got=' + got + (ok ? '' : ' want=' + want));
  ok ? pass++ : fail++;
}
function has(name, text, want) {
  const ok = String(text).includes(String(want));
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + '  含「' + want + '」');
  ok ? pass++ : fail++;
}
const tick = () => new Promise(r => setTimeout(r, 0));
function clickText(root, label) {
  const b = findAll(root, n => n.tagName === 'BUTTON' && (n.textContent || '') === label)[0];
  if (!b) throw new Error('找不到按钮：' + label);
  b.dispatchEvent({ type: 'click' });
  return b;
}
function txt(node) { return textOf(node).replace(/\s+/g, ' ').trim(); }

// ---------- 主题三态 ----------
eq('默认主题模式为跟随系统', TB.getThemeMode(), 'auto');
eq('系统深色 ⇒ 解析为 dark', document.body.getAttribute('data-theme'), 'dark');
TB.setTheme('light');
eq('手动浅色生效', document.body.getAttribute('data-theme'), 'light');
eq('手动模式写入 localStorage', TB.getThemeMode(), 'light');
TB.setTheme('auto');
systemDark = false;
if (schemeListener) schemeListener();
eq('系统偏好变化 ⇒ 跟随模式自动切浅色', document.body.getAttribute('data-theme'), 'light');
TB.setTheme('dark');
systemDark = false;
if (schemeListener) schemeListener();
eq('手动深色不随系统变化', document.body.getAttribute('data-theme'), 'dark');
TB.setTheme('auto');
systemDark = true;

// ---------- 设置面板渲染 ----------
localStorage.setItem('tb_favs', '["standard","ohm"]');
localStorage.setItem('tb_hist_standard', '["1+1"]');
localStorage.setItem('tb_bus_items', '[]');
localStorage.setItem('unrelated_key', 'should-not-be-backed-up');
// 主题切换会写入 tb_theme，因此本机 tb_ 键数按实际枚举，不写死。
let tbCount = 0;
for (let i = 0; i < localStorage.length; i++) {
  const k = localStorage.key(i);
  if (k && k.startsWith('tb_')) tbCount++;
}
const { body } = renderModule('settings');
has('设置面板含外观与主题', txt(body), '外观与主题');
has('设置面板含备份与恢复', txt(body), '本机数据备份与恢复');
has('设置面板含固定数据目录说明', txt(body), '%APPDATA%\\EnergyTestToolbox\\WebView2');
has('统计显示本机数据项数', txt(findId(body, 'st_stat')), tbCount + ' 项本机数据');
eq('设置面板主题按钮数为 3', findAll(findId(body, 'st_theme_row'), n => n.tagName === 'BUTTON').length, 3);

clickText(body, '🌙 深色');
eq('面板内切换深色生效', TB.getThemeMode(), 'dark');
clickText(body, '🖥 跟随系统');
eq('面板内切回跟随系统生效', TB.getThemeMode(), 'auto');

// ---------- 备份导出 ----------
clickText(body, '导出备份 JSON');
let backup = null;
try { backup = JSON.parse(findId(body, 'st_pre').textContent); } catch (e) {}
eq('导出内容是合法 JSON', !!backup, true);
eq('备份 app 标识', backup && backup.app, 'energy-test-toolbox');
eq('备份 schema', backup && backup.schema, 1);
eq('备份只含 tb_ 键', Object.keys((backup && backup.data) || {}).every(k => k.startsWith('tb_')), true);
eq('备份键数与本机 tb_ 键一致', Object.keys((backup && backup.data) || {}).length, tbCount);
eq('备份不含无关的键', 'unrelated_key' in ((backup && backup.data) || {}), false);
eq('备份含收藏数据', backup && backup.data.tb_favs, '["standard","ohm"]');

// ---------- 非法备份被拒绝 ----------
global.FileReader = class {
  readAsText(file) { this.result = file._text; if (this.onload) this.onload(); }
};
const fileInput = findId(body, 'st_file');
function feed(text) {
  fileInput.files = [{ _text: text }];
  fileInput.dispatchEvent({ type: 'change' });
}
feed(JSON.stringify({ app: 'not-this-app', schema: 1, data: { tb_favs: '[]' } }));
has('非本应用备份被拒绝', txt(findId(body, 'st_msg')), '不是本应用的备份文件');
eq('拒绝后确认按钮仍禁用', findId(body, 'st_confirm').getAttribute('disabled'), 'disabled');
feed('{ not json');
has('非法 JSON 被拒绝', txt(findId(body, 'st_msg')), '不是合法的 JSON 备份文件');
feed(JSON.stringify({ app: 'energy-test-toolbox', schema: 1, data: { evil: 'x' } }));
has('含非 tb_ 键的备份被拒绝', txt(findId(body, 'st_msg')), '已拒绝');

// ---------- 合法备份恢复（覆盖语义）----------
feed(JSON.stringify(backup));
has('合法备份显示来源版本摘要', txt(findId(body, 'st_pre')), '来源版本');
eq('校验通过后确认按钮可用', findId(body, 'st_confirm').getAttribute('disabled'), undefined);
localStorage.setItem('tb_favs', '[]');
localStorage.setItem('tb_extra_should_be_removed', 'x');
clickText(body, '确认覆盖并恢复');
eq('恢复后收藏原样还原', localStorage.getItem('tb_favs'), '["standard","ohm"]');
eq('恢复后工具历史原样还原', localStorage.getItem('tb_hist_standard'), '["1+1"]');
eq('覆盖语义：备份外的 tb_ 键被清除', localStorage.getItem('tb_extra_should_be_removed'), null);
eq('无关的键不受影响', localStorage.getItem('unrelated_key'), 'should-not-be-backed-up');

// ---------- 更新闭环（模拟本机后端）----------
let downloadedBody = null;
global.fetch = async (url, opts) => {
  if (url === '/api/update/latest') {
    return { ok: true, json: async () => ({
      ok: true, tag: 'v9.9.9', version: '9.9.9',
      assetUrl: 'https://github.com/code-outpost/energy-test-toolbox/releases/download/v9.9.9/EnergyTestToolbox.exe',
      sumsUrl: 'https://github.com/code-outpost/energy-test-toolbox/releases/download/v9.9.9/SHA256SUMS.txt'
    }) };
  }
  if (url === '/api/update/download') {
    downloadedBody = JSON.parse(opts.body);
    return { ok: true, json: async () => ({
      ok: true, path: 'C:/Users/test/AppData/Roaming/EnergyTestToolbox/updates/EnergyTestToolbox-v9.9.9.exe',
      sha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
      size: 8002560, verified: true, message: 'SHA256 校验通过，与 Release 的 SHA256SUMS.txt 一致'
    }) };
  }
  if (url === '/api/update/reveal') return { ok: true, json: async () => ({ ok: true, message: '已在文件管理器中定位' }) };
  return { ok: false, json: async () => ({}) };
};

clickText(body, '检查更新');
await tick(); await tick();
has('检查到新版本', txt(findId(body, 'st_upd')), '发现新版本 v9.9.9');
eq('最新版本写入全局供顶栏复用', TB.updateInfo && TB.updateInfo.tag, 'v9.9.9');
clickText(body, '下载并校验');
await tick(); await tick();
eq('下载请求携带 tag', downloadedBody && downloadedBody.tag, 'v9.9.9');
has('下载请求携带附件地址', downloadedBody && downloadedBody.url, 'EnergyTestToolbox.exe');
has('下载请求携带哈希清单地址', downloadedBody && downloadedBody.sumsUrl, 'SHA256SUMS.txt');
has('面板显示 SHA256 校验通过', txt(findId(body, 'st_upd')), 'SHA256 校验通过');
has('面板显示下载文件完整路径', txt(findId(body, 'st_upd')), 'EnergyTestToolbox-v9.9.9.exe');
has('面板提示手动覆盖 exe', txt(body), '手动覆盖');
clickText(body, '打开所在文件夹');
await tick();
has('打开文件夹有结果提示', txt(findId(body, 'st_msg')), '已在文件管理器中定位');

// ---------- 运行环境与 macOS 平台感知 ----------
let quitCalled = false;
const macAssets = [
  { name: 'EnergyTestToolbox.exe', browser_download_url: 'https://github.com/x/y/releases/download/v9.9.9/EnergyTestToolbox.exe' },
  { name: 'EnergyTestToolbox-macos-universal.zip', browser_download_url: 'https://github.com/x/y/releases/download/v9.9.9/EnergyTestToolbox-macos-universal.zip' },
  { name: 'SHA256SUMS.txt', browser_download_url: 'https://github.com/x/y/releases/download/v9.9.9/SHA256SUMS.txt' }
];
global.fetch = async (url) => {
  if (url === '/api/app/info') {
    return { ok: true, json: async () => ({
      ok: true, platform: 'darwin', arch: 'arm64', version: '0.3.0',
      windowMode: 'browser', dataDir: '/Users/test/Library/Application Support/EnergyTestToolbox',
      port: 39017, origin: 'http://127.0.0.1:39017', canQuit: true
    }) };
  }
  if (url === '/api/app/quit') { quitCalled = true; return { ok: true, json: async () => ({ ok: true }) }; }
  if (url === '/api/update/latest') return { ok: false, json: async () => ({}) };
  if (String(url).indexOf('api.github.com') >= 0) {
    return { ok: true, json: async () => ({ tag_name: 'v9.9.9', assets: macAssets }) };
  }
  return { ok: false, json: async () => ({}) };
};
const macBody = renderModule('settings').body;
await tick(); await tick(); await tick();
has('环境卡片显示 macOS 平台与架构', txt(findId(macBody, 'st_env')), 'darwin / arm64');
has('环境卡片显示真实数据目录', txt(findId(macBody, 'st_env')), 'Application Support/EnergyTestToolbox');
has('环境卡片显示固定端口', txt(findId(macBody, 'st_env')), '39017');
has('备份卡片改用后端返回的目录', txt(findId(macBody, 'st_stat')), 'Application Support/EnergyTestToolbox');
has('浏览器形态提供退出按钮', txt(findId(macBody, 'st_env_actions')), '退出应用');

clickText(macBody, '检查更新');
await tick(); await tick();
has('macOS 检查到新版本', txt(findId(macBody, 'st_upd')), 'v9.9.9');
has('macOS 只选本平台更新包', txt(findId(macBody, 'st_upd')), 'EnergyTestToolbox-macos-universal.zip');
clickText(macBody, '退出应用');
await tick(); await tick();
eq('退出调用后端 /api/app/quit', quitCalled, true);
has('退出后有结果提示', txt(findId(macBody, 'st_msg')), '本机服务即将关闭');

console.log('\n通过: ' + pass + '   失败: ' + fail);
process.exit(fail ? 1 : 0);
