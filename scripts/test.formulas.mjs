// 数值回归测试（golden cases）：计算类模块必须用标准答案验证，而不只是「渲染不报错」。
// 电力/电工公式算错的代价远高于界面问题，因此这里逐项断言真实数值。
import { installDOM, loadAllScripts, Node, textOf, inputs, setInp, findAll, findId } from './dom-stub.mjs';

installDOM();
loadAllScripts();
const TB = globalThis.TB;

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = typeof want === 'boolean' ? !!got === want : String(got).includes(String(want));
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok ? '' : '  got=' + String(got).slice(0, 120) + '  want=' + want));
  ok ? pass++ : fail++;
}
function bodyText(body) { return textOf(body).replace(/\s+/g, ' ').trim(); }
function render(id) {
  const m = TB.modules.find(x => x.id === id);
  if (!m) throw new Error('module not found: ' + id);
  const body = new Node('main'), aside = new Node('div');
  m.render(body, { aside });
  return { m, body, aside, text: bodyText(body) };
}
function setByOrder(body, vals) {
  const list = inputs(body).filter(n => n.tagName === 'INPUT' || n.tagName === 'SELECT');
  vals.forEach((v, i) => {
    if (!list[i]) return;
    list[i].value = String(v);
    list[i].dispatchEvent({ type: 'input' });
    list[i].dispatchEvent({ type: 'change' });
  });
  return bodyText(body);
}
function caseOf(id, want, label) {
  const r = render(id);
  check(label || (id + ' 默认值'), r.text, want);
  return r;
}

// ---- 电力计算 ----
caseOf('power-factor', '42.13', '功率因数补偿 Qc');
caseOf('cable-drop', '6.33', '电缆压降 ΔU%');
caseOf('pv-array', '110.00', '光伏阵列总功率 kWp');
caseOf('battery', '58 Ah', '储能电池容量 Ah');
caseOf('elec-cost', '440.00', '阶梯电费 ¥');
{
  const r = render('power-factor');
  setInp(r.body, 'pf_p', 200); setInp(r.body, 'pf_c1', 0.8); setInp(r.body, 'pf_c2', 0.95);
  // Qc 与 P 成正比：100 kW → 42.13，200 kW → 84.26
  check('功率因数线性倍增 200kW', bodyText(r.body), '84.26');
}

// ---- 高压电工 ----
caseOf('hv-transformer', '1154.7', '变压器二次额定电流 A');
caseOf('hv-transformer', '46.2', '变压器一次额定电流 A');
caseOf('hv-motor', '99.8', '电机额定电流 A');
caseOf('hv-reactance', '31.42', '50Hz/100mH 感抗 Ω');
caseOf('hv-safety', '0.70', '10kV 不停电安全距离 m');
caseOf('hv-ampacity', '≈ 100 A', '25mm² 铝芯载流量估算');
caseOf('hv-cheatsheet', '公式', '高压电工公式速查卡');

// ---- 基础计算器 / 日常工具 ----
{
  const r = render('fraction');
  const sel = findAll(r.body, n => n.tagName === 'SELECT')[0];
  if (sel) { sel.value = '+'; sel.dispatchEvent({ type: 'change' }); }
  setInp(r.body, 'a1', 1); setInp(r.body, 'b1', 2); setInp(r.body, 'a2', 1); setInp(r.body, 'b2', 3);
  check('分数 1/2 + 1/3 = 5/6', bodyText(r.body), '5/6');
}
caseOf('income-tax', '7,880', '个税应纳税额 元');
caseOf('income-tax', '10%', '个税适用税率');
caseOf('mortgage', '6,277.78', '等额本金首月月供 元');
caseOf('bmi', '22.5', 'BMI 170cm/65kg');
caseOf('geometry', '3.1416', '圆面积 r=1');
caseOf('unit-converter', '0.001', '1 米 → 0.001 千米');
caseOf('datecalc', '0 天', '同日相差天数');

// ---- 编解码 / 协议（有确定标准答案的部分）----
caseOf('checksum', '0xAD0C', 'CRC16-MODBUS 标准帧');
caseOf('chmod', '755', 'rwxr-xr-x → 755');
caseOf('modbus', 'CRC16', 'Modbus RTU 帧 CRC 校验');
caseOf('base-convert', '6699', '0x1A2B → 十进制 6699');
{
  const r = render('endian');
  check('字节序 uint32 大端 = 16909060', r.text, '16909060');
  check('字节序 uint32 小端 = 67305985', r.text, '67305985');
  check('字节序不再报 DataView 错误', !r.text.includes('错误'), true);
}
{
  const r = render('dlt645');
  check('DL/T645 渲染无 undefined 错误', !r.text.includes('undefined') && !r.text.includes('错误'), true);
}

