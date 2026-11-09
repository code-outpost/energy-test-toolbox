#!/usr/bin/env node
/**
 * 全主题逐模块浏览器诊断（真实 Chromium），同时覆盖 dark / light。
 *
 * 对每个主题：
 *   1) 生成临时探针页面 src/_theme_probe.html（强制该主题）
 *   2) 用 headless Chrome --dump-dom 打开；在真实浏览器里逐个调用
 *      所有模块的 render()，可捕获 DOM 桩测漏掉的入口级错误
 *   3) 对直接含文本的元素，取计算色与最近不透明祖先背景色，算 WCAG 对比度，
 *      对比 < 3.0 报警；自身带渐变背景的元素单独列出供人工确认（避免误报）
 *
 * 渐变背景元素的 computed backgroundColor 为 transparent，若按上溯取色会把
 * 「深蓝渐变 + 白字」误判为「浅底白字」，因此单独归类。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  for (const c of ['google-chrome', 'chromium', 'chromium-browser']) {
    try { execFileSync('which', [c], { stdio: 'ignore' }); return c; } catch { /* next */ }
  }
  return null;
}

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const PROBE = path.join(SRC, '_theme_probe.html');
const OUT = path.join(ROOT, '_theme_probe_out.html');
const CHROME = findChrome();
const THEMES = process.env.TB_THEME ? [process.env.TB_THEME] : ['dark', 'light'];

if (!CHROME) {
  console.log('⚠ 未找到 Chromium/Chrome，跳过浏览器诊断（CI 可安装 google-chrome 后启用）');
  process.exit(0);
}

const html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');

const PROBE_SCRIPT = `
<script>
(function () {
  function lum(rgb) {
    var c = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function parse(s) {
    var m = /rgba?\\(([^)]+)\\)/.exec(s || '');
    if (!m) return null;
    var a = m[1].split(',').map(function (x) { return parseFloat(x); });
    return { rgb: [a[0], a[1], a[2]], a: a.length > 3 ? a[3] : 1 };
  }
  function bgOf(el) {
    var n = el;
    while (n && n.nodeType === 1) {
      var p = parse(getComputedStyle(n).backgroundColor);
      if (p && p.a > 0.55) return p.rgb;
      n = n.parentElement;
    }
    var b = parse(getComputedStyle(document.body).backgroundColor);
    return b ? b.rgb : [255, 255, 255];
  }
  function ratio(a, b) {
    var l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  var low = [], grads = {}, errors = [], count = 0;
  var host = document.createElement('div');
  host.className = 'layout';
  host.style.cssText = 'position:absolute;left:-99999px;top:0;width:1100px';
  var stage = document.createElement('main');
  stage.className = 'content';
  host.appendChild(stage);
  document.body.appendChild(host);

  (window.TB && TB.modules ? TB.modules : []).forEach(function (m) {
    stage.innerHTML = '';
    var box = document.createElement('div');
    stage.appendChild(box);
    try { m.render(box, { aside: document.createElement('div') }); }
    catch (e) { errors.push(m.id + ': ' + e.message); return; }
    count++;
    var nodes = box.querySelectorAll('*');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var hasText = false;
      for (var j = 0; j < el.childNodes.length; j++)
        if (el.childNodes[j].nodeType === 3 && el.childNodes[j].textContent.trim()) { hasText = true; break; }
      if (!hasText) continue;
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      var fg = parse(cs.color);
      if (!fg || fg.a < 0.5) continue;
      var bg = bgOf(el);
      var r = ratio(fg.rgb, bg);
      var bi = cs.backgroundImage || '';
      if (bi.indexOf('gradient') >= 0) {
        var key = el.className || el.tagName;
        grads[key] = (grads[key] || 0) + 1;
      } else if (r < 3.0 && low.length < 40) {
        low.push(m.id + ' | <' + el.tagName.toLowerCase() + ' class=' + (el.className || '-') + '> '
          + JSON.stringify(el.textContent.trim().slice(0, 22)) + ' | fg=' + cs.color + ' bg=rgb(' + bg.join(',') + ') ratio=' + r.toFixed(2));
      }
    }
  });
  host.remove();
  var out = ['MODULES=' + count, 'ERRORS=' + errors.length, 'LOW=' + low.length,
    '--- errors ---'].concat(errors.slice(0, 10))
    .concat(['--- low contrast ---']).concat(low)
    .concat(['--- gradient background (manual, not a failure) ---'])
    .concat(Object.keys(grads).slice(0, 8).map(function (k) { return k + ' x' + grads[k]; }));
  var pre = document.createElement('pre');
  pre.id = 'PROBE_RESULT';
  pre.textContent = out.join('\\n');
  document.body.appendChild(pre);
})();
</script>
`;

function runTheme(theme) {
  // 强制主题：必须在 app.js 读取 localStorage 之前写入
  const forced = html
    .replace('<head>', `<head>\n  <script>try{localStorage.setItem('tb_theme','${theme}')}catch(e){}</script>`)
    .replace('data-theme="dark"', `data-theme="${theme}"`);
  fs.writeFileSync(PROBE, forced.replace('</body>', PROBE_SCRIPT + '\n</body>'), 'utf8');
  try {
    execFileSync(CHROME, [
      '--headless', '--no-sandbox', '--disable-gpu', '--allow-file-access-from-files',
      '--virtual-time-budget=8000', '--dump-dom', pathToFileURL(PROBE).href
    ], { stdio: ['ignore', fs.openSync(OUT, 'w'), 'ignore'], timeout: 120000 });
  } catch (e) {
    console.error(`✗ ${theme}: Chromium 运行失败: ${e.message}`);
    return null;
  } finally {
    fs.rmSync(PROBE, { force: true });
  }
  let report = '';
  try {
    const raw = fs.readFileSync(OUT, 'utf8');
    const m = /<pre id="PROBE_RESULT">([\s\S]*?)<\/pre>/.exec(raw);
    report = m ? m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"') : '';
  } catch { /* ignore */ }
  fs.rmSync(OUT, { force: true });
  return report;
}

let failed = false;
for (const theme of THEMES) {
  const report = runTheme(theme);
  if (!report) { failed = true; continue; }
  const mods = /MODULES=(\d+)/.exec(report)?.[1] || '?';
  const errs = Number(/ERRORS=(\d+)/.exec(report)?.[1] ?? -1);
  const low = Number(/LOW=(\d+)/.exec(report)?.[1] ?? -1);
  console.log(`\n=== ${theme} 主题 ===\n模块渲染成功=${mods}  渲染异常=${errs}  低对比元素=${low}`);
  if (errs > 0 || low > 0) {
    console.log(report.split('\n').slice(3, 28).join('\n'));
    failed = true;
  }
}
console.log(failed ? '\n✗ 浏览器诊断未通过' : '\n✓ 全主题逐模块浏览器诊断通过（渲染异常 0 / 低对比 0）');
process.exit(failed ? 1 : 0);
