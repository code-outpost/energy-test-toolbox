// 交互式测试：用较完整 DOM 桩真实模拟点击/输入，校验计算逻辑
import fs from 'fs';
import path from 'path';
import vm from 'vm';

// ---- 较完整 DOM 桩 ----
class Node {
  constructor(tag) {
    this.tagName = (tag || '').toUpperCase(); this.className = ''; this._attrs = {}; this._children = []; this._l = {};
    this.value = ''; this._text = ''; this.style = {}; this.parentNode = null;
    this.classList = { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(c,f){if(f===undefined)f=!this._s.has(c); f?this._s.add(c):this._s.delete(c);}, contains(c){return this._s.has(c);} };
  }
  remove() {}
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); this._children = []; }
  get innerHTML() { return this._html || ''; }
  set innerHTML(v) { this._html = v; this._children = []; }
  setAttribute(k, v) { this._attrs[k] = v; if (k === 'value') this.value = v; }
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
global.window = global;
global.Event = class { constructor(t){this.type=t;} };
global.localStorage = { _m:{}, getItem(k){return this._m[k]||null;}, setItem(k,v){this._m[k]=v;} };
global.document = { createElement: t => new Node(t), createTextNode: t => ({text:t,_text:String(t)}), body: new Node('body') };
global.MutationObserver = class { observe(){} disconnect(){} };

function textOf(node) {
  let s = node._text || '';
  for (const c of (node._children || [])) s += textOf(c);
  return s;
}
function walk(node, fn) { if (!node) return; fn(node); (node._children||[]).forEach(c => walk(c, fn)); }
function hasClass(n, cls) {
  if (!n) return false;
  if (n.classList && n.classList.contains && n.classList.contains(cls)) return true;
  if (typeof n.className === 'string') return n.className.split(/\s+/).indexOf(cls) >= 0;
  return false;
}
function findText(root, text) {
  let r=null;
  walk(root, n => { if (!r && (n.textContent||'')===text) r=n; });
  return r;
}
function findClass(root, cls) {
  let r=null;
  walk(root, n => { if (!r && hasClass(n, cls)) r=n; });
  return r;
}
function findTag(root, tag) {
  let r=null;
  walk(root, n => { if (!r && (n.tagName||'').toUpperCase()===tag.toUpperCase()) r=n; });
  return r;
}
// 仅匹配按键（class 含 key），避免与显示屏文本冲突
function findKey(root, label) {
  let r=null;
  walk(root, n => { if (!r && hasClass(n,'key') && (n.textContent||'')===label) r=n; });
  return r;
}
function findSeg(root, label) {
  let r=null;
  walk(root, n => { if (!r && hasClass(n,'seg') && (n.textContent||'')===label) r=n; });
  return r;
}
function findId(root, id) { let r=null; walk(root, n => { if (!r && n.getAttribute && n.getAttribute('id')===id) r=n; }); return r; }

global.window = global;
const root = process.cwd();
const files = ['src/utils/modules.js','src/modules/calculator/engine.js'];
for (const d of ['src/modules']) {
  for (const f of fs.readdirSync(d, { recursive: true })) {
    if (f.endsWith('.js')) files.push(path.join(d, f).split(path.sep).join('/'));
  }
}
for (const f of files) vm.runInThisContext(fs.readFileSync(f,'utf8'), { filename: f });

let pass=0, fail=0;
function eq(name, got, want) {
  const ok = String(got) === String(want);
  console.log((ok?'  ✓ ':'  ✗ ')+name+'  got='+got+(ok?'':' want='+want));
  ok?pass++:fail++;
}
function clickKey(root, t){ const b=findKey(root,t); if(!b){console.log('  ✗ 未找到键',t);fail++;return;} b.dispatchEvent({type:'click'}); }

// ---- 标准计算器：7 + 8 = 15（历史在右侧 aside）----
const std = TB.modules.find(m=>m.id==='standard');
const stdAside = new Node('div');
const rc = new Node('main'); std.render(rc, { aside: stdAside });
clickKey(rc,'7'); clickKey(rc,'+'); clickKey(rc,'8'); clickKey(rc,'=');
const stdVal = findClass(rc,'val');
eq('标准 7+8', stdVal? textOf(stdVal) : '', '15');
const stdTape = findClass(stdAside,'tape');
eq('标准 历史含 15', stdTape ? textOf(stdTape).replace(/\s+/g,' ').includes('15') : false, true);

