// 统一量纲层：单位族 → SI 基准换算 → 量纲一致性校验
// 设计要点：有功 P / 无功 Q / 视在功率 S 量纲同为「功率」但物理意义不同，
// 因此拆成独立族，禁止直接相加，必须按功率三角形 S = √(P²+Q²) 合成。
(function () {
  window.TB = window.TB || {};

  // 每个族：label 中文名 / base 基准单位 / dim 量纲符号 / units 换算系数（1 单位 = factor × base）
  // 仿射单位（温度）用 { a, b }：base = a·value + b。
  const F = {
    voltage: { label: '电压', base: 'V', dim: 'U', units: { V: 1, mV: 0.001, kV: 1000, MV: 1e6 } },
    current: { label: '电流', base: 'A', dim: 'I', units: { A: 1, mA: 0.001, kA: 1000 } },
    active: { label: '有功功率', base: 'W', dim: 'P', units: { W: 1, kW: 1000, MW: 1e6, GW: 1e9 } },
    reactive: { label: '无功功率', base: 'var', dim: 'Q', units: { var: 1, kvar: 1000, Mvar: 1e6 } },
    apparent: { label: '视在功率', base: 'VA', dim: 'S', units: { VA: 1, kVA: 1000, MVA: 1e6 } },
    energy: { label: '电能 / 能量', base: 'J', dim: 'E', units: { J: 1, kJ: 1000, Wh: 3600, kWh: 3.6e6, MWh: 3.6e9 } },
    resistance: { label: '电阻 / 阻抗', base: 'Ω', dim: 'R', units: { 'Ω': 1, mΩ: 0.001, kΩ: 1000, MΩ: 1e6 } },
    length: { label: '长度', base: 'm', dim: 'L', units: { m: 1, mm: 0.001, cm: 0.01, km: 1000 } },
    area: { label: '导线截面积', base: 'mm²', dim: 'A²', units: { 'mm²': 1, 'cm²': 100, 'm²': 1e6 } },
    time: { label: '时间', base: 's', dim: 'T', units: { s: 1, ms: 0.001, min: 60, h: 3600, d: 86400 } },
    frequency: { label: '频率', base: 'Hz', dim: 'f', units: { Hz: 1, kHz: 1000, MHz: 1e6 } },
    capacitance: { label: '电容', base: 'F', dim: 'C', units: { F: 1, uF: 1e-6, 'µF': 1e-6, nF: 1e-9, pF: 1e-12 } },
    inductance: { label: '电感', base: 'H', dim: 'Lx', units: { H: 1, mH: 0.001, uH: 1e-6, 'µH': 1e-6 } },
    ratio: { label: '无量纲（比值 / 百分数）', base: '1', dim: '1', units: { '1': 1, '%': 0.01 } },
    temperature: { label: '温度', base: '°C', dim: 'Θ', affine: true, units: { '°C': { a: 1, b: 0 }, '°F': { a: 5 / 9, b: -160 / 9 }, K: { a: 1, b: -273.15 } } }
  };

  function familyOf(unit) {
    if (unit == null) return null;
    const u = String(unit).trim();
    for (const k in F) if (Object.prototype.hasOwnProperty.call(F[k].units, u)) return k;
    return null;
  }
  function info(unit) {
    const k = familyOf(unit);
    return k ? { key: k, label: F[k].label, base: F[k].base, dim: F[k].dim, affine: !!F[k].affine } : null;
  }
  function factor(unit) {
    const k = familyOf(unit);
    if (!k) return null;
    const v = F[k].units[String(unit).trim()];
    return F[k].affine ? v : (typeof v === 'number' ? v : null);
  }
  function toBase(value, unit) {
    const v = Number(value), k = familyOf(unit);
    if (!isFinite(v) || !k) return null;
    const f = F[k].units[String(unit).trim()];
    if (F[k].affine) return f.a * v + f.b;
    return v * f;
  }
  function fromBase(base, unit) {
    const v = Number(base), k = familyOf(unit);
    if (!isFinite(v) || !k) return null;
    const f = F[k].units[String(unit).trim()];
    if (F[k].affine) return (v - f.b) / f.a;
    return v / f;
  }
  // 同族换算；跨族返回 null（用 reason 给出可读解释）
  function convert(value, from, to) {
    const a = toBase(value, from);
    if (a === null) return null;
    if (familyOf(from) !== familyOf(to) || familyOf(to) === null) return null;
    return fromBase(a, to);
  }
  function compatible(a, b) {
    const ka = familyOf(a), kb = familyOf(b);
    return !!ka && ka === kb;
  }
  function reason(from, to) {
    const a = info(from), b = info(to);
    if (!a || !b) return '存在未识别的单位，请从下拉框中选择。';
    if (a.key === b.key) return '';
    const power = ['active', 'reactive', 'apparent'];
    if (power.includes(a.key) && power.includes(b.key)) {
      return a.label + '与' + b.label + '不能直接互换：P / Q / S 需按功率三角形 S = √(P²+Q²) 关联。';
    }
    return '量纲不一致（' + a.label + '[' + a.dim + '] ≠ ' + b.label + '[' + b.dim + ']），不可换算或相加。';
  }

  // 功率三角形：P(W) 与 Q(var) → S(VA)、cosφ、需补偿容量
  function powerTriangle(P, Q, targetCos) {
    if (!isFinite(P) || !isFinite(Q) || P <= 0) return null;
    const S = Math.sqrt(P * P + Q * Q);
    const cos = P / S;
    let Qc = null;
    if (isFinite(targetCos) && targetCos > 0 && targetCos <= 1) {
      const tan2 = Math.sqrt(1 - targetCos * targetCos) / targetCos;
      Qc = P * (Q / P - tan2); // 需补偿容量（可能为负表示过补偿）
    }
    return { P: P, Q: Q, S: S, cosPhi: cos, Qc: Qc };
  }

  // 校验一组 {value, unit, label} 是否可直接求和 / 相加
  function check(items) {
    const list = (items || []).filter(x => x && x.unit !== undefined && x.unit !== null && String(x.unit).trim() !== '' && String(x.value).trim() !== '');
    const messages = [];
    if (!list.length) return { ok: false, level: 'idle', messages: ['请输入至少一项数值与单位。'], sum: null, triangle: null };
    const fams = {};
    let bad = 0;
    list.forEach(x => {
      const k = familyOf(x.unit);
      if (!k) { bad++; messages.push('✗ 未识别单位「' + x.unit + '」（' + (x.label || '未命名') + '）'); return; }
      const b = toBase(x.value, x.unit);
      if (b === null || !isFinite(Number(x.value))) { bad++; messages.push('✗ 数值无效：' + (x.label || '') + ' = ' + x.value); return; }
      (fams[k] = fams[k] || []).push({ label: x.label || x.unit, base: b, unit: x.unit, value: Number(x.value) });
    });
    const keys = Object.keys(fams);
    const power = ['active', 'reactive', 'apparent'];
    const powerKeys = keys.filter(k => power.includes(k));
    if (bad) return { ok: false, level: 'error', messages, sum: null, triangle: null };

    if (powerKeys.length > 1) {
      messages.push('✗ 功率三角形：' + powerKeys.map(k => F[k].label).join(' + ') + ' 不能直接相加。');
      let P = 0, Q = 0, S = 0;
      (fams.active || []).forEach(x => P += x.base);
      (fams.reactive || []).forEach(x => Q += x.base);
      (fams.apparent || []).forEach(x => S += x.base);
      if (P > 0 && Q !== 0) {
        const tri = powerTriangle(P, Q);
        messages.push('✓ 正确做法：S = √(P² + Q²) = ' + (tri.S / 1000).toFixed(4) + ' kVA，cosφ = P/S = ' + tri.cosPhi.toFixed(4));
        messages.push('提示：视在功率 S 由 P、Q 合成，不能与 P 或 Q 直接求和。');
        return { ok: false, level: 'error', messages, sum: null, triangle: tri };
      }
      messages.push('提示：请分别统计有功(kW)、无功(kvar)、视在(kVA)，勿混加。');
      return { ok: false, level: 'error', messages, sum: null, triangle: null };
    }
    if (keys.length > 1) {
      keys.forEach(k => messages.push('· ' + F[k].label + '（' + F[k].dim + '）×' + fams[k].length));
      messages.unshift('✗ 量纲不一致：' + keys.map(k => F[k].label + '[' + F[k].dim + ']').join(' / ') + ' 不能直接相加。');
      return { ok: false, level: 'error', messages, sum: null, triangle: null };
    }
    const k = keys[0];
    const base = fams[k].reduce((s, x) => s + x.base, 0);
    const firstUnit = fams[k][0].unit;
    const sum = fromBase(base, firstUnit);
    const mixed = new Set(fams[k].map(x => x.unit));
    if (mixed.size > 1) messages.push('✓ 同族不同前缀，已统一换算到基准单位 ' + F[k].base + ' 后求和。');
    messages.unshift('✓ 量纲一致：' + F[k].label + '（' + F[k].dim + '），共 ' + fams[k].length + ' 项可相加。');
    if (k === 'active' || k === 'reactive' || k === 'apparent') {
      messages.push('注意：本项仅为同类功率求和；P/Q/S 之间请用「功率三角形」而不是加法。');
    }
    return { ok: true, level: 'ok', messages, sum: sum, unit: firstUnit, triangle: null };
  }

  function allUnits() {
    const a = [];
    for (const k in F) for (const u in F[k].units) a.push({ unit: u, family: k, label: F[k].label, base: F[k].base });
    return a;
  }
  function unitsOf(family) {
    const f = F[family];
    return f ? Object.keys(f.units) : [];
  }
  function fmt(n) {
    if (!isFinite(n)) return '—';
    const a = Math.abs(n);
    if (a !== 0 && (a >= 1e6 || a < 1e-4)) return n.toExponential(4);
    if (a >= 1000) return n.toFixed(2);
    if (a >= 1) return n.toFixed(4);
    return n.toPrecision(5);
  }

  TB.units = {
    families: F, familyOf: familyOf, info: info, toBase: toBase, fromBase: fromBase,
    convert: convert, compatible: compatible, reason: reason, check: check,
    powerTriangle: powerTriangle, allUnits: allUnits, unitsOf: unitsOf, fmt: fmt
  };
})();
