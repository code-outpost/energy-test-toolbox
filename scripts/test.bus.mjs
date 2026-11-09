// 跨工具结果总线回归：发布 / 引用填入 / 单位自动换算 / 端到端串联 / 测试记录
import { installDOM, loadAllScripts, renderModule, Node, textOf } from './dom-stub.mjs';

installDOM();
loadAllScripts();
const B = globalThis.TB.bus;
const R = globalThis.TB.records;

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
function txt(body) { return textOf(body).replace(/\s+/g, ' ').trim(); }

B.clear(); R.clear();

// ---- 发布与族推断 ----
const e = B.publish('demo', '测试有功功率', 1, 'kW');
eq('发布后有 1 条结果', B.all().length, 1);
eq('自动推断 family=active', e.family, 'active');
eq('latest 返回最新结果', B.latest().label, '测试有功功率');
eq('latest(modId) 可按工具过滤', B.latest('demo').value, 1);
eq('latest(不存在的工具) 为 null', B.latest('nope'), null);

// ---- 引用填入 + 单位自动换算 ----
B.requestFill(e, 'power-factor');
const target = new Node('input');
const r = B.consume('power-factor', [{ el: target, family: 'active', unit: 'W', label: 'P(W)' }]);
eq('按 family 命中目标字段', r.filled, true);
eq('1 kW 自动换算为 1000 W 填入', target.value, '1000');
eq('返回携带来源 entry', r.entry.id, e.id);
eq('pending 已被消费', B.peekPending() === null, true);

// ---- 目标不匹配时不应误吞 pending ----
B.requestFill(e, 'another-tool');
eq('目标不匹配时 consume 返回 null', B.consume('power-factor', [{ el: target, family: 'active', unit: 'W' }]), null);
eq('pending 保留（未误消费）', !!B.peekPending(), true);
B.takePending();

// ---- 通配接收（量纲校验台）----
B.requestFill(e, 'unit-guard');
const anyTarget = new Node('input');
const r2 = B.consume('unit-guard', [{ el: anyTarget, family: '*', unit: '', label: '换算数值' }]);
eq('family=* 通配可接收任意结果', r2.filled, true);
eq('通配接收保留原值', anyTarget.value, '1');

// ---- 端到端串联 ①：三相功率 200 kW → 功率因数补偿 ----
B.clear();
const p1 = B.publish('threephase', '三相有功功率 P', 200, 'kW', { note: 'P = √3·U·I·cosφ' });
B.requestFill(p1, 'power-factor');
const m1 = renderModule('power-factor');
has('串联①：200 kW 送入功率因数补偿 ⇒ Qc 84.26 kvar', txt(m1.body), '84.26');
eq('串联后 pending 已清空', B.peekPending() === null, true);

// ---- 端到端串联 ②：变压器二次电流 120 A → 载流量校核 ----
const p2 = B.publish('hv-transformer', '额定二次电流 I₂', 120, 'A');
B.requestFill(p2, 'hv-ampacity');
const m2 = renderModule('hv-ampacity');
has('串联②：120 A 送入导线载流量 ⇒ 出现电流校核', txt(m2.body), '电流校核');
has('串联②：校核文本含 120.0 A', txt(m2.body), '120.0 A');

// ---- 端到端串联 ③：任意结果 → 量纲校验台 ----
const p3 = B.publish('demo', '某视在功率', 50, 'kVA');
B.requestFill(p3, 'unit-guard');
const m3 = renderModule('unit-guard');
has('串联③：量纲校验台显示已引用', txt(m3.body), '已引用');

// ---- 模块元数据 ----
eq('声明 accepts 的接收方 ≥ 6 个', B.targets().length >= 6, true);
eq('结果上限为 12', B.LIMIT, 12);

// ---- 本地测试记录 ----
R.clear();
const rec = R.add({ type: '批量计算', title: '三相功率模板', rows: 3, ok: 2, csv: 'a,b\n1,2', tpl: 'p3' });
eq('新增记录后 1 条', R.all().length, 1);
eq('stats.rows 累计 3', R.stats().rows, 3);
eq('stats.ok 累计 2', R.stats().ok, 2);
eq('可按 id 取回', R.get(rec.id).title, '三相功率模板');
R.remove(rec.id);
eq('删除后 0 条', R.all().length, 0);
R.add({ title: 'A', rows: 1, ok: 1 });
R.add({ title: 'B', rows: 2, ok: 2 });
eq('可存多条', R.all().length, 2);
R.clear();
eq('清空后 0 条', R.all().length, 0);

B.clear();
console.log('\n通过:', pass, '  失败:', fail);
process.exit(fail ? 1 : 0);
