// 统一量纲层回归：换算、仿射温标、功率三角形、混用拦截
import { installDOM, loadAllScripts } from './dom-stub.mjs';

installDOM();
loadAllScripts();
const U = globalThis.TB.units;

let pass = 0, fail = 0;
function eq(name, got, want) {
  const ok = String(got) === String(want);
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + '  got=' + got + (ok ? '' : ' want=' + want));
  ok ? pass++ : fail++;
}
function near(name, got, want, tol) {
  const ok = typeof got === 'number' && isFinite(got) && Math.abs(got - want) <= (tol || 1e-6);
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + '  got=' + got + (ok ? '' : ' want≈' + want));
  ok ? pass++ : fail++;
}
function has(name, text, want) {
  const ok = String(text).includes(String(want));
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + '  含「' + want + '」');
  ok ? pass++ : fail++;
}

// ---- 基础换算 ----
near('1 kV → 1000 V', U.convert(1, 'kV', 'V'), 1000);
near('1 kW → 1000 W', U.convert(1, 'kW', 'W'), 1000);
near('1 kVA → 1000 VA', U.convert(1, 'kVA', 'VA'), 1000);
near('1 kWh → 3.6e6 J', U.convert(1, 'kWh', 'J'), 3600000);
near('1 cm² → 100 mm²', U.convert(1, 'cm²', 'mm²'), 100);
near('1 h → 3600 s', U.convert(1, 'h', 's'), 3600);
near('80 % → 0.8', U.toBase(80, '%'), 0.8);
near('0.8 → 80 %', U.fromBase(0.8, '%'), 80);

// ---- 仿射温标（不能按倍数处理）----
near('100 °C → 212 °F', U.convert(100, '°C', '°F'), 212, 1e-9);
near('0 °C → 32 °F', U.convert(0, '°C', '°F'), 32, 1e-9);
near('25 °C → 298.15 K', U.convert(25, '°C', 'K'), 298.15, 1e-9);
near('212 °F → 100 °C', U.convert(212, '°F', '°C'), 100, 1e-9);

// ---- 量纲族与兼容性 ----
eq('kW 与 W 同族', U.compatible('kW', 'W'), true);
eq('kW 与 kvar 不同族', U.compatible('kW', 'kvar'), false);
eq('kVA 与 kW 不同族', U.compatible('kVA', 'kW'), false);
eq('kW → kvar 换算被拒绝', U.convert(1, 'kW', 'kvar'), null);
eq('V → A 换算被拒绝', U.convert(1, 'V', 'A'), null);
has('功率族转换给出解释', U.reason('kW', 'kvar'), '功率三角形');
has('异量纲转换给出解释', U.reason('V', 'A'), '量纲不一致');
eq('familyOf(kvar) = reactive', U.familyOf('kvar'), 'reactive');
eq('未识别单位返回 null', U.familyOf('xyz'), null);

// ---- 功率三角形 ----
const tri = U.powerTriangle(3000, 4000);
near('P=3kW Q=4kvar ⇒ S=5000 VA', tri.S, 5000);
near('cosφ = 0.6', tri.cosPhi, 0.6, 1e-12);
eq('目标 cosφ=0.95 时需补偿 Qc > 3000 var', U.powerTriangle(3000, 4000, 0.95).Qc > 3000, true);

// ---- 校验与求和（结果沿用第一项的单位）----
const r1 = U.check([{ value: 1, unit: 'kV', label: 'A' }, { value: 500, unit: 'V', label: 'B' }]);
near('1 kV + 500 V = 1.5 kV', r1.sum, 1.5);
eq('结果单位 = kV', r1.unit, 'kV');
eq('同族求和通过', r1.ok, true);
const r2 = U.check([{ value: 1, unit: 'kW' }, { value: 500, unit: 'W' }]);
near('1 kW + 500 W = 1.5 kW', r2.sum, 1.5);
const r3 = U.check([{ value: 3, unit: 'kW' }, { value: 4, unit: 'kvar' }]);
eq('kW + kvar 被拦截', r3.ok, false);
has('拦截原因含功率三角形', r3.messages.join(' '), '功率三角形');
has('给出正确合成结果', r3.messages.join(' '), '5.0000 kVA');
near('P/Q 合成三角形 S', r3.triangle.S, 5000);
const r4 = U.check([{ value: 1, unit: 'm' }, { value: 1, unit: 'A' }]);
eq('长度 + 电流被拦截', r4.ok, false);
has('拦截原因含量纲不一致', r4.messages.join(' '), '量纲不一致');
const r5 = U.check([{ value: 1, unit: 'kWh' }, { value: 1, unit: 'kW' }]);
eq('能量 + 功率被拦截', r5.ok, false);

// ---- 元数据完整性 ----
eq('单位族数量 ≥ 15', Object.keys(U.families).length >= 15, true);
eq('allUnits 覆盖所有族', U.allUnits().length >= 45, true);
eq('unitsOf(active) 含 kW', U.unitsOf('active').includes('kW'), true);

console.log('\n通过:', pass, '  失败:', fail);
process.exit(fail ? 1 : 0);