// ---- 科学计算器：sin(30) in DEG -> 0.5（历史在右侧 aside）----
const sci = TB.modules.find(m=>m.id==='scientific');
const sciAside = new Node('div');
const rs = new Node('main'); sci.render(rs, { aside: sciAside });
const degBtn = findKey(rs,'RAD'); if(degBtn) degBtn.dispatchEvent({type:'click'}); // RAD -> DEG
['sin','3','0',')','='].forEach(t=>clickKey(rs,t));
const sciVal = findClass(rs,'val');
eq('科学 sin(30°)', sciVal?textOf(sciVal):'', '0.5');
const sciTape = findClass(sciAside,'tape');
eq('科学 历史含 0.5', sciTape ? textOf(sciTape).replace(/\s+/g,' ').includes('0.5') : false, true);

// ---- 程序员：HEX FF -> DEC 255，并验证新增算术键 255 + 1 = 256 ----
const pr = TB.modules.find(m=>m.id==='programmer');
const prAside = new Node('div');
const rp = new Node('main'); pr.render(rp, { aside: prAside });
const hexSeg = findSeg(rp,'HEX'); if(hexSeg) hexSeg.dispatchEvent({type:'click'});
['F','F'].forEach(d=>clickKey(rp,d));
const decSeg = findSeg(rp,'DEC'); if(decSeg) decSeg.dispatchEvent({type:'click'});
const prVal = findClass(rp,'val');
eq('程序员 HEX FF->DEC', prVal?textOf(prVal):'', '255');
clickKey(rp,'+'); clickKey(rp,'1'); clickKey(rp,'=');
const prVal2 = findClass(rp,'val');
eq('程序员 255+1', prVal2?textOf(prVal2):'', '256');
const prTape = findClass(prAside,'tape');
eq('程序员 历史含 256', prTape ? textOf(prTape).replace(/\s+/g,' ').includes('256') : false, true);
// 位面板应迁移到右侧 aside（而非左侧主体）
const prBitInAside = !!findClass(prAside, 'bitpanel');
const prBitInBody = !!findClass(rp, 'bitpanel');
eq('程序员 位面板在右侧 aside', prBitInAside && !prBitInBody, true);

// ---- 分数：1/2 + 1/3 = 5/6 ----
const fr = TB.modules.find(m=>m.id==='fraction');
const rf = new Node('main'); fr.render(rf);
function setInp(root,id,v){ const e=findId(root,id); if(e){ e.value=String(v); e.dispatchEvent({type:'input'}); } }
const opSel = findTag(rf,'SELECT'); if(opSel) opSel.value='+'; // 桩环境需手动设定下拉默认值
setInp(rf,'a1',1); setInp(rf,'b1',2); setInp(rf,'a2',1); setInp(rf,'b2',3);
const frOut = findClass(rf,'result-box');
eq('分数 1/2+1/3', frOut?textOf(frOut).replace(/\s+/g,' ').includes('5/6'):false, true);

// ---- 功率因数：P=100 λ1=0.8 λ2=0.95 -> Qc≈42.13 kvar ----
const pf = TB.modules.find(m=>m.id==='power-factor');
const rpf = new Node('main'); pf.render(rpf);
setInp(rpf,'pf_p',100); setInp(rpf,'pf_c1',0.80); setInp(rpf,'pf_c2',0.95); setInp(rpf,'pf_u',400);
const pfOut = findClass(rpf,'result-box');
eq('功率因数 Qc', pfOut? textOf(pfOut).replace(/\s+/g,' ').includes('42.13'):false, true);

// ---- 电缆压降：合理范围 ----
const cd = TB.modules.find(m=>m.id==='cable-drop');
const rcd = new Node('main'); cd.render(rcd);
let numInputs=[]; walk(rcd, n=>{ if(n.tagName==='INPUT' && (n.getAttribute('type')==='number'||!n.getAttribute('type'))) numInputs.push(n); });
// cd 字段顺序: U=400,P=30,pf=0.85,L=150,S=16,allow=5
['400','30','0.85','150','16','5'].forEach((v,i)=>{ if(numInputs[i]){ numInputs[i].value=v; numInputs[i].dispatchEvent({type:'input'}); }});
const cdOut = findClass(rcd,'result-box');
const cdText = cdOut?textOf(cdOut).replace(/\s+/g,' '):'';
eq('电缆压降 有数值', /\d/.test(cdText) && cdText.includes('%'), true);

// ---- 高压电工：变压器 800kVA 10kV/400V -> I1≈46.2A I2≈1154.7A ----
const tf = TB.modules.find(m=>m.id==='hv-transformer');
const rtf = new Node('main'); tf.render(rtf);
const tfBig = findClass(rtf,'big');
eq('变压器 额定电流', tfBig? textOf(tfBig).replace(/\s+/g,' ').includes('1154.7') : false, true);

// ---- 高压电工：安全距离(选 10kV)-> 0.70 m ----
const sf = TB.modules.find(m=>m.id==='hv-safety');
const rsf = new Node('main'); sf.render(rsf);
const sfSel = findTag(rsf,'SELECT'); if (sfSel) { sfSel.value='10kV'; sfSel.dispatchEvent({type:'change'}); }
const sfBig = findClass(rsf,'big');
eq('安全距离 10kV', sfBig? textOf(sfBig).replace(/\s+/g,' ').includes('0.70') : false, true);

