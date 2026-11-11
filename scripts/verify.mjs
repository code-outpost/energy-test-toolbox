// 验证脚本：用最小 DOM 桩加载所有模块，确认注册与默认样本渲染无异常
import fs from 'fs';
import path from 'path';
import vm from 'vm';

global.window = global;
global.Event = class { constructor(t) { this.type = t; } };
global.localStorage = { _m: {}, getItem(k) { return this._m[k] || null; }, setItem(k, v) { this._m[k] = v; } };

class Node {
  constructor(tag) { this.tagName = (tag || '').toUpperCase(); this.className = ''; this._attrs = {}; this._children = []; this._l = {}; this.value = ''; this._text = ''; this.style = {}; this.parentNode = null; this.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } }; }
  remove() {}
  get parentNode_() { return this.parentNode; }
  set textContent(v) { this._text = String(v); this._children = []; }
  get textContent() { return this._text; }
  set innerHTML(v) { this._html = v; this._children = []; }
  get innerHTML() { return this._html || ''; }
  setAttribute(k, v) { this._attrs[k] = v; }
  getAttribute(k) { return this._attrs[k]; }
  addEventListener(type, fn) { (this._l[type] = this._l[type] || []).push(fn); }
  appendChild(c) { if (c == null) return c; this._children.push(c); return c; }
  get lastChild() { return this._children[this._children.length - 1]; }
  dispatchEvent(ev) { (this._l[ev.type] || []).forEach(fn => fn({ currentTarget: this, target: this })); return true; }
}
global.document = {
  createElement: (t) => new Node(t),
  createTextNode: (t) => ({ text: t, _text: String(t) }),
  body: new Node('body')
};

const root = process.cwd();
const files = [];
for (const d of ['src/modules']) {
  for (const f of fs.readdirSync(d, { recursive: true })) {
    if (f.endsWith('.js')) files.push(path.join(d, f).split(path.sep).join('/'));
  }
}
// 共享基础层必须在最前（模块文件会引用 TB / TB.units / TB.bus）
const shared = ['src/utils/modules.js', 'src/utils/units.js', 'src/utils/bus.js', 'src/data/iec104-points.js'];
const allFiles = [...shared, ...files.filter(f => !f.startsWith('src/utils/'))];

let loadErr = 0;
for (const f of allFiles) {
  try { vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f }); }
  catch (e) { console.log('LOAD FAIL', f, e.message); loadErr++; }
}

console.log('已注册模块数:', TB.modules.length);
let renderErr = 0;
const container = new Node('main');
for (const m of TB.modules) {
  try {
    new Node('main');
    const c = new Node('main');
    m.render(c);
    if (c._children.length === 0) { console.log('  ⚠ 渲染为空:', m.id); }
  } catch (e) { console.log('  ✗ 渲染异常:', m.id, '->', e.message); renderErr++; }
}
console.log('加载失败:', loadErr, ' 渲染异常:', renderErr);
if (loadErr === 0 && renderErr === 0) console.log('✓ 全部模块注册并渲染通过');
else console.log('✗ 存在失败');
