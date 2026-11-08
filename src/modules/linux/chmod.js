// chmod 权限计算器：符号(rwx) ↔ 数字(0-7) ↔ 八进制，含特殊位
TB.register({
  id: 'chmod',
  name: 'chmod 权限计算器',
  category: 'Linux 命令',
  desc: '权限符号与数字互转，含 setuid/setgid/sticky 特殊位',
  render(c) {
    const input = TB.util.el('input', { type: 'text', class: 'mono', placeholder: '如 755 / 4755 / rwxr-xr-x', style: 'width:280px' });
    const out = TB.util.el('div', { class: 'kv' });

    function toDigit(rwx) {
      return ((rwx[0] === 'r') ? 4 : 0) | ((rwx[1] === 'w') ? 2 : 0) | ((rwx[2] === 'x' || rwx[2] === 's' || rwx[2] === 't' || rwx[2] === 'S' || rwx[2] === 'T') ? 1 : 0);
    }
    function toSym(d) {
      return ((d & 4) ? 'r' : '-') + ((d & 2) ? 'w' : '-') + ((d & 1) ? 'x' : '-');
    }

    function parse(input) {
      let s = (input || '').trim();
      if (!s) return null;
      // 数字模式
      if (/^[0-7]{1,4}$/.test(s)) {
        let special = 0, three;
        if (s.length === 4) { special = parseInt(s[0], 10); three = s.slice(1); }
        else { three = s.padStart(3, '0'); }
        return { owner: parseInt(three[0], 10), group: parseInt(three[1], 10), other: parseInt(three[2], 10), special };
      }
      // 符号模式（允许首位类型字符 d/-，取后 9 位）
      const m = s.replace(/\s/g, '').match(/[rwx-]{9}$/);
      if (m) {
        const s9 = m[0];
        return {
          owner: toDigit(s9.slice(0, 3)), group: toDigit(s9.slice(3, 6)), other: toDigit(s9.slice(6, 9)), special: 0
        };
      }
      return null;
    }

    function run() {
      out.innerHTML = '';
      const put = (k, v, extra) => {
        out.appendChild(TB.util.el('div', { class: 'k', text: k }));
        out.appendChild(TB.util.el('div', { class: 'v' }, [v, extra || TB.util.copyBtn(v)]));
      };
      const r = parse(input.value);
      if (!r) { put('提示', '请输入 3-4 位数字或 9 位符号（如 rwxr-xr-x）'); return; }
      const full = r.special * 1000 + r.owner * 100 + r.group * 10 + r.other;
      put('数字(3 位)', String(r.owner) + r.group + r.other);
      put('完整数字(4 位)', String(full), TB.util.copyBtn('0' + String(full)));
      put('符号', toSym(r.owner) + toSym(r.group) + toSym(r.other));
      put('owner (u)', toSym(r.owner) + (r.special & 4 ? '  [setuid]' : ''));
      put('group (g)', toSym(r.group) + (r.special & 2 ? '  [setgid]' : ''));
      put('other (o)', toSym(r.other) + (r.special & 1 ? '  [sticky]' : ''));
      put('特殊位', [
        r.special & 4 ? 'setuid(4)' : null,
        r.special & 2 ? 'setgid(2)' : null,
        r.special & 1 ? 'sticky(1)' : null
      ].filter(Boolean).join(' ') || '无');
    }
    input.addEventListener('input', run);

    c.appendChild(TB.util.el('div', { class: 'card' }, [
      TB.util.el('h3', { text: 'chmod 权限计算器' }),
      TB.util.el('div', { class: 'row' }, [TB.util.el('label', { text: '输入' }), input]),
      TB.util.el('div', { class: 'hint', text: '支持 755、4755、rwxr-xr-x 等格式，自动识别。' }),
      out
    ]));

    input.value = 'rwxr-xr-x';
    run();
  }
});
