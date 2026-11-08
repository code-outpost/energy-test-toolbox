// 命令解析器：拆解命令名与参数，并关联速查库说明
TB.register({
  id: 'cmd-parse',
  name: '命令解析',
  category: 'Linux 命令',
  desc: '粘贴一条命令，拆解命令名与各参数，并关联速查库说明',
  render(c) {
    function tokenize(s) {
      const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
      const out = []; let m;
      while ((m = re.exec(s)) !== null) out.push(m[1] != null ? m[1] : (m[2] != null ? m[2] : m[3]));
      return out;
    }

    const input = TB.util.el('input', { type: 'text', class: 'mono', placeholder: '如：rsync -avz src/ user@host:/dst/', style: 'width:100%' });
    const out = TB.util.el('div', { class: 'kv' });

    function run() {
      out.innerHTML = '';
      const put = (k, v, copy) => { out.appendChild(TB.util.el('div', { class: 'k', text: k })); out.appendChild(TB.util.el('div', { class: 'v' }, [v, copy ? TB.util.copyBtn(v) : null])); };
      const tokens = tokenize(input.value);
      if (!tokens.length) { put('提示', '请输入一条命令'); return; }
      const cmd = tokens[0];
      const ref = (TB.CMD_REF || []).find(x => x.name === cmd);
      put('命令名', cmd, true);
      if (ref) put('说明', ref.cat + ' · ' + ref.desc);
      else put('说明', '速查库中暂无该命令的详细条目');
      const args = tokens.slice(1);
      if (args.length) {
        args.forEach((a, i) => put('参数 ' + (i + 1), a, true));
      } else {
        put('参数', '（无）');
      }
      if (ref) put('提示', '可在「命令速查」中查看 ' + cmd + ' 的完整示例');
    }
    input.addEventListener('input', run);

    c.appendChild(TB.util.el('div', { class: 'card' }, [
      TB.util.el('h3', { text: '命令解析' }),
      TB.util.el('div', { class: 'col' }, [TB.util.el('label', { text: '输入命令' }), input]),
      TB.util.el('div', { class: 'hint', text: '支持引号包裹的参数（如 "a b" 视为一个参数）。' }),
      out
    ]));

    input.value = 'rsync -avz src/ user@host:/dst/';
    run();
  }
});
