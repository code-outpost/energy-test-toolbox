// 功率因数补偿计算器：根据有功功率与补偿前后功率因数，求需补偿的无功容量与压降电流改善
(function () {
  const T = TB.util;
  TB.register({
    id: 'power-factor', name: '功率因数补偿', category: '电力计算',
    desc: '输入有功功率与补偿前后功率因数，计算需投切的电容容量(kvar)、视在功率与电流下降幅度。',
    accepts: ["active"],
    limits: ["输入范围：P > 0，0 < λ₁ < 1，λ₁ ≤ λ₂ ≤ 1，U > 0","适用边界：三相 / 单相正弦稳态线性负荷，不含谐波、冲击负荷与电容器分组投切细节","示例：100 kW、0.80 → 0.95、400 V ⇒ Qc ≈ 42.13 kvar","警告：电容容量须按标准档位取整，并校核谐波放大、投切涌流与轻载过补偿"],
    refs: ["无功补偿容量 Qc = P·(tanφ₁ − tanφ₂)，依据 GB 50052《供配电系统设计规范》关于功率因数补偿的原则","tanφ = √(1−cos²φ)/cosφ；cosφ 由有功功率与视在功率之比定义","实际补偿容量还需结合变压器容量、谐波与投切分组，以设计文件为准"],
    render(c) {
      function fld(label, val, unit, id) {
        const inp = T.el('input', { type: 'number', value: val, step: 'any', id: id });
        return { wrap: T.el('div', { class: 'field' }, [T.el('label', { text: label }), inp, unit ? T.el('span', { class: 'suffix', text: unit }) : null]), inp };
      }
      const p = fld('有功功率 P', '100', 'kW', 'pf_p');
      const c1 = fld('当前功率因数 λ₁', '0.80', '', 'pf_c1');
      const c2 = fld('目标功率因数 λ₂', '0.95', '', 'pf_c2');
      const u = fld('系统电压 U', '400', 'V', 'pf_u');
      const phase = T.el('select', {}, [T.el('option', { value: '3', text: '三相 380/400V' }), T.el('option', { value: '1', text: '单相 220V' })]);
      const phaseWrap = T.el('div', { class: 'field' }, [T.el('label', { text: '系统类型' }), phase]);

      if (TB.bus) {
        const rr = TB.bus.consume('power-factor', [{ el: p.inp, family: 'active', unit: 'kW', label: '有功功率 P' }]);
        if (rr && rr.filled && TB.toast) TB.toast('已引用「' + rr.label + '」= ' + rr.value + ' ' + rr.unit + ' 填入有功功率 P', 'ok');
      }
      const out = T.el('div', {});
      let last = null;

      function calc() {
        const P = parseFloat(p.inp.value), l1 = parseFloat(c1.inp.value), l2 = parseFloat(c2.inp.value), U = parseFloat(u.inp.value);
        out.innerHTML = '';
        if (![P, l1, l2, U].every(x => isFinite(x)) || l1 <= 0 || l2 <= 0 || l1 >= 1 || l2 > 1 || l2 < l1) {
          out.appendChild(T.el('div', { class: 'error', text: '请检查输入：功率>0，0<λ₁<1，λ₂≤1 且 λ₂≥λ₁。' })); return;
        }
        const tan1 = Math.sqrt(1 - l1 * l1) / l1, tan2 = Math.sqrt(1 - l2 * l2) / l2;
        const Qc = P * (tan1 - tan2);               // kvar
        const S1 = P / l1, S2 = P / l2;             // kVA
        const is3 = phase.value === '3';
        const I1 = is3 ? S1 * 1000 / (Math.sqrt(3) * U) : S1 * 1000 / U;
        const I2 = is3 ? S2 * 1000 / (Math.sqrt(3) * U) : S2 * 1000 / U;
        const savePct = (1 - I2 / I1) * 100;
        const box = T.el('div', { class: 'result-box' }, [
          T.el('div', { class: 'big', text: Qc.toFixed(2) + ' kvar' }),
          T.el('div', { class: 'hint', text: '需补偿的无功容量 Qc = P·(tanφ₁ − tanφ₂)' })
        ]);
        const tbl = T.el('table', {}, [
          T.el('tr', {}, [T.el('th', { text: '项目' }), T.el('th', { text: '补偿前' }), T.el('th', { text: '补偿后' })]),
          T.el('tr', {}, [T.el('td', { text: '视在功率 S' }), T.el('td', { text: S1.toFixed(2) + ' kVA' }), T.el('td', { text: S2.toFixed(2) + ' kVA' })]),
          T.el('tr', {}, [T.el('td', { text: '电流 I' }), T.el('td', { text: I1.toFixed(1) + ' A' }), T.el('td', { text: I2.toFixed(1) + ' A' })])
        ]);
        const note = T.el('div', { class: 'success', text: '线路电流下降约 ' + savePct.toFixed(1) + '%，可选用接近 ' + Math.ceil(Qc) + ' kvar 的电容柜（建议取整档位）。' });
        out.appendChild(box); out.appendChild(tbl); out.appendChild(note);
        last = { P: P, Qc: Qc, S1: S1, S2: S2, I1: I1, I2: I2 };
      }
      function publish() {
        if (!last || !TB.bus) { if (TB.toast) TB.toast('请先输入有效参数完成计算', 'warn'); return; }
        TB.bus.publish('power-factor', '需补偿无功 Qc', Number(last.Qc.toFixed(2)), 'kvar', { note: 'P = ' + last.P + ' kW' });
        TB.bus.publish('power-factor', '补偿前视在功率 S₁', Number(last.S1.toFixed(2)), 'kVA', { note: 'P = ' + last.P + ' kW' });
        TB.bus.publish('power-factor', '补偿前线路电流 I₁', Number(last.I1.toFixed(1)), 'A', { note: 'U = ' + u.inp.value + ' V' });
        if (TB.toast) TB.toast('已发布 3 条结果到「结果中转站」，可在右侧送入其它工具', 'ok');
      }
      [p.inp, c1.inp, c2.inp, u.inp, phase].forEach(e => e.addEventListener('input', calc));
      phase.addEventListener('change', calc);
      const card = T.el('div', { class: 'card' }, [
        T.el('h3', { text: '功率因数补偿计算' }),
        T.el('div', { class: 'form-grid' }, [p.wrap, c1.wrap, c2.wrap, u.wrap, phaseWrap]),
        T.el('div', { class: 'row' }, [T.el('button', { class: 'btn ghost', text: '发布结果（可送入其它工具）', onclick: publish })]),
        out
      ]);
      c.appendChild(card);
      calc();
    }
  });
})();
