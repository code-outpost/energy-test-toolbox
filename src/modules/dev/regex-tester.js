// 正则测试器：实时匹配、分组与高亮（纯本地）
(function () {
  const T = TB.util;
  TB.register({
    id: 'regex-tester', name: '正则测试器', category: '开发常用',
    desc: '输入正则与测试文本，实时查看匹配结果、分组与高亮；支持 g/i/m/s 标志。',
    tips: ['勾选 g 全局匹配，否则只返回首个', 'm 多行使 ^ $ 匹配行首行尾', '匹配结果按出现顺序列出，并给出捕获分组'],
    ref: [{ k: '标志 g', v: '全局匹配（多次）' }, { k: '标志 i', v: '忽略大小写' }, { k: '标志 m', v: '多行模式' }, { k: '标志 s', v: '点号匹配换行' }],
    render(c) {
      const patInp = T.el('input', { type: 'text', placeholder: '正则表达式，如 \\d{3,4}' });
      const mkFlag = (v, lbl) => {
        const cb = T.el('input', { type: 'checkbox' }); cb.value = v;
        if (v === 'g') cb.checked = true;
        return { cb, w: T.el('label', { class: 'pill', style: 'cursor:pointer' }, [cb, T.el('span', { text: lbl })]) };
      };
      const fg = mkFlag('g', 'g'), fi = mkFlag('i', 'i'), fm = mkFlag('m', 'm'), fs = mkFlag('s', 's');
      const txtInp = T.el('textarea', { placeholder: '在此粘贴待匹配的文本...', style: 'min-height:90px' });
      const errEl = T.el('div', { class: 'error', text: '' });
      const statEl = T.el('div', { class: 'hint', text: '' });
      const hl = T.el('div', { class: 'pre', style: 'white-space:pre-wrap;min-height:60px' });
      const listEl = T.el('div', {});

      function flagStr() { let s = ''; [fg, fi, fm, fs].forEach(o => { if (o.cb.checked) s += o.cb.value; }); return s; }
      function run() {
        errEl.textContent = ''; statEl.textContent = ''; hl.innerHTML = ''; listEl.innerHTML = '';
        const pat = patInp.value;
        if (!pat) { hl.textContent = '（预览区）'; return; }
        let re;
        try { re = new RegExp(pat, flagStr()); }
        catch (e) { errEl.textContent = '✗ 正则错误：' + e.message; return; }
        const text = txtInp.value; const matches = []; let m, n = 0;
        if (flagStr().indexOf('g') >= 0) {
          while ((m = re.exec(text)) !== null) { matches.push(m); if (m.index === re.lastIndex) re.lastIndex++; if (++n > 20000) break; }
        } else { m = re.exec(text); if (m) matches.push(m); }
        // 高亮
        let pos = 0;
        matches.forEach(mm => {
          if (mm.index > pos) hl.appendChild(T.el('span', { text: text.slice(pos, mm.index) }));
          hl.appendChild(T.el('mark', { text: mm[0] || '' }));
          pos = mm.index + mm[0].length;
        });
        if (pos < text.length) hl.appendChild(T.el('span', { text: text.slice(pos) }));
        if (!text) hl.textContent = '（预览区）';
        if (!matches.length) { statEl.textContent = '未匹配到任何内容'; return; }
        statEl.textContent = '共匹配 ' + matches.length + ' 处';
        matches.slice(0, 200).forEach((mm, i) => {
          listEl.appendChild(T.el('div', { style: 'margin:8px 0 4px;font-weight:700' }, [
            T.el('span', { text: '#' + (i + 1) + '  @' + mm.index + '  ' }),
            T.el('span', { class: 'mono', text: JSON.stringify(mm[0]) })
          ]));
          if (mm.length > 1) {
            const g = T.el('div', { class: 'kv' });
            for (let gi = 1; gi < mm.length; gi++) {
              g.appendChild(T.el('div', { class: 'k', text: '组 ' + gi }));
              g.appendChild(T.el('div', { class: 'v', text: JSON.stringify(mm[gi]) }));
            }
            listEl.appendChild(g);
          }
        });
      }
      [patInp, txtInp].forEach(e => e.addEventListener('input', run));
      [fg.cb, fi.cb, fm.cb, fs.cb].forEach(e => e.addEventListener('change', run));

      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '正则表达式测试' }),
        T.el('label', { text: '正则表达式' }), patInp,
        T.el('div', { class: 'row', style: 'margin-top:10px' }, [fg.w, fi.w, fm.w, fs.w]),
        T.el('label', { text: '测试文本', style: 'margin-top:12px;display:block' }), txtInp,
        errEl, statEl,
        T.el('label', { text: '高亮预览', style: 'margin-top:12px;display:block' }), hl,
        T.el('label', { text: '匹配明细', style: 'display:block;margin-top:10px' }), listEl
      ]));
    }
  });
})();