// ---- 公式出处元数据：所有电力/电工模块必须标注依据 ----
const needRefs = TB.modules.filter(m => m.category === '电力计算' || m.category === '高压电工');
let refsOk = 0;
for (const m of needRefs) {
  if (Array.isArray(m.refs) && m.refs.length >= 2) refsOk++;
  else console.log('  ✗ 缺少公式出处:', m.id);
}
check('电力计算/高压电工模块均标注公式依据 (' + refsOk + '/' + needRefs.length + ')', refsOk === needRefs.length, true);

// ---- 注册表健康度 ----
check('模块 id 唯一', new Set(TB.modules.map(m => m.id)).size === TB.modules.length, true);
check('计算类模块均有 desc', TB.modules.filter(m => !m.desc).length === 0, true);

// ---- v0.1.0 新增模块的标准答案 ----
{
  const r = render('batch-calc');
  check('批量计算台 三相功率 400V/10A/0.8 → 5.5426 kW', r.text, '5.5426');
  check('批量计算台 3 行全部计算成功', r.text, '3 / 3');
}
{
  const r = render('device-bridge');
  const hex = findId(r.body, 'db_hex');
  check('设备联调 默认 Modbus TCP 读保持寄存器帧', hex ? hex.value : '', '00 01 00 00 00 06 01 03 00 00 00 0A');
}
{
  const r = render('crontab');
  check('crontab 默认表达式 */5', r.text, '*/5 * * * *');
  check('crontab 推算未来执行时间', r.text, '未来 5 次执行');
}
{
  const r = render('sql-ddl');
  check('SQL 建表语句生成', r.text, 'CREATE TABLE');
  check('SQL 建表字段保留', r.text, 'device_id');
}
{
  const r = render('sql-format');
  check('SQL 格式化关键字大写', r.text, 'SELECT');
  check('SQL 格式化子句换行', r.text, 'FROM');
}
{
  const r = render('endian');
  check('字节序模块回归（修复后）', r.text.includes('16909060'), true);
}

// ---- v0.2.0：适用边界元数据 + 跨工具接收能力 ----
const needLimits = TB.modules.filter(m => m.category === '电力计算' || m.category === '高压电工');
let limOk = 0;
for (const m of needLimits) {
  if (Array.isArray(m.limits) && m.limits.length >= 3) limOk++;
  else console.log('  ✗ 缺少适用边界:', m.id);
}
check('电力/高压模块均标注适用边界 (' + limOk + '/' + needLimits.length + ')', limOk === needLimits.length, true);
const receivers = TB.modules.filter(m => Array.isArray(m.accepts) && m.accepts.length);
check('声明跨工具接收能力的模块 ≥ 6 (' + receivers.length + ')', receivers.length >= 6, true);

// ---- v0.2.0：新模块标准答案 ----
{
  const r = render('unit-guard');
  check('量纲校验台 1 kV = 1000 V', r.text, '1000.00 V');
  check('量纲校验台 P/Q 合成 5 kVA', r.text, '5.0000 kVA');
  check('量纲校验台 cosφ = 0.6', r.text, '0.6000');
  check('量纲校验台含 kW+kvar 陷阱', r.text, 'kW + kvar');
}
{
  const r = render('hv-tables');
  check('工程标准数据表 25mm² 铜芯 105 A', r.text, '105.0 A');
  check('工程标准数据表含边界警告', r.text, '不得直接');
  check('工程标准数据表含标准出处', r.m.refs.join(' '), 'GB/T 16895.15');
  setInp(r.body, 'ht_x', 50);
  check('工程标准数据表 50mm² 插值', bodyText(r.body), '160.0 A');
}
{
  const r = render('test-records');
  check('测试记录空状态提示', r.text, '暂无记录');
}
{
  const r = render('batch-calc');
  check('批量计算台趋势曲线（SVG 轴标签）', r.text, '行号 1 →');
  check('批量计算台含 Excel / PDF 导出按钮', r.text, '导出 Excel');
}

console.log('\n通过:', pass, '  失败:', fail);
process.exit(fail ? 1 : 0);
