// 启动级测试：用较完整 DOM 桩加载 index.html 引用的全部脚本（含 app.js），
// 真实模拟浏览器加载顺序，捕获 app.js 启动（route）阶段的任何错误。
import fs from 'fs';
import path from 'path';
import vm from 'vm';

// ---- 较完整 DOM 桩（含 getElementById / location / navigator）----
class Node {
  constructor(tag) {
    this.tagName = (tag || '').toUpperCase(); this.className = ''; this._attrs = {}; this._children = []; this._l = {};
    this.value = ''; this._text = ''; this.style = {}; this.parentNode = null; this.id = '';
    this.classList = { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(c,f){if(f===undefined)f=!this._s.has(c); f?this._s.add(c):this._s.delete(c);}, contains(c){return this._s.has(c);} };
  }
  remove() {}
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); this._children = []; }
  get innerHTML() { return this._html || ''; }
  set innerHTML(v) { this._html = v; this._children = []; }
  setAttribute(k, v) { this._attrs[k] = v; if (k === 'value') this.value = v; if (k === 'id') this.id = v; }
  getAttribute(k) { return this._attrs[k]; }
  removeAttribute(k) { delete this._attrs[k]; }
  addEventListener(t, fn) { (this._l[t] = this._l[t] || []).push(fn); }
  appendChild(c) { if (c == null) return c; this._children.push(c); if (c && typeof c==='object') c.parentNode = this; return c; }
  insertBefore(c, ref) { if (c == null) return c; const i = ref ? this._children.indexOf(ref) : -1; if (i < 0) this._children.push(c); else this._children.splice(i, 0, c); if (c && typeof c==='object') c.parentNode = this; return c; }
  get lastChild() { return this._children[this._children.length - 1]; }
  querySelectorAll() { return []; }
  dispatchEvent(ev) { const t = ev.type; (this._l[t] || []).forEach(fn => fn({ currentTarget: this, target: this, preventDefault(){} })); const prop = this['on' + t]; if (typeof prop === 'function') prop.call(this, { currentTarget: this, target: this, preventDefault(){} }); return true; }
  focus() {}
}

const idMap = {};
function makeEl(tag, id) { const n = new Node(tag); if (id) { n.id = id; idMap[id] = n; } return n; }
// 预建 index.html 中由 id 引用的节点
['sidebar','content','globalSearch','themeToggle','statusbar'].forEach(id => makeEl('div', id));

global.window = global;
global.Event = class { constructor(t){this.type=t;} };
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.location = { hash: '' };
global.localStorage = { _m:{}, getItem(k){return this._m[k]||null;}, setItem(k,v){this._m[k]=v;} };
global.document = {
  createElement: (t) => new Node(t),
  createTextNode: (t) => ({text:t,_text:String(t)}),
  getElementById: (id) => idMap[id] || makeEl('div', id),
  body: new Node('body')
};
global.MutationObserver = class { observe(){} disconnect(){} };

// ---- 加载顺序：与 index.html 完全一致 ----
const root = process.cwd();
const scripts = [
  'src/utils/modules.js',
  'src/modules/calculator/engine.js',
  'src/modules/calculator/standard.js',
  'src/modules/calculator/scientific.js',
  'src/modules/calculator/programmer.js',
  'src/modules/calculator/power-factor.js',
  'src/modules/calculator/cable-drop.js',
  'src/modules/calculator/pv-array.js',
  'src/modules/calculator/battery.js',
  'src/modules/calculator/elec-cost.js',
  'src/modules/calculator/datecalc.js',
  'src/modules/calculator/fraction.js',
  'src/modules/hv/hv-transformer.js',
  'src/modules/hv/hv-motor.js',
  'src/modules/hv/hv-reactance.js',
  'src/modules/hv/hv-safety.js',
  'src/modules/hv/hv-ampacity.js',
  'src/modules/hv/hv-cheatsheet.js',
  'src/modules/calculator/ohm.js',
  'src/modules/calculator/threephase.js',
  'src/modules/calculator/resistor.js',
  'src/modules/calculator/unitconv.js',
  'src/modules/encoding/base-convert.js',
  'src/modules/encoding/encoding.js',
  'src/modules/encoding/timestamp.js',
  'src/modules/encoding/endian.js',
  'src/modules/encoding/checksum.js',
  'src/modules/linux/chmod.js',
  'src/modules/linux/cmd-ref.js',
  'src/modules/linux/cmd-parse.js',
  'src/modules/protocol/iec104.js',
  'src/modules/protocol/modbus.js',
  'src/modules/protocol/goose.js',
  'src/modules/protocol/sv.js',
  'src/modules/protocol/dlt645.js',
  'src/modules/protocol/dnp3.js',
  'src/modules/protocol/iec101103.js',
  'src/modules/protocol/cdt.js',
  'src/modules/protocol/mms-mqtt-opcua.js',
  'src/modules/sql/sql.js',
  'src/modules/dev/json-tool.js',
  'src/modules/dev/regex-tester.js',
  'src/modules/dev/color-convert.js',
  'src/modules/dev/text-tool.js',
  'src/modules/dev/base64-url.js',
  'src/modules/dev/passgen.js',
  'src/modules/daily/unit-converter.js',
  'src/modules/daily/income-tax.js',
  'src/modules/daily/mortgage.js',
  'src/modules/daily/bmi.js',
  'src/modules/daily/geometry.js',
  'src/modules/daily/random.js',
  'src/modules/misc/hex-diff.js',
  'src/modules/misc/hex-dump.js',
  'src/modules/misc/calc.js',
  'src/app.js'
];

let loadErr = 0;
for (const f of scripts) {
  try { vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f }); }
  catch (e) { console.log('✗ LOAD/EXEC FAIL:', f, '->', e.message); loadErr++; }
}

function countDeep(n) { let c = 0; (n._children||[]).forEach(ch => { c += 1 + countDeep(ch); }); return c; }
const sidebarKids = countDeep(idMap['sidebar']);
const contentKids = countDeep(idMap['content']);
const statusKids = countDeep(idMap['statusbar']);

console.log('已注册模块数:', (global.TB && TB.modules.length) || 0);
console.log('sidebar 渲染节点数:', sidebarKids);
console.log('content 渲染节点数:', contentKids);
console.log('statusbar 渲染节点数:', statusKids);
console.log('加载/执行失败数:', loadErr);

if (loadErr === 0 && sidebarKids > 0 && contentKids > 0) {
  console.log('✓ app.js 启动渲染通过（非 JS 启动错误）');
} else {
  console.log('✗ 存在启动失败，需要进一步排查');
}
