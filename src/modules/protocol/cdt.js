// CDT (DL/T 451) 循环式远动规约解析：同步字 + 控制字 + 信息字
(function () {
  const T = TB.util;
  function parseHex(s) { s = (s || '').replace(/[^0-9a-fA-F]/g, ''); if (s.length % 2) return null; const a = []; for (let i = 0; i < s.length; i += 2) a.push(parseInt(s.substr(i, 2), 16)); return a; }
  function hx(arr, sep) { return arr.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(sep || ' '); }

  const FRAME_CLASS = {
    0xB8: '上行 A 帧(重要遥测)', 0xB9: '上行 B1 帧(次要遥测)', 0xBA: '上行 B2 帧(一般遥测)',
    0xBB: '上行 C 帧(遥信)', 0xBC: '上行 D1 帧', 0xBD: '上行 D2 帧', 0xBE: '上行 E 帧(扩展)',
    0x61: '上行 A 帧(备用)', 0xF4: '下行 E 帧(广播/设定命令)', 0x71: '下行 E 帧(遥控/设定)'
  };
  const WORD_FN = {
    0x00: '遥信状态(32位)', 0x01: '遥信(带时标)', 0x02: '遥信带时标', 0x03: '水位流量',
    0x04: '电能脉冲计数量', 0x05: '事件顺序记录 SOE', 0x08: '设定命令', 0x09: '子站工作状态',
    0x0F: '广播命令', 0xF0: '遥测(标度化,int16×2)', 0xF1: '遥测(归一化,int16×2)',
    0xF2: '遥测(浮点,float32)', 0xF3: '遥测(百分值)', 0xF4: '遥测(水位)', 0xF5: '频率', 0xF6: '复费率电能'
  };

  function ival(b, o) { const v = b[o] << 8 | b[o + 1]; return v >= 0x8000 ? v - 0x10000 : v; }

  function parse(bytes) {
    if (bytes.length < 6 + 6) return { ok: false, err: '报文过短' };
    // 同步字 EB90 重复 3 次
    const syncOK = [0, 2, 4].every(i => bytes[i] === 0xEB && bytes[i + 1] === 0x90);
    if (!syncOK) return { ok: false, err: '同步字应为 EB90 EB90 EB90，实际 ' + hx(bytes.slice(0, 6)) };
    const fc = bytes[6], src = bytes[7], dst = bytes[8], fnByte = bytes[9], st1 = bytes[10], st2 = bytes[11];
    const infoCount = (fnByte >> 4) & 0x0f;
    const fn = fnByte & 0x0f;
    const words = [];
    let p = 12;
    while (p + 6 <= bytes.length) {
      const wfn = bytes[p], d = bytes.slice(p + 1, p + 5), chk = bytes[p + 5];
      let decoded = '';
      if (wfn === 0xF0 || wfn === 0xF1) decoded = '遥测1=' + ival(d, 0) + ', 遥测2=' + ival(d, 2);
      else if (wfn === 0xF2) { const f = new DataView(new Uint8Array([d[0], d[1], d[2], d[3]]).buffer).getFloat32(0, false); decoded = '浮点=' + f.toFixed(3); }
      else if (wfn === 0x00) { const bits = []; for (let bit = 0; bit < 32; bit++) if ((d[bit >> 3] >> (bit & 7)) & 1) bits.push(bit + 1); decoded = '遥信位=' + (bits.join(',') || '无'); }
      else decoded = '原始=' + hx(d);
      words.push({ wfn, fn: WORD_FN[wfn] || ('0x' + wfn.toString(16)), decoded, raw: hx(d) });
      p += 6;
    }
    return {
      ok: true,
      ctrl: [
        { k: '帧类别', v: '0x' + fc.toString(16).toUpperCase() + ' (' + (FRAME_CLASS[fc] || '未知') + ')' },
        { k: '源站址', v: '0x' + src.toString(16).toUpperCase().padStart(2, '0') },
        { k: '目的站址', v: '0x' + dst.toString(16).toUpperCase().padStart(2, '0') },
        { k: '功能码', v: '信息字数=' + infoCount + ' 功能=0x' + fn.toString(16) + ' (' + (WORD_FN[fn] || '未知') + ')' },
        { k: '帧状态', v: '0x' + st1.toString(16).padStart(2, '0') + ' 0x' + st2.toString(16).padStart(2, '0') }
      ],
      words
    };
  }

  function buildSampleMeas() {
    const info = (v1, v2) => { const hx2 = n => [(n >> 8) & 0xff, n & 0xff]; const a = [0xF0, ...hx2(v1), ...hx2(v2)]; const chk = a.reduce((x, y) => x ^ y, 0); return [...a, chk]; };
    return [0xEB, 0x90, 0xEB, 0x90, 0xEB, 0x90, 0xB8, 0x01, 0xFF, 0x2F, 0x00, 0x00, ...info(1234, -567), ...info(3000, -100)];
  }
  function buildSampleYx() {
    const d = [0x03, 0x00, 0x00, 0x00]; const chk = [0x01, ...d].reduce((x, y) => x ^ y, 0);
    return [0xEB, 0x90, 0xEB, 0x90, 0xEB, 0x90, 0xBB, 0x01, 0xFF, 0x11, 0x00, 0x00, 0x01, ...d, chk];
  }

  TB.register({
    id: 'cdt', name: 'CDT 循环远动', category: '协议报文解析',
    desc: 'DL/T 451 循环式远动规约：同步字 EB90×3、控制字(帧类别/站址/信息字数)、信息字(遥测 int16 / 遥信按位 / SOE)解析',
    render(c) {
      const input = T.el('textarea', { class: 'mono', placeholder: '粘贴 CDT 帧 HEX（含同步字）' });
      const out = T.el('div', { class: 'col' });
      function render(r) {
        out.innerHTML = '';
        if (!r.ok) { out.appendChild(T.el('div', { class: 'error', text: '解析失败：' + r.err })); return; }
        const kv = T.el('div', { class: 'kv' });
        r.ctrl.forEach(f => { kv.appendChild(T.el('div', { class: 'k', text: f.k })); kv.appendChild(T.el('div', { class: 'v', text: f.v })); });
        out.appendChild(kv);
        const tbl = T.el('table', {}); tbl.appendChild(T.el('tr', {}, [T.el('th', { text: '信息字功能' }), T.el('th', { text: '解读' }), T.el('th', { text: '原始' })]));
        r.words.forEach(w => tbl.appendChild(T.el('tr', {}, [T.el('td', { class: 'mono', text: w.fn }), T.el('td', { class: 'mono', text: w.decoded }), T.el('td', { class: 'mono', text: w.raw })])));
        out.appendChild(tbl);
      }
      input.addEventListener('input', () => { const b = parseHex(input.value); if (!b) { out.innerHTML = ''; out.appendChild(T.el('div', { class: 'error', text: 'HEX 格式错误' })); return; } render(parse(b)); });
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: 'CDT (DL/T 451) 循环式远动解析' }),
        T.el('div', { class: 'row' }, [
          T.el('button', { class: 'btn sm primary', text: '示例·遥测A帧', onclick: () => { input.value = hx(buildSampleMeas()); input.dispatchEvent(new Event('input')); } }),
          T.el('button', { class: 'btn sm', text: '示例·遥信C帧', onclick: () => { input.value = hx(buildSampleYx()); input.dispatchEvent(new Event('input')); } })
        ]),
        input,
        T.el('div', { class: 'hint', text: '国内存量老站大量使用；同步字 EB90×3；控制字含帧类别(0xB8遥测/0xBB遥信)与信息字数(高4位)；遥测按大端 int16。' }),
        out
      ]));
      input.value = hx(buildSampleMeas()); input.dispatchEvent(new Event('input'));
    }
  });
})();
