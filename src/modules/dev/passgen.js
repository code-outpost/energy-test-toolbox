// 随机密码 / 字符串生成器（纯本地，使用 Web Crypto）
(function () {
  const T = TB.util;
  const U = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', L = 'abcdefghijklmnopqrstuvwxyz', D = '0123456789', S = '!@#$%^&*()-_=+[]{};:,.<>?';
  const AMB = { '0': 1, 'O': 1, 'o': 1, '1': 1, 'l': 1, 'I': 1, '|': 1 };
  function getCrypto() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) return crypto;
    try { return require('crypto').webcrypto; } catch (e) { return null; }
  }
  function rnd(max) {
    const cr = getCrypto();
    if (cr) { const a = new Uint32Array(1); cr.getRandomValues(a); return a[0] % max; }
    return Math.floor(Math.random() * max);
  }
  function clampInt(v, a, b) { return Math.max(a, Math.min(b, v)); }
  TB.register({
    id: 'passgen', name: '密码生成器', category: '开发常用',
    desc: '可定制长度与字符集的随机密码生成，支持排除易混淆字符并估算强度（按信息熵）。',
    tips: ['默认 16 位含四类字符', '勾选"排除易混淆"去掉 0/O/1/l/I 等', '强度按信息熵估算，越长越安全'],
    ref: [{ k: '强度', v: '弱 <40bit · 中 40-70 · 强 >70' }],
    render(c) {
      const len = T.el('input', { type: 'number', value: 16, min: 4, max: 128 });
      const cU = T.el('input', { type: 'checkbox' }); cU.checked = true;
      const cL = T.el('input', { type: 'checkbox' }); cL.checked = true;
      const cD = T.el('input', { type: 'checkbox' }); cD.checked = true;
      const cS = T.el('input', { type: 'checkbox' }); cS.checked = true;
      const cA = T.el('input', { type: 'checkbox' }); cA.checked = false;
      const out = T.el('input', { type: 'text', readonly: true, style: 'font-family:var(--mono);font-size:15px' });
      const strength = T.el('div', { class: 'hint', text: '' });
      const pbar = T.el('div', { style: 'height:100%;width:0%;background:var(--success);transition:.2s' });
      const bar = T.el('div', { style: 'height:8px;border-radius:6px;background:var(--surface-3);overflow:hidden' }, [pbar]);
      function gen() {
        let pool = '';
        if (cU.checked) pool += U; if (cL.checked) pool += L; if (cD.checked) pool += D; if (cS.checked) pool += S;
        if (!pool) { out.value = ''; strength.textContent = '请至少选择一类字符'; pbar.style.width = '0%'; return; }
        const n = clampInt(+len.value || 16, 4, 128);
        const excl = cA.checked;
        let s = '';
        for (let i = 0; i < n; i++) {
          let ch = pool[rnd(pool.length)];
          if (excl) { let guard = 0; while (AMB[ch] && guard++ < 12) ch = pool[rnd(pool.length)]; }
          s += ch;
        }
        out.value = s;
        const ent = n * Math.log2(pool.length);
        const lvl = ent < 40 ? '弱' : ent < 70 ? '中' : '强';
        const col = ent < 40 ? 'var(--danger)' : ent < 70 ? 'var(--warn)' : 'var(--success)';
        strength.textContent = '长度 ' + n + ' · 字符集 ' + pool.length + ' · 熵 ≈ ' + ent.toFixed(0) + ' bit · 强度：' + lvl;
        pbar.style.width = Math.min(100, ent / 128 * 100) + '%';
        pbar.style.background = col;
      }
      [len, cU, cL, cD, cS, cA].forEach(e => { e.addEventListener('input', gen); e.addEventListener('change', gen); });
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '随机密码 / 字符串生成' }),
        T.el('div', { class: 'form-grid' }, [T.el('div', { class: 'field' }, [T.el('label', { text: '长度' }), len])]),
        T.el('div', { class: 'row', style: 'gap:16px;flex-wrap:wrap;margin:6px 0' }, [
          T.el('label', { class: 'pill', style: 'cursor:pointer' }, [cU, T.el('span', { text: '大写 A-Z' })]),
          T.el('label', { class: 'pill', style: 'cursor:pointer' }, [cL, T.el('span', { text: '小写 a-z' })]),
          T.el('label', { class: 'pill', style: 'cursor:pointer' }, [cD, T.el('span', { text: '数字 0-9' })]),
          T.el('label', { class: 'pill', style: 'cursor:pointer' }, [cS, T.el('span', { text: '符号' })]),
          T.el('label', { class: 'pill', style: 'cursor:pointer' }, [cA, T.el('span', { text: '排除易混淆' })])
        ]),
        T.el('div', { class: 'row', style: 'margin:8px 0' }, [
          T.el('button', { class: 'btn primary', text: '生成', onclick: gen }),
          T.el('button', { class: 'btn ghost', text: '复制', onclick: () => { if (out.value) T.copy(out.value); } })
        ]),
        out, bar, strength
      ]));
      gen();
    }
  });
})();
