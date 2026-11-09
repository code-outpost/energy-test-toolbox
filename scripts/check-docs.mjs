// 跨文档一致性：以源码为唯一事实来源，校验 README / design / 官网 / 更新日志里的
// 模块数、分类数、版本号，防止「代码改了文档没改」。
import fs from 'fs';
import path from 'path';

const root = process.cwd();
function walk(dir, acc = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, acc);
    else if (p.endsWith('.js')) acc.push(p.split(path.sep).join('/'));
  }
  return acc;
}

// 真实模块数 / 分类数（来自模块源码里的 category 字段）
const counts = {};
let total = 0;
for (const f of walk('src/modules')) {
  const m = fs.readFileSync(f, 'utf8').match(/category\s*:\s*['"]([^'"]+)['"]/);
  if (m) { counts[m[1]] = (counts[m[1]] || 0) + 1; total++; }
}
const cats = Object.keys(counts).length;

// index.html 引用的脚本与注册表一一对应（防止模块文件写了却没引入）
const html = fs.readFileSync('src/index.html', 'utf8');
const refs = Array.from(html.matchAll(/<script\s+src="([^"]+)"/g), m => m[1]);
const moduleScripts = refs.filter(r => r.startsWith('modules/'));
const missing = [];
for (const f of walk('src/modules')) {
  const rel = f.replace(/^src\//, '').split(path.sep).join('/');
  if (!moduleScripts.includes(rel)) missing.push(rel);
}

// 版本号唯一来源
const version = (fs.readFileSync('src/version.js', 'utf8').match(/VERSION\s*=\s*'([^']+)'/) || [])[1] || '?';

const docs = ['README.md', 'design.md', 'docs/index.html', 'CHANGELOG.md', 'RELEASE_NOTES.md'];
const stale = [];
const staleNums = [];
// 只把「接近总量」的数字视为过时总量；分类内的「6 个工具」等描述不误伤。
for (let n = 20; n < 200; n++) {
  if (n === total) continue;
  staleNums.push(new RegExp('\\b' + n + '\\s*(个工具|个模块)'));
}
for (const d of docs) {
  if (!fs.existsSync(d)) { stale.push(d + ' 缺失'); continue; }
  const t = fs.readFileSync(d, 'utf8');
  if (!t.includes(String(total))) stale.push(d + ' 未出现真实模块数 ' + total);
  // design.md / CHANGELOG.md 保留历史版本的旧计数，只校验「当前状态」类文档。
  if (['README.md', 'docs/index.html'].includes(d)) {
    for (const re of staleNums) {
      const m = t.match(re);
      if (m && /个工具|个模块/.test(m[0])) { stale.push(d + ' 含过时计数「' + m[0] + '」'); break; }
    }
  }
  if (!t.includes('v' + version)) stale.push(d + ' 未出现当前版本 v' + version);
}

console.log('真实模块数:', total, ' 分类数:', cats, ' 版本: v' + version);
console.log('入口引入的模块脚本:', moduleScripts.length, ' 未被引入的模块:', missing.length);
if (missing.length) missing.forEach(f => console.log('  ✗ 未引入:', f));
console.log('文档检查:', stale.length ? stale.length + ' 项不一致' : '全部一致');
stale.forEach(s => console.log('  ✗', s));

const bad = stale.length + missing.length;
if (bad) process.exit(1);
console.log('✓ 跨文档一致性通过');
