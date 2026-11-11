// v0.4.0 回归：IEC104 四遥点位计算器 —— 点号/IOA 换算、反查、点表检索、ASDU 组包、自定义点表导入
import { installDOM, loadAllScripts, renderModule, findId, findAll, textOf, setInp } from './dom-stub.mjs';

installDOM();
loadAllScripts();
const TB = globalThis.TB;
const C = TB.iec104calc;
const DATA = globalThis.TB_IEC104_POINTS;

let pass = 0, fail = 0;
function eq(name, got, want) {
  const ok = String(got) === String(want);
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + '  got=' + got + (ok ? '' : ' want=' + want));
  ok ? pass++ : fail++;
}
function ok(name, cond) { eq(name, !!cond, true); }
function has(name, text, want) {
  const found = String(text).includes(String(want));
  console.log((found ? '  ✓ ' : '  ✗ ') + name + '  含「' + want + '」');
  found ? pass++ : fail++;
}
function clickText(root, label) {
  const b = findAll(root, n => n.tagName === 'BUTTON' && (n.textContent || '') === label)[0];
  if (!b) throw new Error('找不到按钮：' + label);
  b.dispatchEvent({ type: 'click' });
  return b;
}
const txt = n => textOf(n).replace(/\s+/g, ' ').trim();

console.log('\n--- 内置点表数据 ---');
ok('内置点表已加载', DATA && Array.isArray(DATA.devices));
eq('设备表数量', DATA.devices.length, 40);
eq('点位数', DATA.meta.points, 5561);
eq('遥信基地址', DATA.bases.yx, 1);
eq('遥测基地址', DATA.bases.yc, 0x4001);
eq('遥控基地址', DATA.bases.yk, 0x6001);
eq('遥调基地址', DATA.bases.yt, 0x6201);
eq('信息体地址字节数', DATA.byteCfg.ioa, 3);
eq('文档 TI 遥测', DATA.ti.huawei.yc, 13);
eq('标准 TI 遥测', DATA.ti.standard.yc, 7);
eq('转发设备配置条数', DATA.slaves.length, 7);
eq('SmartLogger 遥测区间', DATA.slaves[0].yc.join('-'), '1-50');
eq('SUN2000(1-1) 遥测起点', DATA.slaves[1].yc[0], 51);
has('SmartLogger-光储 首点', (DATA.devices[0].g.yc[0] || {}).s, '子阵光伏直流总电流');
ok('遥调点位存在', (DATA.devices[0].g.yt || []).length >= 10);

console.log('\n--- 点号 ⇄ IOA 换算 ---');
C.setData(DATA);
eq('遥测点号 1 → IOA', C.ioaOf('yc', 1), 16385);
eq('遥测点号 50 → IOA', C.ioaOf('yc', 50), 16434);
eq('遥信点号 1 → IOA', C.ioaOf('yx', 1), 1);
eq('遥控点号 1 → IOA', C.ioaOf('yk', 1), 24577);
eq('遥调点号 1 → IOA', C.ioaOf('yt', 1), 25089);
eq('非法点号 → null', C.ioaOf('yc', 0), null);
eq('IOA 16385 → 全局点号', C.globalOf('yc', 16385), 1);
eq('IOA 16435 → 全局点号', C.globalOf('yc', 16435), 51);
eq('IOA 反查类别：遥测', C.catOfIoa(0x4001), 'yc');
eq('IOA 反查类别：遥信', C.catOfIoa(0x0001), 'yx');
eq('IOA 反查类别：遥控', C.catOfIoa(0x6001), 'yk');
eq('IOA 反查类别：遥调', C.catOfIoa(0x6201), 'yt');
eq('越界 IOA 0x6401 → null', C.catOfIoa(0x6401), null);
eq('所属设备（遥测 51）', (C.slaveOf('yc', 51) || {}).name, 'SUN2000 (1-1) 已接入');
eq('表内序号（遥测 51）', C.localOf(C.slaveOf('yc', 51), 'yc', 51), 1);
eq('IOA 三字节小端', C.bytesHex(C.ioaBytes(16385)), '01 40 00');
eq('IOA 三字节（遥调）', C.bytesHex(C.ioaBytes(25089)), '01 62 00');
eq('IOA 超 24 位 → null', C.ioaBytes(0x1000000), null);

console.log('\n--- 四遥 ASDU 组包 ---');
const f1 = C.frame({ cat: 'yc', ti: 13, ioa: 16385, ca: 1, cot: 3, value: '123.45' });
ok('遥测帧生成', f1 && f1.bytes.length > 0);
eq('起始字节 0x68', f1.bytes[0], 0x68);
eq('长度 L = 控制域4 + ASDU', f1.bytes[1], f1.bytes.length - 2);
eq('I 帧控制域首字节 bit0=0', f1.bytes[2] & 1, 0);
eq('类型标识', f1.bytes[6], 13);
eq('VSQ = 1 个信息对象', f1.bytes[7], 1);
eq('COT', f1.bytes[8], 3);
eq('CA 低字节', f1.bytes[10], 1);
eq('IOA 三字节', C.bytesHex(f1.bytes.slice(12, 15)), '01 40 00');
const dv = new DataView(new ArrayBuffer(4)); dv.setFloat32(0, 123.45, true);
eq('短浮点小端 4 字节', C.bytesHex(f1.bytes.slice(15, 19)), C.bytesHex(Array.from(new Uint8Array(dv.buffer))));
eq('QDS 品质字节（有效）', f1.bytes[19], 0);
eq('APDU 总长', f1.bytes.length, 20);
has('HEX 以 68 开头', f1.hex, '68');

