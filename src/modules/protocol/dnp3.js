// DNP3 (IEEE 1815) 报文解析：链路层 + 传输层 + 应用层对象头 + 绝对时间戳
(function () {
  const T = TB.util;
  function parseHex(s) { s = (s || '').replace(/[^0-9a-fA-F]/g, ''); if (s.length % 2) return null; const a = []; for (let i = 0; i < s.length; i += 2) a.push(parseInt(s.substr(i, 2), 16)); return a; }
  function hx(arr, sep) { return arr.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(sep || ' '); }
  function u16le(b, o) { return b[o] | (b[o + 1] << 8); }
  function i16le(b, o) { const v = u16le(b, o); return v >= 0x8000 ? v - 0x10000 : v; }

  const LINK_FN = { 0: '复位链路', 1: '复位用户进程', 2: '测试链路', 3: '发送用户数据', 4: '未编号确认', 5: '请求链路状态', 6: '请求会话密钥状态', 7: '会话密钥改变', 9: '确认链路状态' };
  const APP_FN = { 0: '确认', 1: '读', 2: '写', 3: '选择', 4: '操作', 5: '直接操作', 6: '直接操作确认', 7: '空闲', 8: '冷启动', 9: '热/暖重启', 10: '初始化数据', 11: '初始化应用', 12: '启动应用', 13: '停止应用', 14: '保存配置', 15: '事件冻结', 16: '事件冻结清除', 17: '事件冻结带时标', 18: '事件清除', 19: '事件清除带时标', 20: '指派class', 21: '延时测量', 22: '记录当前时间', 23: '打开文件', 24: '关闭文件', 25: '删除文件', 26: '获取文件信息', 27: '认证请求', 28: '认证用户', 29: '认证更新', 30: '认证错误', 31: '响应', 32: '未请求', 33: '确认应用序列' };
  const GROUP = {
    1: '二进制输入(遥信)', 2: '二进制输入事件(带时标)', 3: '双点输入', 4: '双点输入事件', 10: '二进制输出(遥控)', 11: '二进制输出事件', 12: '二进制输出命令', 13: '二进制输出命令事件', 20: '计数器', 21: '计数器事件', 22: '冻结计数器', 30: '模拟输入(遥测)', 31: '模拟输入事件', 32: '冻结模拟输入', 33: '冻结模拟输入事件', 40: '模拟输出状态', 41: '模拟输出命令', 42: '模拟输出命令事件', 50: '时间对象', 60: '文件传输', 80: '内部指示', 86: '时间同步', 87: '认证'
  };
  const QUAL = {
    0x00: '起止范围(16位)', 0x01: '1字节计数', 0x02: '2字节计数', 0x03: '起止范围(8位)', 0x04: '无范围(所有)', 0x05: '无范围(虚拟)', 0x06: '起止VIndex', 0x07: '0x0CountofObjects', 0x09: '起止范围(32位)'
  };

  // DNP3 48位绝对时间：自 1984-01-01 00:00:00 UTC 起的毫秒
  function decodeDnpTime(b, o) {
    let ms = 0; for (let i = 0; i < 6; i++) ms |= b[o + i] * Math.pow(256, i);
    const base = Date.UTC(1984, 0, 1, 0, 0, 0);
    const d = new Date(base + ms);
    const invalid = (b[o + 5] & 0x80) !== 0;
    const discont = (b[o + 5] & 0x40) !== 0;
    const tstr = d.toISOString().replace('T', ' ').replace('.000Z', ' UTC').replace('Z', ' UTC');
    let flag = invalid ? ' [无效]' : ''; if (discont) flag += ' [时标不连续]';
    return { ms, tstr: tstr + flag, raw: hx(b.slice(o, o + 6)).replace(/ /g, '') };
  }

  function parse(bytes) {
    if (bytes.length < 10) return { ok: false, err: '报文过短（< 10 字节）' };
    if (bytes[0] !== 0x05 || bytes[1] !== 0x64) return { ok: false, err: '起始字应为 0x0564，实际 0x' + hx(bytes.slice(0, 2)).replace(/ /g, '') };
    const len = bytes[2];
    const ctrl = bytes[3];
    const dir = (ctrl & 0x80) ? 1 : 0, prm = (ctrl & 0x40) ? 1 : 0, fcb = (ctrl & 0x20) ? 1 : 0, fcv = (ctrl & 0x10) ? 1 : 0, fn = ctrl & 0x0f;
    const dst = u16le(bytes, 4), src = u16le(bytes, 6);
    const fields = [];
    fields.push({ k: '起始字', v: '0x0564' });
    fields.push({ k: '用户数据长度', v: String(len) });
    fields.push({ k: '控制字节', v: '0x' + ctrl.toString(16).toUpperCase().padStart(2, '0') + ' (DIR=' + dir + ' PRM=' + prm + ' FCB=' + fcb + ' FCV=' + fcv + ' 功能码=' + fn + ')' });
    fields.push({ k: '功能', v: LINK_FN[fn] || ('未知(' + fn + ')') });
    fields.push({ k: '目的地址', v: '0x' + dst.toString(16).toUpperCase().padStart(4, '0') + ' (' + dst + ')' });
    fields.push({ k: '源地址', v: '0x' + src.toString(16).toUpperCase().padStart(4, '0') + ' (' + src + ')' });

    // 应用层（跳过头部 10 字节）
    let off = 10;
    const app = [];
    if (off < bytes.length) {
      const tfc = bytes[off];
      const fir = (tfc & 0x80) ? 1 : 0, fin = (tfc & 0x40) ? 1 : 0, seq = tfc & 0x3f;
      app.push({ k: '传输层', v: 'FIR=' + fir + ' FIN=' + fin + ' SEQ=' + seq });
      off += 1;
      if (off + 3 < bytes.length) {
        const ac = bytes[off];
        const afir = (ac & 0x80) ? 1 : 0, afin = (ac & 0x40) ? 1 : 0, aseq = ac & 0x0f;
        const fnc = bytes[off + 1];
        const iin1 = bytes[off + 2], iin2 = bytes[off + 3];
        app.push({ k: '应用控制', v: 'FIR=' + afir + ' FIN=' + afin + ' SEQ=' + aseq });
        app.push({ k: '功能码', v: fnc + ' (' + (APP_FN[fnc] || '未知') + ')' });
        app.push({ k: 'IIN', v: '0x' + iin1.toString(16).padStart(2, '0') + ' 0x' + iin2.toString(16).padStart(2, '0') });
        off += 4;
        // 对象头解析（最多遍历若干段）
        let idx = 0;
        const objs = [];
        while (off + 3 <= bytes.length && idx < 16) {
          const g = bytes[off], v = bytes[off + 1], q = bytes[off + 2];
          let rng = '', ooff = off + 3;
          if (q === 0x00) { const s = u16le(bytes, off + 3), e = u16le(bytes, off + 5); rng = '范围 ' + s + '–' + e; ooff = off + 7; }
          else if (q === 0x01) { rng = '个数 ' + bytes[off + 3]; ooff = off + 4; }
          else if (q === 0x03) { rng = '范围 ' + bytes[off + 3] + '–' + bytes[off + 4]; ooff = off + 5; }
          else if (q === 0x04 || q === 0x05) { rng = '无范围(所有)'; ooff = off + 3; }
          else { rng = '限定符 0x' + q.toString(16); ooff = off + 3; }
          objs.push({ g, v, q, rng, ooff });
          // 尝试解码第一个带时标的模拟量对象
          if (g === 30 && v === 1 && q === 0x01) {
            let p = ooff;
            const count = (q === 0x01) ? bytes[off + 3] : 0;
            const vals = [];
            for (let i = 0; i < count && p + 9 <= bytes.length; i++) {
              const ix = bytes[p]; const val = i16le(bytes, p + 1); const tm = decodeDnpTime(bytes, p + 3);
              vals.push({ ix, val, tm: tm.tstr });
              p += 9;
            }
            app.push({ k: '对象 G30V1(模拟量+时标)', v: vals.map(x => 'idx' + x.ix + '=' + x.val + ' @' + x.tm).join(' | ') });
          } else if (g === 2 && (v === 1 || v === 3) && q === 0x01) {
            let p = ooff; const count = bytes[off + 3]; const vals = [];
            const sz = (v === 1) ? 11 : 5; // V1: 状态+时标+索引; V3: 状态+时标(无索引前缀)
            for (let i = 0; i < count && p + sz <= bytes.length; i++) { const tm = decodeDnpTime(bytes, p + 1); vals.push(tm.tstr); p += sz; }
            app.push({ k: '对象 G2V' + v + '(遥信事件+时标)', v: vals.join(' | ') });
          } else {
            app.push({ k: '对象 G' + g + 'V' + v, v: (GROUP[g] || '未知组') + ' / ' + (QUAL[q] || '限定符?') + ' / ' + rng });
          }
          off = ooff; idx++;
        }
      }
    }
    return { ok: true, fields, app };
  }

  function buildSample() {
    // 链路层: 05 64 len C3 目的(01 00) 源(02 00) ... (此处忽略CRC精确, 解析不强制校验)
    const dst = [0x01, 0x00], src = [0x02, 0x00];
    // 应用层: 传输层 0xC0 + 应用控制 0xC0 + 功能码 0x81(响应) + IIN 00 00
    // + 对象 G30V1 q=0x01 count=2, 每个: 索引1 + 值2 + 时标6
    const mkTime = (ms) => { const a = []; for (let i = 0; i < 6; i++) { a.push(ms & 0xff); ms = Math.floor(ms / 256); } return a; };
    const nowMs = (Date.UTC(2026, 10, 5, 3, 0, 0) - Date.UTC(1984, 0, 1)) / 1;
    const obj = [30, 1, 0x01, 2, 0x00, 0x2A, 0x00, ...mkTime(nowMs), 0x01, 0x5A, 0x00, ...mkTime(nowMs + 1000)];
    const app = [0xC0, 0xC0, 0x81, 0x00, 0x00, ...obj];
    const len = app.length;
    return [0x05, 0x64, len, 0xC3, ...dst, ...src, ...app];
  }

  TB.register({
    id: 'dnp3', name: 'DNP3', category: '协议报文解析',
    desc: 'DNP3(IEEE 1815) 解析：链路层控制域/地址、应用层功能码/IIN、对象头(G/V/限定符)与绝对时间戳(48位)解码',
    render(c) {
      const input = T.el('textarea', { class: 'mono', placeholder: '粘贴 DNP3 帧 HEX' });
      const out = T.el('div', { class: 'col' });
      function render(r) {
        out.innerHTML = '';
        if (!r.ok) { out.appendChild(T.el('div', { class: 'error', text: '解析失败：' + r.err })); return; }
        const ov = T.el('div', { class: 'kv' });
        r.fields.forEach(f => { ov.appendChild(T.el('div', { class: 'k', text: f.k })); ov.appendChild(T.el('div', { class: 'v', text: f.v })); });
        out.appendChild(ov);
        if (r.app && r.app.length) {
          out.appendChild(T.el('h4', { text: '应用层' }));
          const av = T.el('div', { class: 'kv' });
          r.app.forEach(f => { av.appendChild(T.el('div', { class: 'k', text: f.k })); av.appendChild(T.el('div', { class: 'v', text: f.v })); });
          out.appendChild(av);
        }
      }
      input.addEventListener('input', () => { const b = parseHex(input.value); if (!b) { out.innerHTML = ''; out.appendChild(T.el('div', { class: 'error', text: 'HEX 格式错误' })); return; } render(parse(b)); });
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: 'DNP3 (IEEE 1815) 报文解析' }),
        T.el('div', { class: 'row' }, [T.el('button', { class: 'btn sm primary', text: '载入示例', onclick: () => { input.value = hx(buildSample()); input.dispatchEvent(new Event('input')); } })]),
        input,
        T.el('div', { class: 'hint', text: '新能源场站 SCADA 常用；链路层起始 0x0564；绝对时间为自1984-01-01起的48位毫秒。事件对象(组2/组30)含时标。' }),
        out
      ]));
      input.value = hx(buildSample()); input.dispatchEvent(new Event('input'));
    }
  });
})();