// ---- 高压电工：导线载流量 25mm² 铜(升级按铝35 x3=105A) ----
const am = TB.modules.find(m=>m.id==='hv-ampacity');
const ram = new Node('main'); am.render(ram);
const amBig = findClass(ram,'big');
eq('导线载流量 估算', amBig? /≈\s*\d+\s*A/.test(textOf(amBig).replace(/\s+/g,' ')) : false, true);

// ---- 高压电工：公式速查卡 渲染非空 ----
const cs = TB.modules.find(m=>m.id==='hv-cheatsheet');
const rcs = new Node('main'); cs.render(rcs);
const csHasFormula = !!findClass(rcs,'formula');
eq('公式速查卡 有公式', csHasFormula, true);

// ---- 日常工具：通用单位换算 1 千米 -> 1000 米 ----
const uc = TB.modules.find(m=>m.id==='unit-converter');
const ruc = new Node('main'); uc.render(ruc);
const ucCat = findTag(ruc,'SELECT'); // 第一个 select 是类别
if (ucCat) { ucCat.value='长度'; ucCat.dispatchEvent({type:'change'}); }
const ucSels = []; walk(ruc, n=>{ if(n.tagName==='SELECT') ucSels.push(n); });
if (ucSels[1]) { ucSels[1].value='千米 km'; ucSels[1].dispatchEvent({type:'change'}); }
if (ucSels[2]) { ucSels[2].value='米 m'; ucSels[2].dispatchEvent({type:'change'}); }
const ucBig = findClass(ruc,'big');
eq('单位换算 1千米->1000米', ucBig? textOf(ucBig).replace(/\s+/g,' ').includes('1000') : false, true);

// ---- 日常工具：个税 200000/24000/12000 -> 税率10% ----
const it = TB.modules.find(m=>m.id==='income-tax');
const rit = new Node('main'); it.render(rit);
let itInputs=[]; walk(rit, n=>{ if(n.tagName==='INPUT' && n.getAttribute('type')==='number') itInputs.push(n); });
['200000','24000','12000'].forEach((v,i)=>{ if(itInputs[i]){ itInputs[i].value=v; itInputs[i].dispatchEvent({type:'input'}); }});
const itOut = findClass(rit,'result-box');
eq('个税 税率10%', itOut? textOf(itOut).replace(/\s+/g,' ').includes('10%') : false, true);

// ---- 日常工具：BMI 170/65 -> 22.5 正常 ----
const bm = TB.modules.find(m=>m.id==='bmi');
const rbm = new Node('main'); bm.render(rbm);
let bmInputs=[]; walk(rbm, n=>{ if(n.tagName==='INPUT' && n.getAttribute('type')==='number') bmInputs.push(n); });
['170','65','30'].forEach((v,i)=>{ if(bmInputs[i]){ bmInputs[i].value=v; bmInputs[i].dispatchEvent({type:'input'}); }});
const bmOut = findClass(rbm,'result-box');
eq('BMI 170/65 正常', bmOut? textOf(bmOut).replace(/\s+/g,' ').includes('22.5') : false, true);

// ---- 日常工具：几何 圆 r=1 -> 面积 3.1416 ----
const gm = TB.modules.find(m=>m.id==='geometry');
const rgm = new Node('main'); gm.render(rgm);
let gmInputs=[]; walk(rgm, n=>{ if(n.tagName==='INPUT' && n.getAttribute('type')==='number') gmInputs.push(n); });
if(gmInputs[0]){ gmInputs[0].value='1'; gmInputs[0].dispatchEvent({type:'input'}); }
const gmKv = findClass(rgm,'kv');
eq('几何 圆面积', gmKv? textOf(gmKv).replace(/\s+/g,' ').includes('3.1416') : false, true);

// ---- 日常工具：随机 掷骰子 出总和 ----
const rd = TB.modules.find(m=>m.id==='random');
const rrd = new Node('main'); rd.render(rrd);
const rdMode = findTag(rrd,'SELECT'); if (rdMode) { rdMode.value='dice'; rdMode.dispatchEvent({type:'change'}); }
// 找到「掷骰」按钮（primary + 文本）
let rdBtn=null; walk(rrd, n=>{ if(!rdBtn && hasClass(n,'btn') && (n.textContent||'')==='掷骰') rdBtn=n; });
if (rdBtn) rdBtn.dispatchEvent({type:'click'});
const rdBig = findClass(rrd,'big');
eq('随机 掷骰 出总和', rdBig? textOf(rdBig).replace(/\s+/g,' ').includes('总和') : false, true);

console.log('\n通过:',pass,'  失败:',fail);
process.exit(fail?1:0);