const f2 = C.frame({ cat: 'yx', ti: 1, ioa: 1, ca: 1, cot: 3, value: '1' });
eq('遥信 SIQ = 1（合）', f2.bytes[15], 1);
eq('遥信帧长度', f2.bytes.length, 16);
const f3 = C.frame({ cat: 'yx', ti: 1, ioa: 1, value: '1', flags: { iv: true } });
eq('遥信 SIQ：合 + IV 无效位', f3.bytes[15], 0x81);
const f4 = C.frame({ cat: 'yk', ti: 45, ioa: 24577, value: '1', flags: { se: true, qu: 0 } });
eq('遥控 SCO：选择+合', f4.bytes[15], 0x81);
const f5 = C.frame({ cat: 'yt', ti: 50, ioa: 25089, value: '-5.5', flags: { se: true } });
eq('遥调 QOS SE 位', f5.bytes[19], 0x80);
eq('遥调 IOA 三字节', C.bytesHex(f5.bytes.slice(12, 15)), '01 62 00');
const f6 = C.frame({ cat: 'yc', ti: 7, ioa: 16385, value: '1' });
eq('标准方案可用 TI=7', f6.bytes[6], 7);
eq('无效数值 → null', C.frame({ cat: 'yc', ti: 13, ioa: 16385, value: 'abc' }), null);

console.log('\n--- 点表检索 ---');
const s1 = C.search('子阵光伏直流总电流');
ok('精确名称可搜到', s1.length >= 1);
has('命中信号名', s1[0].p.s, '子阵光伏直流总电流');
eq('命中 IOA', s1[0].ioa, 16385);
const s2 = C.search('有功功率', { cat: 'yc' });
ok('「有功功率」命中多表', s2.length > 5);
ok('类别过滤生效', s2.every(x => x.cat === 'yc'));
const s3 = C.search('A相电压', { device: 'Modbus电表' });
ok('设备过滤生效', s3.length > 0 && s3.every(x => x.dev === 'Modbus电表'));
eq('无结果查询', C.search('绝不可能存在的信号XYZ').length, 0);
const s4 = C.search('开机', { start: 51 });
eq('起始点号 51 生效', s4.length ? s4[0].global : -1, 51 + (s4.length ? C.search('开机')[0].p.n : 1) - 1);

console.log('\n--- 自定义点表导入（CSV / 扁平 / JSON） ---');
const sectionCSV = [
  '遥测,,,遥信,,,遥控,,',
  '序号,信号名称,单位,序号,信号名称,状态,序号,信号名称,命令',
  '1,A相电压,V,1,通讯故障,0：正常 1：故障,1,开机控制,0：开机',
  '2,B相电压,V,2,过压告警,0：正常 1：告警,,'
].join('\n');
const sec = C.parseCSV(sectionCSV);
ok('四遥分区 CSV 可解析', sec && sec.devices.length === 1);
eq('分区遥测点', sec.devices[0].g.yc.length, 2);
eq('分区遥测首点', sec.devices[0].g.yc[0].s, 'A相电压');
eq('分区遥信状态', sec.devices[0].g.yx[0].x, '0：正常 1：故障');
eq('分区遥控点', sec.devices[0].g.yk.length, 1);
const flatCSV = [
  '类别,序号,信号名称,单位,状态',
  '遥测,1,直流电压,V,',
  '遥信,1,通讯状态,,0：正常 1：故障'
].join('\n');
const flat = C.parseCSV(flatCSV);
ok('扁平 CSV 可解析', flat && flat.devices.length === 1);
eq('扁平遥测点', flat.devices[0].g.yc[0].s, '直流电压');
eq('扁平遥信点', flat.devices[0].g.yx[0].x, '0：正常 1：故障');
const norm = C.setData(sec);
eq('归一化后设备表数', norm.devices.length, 1);
eq('归一化后保留基地址', norm.bases.yc, 0x4001);
eq('归一化后保留 TI', norm.ti.huawei.yc, 13);
C.setData(DATA);

console.log('\n--- 模块渲染与交互 ---');
const { body, aside } = renderModule('iec104-points');
ok('计算器卡片已渲染', findId(body, 'ip_info') != null);
has('点表来源说明', txt(findId(body, 'ip_info')), 'SmartLogger');
has('正向计算显示 IOA', txt(findId(body, 'ip_calc')), '16385');
has('组包结果以 68 开头', txt(findId(body, 'ip_frame_hex')), '68 ');
has('搜索结果表已渲染', txt(findId(body, 'ip_results')), '命中');
has('右侧点表概览', txt(aside), '内置点表概览');

setInp(body, 'ip_local', '2');
has('表内序号 2 → IOA 16386', txt(findId(body, 'ip_calc')), '16386');
setInp(body, 'ip_ioa', '24577');
has('IOA 24577 反查为遥控', txt(findId(body, 'ip_calc')), '遥控');
setInp(body, 'ip_q', '子阵光伏直流总电流');
has('搜索框输入即检索', txt(findId(body, 'ip_results')), '子阵光伏直流总电流');
setInp(body, 'ip_paste', sectionCSV);
clickText(body, '导入粘贴内容');
has('导入后来源更新', txt(findId(body, 'ip_info')), '导入的 CSV');
clickText(body, '恢复内置点表');
has('恢复内置点表', txt(findId(body, 'ip_info')), 'SmartLogger');

console.log('\n通过: ' + pass + '   失败: ' + fail);
process.exit(fail ? 1 : 0);
