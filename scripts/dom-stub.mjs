// 共享 DOM 桩（ESM）：数值回归测试 / 模块诊断共用，行为与浏览器一致到够用为止。
import fs from 'fs';
import path from 'path';
import vm from 'vm';

export class Node {
  constructor(tag) {
    this.tagName = (tag || '').toUpperCase();
    this.className = ''; this._attrs = {}; this._children = []; this._l = {};
    this.value = ''; this._text = ''; this._html = ''; this.style = {}; this.parentNode = null;
    this.classList = {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, f) { if (f === undefined) f = !this._s.has(c); f ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    };
  }
  remove() { if (this.parentNode && this.parentNode.removeChild) this.parentNode.removeChild(this); }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); this._children = []; }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); this._children = []; }
  get firstChild() { return this._children[0] || null; }
  get lastChild() { return this._children[this._children.length - 1] || null; }
  get childNodes() { return this._children; }
  setAttribute(k, v) { this._attrs[k] = String(v); if (k === 'class') this.className = String(v); if (k === 'value') this.value = String(v); }
  getAttribute(k) { return this._attrs[k]; }
  removeAttribute(k) { delete this._attrs[k]; }
  addEventListener(t, fn) { (this._l[t] = this._l[t] || []).push(fn); }
  appendChild(c) { if (c == null) return c; this._children.push(c); if (typeof c === 'object') c.parentNode = this; return c; }
  insertBefore(c, ref) {
    if (c == null) return c;
    const i = ref ? this._children.indexOf(ref) : -1;
    if (i < 0) this._children.push(c); else this._children.splice(i, 0, c);
    if (typeof c === 'object') c.parentNode = this;
    return c;
  }
  removeChild(c) { const i = this._children.indexOf(c); if (i >= 0) this._children.splice(i, 1); return c; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  dispatchEvent(ev) {
    const t = ev.type, arg = { currentTarget: this, target: this, preventDefault() {}, stopPropagation() {} };
    (this._l[t] || []).forEach(fn => fn(arg));
    const prop = this['on' + t]; if (typeof prop === 'function') prop.call(this, arg);
    return true;
  }
  focus() {}
  select() {}
}

export function textOf(node) {
  if (!node) return '';
  let s = node._text || '';
  for (const c of (node._children || [])) s += textOf(c);
  return s;
}
export function walk(node, fn) { if (!node) return; fn(node); (node._children || []).forEach(c => walk(c, fn)); }
export function hasClass(n, cls) {
  if (!n) return false;
  if (n.classList && n.classList.contains && n.classList.contains(cls)) return true;
  if (typeof n.className === 'string') return n.className.split(/\s+/).indexOf(cls) >= 0;
  return false;
}
export function findBy(root, pred) { let r = null; walk(root, n => { if (!r && pred(n)) r = n; }); return r; }
export function findAll(root, pred) { const a = []; walk(root, n => { if (pred(n)) a.push(n); }); return a; }
export function findClass(root, cls) { return findBy(root, n => hasClass(n, cls)); }
export function findId(root, id) { return findBy(root, n => n.getAttribute && n.getAttribute('id') === id); }
export function findTag(root, tag) { return findBy(root, n => (n.tagName || '').toUpperCase() === tag.toUpperCase()); }
export function findKey(root, label) { return findBy(root, n => hasClass(n, 'key') && (n.textContent || '') === label); }
export function inputs(root) { return findAll(root, n => n.tagName === 'INPUT' || n.tagName === 'SELECT' || n.tagName === 'TEXTAREA'); }
export function setInp(root, id, v) { const e = findId(root, id); if (e) { e.value = String(v); e.dispatchEvent({ type: 'input' }); e.dispatchEvent({ type: 'change' }); return true; } return false; }

export function installDOM() {
  global.window = global;
  global.Event = class { constructor(t) { this.type = t; } };
  global.location = { hash: '' };
  // 与浏览器 Storage 接口对齐：length / key / removeItem / clear，
  // 供设置与备份模块枚举 tb_ 键、覆盖恢复数据。
  global.localStorage = {
    _m: {},
    get length() { return Object.keys(this._m).length; },
    key(i) { return Object.keys(this._m)[i] ?? null; },
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._m, k) ? this._m[k] : null; },
    setItem(k, v) { this._m[k] = String(v); },
    removeItem(k) { delete this._m[k]; },
    clear() { this._m = {}; }
  };
  try { Object.defineProperty(global, 'navigator', { value: { clipboard: { writeText: async () => {} } }, configurable: true, writable: true }); } catch {}
  global.MutationObserver = class { observe() {} disconnect() {} };
  global.document = {
    createElement: t => new Node(t),
    createTextNode: t => { const n = new Node('#text'); n._text = String(t); return n; },
    body: new Node('body'),
    addEventListener() {},
    getElementById: () => new Node('div'),
    execCommand: () => true
  };
  global.addEventListener = () => {};
}

export function loadAllScripts() {
  const html = fs.readFileSync(path.join(process.cwd(), 'src/index.html'), 'utf8');
  const scripts = Array.from(html.matchAll(/<script\s+src="([^"]+)"/g), m => 'src/' + m[1]);
  for (const f of scripts) vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f });
  return scripts;
}

export function renderModule(id) {
  const m = TB.modules.find(x => x.id === id);
  if (!m) throw new Error('module not found: ' + id);
  const body = new Node('main'), aside = new Node('div');
  m.render(body, { aside });
  return { m, body, aside };
}
