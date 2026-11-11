// v0.4.0 回归：MODBUS TCP/RTU 报文发送计算（组包 / CRC / MBAP / 编码解码 / 工程值）
// 以及 IEC 104 解析器的 U/S 帧与 TI=13 联动修复。
import { installDOM, loadAllScripts, renderModule, findId, findTag, findAll, textOf, setInp } from './dom-stub.mjs';

installDOM();
loadAllScripts();
const TB = globalThis.TB;
const M = TB.modbustcp;

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

console.log('\n--- HEX 与 CRC16 ---');
eq('HEX 空格分隔', M.hx(M.parseHex('00 01 0A FF')), '00 01 0A FF');
eq('HEX 0x 前缀', M.hx(M.parseHex('0x01,0x03,0x00')), '01 03 00');
eq('HEX 连续字符串', M.hx(M.parseHex('68040100')), '68 04 01 00');
eq('非法字符被过滤', M.hx(M.parseHex('01 ZZ 03')), '01 03');
const req = [0x01, 0x03, 0x00, 0x00, 0x00, 0x0A];
eq('CRC16 已知向量 01 03 00 00 00 0A', M.crc16(req).toString(16).toUpperCase(), 'CDC5');
eq('追加 CRC 低字节在前', M.hx(M.appendCrc(req)), '01 03 00 00 00 0A C5 CD');
eq('CRC16 自洽（整帧前缀）', M.crc16(M.appendCrc(req).slice(0, -2)), M.crc16(req));

console.log('\n--- 请求组包（TCP / RTU） ---');
const t3 = M.build({ mode: 'tcp', func: 3, addr: 0, count: 10, tid: 1, uid: 1 });
ok('读保持寄存器组包成功', t3.ok);
eq('TCP 请求 HEX', t3.hex, '00 01 00 00 00 06 01 03 00 00 00 0A');
eq('MBAP 长度 = UID + PDU', t3.bytes[5], 6);
eq('预期响应 PDU 长度', t3.expect, 22);
const r3 = M.build({ mode: 'rtu', func: 3, addr: 0, count: 10, slave: 1 });
eq('RTU 请求 HEX', r3.hex, '01 03 00 00 00 0A C5 CD');
const t1 = M.build({ mode: 'tcp', func: 1, addr: 5, count: 8, tid: 2, uid: 3 });
eq('读线圈 MBAP', M.hx(t1.bytes.slice(0, 7)), '00 02 00 00 00 06 03');
eq('读线圈预期响应', t1.expect, 3);
const w5 = M.build({ mode: 'tcp', func: 5, addr: 0, values: '1', tid: 1, uid: 1 });
has('写单线圈 ON = FF00', w5.hex, 'FF 00');
has('写单线圈 OFF = 0000', M.build({ mode: 'tcp', func: 5, addr: 0, values: '0' }).hex, '00 00');
const w6 = M.build({ mode: 'tcp', func: 6, addr: 10, values: '25', type: 'uint16', scale: '0.1', offset: '0' });
has('写单寄存器按系数反算原码 250', w6.hex, '00 FA');
has('写单寄存器地址 0x000A', w6.hex, '00 0A');
const w15 = M.build({ mode: 'tcp', func: 15, addr: 0, values: '1,0,1,1' });
has('写多线圈位打包 0x0D', w15.hex, '01 0F 00 00 00 04 01 0D');
const w16 = M.build({ mode: 'tcp', func: 16, addr: 0, values: '100,200', type: 'uint16' });
has('写多寄存器 2 个', w16.hex, '01 10 00 00 00 02 04 00 64 00 C8');
ok('非法功能码被拒绝', !M.build({ func: 99 }).ok);
ok('读数量超限被拒绝', !M.build({ func: 3, count: 200 }).ok);
ok('无效写入值被拒绝', !M.build({ func: 6, values: 'abc' }).ok);
ok('负 uint16 被拒绝', !M.build({ func: 6, values: '-1' }).ok);

console.log('\n--- 帧解析（含 MBAP 长度修复） ---');
const respTCP = [0x00, 0x01, 0x00, 0x00, 0x00, 0x07, 0x01, 0x03, 0x04, 0x00, 0x0A, 0x01, 0x2C];
const pr = M.parse(respTCP, 'tcp');
ok('合法 TCP 响应解析成功（旧版会误判长度）', pr.ok);
eq('事务 ID', pr.tid, 1);
eq('MBAP 长度', pr.len, 7);
eq('单元 ID', pr.uid, 1);
eq('功能码', pr.func, 3);
eq('数据区', M.hx(pr.data), '04 00 0A 01 2C');
const badLen = M.parse(respTCP.slice(0, 5).concat([0x08], respTCP.slice(6)), 'tcp');
ok('长度字段不符被拒绝', !badLen.ok);
has('错误信息给出应有长度', badLen.err, '应为 7');
const badPid = M.parse([0, 1, 0, 1].concat(respTCP.slice(4)), 'tcp');
ok('协议标识非 0 被拒绝', !badPid.ok);
const prRtu = M.parse(M.parseHex('01 03 04 00 0A 01 2C DA 7C'), 'rtu');
ok('RTU 帧解析成功', prRtu.ok);
eq('RTU CRC 正确', prRtu.crcOk, true);
eq('RTU 从站地址', prRtu.addr, 1);
const exc = M.parse([0, 1, 0, 0, 0, 3, 1, 0x83, 2], 'tcp');
ok('异常响应可解析', exc.ok);
eq('异常码', M.responseValues(exc).code, 2);

