// 分数计算器：两个分数 + − × ÷，结果化简为最简分数、带分数与小数
(function () {
  const T = TB.util;
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
  function neg(n) { return n < 0 ? -n : n; }
  TB.register({
    id: 'fraction', name: '分数计算器', category: '计算器',
    desc: '输入两个分数与运算符，计算结果并化简为最简分数、带分数与小数形式。',
    render(c) {
      function num(id, val) { return T.el('input', { type: 'number', value: val, step: 'any', id: id }); }
      const a1 = num('a1', '1'), b1 = num('b1', '2'), a2 = num('a2', '1'), b2 = num('b2', '3');
      const op = T.el('select', {}, ['+', '−', '×', '÷'].map(o => T.el('option', { value: o, text: o })));
      const out = T.el('div', {});
      function calc() {
        const A1 = +a1.value, B1 = +b1.value, A2 = +a2.value, B2 = +b2.value;
        out.innerHTML = '';
        if (![A1, B1, A2, B2].every(isFinite) || B1 === 0 || B2 === 0) { out.appendChild(T.el('div', { class: 'error', text: '请输入有效分数（分母不为 0）。' })); return; }
        const o = op.value, s = A1 * B2, t = B1 * A2;       // a1/b1 ± a2/b2 通分
        let nume, den;
        if (o === '+') { nume = s + t; den = B1 * B2; }
        else if (o === '−') { nume = s - t; den = B1 * B2; }
        else if (o === '×') { nume = A1 * A2; den = B1 * B2; }
        else { nume = A1 * B2; den = B1 * A2; }
        if (den < 0) { nume = -nume; den = -den; }
        const g = gcd(nume, den); const rn = nume / g, rd = den / g;
        const dec = (nume / den);
        const whole = Math.trunc(rn / rd), rem = rn - whole * rd;
        const mixed = (whole !== 0) ? (whole + (rem !== 0 ? ' ' + neg(rem) + '/' + rd : '')) : (rn + '/' + rd);
        const box = T.el('div', { class: 'result-box' }, [
          T.el('div', { class: 'big', text: rn + '/' + rd }),
          T.el('div', { class: 'hint', text: '小数 ' + (Math.round(dec * 1e6) / 1e6) + '　|　带分数 ' + mixed })
        ]);
        out.appendChild(box);
        out.appendChild(T.el('div', { class: 'kv' }, [
          T.el('div', { class: 'k', text: '通分过程' }),
          T.el('div', { class: 'v', text: '(' + A1 + '/' + B1 + ') ' + o + ' (' + A2 + '/' + B2 + ') = (' + nume + ')/(' + den + ') → 约分 ÷' + g })
        ]));
      }
      [a1, b1, a2, b2].forEach(e => e.addEventListener('input', calc));
      op.addEventListener('change', calc);
      const grid = T.el('div', { class: 'row', style: 'align-items:flex-end;gap:10px' }, [
        T.el('div', { class: 'field', style: 'flex:1' }, [T.el('label', { text: '分数 1' }), T.el('div', { class: 'row' }, [a1, T.el('span', { text: '/' }), b1])]),
        op,
        T.el('div', { class: 'field', style: 'flex:1' }, [T.el('label', { text: '分数 2' }), T.el('div', { class: 'row' }, [a2, T.el('span', { text: '/' }), b2])])
      ]);
      c.appendChild(T.el('div', { class: 'card' }, [T.el('h3', { text: '分数计算器' }), grid, out]));
      calc();
    }
  });
})();
