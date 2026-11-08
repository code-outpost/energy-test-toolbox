// 随机抽签 / 掷骰子（日常工具）
(function () {
  const T = TB.util;
  TB.register({
    id: 'random', name: '随机抽签', category: '日常工具',
    desc: '随机抽取名单（可设数量与是否重复）或模拟掷骰子（多骰多面求和），用于抽奖、分组、决策等日常场景。',
    tips: [
      '抽签：每行一个候选项；不重复模式下去重抽取，候选项不足时自动取全部。',
      '掷骰子：可设骰子数量与面数（默认 6 面），显示各骰点数与总和。',
      '每次点击「抽取/掷骰」重新随机，结果以高亮卡片展示。'
    ],
    ref: [
      { k: '用途', v: '抽奖 / 分组 / 决策' },
      { k: '随机源', v: '浏览器 Math.random' },
      { k: '可重复', v: '开启后同项可多次出现' }
    ],
    render(c) {
      const mode = T.el('select', {}, [
        T.el('option', { value: 'draw', text: '随机抽签' }),
        T.el('option', { value: 'dice', text: '掷骰子' })
      ]);
      // 抽签控件
      const listArea = T.el('textarea', { value: '张三\n李四\n王五\n赵六\n钱七\n孙八' });
      const drawN = T.el('input', { type: 'number', value: '2', step: '1' });
      const allowDup = T.el('input', { type: 'checkbox' });
      const allowLabel = T.el('label', { class: 'row', style: 'gap:6px;align-items:center' });
      allowLabel.appendChild(allowDup);
      allowLabel.appendChild(T.el('span', { text: '允许重复' }));
      const drawBtn = T.el('button', { class: 'btn primary', text: '抽取' });
      // 骰子控件
      const diceCount = T.el('input', { type: 'number', value: '2', step: '1' });
      const diceSides = T.el('input', { type: 'number', value: '6', step: '1' });
      const diceBtn = T.el('button', { class: 'btn primary', text: '掷骰' });
      const drawBox = T.el('div', { class: 'col' }, [
        T.el('div', { class: 'field' }, [T.el('label', { text: '候选项（每行一个）' }), listArea]),
        T.el('div', { class: 'form-grid' }, [
          T.el('div', { class: 'field' }, [T.el('label', { text: '抽取数量' }), drawN]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '' }), allowLabel])
        ]),
        drawBtn
      ]);
      const diceBox = T.el('div', { class: 'form-grid' }, [
        T.el('div', { class: 'field' }, [T.el('label', { text: '骰子数量' }), diceCount]),
        T.el('div', { class: 'field' }, [T.el('label', { text: '面数' }), diceSides]),
        T.el('div', { class: 'field' }, [T.el('label', { text: '' }), diceBtn])
      ]);
      const out = T.el('div', { class: 'result-box' });

      function doDraw() {
        const items = listArea.value.split('\n').map(s => s.trim()).filter(Boolean);
        const n = Math.max(0, parseInt(drawN.value) || 0);
        if (!items.length) { out.className = 'result-box danger'; out.textContent = '请先填写候选项。'; return; }
        let picks;
        if (allowDup.checked) {
          picks = [];
          for (let i = 0; i < n; i++) picks.push(items[Math.floor(Math.random() * items.length)]);
        } else {
          const pool = items.slice();
          const max = Math.min(n, pool.length);
          picks = [];
          for (let i = 0; i < max; i++) { const j = Math.floor(Math.random() * pool.length); picks.push(pool.splice(j, 1)[0]); }
        }
        out.className = 'result-box';
        out.innerHTML = '';
        out.appendChild(T.el('div', { class: 'big', text: '抽中 ' + picks.length + ' 项' }));
        const wrap = T.el('div', { class: 'row', style: 'margin-top:10px;gap:10px' });
        picks.forEach(p => wrap.appendChild(T.el('span', { class: 'pill', style: 'font-size:14px;padding:8px 14px', text: p })));
        out.appendChild(wrap);
      }
      function doDice() {
        const cnt = Math.max(1, parseInt(diceCount.value) || 1);
        const sides = Math.max(2, parseInt(diceSides.value) || 6);
        const pts = []; let sum = 0;
        for (let i = 0; i < cnt; i++) { const d = 1 + Math.floor(Math.random() * sides); pts.push(d); sum += d; }
        out.className = 'result-box';
        out.innerHTML = '';
        out.appendChild(T.el('div', { class: 'big', text: '总和 ' + sum }));
        const wrap = T.el('div', { class: 'row', style: 'margin-top:10px;gap:10px' });
        pts.forEach(d => wrap.appendChild(T.el('span', { class: 'pill', style: 'font-size:15px;padding:8px 14px', text: '🎲 ' + d })));
        out.appendChild(wrap);
      }
      function sync() {
        const isDraw = mode.value === 'draw';
        drawBox.style.display = isDraw ? '' : 'none';
        diceBox.style.display = isDraw ? 'none' : '';
        out.innerHTML = '';
      }
      drawBtn.onclick = doDraw; diceBtn.onclick = doDice; mode.onchange = sync;
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '随机工具' }),
        T.el('div', { class: 'field', style: 'margin-bottom:12px' }, [T.el('label', { text: '模式' }), mode]),
        drawBox, diceBox, out
      ]));
      sync();
    }
  });
})();
