// 导线载流量口诀估算（铝/铜芯绝缘线）
(function () {
  const T = TB.util;
  const SECTIONS = [1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300];
  function alumMul(s) {
    if (s <= 10) return 5;
    if (s <= 25) return 4;
    if (s <= 50) return 3;
    if (s <= 95) return 2.5;
    return 2;
  }
  function nextUp(s) { for (const x of SECTIONS) if (x > s + 1e-9) return x; return SECTIONS[SECTIONS.length - 1]; }
  TB.register({
    id: 'hv-ampacity', name: '导线载流量口诀', category: '高压电工',
    desc: '按经典口诀估算绝缘导线载流量：10下五、100上二、25/35四三界、70/95两倍半；并支持穿管八折、高温九折、裸线加一半、铜线升级算。',
    tips: ['口诀：10下五，100上二，25、35四三界，70、95两倍半', '穿管 ×0.8，高温 ×0.9，裸线 ×1.5，铜线升级算', '结果为估算值，实际以载流量表/设计手册为准', '适用于聚氯乙烯/橡皮绝缘铜铝线明敷常温估算'],
    ref: [{ k: '基准', v: '截面×倍数（铝）' }, { k: '铜线', v: '按大一级铝线算' }],
    render(c) {
      function fld(label, val, unit, id) {
        const inp = T.el('input', { type: 'number', value: val, step: 'any', id: id });
        return { wrap: T.el('div', { class: 'field' }, [T.el('label', { text: label }), inp, unit ? T.el('span', { class: 'suffix', text: unit }) : null]), inp };
      }
      const s = fld('导线截面 S', '25', 'mm²', 'am_s');
      const mat = T.el('select', {}, [T.el('option', { value: 'cu', text: '铜芯' }), T.el('option', { value: 'al', text: '铝芯' })]);
      const lay = T.el('select', {}, [T.el('option', { value: 'open', text: '明敷' }), T.el('option', { value: 'pipe', text: '穿管' })]);
      const temp = T.el('select', {}, [T.el('option', { value: 'n', text: '常温(≤35℃)' }), T.el('option', { value: 'h', text: '高温(>35℃)' })]);
      const bare = T.el('select', {}, [T.el('option', { value: 'no', text: '绝缘线' }), T.el('option', { value: 'yes', text: '裸线' })]);

      const out = T.el('div', {});
      function calc() {
        const S = parseFloat(s.inp.value);
        out.innerHTML = '';
        if (!isFinite(S) || S <= 0) { out.appendChild(T.el('div', { class: 'error', text: '截面需为正数(mm²)。' })); return; }
        const isCu = mat.value === 'cu';
        const effS = isCu ? nextUp(S) : S;
        let amp = effS * alumMul(effS);
        const steps = ['基准(铝)：' + effS + 'mm² × ' + alumMul(effS) + ' = ' + amp.toFixed(0) + ' A'];
        if (isCu) steps.push('铜线升级：按铝 ' + effS + 'mm² 选取');
        if (lay.value === 'pipe') { amp *= 0.8; steps.push('穿管八折：×0.8'); }
        if (temp.value === 'h') { amp *= 0.9; steps.push('高温九折：×0.9'); }
        if (bare.value === 'yes') { amp *= 1.5; steps.push('裸线加一半：×1.5'); }
        out.appendChild(T.el('div', { class: 'result-box' }, [
          T.el('div', { class: 'big', text: '≈ ' + amp.toFixed(0) + ' A' }),
          T.el('div', { class: 'hint', text: '估算载流量（' + (isCu ? '铜芯' : '铝芯') + '）' })
        ]));
        out.appendChild(T.el('div', { class: 'hint' }, steps.map(t => T.el('div', { text: '· ' + t }))));
      }
      [s.inp, mat, lay, temp, bare].forEach(e => e.addEventListener('input', calc));
      [mat, lay, temp, bare].forEach(e => e.addEventListener('change', calc));
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '导线载流量口诀估算' }),
        T.el('div', { class: 'form-grid' }, [
          s.wrap,
          T.el('div', { class: 'field' }, [T.el('label', { text: '材质' }), mat]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '敷设' }), lay]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '环境温度' }), temp]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '线型' }), bare])
        ]),
        out
      ]));
      calc();
    }
  });
})();
