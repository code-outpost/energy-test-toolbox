// 颜色转换：HEX <-> RGB <-> HSL（纯本地）
(function () {
  const T = TB.util;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function hexToRgb(h) {
    h = (h || '').replace('#', '').trim();
    if (h.length === 3) h = h.split('').map(x => x + x).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4;
      }
      h /= 6;
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  }
  TB.register({
    id: 'color-convert', name: '颜色转换', category: '开发常用',
    desc: 'HEX ↔ RGB ↔ HSL 互转，实时预览色块；适合前端 / UI 配色与取色。',
    tips: ['支持简写 #abc 与完整 #aabbcc', '修改 HEX 或 RGB 会自动互转', 'HSL 为只读参考值'],
    ref: [{ k: '格式', v: 'HEX #RRGGBB / RGB 0-255 / HSL 0-360,0-100,0-100' }],
    render(c) {
      const hex = T.el('input', { type: 'text', value: '#2F6FED' });
      const r = T.el('input', { type: 'number', value: 47, min: 0, max: 255 });
      const g = T.el('input', { type: 'number', value: 111, min: 0, max: 255 });
      const b = T.el('input', { type: 'number', value: 237, min: 0, max: 255 });
      const hsl = T.el('input', { type: 'text', value: '', readonly: true });
      const sw = T.el('div', { style: 'width:100%;height:64px;border-radius:12px;border:1px solid var(--border);margin:6px 0' });
      const err = T.el('div', { class: 'error', text: '' });

      function sync() {
        const R = clamp(+r.value || 0, 0, 255), G = clamp(+g.value || 0, 0, 255), B = clamp(+b.value || 0, 0, 255);
        const hslv = rgbToHsl(R, G, B);
        hsl.value = hslv[0] + '°, ' + hslv[1] + '%, ' + hslv[2] + '%';
        sw.style.background = rgbToHex(R, G, B);
      }
      function fromHex() {
        const rgb = hexToRgb(hex.value);
        if (!rgb) { err.textContent = '✗ HEX 格式不正确'; return; }
        err.textContent = ''; r.value = rgb[0]; g.value = rgb[1]; b.value = rgb[2]; sync();
      }
      function fromRgb() {
        r.value = clamp(+r.value || 0, 0, 255); g.value = clamp(+g.value || 0, 0, 255); b.value = clamp(+b.value || 0, 0, 255);
        hex.value = rgbToHex(+r.value, +g.value, +b.value); sync(); err.textContent = '';
      }
      hex.addEventListener('input', fromHex);
      [r, g, b].forEach(e => e.addEventListener('input', fromRgb));

      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '颜色转换 HEX / RGB / HSL' }),
        T.el('div', { style: 'display:flex;gap:14px;align-items:center;flex-wrap:wrap' }, [
          T.el('div', { class: 'field', style: 'flex:1;min-width:160px' }, [T.el('label', { text: 'HEX' }), hex]),
          T.el('div', { class: 'field', style: 'width:74px' }, [T.el('label', { text: 'R' }), r]),
          T.el('div', { class: 'field', style: 'width:74px' }, [T.el('label', { text: 'G' }), g]),
          T.el('div', { class: 'field', style: 'width:74px' }, [T.el('label', { text: 'B' }), b])
        ]),
        sw,
        T.el('div', { class: 'field' }, [T.el('label', { text: 'HSL（只读）' }), hsl]),
        err
      ]));
      sync();
    }
  });
})();
