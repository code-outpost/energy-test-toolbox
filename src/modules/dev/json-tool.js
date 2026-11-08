// JSON 工具：格式化 / 压缩 / 校验 / 转义 / 去转义（纯本地）
(function () {
  const T = TB.util;
  TB.register({
    id: 'json-tool', name: 'JSON 工具', category: '开发常用',
    desc: 'JSON 格式化（美化缩进）、压缩（去空白）、合法性校验、字符串转义/去转义；纯本地处理，不上传。',
    tips: ['格式化：美化并以 2 空格缩进', '压缩：去除所有空白', '转义：将文本转为可嵌入字符串的转义形式'],
    ref: [{ k: '校验', v: '解析失败会标红并提示原因' }, { k: '说明', v: '所有处理均在本地完成' }],
    render(c) {
      const input = T.el('textarea', { placeholder: '在此粘贴 JSON...', style: 'min-height:120px' });
      const output = T.el('pre', { class: 'pre', style: 'min-height:140px;white-space:pre-wrap' });
      const status = T.el('div', { class: 'hint', text: '支持 格式化 / 压缩 / 校验 / 转义' });

      function setOut(t, err) {
        output.textContent = t || '';
        output.style.color = err ? 'var(--danger)' : '';
        if (err) { status.textContent = err; status.className = 'error'; }
        else { status.textContent = '就绪'; status.className = 'hint'; }
      }
      function fmt() {
        try { const o = JSON.parse(input.value); output.style.color = ''; output.textContent = JSON.stringify(o, null, 2); status.textContent = '✓ 格式化成功'; status.className = 'hint success'; }
        catch (e) { setOut('', '✗ ' + e.message); }
      }
      function min() {
        try { const o = JSON.parse(input.value); output.style.color = ''; output.textContent = JSON.stringify(o); status.textContent = '✓ 压缩成功'; status.className = 'hint success'; }
        catch (e) { setOut('', '✗ ' + e.message); }
      }
      function validate() {
        try { JSON.parse(input.value); status.textContent = '✓ JSON 合法'; status.className = 'hint success'; }
        catch (e) { status.textContent = '✗ ' + e.message; status.className = 'error'; }
      }
      function esc() {
        try { output.style.color = ''; const r = JSON.stringify(input.value); output.textContent = r; status.textContent = '✓ 已转义（含外侧引号）'; status.className = 'hint success'; }
        catch (e) { setOut('', '✗ ' + e.message); }
      }
      function unesc() {
        try { const s = input.value.trim(); const r = JSON.parse(s); output.style.color = ''; output.textContent = (typeof r === 'string') ? r : JSON.stringify(r); status.textContent = '✓ 已去转义'; status.className = 'hint success'; }
        catch (e) { setOut('', '✗ 去转义失败：需为合法 JSON 字符串字面量'); }
      }
      function clearAll() { input.value = ''; setOut('', ''); status.textContent = '已清空'; status.className = 'hint'; }
      function copy() { if (output.textContent) T.copy(output.textContent); }

      const row = T.el('div', { class: 'row' }, [
        T.el('button', { class: 'btn primary', text: '格式化', onclick: fmt }),
        T.el('button', { class: 'btn', text: '压缩', onclick: min }),
        T.el('button', { class: 'btn', text: '校验', onclick: validate }),
        T.el('button', { class: 'btn', text: '转义', onclick: esc }),
        T.el('button', { class: 'btn', text: '去转义', onclick: unesc }),
        T.el('button', { class: 'btn ghost', text: '清空', onclick: clearAll }),
        T.el('button', { class: 'btn ghost', text: '复制结果', onclick: copy })
      ]);

      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: 'JSON 格式化 / 校验 / 转义' }),
        T.el('label', { text: '输入' }), input,
        T.el('div', { style: 'height:10px' }), row,
        T.el('label', { text: '输出', style: 'margin-top:12px;display:block' }), output,
        status
      ]));
    }
  });
})();
