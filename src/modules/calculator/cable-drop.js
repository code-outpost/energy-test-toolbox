// 电缆压降 / 载流量估算：低压配电常用公式，校验压降率并给出参考载流量
(function () {
  const T = TB.util;
  const AMPS = [[1.5, 18], [2.5, 25], [4, 32], [6, 40], [10, 55], [16, 75], [25, 95], [35, 120], [50, 145], [70, 185], [95, 225], [120, 260], [150, 300], [185, 345], [240, 410]];
  function ampacity(s, al) {
    let v = AMPS[0][1];
    for (const [ss, aa] of AMPS) { if (s >= ss) v = aa; }
    return Math.round(v * (al ? 0.78 : 1));
  }
  TB.register({
    id: 'cable-drop', name: '电缆压降/载流量', category: '电力计算',
    desc: '输入功率、距离、截面与材料，计算线路电流、压降与压降率，并校验是否达标，附铜/铝参考载流量。',
    refs: ["三相线路压降 ΔU% = √3·I·(R·cosφ + X·sinφ)·L/U；本工具按简化电阻模型估算","导线直流电阻 R = ρ·L/S，铜 20℃ 时 ρ≈0.0175 Ω·mm²/m","电压偏差限值见 GB 50054《低压配电设计规范》，以现行版本为准"],
    render(c) {
      function fld(label, val, unit) {
        const inp = T.el('input', { type: 'number', value: val, step: 'any' });
        return { wrap: T.el('div', { class: 'field' }, [T.el('label', { text: label }), inp, unit ? T.el('span', { class: 'suffix', text: unit }) : null]), inp };
      }
      const u = fld('系统电压 U', '400', 'V');
      const p = fld('负载功率 P', '30', 'kW');
      const pf = fld('功率因数 cosφ', '0.85', '');
      const l = fld('电缆长度 L', '150', 'm');
      const s = fld('截面积 S', '16', 'mm²');
      const mat = T.el('select', {}, [T.el('option', { value: 'cu', text: '铜 Cu' }), T.el('option', { value: 'al', text: '铝 Al' })]);
      const ph = T.el('select', {}, [T.el('option', { value: '3', text: '三相' }), T.el('option', { value: '1', text: '单相' })]);
      const allow = fld('允许压降率', '5', '%');
      const matWrap = T.el('div', { class: 'field' }, [T.el('label', { text: '导体材料' }), mat]);
      const phWrap = T.el('div', { class: 'field' }, [T.el('label', { text: '相数' }), ph]);
      const out = T.el('div', {});

      function calc() {
        const U = +u.inp.value, P = +p.inp.value, cosf = +pf.inp.value, L = +l.inp.value, S = +s.inp.value, a = +allow.inp.value;
        out.innerHTML = '';
        if (![U, P, cosf, L, S, a].every(isFinite) || cosf <= 0 || cosf > 1 || S <= 0) {
          out.appendChild(T.el('div', { class: 'error', text: '请检查输入：电压/功率/截面>0，0<cosφ≤1。' })); return;
        }
        const is3 = ph.value === '3';
        const I = is3 ? P * 1000 / (Math.sqrt(3) * U * cosf) : P * 1000 / (U * cosf);
        const rho = mat.value === 'al' ? 0.0283 : 0.0172;
        const R = rho * L / S;
        const X = 0.08 * L / 1000;
        const sinf = Math.sqrt(1 - cosf * cosf);
        const dU = (is3 ? Math.sqrt(3) : 2) * I * (R * cosf + X * sinf);
        const dUpct = dU / U * 100;
        const amp = ampacity(S, mat.value === 'al');
        const ok = dUpct <= a;
        const box = T.el('div', { class: 'result-box' }, [
          T.el('div', { class: 'big', text: dUpct.toFixed(2) + ' %' }),
          T.el('div', { class: 'hint', text: '压降 ΔU = ' + dU.toFixed(2) + ' V（' + (ok ? '✓ 满足 ≤' + a + '%' : '✗ 超出 ≤' + a + '%') + '）' })
        ]);
        box.style.background = ok ? 'var(--success-soft)' : 'var(--danger-soft)';
        box.style.borderColor = ok ? 'var(--success)' : 'var(--danger)';
        const tbl = T.el('table', {}, [
          T.el('tr', {}, [T.el('th', { text: '项目' }), T.el('th', { text: '数值' })]),
          T.el('tr', {}, [T.el('td', { text: '计算电流 I' }), T.el('td', { text: I.toFixed(1) + ' A' })]),
          T.el('tr', {}, [T.el('td', { text: '导线电阻 R' }), T.el('td', { text: R.toFixed(4) + ' Ω' })]),
          T.el('tr', {}, [T.el('td', { text: '参考载流量' }), T.el('td', { text: amp + ' A（' + (mat.value === 'al' ? '铝' : '铜') + '芯 PVC）' })]),
          T.el('tr', {}, [T.el('td', { text: '载流量裕度' }), T.el('td', { text: (I <= amp ? '✓ 满足' : '✗ 偏载，建议加大截面') })]),
          T.el('tr', {}, [T.el('td', { text: '推荐最小截面' }), T.el('td', { text: ok ? S + ' mm² 可用' : '建议 ≥ ' + (Math.ceil(S * dUpct / a)) + ' mm²' })])
        ]);
        out.appendChild(box); out.appendChild(tbl);
      }
      [u.inp, p.inp, pf.inp, l.inp, s.inp, allow.inp].forEach(e => e.addEventListener('input', calc));
      [mat, ph].forEach(e => e.addEventListener('change', calc));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '电缆压降 / 载流量估算' }),
        T.el('div', { class: 'form-grid' }, [u.wrap, p.wrap, pf.wrap, l.wrap, s.wrap, allow.wrap, matWrap, phWrap]),
        out
      ]));
      calc();
    }
  });
})();
