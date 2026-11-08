// 电费估算：支持单一电价、峰谷电价与阶梯电价三种计费方式
(function () {
  const T = TB.util;
  TB.register({
    id: 'elec-cost', name: '电费估算', category: '电力计算',
    desc: '按月用电量估算电费，支持单一电价、峰谷电价与阶梯电价（居民/一般工商业常用）三种计费方式。',
    render(c) {
      function fld(label, val, unit) {
        const inp = T.el('input', { type: 'number', value: val, step: 'any' });
        return { wrap: T.el('div', { class: 'field' }, [T.el('label', { text: label }), inp, unit ? T.el('span', { class: 'suffix', text: unit }) : null]), inp };
      }
      const mode = T.el('select', {}, [
        T.el('option', { value: 'single', text: '单一电价' }),
        T.el('option', { value: 'peak', text: '峰谷电价' }),
        T.el('option', { value: 'tiered', text: '阶梯电价' })
      ]);
      const modeWrap = T.el('div', { class: 'field' }, [T.el('label', { text: '计费方式' }), mode]);
      const kwh = fld('月用电量', '800', 'kWh');
      // 单一
      const sp = fld('单价', '0.65', '元/kWh');
      // 峰谷
      const pk = fld('峰段占比', '40', '%');
      const pp = fld('峰段电价', '1.00', '元');
      const vp = fld('谷段电价', '0.35', '元');
      // 阶梯
      const p1 = fld('一档电价', '0.55', '元');
      const p2 = fld('二档电价', '0.60', '元');
      const p3 = fld('三档电价', '0.85', '元');
      const t1 = fld('一档上限', '2160', 'kWh');
      const t2 = fld('二档上限', '4800', 'kWh');
      const out = T.el('div', {});

      const singleGrp = T.el('div', { class: 'form-grid' }, [sp.wrap]);
      const peakGrp = T.el('div', { class: 'form-grid' }, [pk.wrap, pp.wrap, vp.wrap]);
      const tierGrp = T.el('div', { class: 'form-grid' }, [p1.wrap, p2.wrap, p3.wrap, t1.wrap, t2.wrap]);

      function showGroups() {
        singleGrp.style.display = mode.value === 'single' ? '' : 'none';
        peakGrp.style.display = mode.value === 'peak' ? '' : 'none';
        tierGrp.style.display = mode.value === 'tiered' ? '' : 'none';
      }
      function calc() {
        const K = +kwh.inp.value;
        out.innerHTML = '';
        if (!isFinite(K) || K < 0) { out.appendChild(T.el('div', { class: 'error', text: '请输入有效的月用电量。' })); return; }
        let cost, note;
        if (mode.value === 'single') {
          const r = +sp.inp.value; cost = K * r; note = '单一电价 ' + r + ' 元/kWh';
        } else if (mode.value === 'peak') {
          const f = +pk.inp.value / 100, r1 = +pp.inp.value, r2 = +vp.inp.value;
          if (![f, r1, r2].every(isFinite)) { out.appendChild(T.el('div', { class: 'error', text: '请检查峰谷电价输入。' })); return; }
          cost = K * (f * r1 + (1 - f) * r2); note = '峰 ' + (f * 100).toFixed(0) + '%×' + r1 + ' + 谷 ' + ((1 - f) * 100).toFixed(0) + '%×' + r2;
        } else {
          const a = +p1.inp.value, b = +p2.inp.value, d = +p3.inp.value, A = +t1.inp.value, B = +t2.inp.value;
          if (![a, b, d, A, B].every(isFinite)) { out.appendChild(T.el('div', { class: 'error', text: '请检查阶梯电价输入。' })); return; }
          let rem = K, c = 0, seg = [];
          const s1 = Math.min(rem, A); c += s1 * a; rem -= s1; seg.push([s1, a]);
          if (rem > 0) { const s2 = Math.min(rem, B - A); c += s2 * b; rem -= s2; seg.push([s2, b]); }
          if (rem > 0) { c += rem * d; seg.push([rem, d]); }
          cost = c; note = '阶梯：' + seg.filter(s => s[0] > 0).map(s => s[0].toFixed(0) + '×' + s[1]).join(' + ');
        }
        const box = T.el('div', { class: 'result-box' }, [
          T.el('div', { class: 'big', text: '¥ ' + cost.toFixed(2) }),
          T.el('div', { class: 'hint', text: '预估月电费（' + note + '），等效单价 ' + (cost / K).toFixed(3) + ' 元/kWh' })
        ]);
        out.appendChild(box);
      }
      mode.addEventListener('change', () => { showGroups(); calc(); });
      [kwh.inp, sp.inp, pk.inp, pp.inp, vp.inp, p1.inp, p2.inp, p3.inp, t1.inp, t2.inp].forEach(e => e.addEventListener('input', calc));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '电费估算' }),
        T.el('div', { class: 'form-grid' }, [modeWrap, kwh.wrap]),
        singleGrp, peakGrp, tierGrp, out
      ]));
      showGroups(); calc();
    }
  });
})();
