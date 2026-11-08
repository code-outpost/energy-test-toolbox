// 临时联调测试：引擎求值 + 模拟标准/程序员计算器点击
import fs from 'fs';
import path from 'path';
import vm from 'vm';

// ---- 较完整 DOM 桩 ----
function makeNode(tag) {
  const n = {
    tagName: (tag || '').toUpperCase(), _attrs: {}, _children: [], value: '',
    _text: '', _html: '', style: {}, parentNode: null, _l: {}, _cls: new Set(),
  };
  Object.defineProperty(n, 'className', {
    get(){ return [...n._cls].join(' '); },
    set(v){ n._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  });
  n.classList = { add(c){n._cls.add(c);}, remove(c){n._cls.delete(c);}, toggle(c,f){ if(f===undefined) f=!n._cls.has(c); f?n._cls.add(c):n._cls.delete(c); }, contains(c){ return n._cls.has(c); } };
  Object.defineProperty(n, 'textContent', { get(){return n._text;}, set(v){n._text=String(v); n._children=[];} });
  Object.defineProperty(n, 'innerHTML', { get(){return n._html;}, set(v){n._html=String(v); n._children=[];} });
  n.setAttribute=(k,v)=>{n._attrs[k]=v;};
  n.getAttribute=(k)=>n._attrs[k];
  n.addEventListener=(t,fn)=>{(n._l[t]=n._l[t]||[]).push(fn);};
  n.appendChild=(c)=>{ if(c==null) return c; c.parentNode=n; n._children.push(c); return c; };
  Object.defineProperty(n,'lastChild',{get(){return n._children[n._children.length-1];}});
  n.dispatchEvent=(ev)=>{ (n._l[ev.type]||[]).forEach(fn=>fn({currentTarget:n,target:n,preventDefault(){}})); return true; };
  n.querySelectorAll=(sel)=>{ const res=[]; const want=sel.replace('.',''); (function walk(x){ x._children.forEach(ch=>{ if(ch.classList&&ch.classList.contains(want)) res.push(ch); walk(ch);}); })(n); return res; };
  n.querySelectorAll=n.querySelectorAll;
  n.querySelector=(sel)=>n.querySelectorAll(sel)[0]||null;
  return n;
}
global.window = global;
global.Event = class { constructor(t){this.type=t;} };
global.localStorage = { _m:{}, getItem(k){return this._m[k]||null;}, setItem(k,v){this._m[k]=v;} };
global.document = { createElement:t=>makeNode(t), createTextNode:t=>({text:t}), body:makeNode('body') };
global.TB = global.TB || {};
global.location = { hash:'' };

function load(f){ vm.runInThisContext(fs.readFileSync(f,'utf8'),{filename:f}); }
['src/utils/modules.js','src/modules/calculator/engine.js','src/modules/calculator/standard.js','src/modules/calculator/programmer.js'].forEach(load);

let pass=0, fail=0;
function eq(name, got, exp){ if(got===exp){pass++; console.log('  ✓',name,'=>',got);} else {fail++; console.log('  ✗',name,'got',got,'exp',exp);} }

console.log('— 引擎测试 —');
eq('2+3*4', TB.calcEval('2+3*4'), '14');
eq('(1+2)*3^2 - sqrt(16)', TB.calcEval('(1+2)*3^2 - sqrt(16)'), '23');
eq('fact(5)', TB.calcEval('fact(5)'), '120');
eq('10^(3)', TB.calcEval('10^(3)'), '1000');
eq('2^10', TB.calcEval('2^10'), '1024');
eq('log(1000)', TB.calcEval('log(1000)'), '3');
eq('ln(e)', TB.calcEval('ln(e)'), '1');
eq('sin30deg', TB.calcEval('sin(30)',{deg:true}), '0.5');
eq('pi', TB.calcEval('pi').slice(0,5), '3.141');

console.log('— 标准计算器模拟 7 + 8 = —');
const root = makeNode('main');
const std = TB.modules.find(m=>m.id==='standard');
std.render(root);
function allBtns(n, acc){ acc=acc||[]; (n._children||[]).forEach(ch=>{ if(ch.tagName==='BUTTON') acc.push(ch); allBtns(ch,acc); }); return acc; }
function clickText(t){ const b=allBtns(root).find(x=>x._text===t); if(!b){console.log('  未找到按钮',t);return;} b.dispatchEvent({type:'click'}); }
function dispVal(){ return root.querySelectorAll('.val')[0]._text; }
clickText('7'); clickText('+'); clickText('8'); clickText('=');
eq('7+8 显示', dispVal(), '15');
clickText('AC'); clickText('9'); clickText('×'); clickText('9'); clickText('=');
eq('9*9 显示', dispVal(), '81');
clickText('AC'); clickText('1'); clickText('0'); clickText('0'); clickText('÷'); clickText('4'); clickText('=');
eq('100/4 显示', dispVal(), '25');

console.log('— 程序员计算器 模拟 HEX FF + 1 = —');
const proot = makeNode('main');
const prog = TB.modules.find(m=>m.id==='programmer');
prog.render(proot);
function pclick(t){ const b=allBtns(proot).find(x=>x._text===t); if(!b){console.log('  未找到按钮',t);return;} b.dispatchEvent({type:'click'}); }
function pdisp(){ return proot.querySelectorAll('.val')[0]._text; }
// 切到 HEX
const hexSeg = allBtns(proot).length? null : null;
const hexSegNode = (function(){ let r=null; (function w(n){ n._children.forEach(ch=>{ if(ch._text==='HEX'&&ch.classList.contains('seg')) r=ch; w(ch);}); })(proot); return r; })();
hexSegNode.dispatchEvent({type:'click'});
pclick('F'); pclick('F'); // entry FF
pclick('+'); pclick('1'); pclick('=');
eq('FF+1=100(HEX)', pdisp(), '100');

console.log('\n通过:',pass,'  失败:',fail);

// ---- 入口/导航 运行时校验 ----
console.log('— 入口/导航 (app.js) 渲染 —');
const ids = {};
global.document.getElementById = (id)=>{ if(!ids[id]){ ids[id]=makeNode('div'); ids[id].id=id; } return ids[id]; };
global.document.querySelectorAll = ()=>[];
let hashHandlers=[];
global.addEventListener = (t,fn)=>{ if(t==='hashchange') hashHandlers.push(fn); };
global.window.addEventListener = global.addEventListener;
global.location = { hash:'' };
// 补齐加载全部模块（与真实环境一致）
const modFiles = [];
for (const d of ['src/modules']) {
  for (const f of fs.readdirSync(d, { recursive: true })) {
    if (String(f).endsWith('.js')) modFiles.push(path.join(d, f).split(path.sep).join('/'));
  }
}
modFiles.sort().forEach(f => { try { load(f); } catch(e){ console.log('  模块加载失败', f, e.message); } });
console.log('  已注册模块总数:', TB.modules.length);
load('src/app.js');  // IIFE 立即执行 route() -> 仪表盘
const sb = ids['sidebar'], ct = ids['content'], st = ids['statusbar'];
const catCards = ct.querySelectorAll('.cat-card');
console.log('  仪表盘分类卡片:', catCards.length, catCards.length>=6?'✓':'✗');
const homeItems = sb.querySelectorAll('.nav-home');
console.log('  侧边首页入口:', homeItems.length, homeItems.length===1?'✓':'✗');
// 模拟打开标准计算器模块
global.location.hash = '#/m/standard';
hashHandlers.forEach(h=>h());
const hasCalc = ct.querySelectorAll('.calc').length>0 || ct.querySelectorAll('.keypad').length>0;
console.log('  打开 standard 模块渲染键盘:', hasCalc?'✓':'✗');
// 模拟搜索过滤
const searchEl = ids['globalSearch'];
searchEl.value='进制'; searchEl.dispatchEvent({type:'input'});
const filtered = sb.querySelectorAll('.nav-item');
console.log('  搜索“进制”后导航项:', filtered.length, '(应>0)');

process.exit(fail?1:0);