console.log('\n--- 值编码 / 解码 / 工程值换算 ---');
const regs = M.encodeValue(123.45, 'float32', 'AB', 1, 0);
eq('float32 编码寄存器数', regs.length, 2);
const back = M.decodeNumbers(regs, 'float32', 'AB');
ok('float32 往返一致', Math.abs(back[0] - 123.45) < 0.0001);
for (const ord of ['AB', 'CD', 'BADC', 'CDAB']) {
  const r = M.encodeValue(123.45, 'float32', ord, 1, 0);
  const d = M.decodeNumbers(r, 'float32', ord);
  ok('字节序 ' + ord + ' 编解码自洽', Math.abs(d[0] - 123.45) < 0.0001);
}
eq('int16 编码 -5', M.hx(M.encodeValue(-5, 'int16', 'AB', 1, 0).flatMap(x => [(x >> 8) & 255, x & 255])), 'FF FB');
eq('系数反算：工程值 25 / 系数 0.1', M.encodeValue(25, 'uint16', 'AB', 0.1, 0)[0], 250);
eq('偏移反算：工程值 30 / 偏移 10', M.encodeValue(30, 'uint16', 'AB', 1, 10)[0], 20);
const rv = M.responseValues(pr, 'uint16', 'AB', '0.1', '0');
eq('响应寄存器数', rv.regs.length, 2);
eq('寄存器 0 原码', rv.raw[0], 10);
eq('寄存器 1 原码', rv.raw[1], 300);
eq('工程值换算 1', rv.eng[0], 1);
eq('工程值换算 2', rv.eng[1], 30);
// MBAP LEN=4 = UID(1) + FUNC(1) + 数据(2)；数据 = 字节数 01 + 位串 0D
const bits = M.parse([0, 1, 0, 0, 0, 4, 1, 1, 1, 0x0D], 'tcp');
const bv = M.responseValues(bits, 'uint16', 'AB');
eq('线圈位值 bit0', bv.bits[0], 1);
eq('线圈位值 bit1', bv.bits[1], 0);
eq('线圈位值 bit2', bv.bits[2], 1);

console.log('\n--- 模块渲染与联动 ---');
const { body } = renderModule('modbus');
ok('组包结果已渲染', findId(body, 'mb_req_hex') != null);
has('默认读保持寄存器报文', txt(findId(body, 'mb_req_hex')), '00 01 00 00 00 06 01 03 00 00 00 0A');
has('预期响应长度已展示', txt(findId(body, 'mb_req')), '预期响应 PDU');
has('TCP 示例解析成功', txt(findId(body, 'mb_resp_out')), 'MBAP 长度');
has('寄存器解码表', txt(findId(body, 'mb_resp_out')), '工程值');
setInp(body, 'mb_func', '6');
setInp(body, 'mb_values', '25');
setInp(body, 'mb_scale', '0.1');
has('切换到写单寄存器', txt(findId(body, 'mb_req_hex')), '01 06');
clickText(body, '送入设备联调 →');
ok('已暂存待联调报文', !!localStorage.getItem('tb_bridge_frame'));
const saved = JSON.parse(localStorage.getItem('tb_bridge_frame'));
eq('联调模式', saved.mode, 'modbus');

console.log('\n--- IEC 104 解析器联动修复 ---');
const iec = renderModule('iec104');
const ta = findTag(iec.body, 'TEXTAREA');
ok('IEC104 输入框存在', ta != null);
ta.value = '68 04 07 00 00 00';
ta.dispatchEvent({ type: 'input' });
has('U 帧 STARTDT act 正确解码', txt(iec.body), 'STARTDT act');
ta.value = '68 04 01 00 02 00';
ta.dispatchEvent({ type: 'input' });
has('S 帧不再误报 ASDU 过短', txt(iec.body), '帧类型');
eq('S 帧解析无错误', findAll(iec.body, n => (n.className || '').includes('error') && String(n.textContent).includes('ASDU 过短')).length, 0);
const ti13 = [0x68, 18, 0, 0, 0, 0, 13, 1, 3, 0, 1, 0, 1, 0x40, 0, 0, 0, 0, 0, 0];
ta.value = M.hx(ti13);
ta.dispatchEvent({ type: 'input' });
has('TI=13 短浮点可解析', txt(iec.body), '短浮点');

console.log('\n通过: ' + pass + '   失败: ' + fail);
process.exit(fail ? 1 : 0);
