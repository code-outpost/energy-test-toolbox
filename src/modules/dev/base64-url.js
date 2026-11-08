// Base64 / URL 编解码（纯本地，Unicode 兼容）
(function () {
  const T = TB.util;
  function b64encode(s) {
    if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(s)));
    return Buffer.from(s, 'utf-8').toString('base64');
  }
  function b64decode(s) {
    if (typeof atob === 'function') return decodeURIComponent(escape(atob(s)));
    return Buffer.from(s, 'base64').toString('utf-8');
  }
  TB.register({
    id: 'base64-url', name: 'Base64 / URL 编解码', category: '开发常用',
    desc: 'Base64（兼容中文 / Unicode）与 URL 百分号编解码；纯本地，不上传。',
    tips: ['Base64 已做 Unicode 兼容，中文不会乱码', 'URL 编码使用 encodeURIComponent 标准', '解码失败会提示'],
    render(c) {
      const inp = T.el('textarea', { placeholder: '输入待处理文本...', style: 'min-height:100px' });
      const mode = T.el('select', {}, [
        T.el('option', { value: 'b64e', text: 'Base64 编码' }),
        T.el('option', { value: 'b64d', text: 'Base64 解码' }),
        T.el('option', { value: 'urle', text: 'URL 编码' }),
        T.el('option', { value: 'urld', text: 'URL 解码' })
      ]);
      const out = T.el('textarea', { readonly: true, style: 'min-height:100px' });
      const err = T.el('div', { class: 'error', text: '' });
      function run() {
        err.textContent = ''; const t = inp.value;
        try {
          let r = '';
          switch (mode.value) {
            case 'b64e': r = b64encode(t); break;
            case 'b64d': r = b64decode(t.trim()); break;
            case 'urle': r = encodeURIComponent(t); break;
            case 'urld': r = decodeURIComponent(t.trim()); break;
          }
          out.value = r;
        } catch (e) { err.textContent = '✗ ' + e.message; }
      }
      inp.addEventListener('input', run);
      mode.addEventListener('change', run);
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: 'Base64 / URL 编解码' }),
        T.el('div', { class: 'field', style: 'max-width:240px' }, [T.el('label', { text: '模式' }), mode]),
        T.el('label', { text: '输入' }), inp,
        T.el('div', { style: 'height:10px' }),
        T.el('div', { class: 'row' }, [
          T.el('button', { class: 'btn primary', text: '转换', onclick: run }),
          T.el('button', { class: 'btn ghost', text: '复制', onclick: () => { if (out.value) T.copy(out.value); } })
        ]),
        err,
        T.el('label', { text: '输出', style: 'margin-top:12px;display:block' }), out
      ]));
      run();
    }
  });
})();
