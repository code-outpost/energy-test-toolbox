// IEC 60870-5-104 报文解析（APDU / ASDU 全字段）
// 仅离线：粘贴 HEX → 结构化字段解释 + 原始字节对照
(function () {
  const T = TB.util;

  function parseHex(s) {
    s = (s || '').replace(/[^0-9a-fA-F]/g, '');
    if (s.length % 2) return null;
    const a = [];
    for (let i = 0; i < s.length; i += 2) a.push(parseInt(s.substr(i, 2), 16));
    return a;
  }
  function hx(arr, sep) { return arr.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(sep || ' '); }

  const TI_META = {
    1: { name: 'M_SP_NA_1 单点遥信', kind: 'sp' },
    2: { name: 'M_DP_NA_1 双点遥信', kind: 'dp' },
    3: { name: 'M_ST_NA_1 步进位置', kind: 'st' },
    4: { name: 'M_BO_NA_1 32位位串', kind: 'bo' },
    5: { name: 'M_ME_NA_1 遥测-规一化', kind: 'mea' },
    6: { name: 'M_ME_NB_1 遥测-标度化', kind: 'meb' },
    7: { name: 'M_ME_NC_1 遥测-浮点', kind: 'mef' },
    8: { name: 'M_IT_NA_1 累计量', kind: 'it' },
    9: { name: 'M_ME_ND_1 遥测-规一化(无品质)', kind: 'mea2' },
    13: { name: '测量值-短浮点（SmartLogger 文档 / 101 体系编号，值格式同 TI=7）', kind: 'mef' },
    30: { name: 'M_SP_TB_1 单点遥信(时标)', kind: 'sp', time: true },
    31: { name: 'M_DP_TB_1 双点遥信(时标)', kind: 'dp', time: true },
    34: { name: 'M_ME_TD_1 遥测-规一化(时标)', kind: 'mea', time: true },
    35: { name: 'M_ME_TE_1 遥测-标度化(时标)', kind: 'meb', time: true },
    36: { name: 'M_ME_TF_1 遥测-浮点(时标)', kind: 'mef', time: true },
    37: { name: 'M_IT_TB_1 累计量(时标)', kind: 'it', time: true },
    45: { name: 'C_SC_NA_1 单点遥控', kind: 'csc' },
    46: { name: 'C_DC_NA_1 双点遥控', kind: 'cdc' },
    48: { name: 'C_SE_NA_1 设定-规一化', kind: 'sea' },
    49: { name: 'C_SE_NB_1 设定-标度化', kind: 'seb' },
    50: { name: 'C_SE_NC_1 设定-浮点', kind: 'sef' },
    100: { name: 'C_IC_NA_1 总召唤', kind: 'ic' },
    101: { name: 'C_CI_NA_1 计数量召唤', kind: 'ci' },
    102: { name: 'C_RD_NA_1 读命令', kind: 'rd' },
    103: { name: 'C_CS_NA_1 时钟同步', kind: 'cs' }
  };

  const COT = {
    1: '周期/循环', 2: '背景扫描', 3: '突发', 4: '初始化', 5: '请求', 6: '激活', 7: '激活确认',
    8: '停止激活', 9: '停止激活确认', 10: '激活终止', 11: '返送信息(远)', 12: '返送信息(近)',
    13: '文件传输', 20: '响应站召唤', 21: '响应第1组召唤', 22: '第2组', 23: '第3组', 24: '第4组',
    25: '第5组', 26: '第6组', 27: '第7组', 28: '第8组', 29: '第9组', 30: '第10组',
    31: '响应站召唤(带时标)', 44: '未知类型标识', 45: '未知传送原因', 46: '未知公共地址', 47: '未知信息对象地址'
  };

  function qds(b) {
    const f = [];
    if (b & 1) f.push('IV无效'); if (b & 2) f.push('NT非当前'); if (b & 4) f.push('SB替代');
    if (b & 8) f.push('BL封锁'); if (b & 16) f.push('OV溢出');
    return f.length ? f.join(',') : '有效';
  }
  function readI16(buf, off) { return (buf[off] | (buf[off + 1] << 8)) << 16 >> 16; }
  function readU32(buf, off) { return (buf[off] >>> 0) | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24); }
  function readF32(buf, off) {
    const dv = new DataView(new Uint8Array(buf.slice(off, off + 4)).buffer);
    return dv.getFloat32(0, true);
  }
  function time56(buf, off) {
    const ms = buf[off] | (buf[off + 1] << 8);
    const min = buf[off + 2] & 0x3f, hr = buf[off + 3] & 0x1f, dom = buf[off + 4] & 0x1f;
    const mon = buf[off + 5] & 0x0f, yr = buf[off + 6] & 0x7f;
    const iv = !!(buf[off + 2] & 0x80 || buf[off + 3] & 0x80 || buf[off + 4] & 0x80 || buf[off + 5] & 0x80 || buf[off + 6] & 0x80);
    const su = !!(buf[off + 3] & 0x40);
    const d = new Date(2000 + yr, mon - 1, dom, hr, min, Math.floor(ms / 1000), ms % 1000);
    return { text: d.toLocaleString('zh-CN') + (su ? ' (夏令时)' : '') + (iv ? ' [时标无效]' : ''), iv, su };
  }

  function infoLen(kind, time) {
    const base = { sp: 1, dp: 1, st: 2, bo: 4, mea: 3, meb: 3, mef: 5, mea2: 2, it: 5, csc: 1, cdc: 1, sea: 3, seb: 3, sef: 5, ic: 1, ci: 1, rd: 0, cs: 7 }[kind];
    return base + (time ? 7 : 0);
  }

  // 单信息对象的值解码
  function decodeValue(kind, buf, off) {
    const o = [];
    const q = b => ({ label: '品质', value: '0x' + b.toString(16).toUpperCase().padStart(2, '0') + ' ' + qds(b) });
    switch (kind) {
      case 'sp': o.push({ label: '状态 SPI', value: (buf[off] & 1) ? '1 (合/ON)' : '0 (分/OFF)' }); o.push(q(buf[off])); break;
      case 'dp': { const d = buf[off] & 3; o.push({ label: '状态 DPI', value: ['不确定/中间态', '分/OFF', '合/ON', '不确定/中间态'][d] }); o.push(q(buf[off])); break; }
      case 'st': o.push({ label: '值 VTI', value: String(((buf[off] & 0x7f) << 24 >> 24) + 64 - 64) }); o.push(q(buf[off + 1])); break;
      case 'bo': o.push({ label: '位串', value: '0x' + readU32(buf, off).toString(16).toUpperCase() }); break;
      case 'mea': o.push({ label: '规一化值', value: (readI16(buf, off) / 32768).toFixed(6) }); o.push(q(buf[off + 2])); break;
      case 'meb': o.push({ label: '标度化值', value: String(readI16(buf, off)) }); o.push(q(buf[off + 2])); break;
      case 'mef': o.push({ label: '浮点值', value: String(readF32(buf, off)) }); o.push(q(buf[off + 4])); break;
      case 'mea2': o.push({ label: '规一化值', value: (readI16(buf, off) / 32768).toFixed(6) }); break;
      case 'it': o.push({ label: '累计值', value: String(readU32(buf, off)) }); o.push(q(buf[off + 4])); break;
      case 'csc': o.push({ label: '遥控 SCO', value: '选择SE=' + ((buf[off] >> 7) & 1) + ' 状态=' + (buf[off] & 1) }); break;
      case 'cdc': o.push({ label: '遥控 DCO', value: '选择SE=' + ((buf[off] >> 7) & 1) + ' 状态=' + (buf[off] & 3) }); break;
      case 'sea': o.push({ label: '设定值', value: (readI16(buf, off) / 32768).toFixed(6) }); o.push({ label: 'QOS', value: 'SE=' + ((buf[off + 2] >> 7) & 1) }); break;
      case 'seb': o.push({ label: '设定值', value: String(readI16(buf, off)) }); o.push({ label: 'QOS', value: 'SE=' + ((buf[off + 2] >> 7) & 1) }); break;
      case 'sef': o.push({ label: '设定值', value: String(readF32(buf, off)) }); o.push({ label: 'QOS', value: 'SE=' + ((buf[off + 4] >> 7) & 1) }); break;
      case 'ic': o.push({ label: '召唤限定 QOI', value: '0x' + buf[off].toString(16).toUpperCase() + (buf[off] === 20 ? ' (全局)' : '') }); break;
      case 'ci': o.push({ label: '计数限定 QCC', value: '0x' + buf[off].toString(16).toUpperCase() }); break;
      case 'rd': break;
      case 'cs': { const t = time56(buf, off); o.push({ label: '时标', value: t.text }); break; }
    }
    return o;
  }

  function parseFrame(bytes) {
    if (!bytes || bytes.length < 6) return { ok: false, err: '报文过短（至少 6 字节）' };
    if (bytes[0] !== 0x68) return { ok: false, err: '起始字节应为 0x68，实际 0x' + bytes[0].toString(16).toUpperCase() };
    const L = bytes[1];
    if (L !== bytes.length - 2) return { ok: false, err: '长度字段 L=0x' + L.toString(16) + ' 与实际剩余字节 ' + (bytes.length - 2) + ' 不符' };
    const C = bytes.slice(2, 6);
    const asdu = bytes.slice(6);
    const res = { ok: true, L, control: C };
    // 控制域
    if ((C[0] & 0x01) === 0) {
      res.frameType = 'I'; res.sendSeq = (C[0] | (C[1] << 8)) & 0x7fff; res.recvSeq = (C[2] | (C[3] << 8)) & 0x7fff;
    } else if ((C[0] & 0x03) === 0x01) {
      res.frameType = 'S'; res.recvSeq = (C[2] | (C[3] << 8)) & 0x7fff;
    } else {
      res.frameType = 'U';
      // U 帧控制域首字节高 6 位编码功能：1=STARTDT act / 2=STARTDT con /
      // 4=STOPDT act / 8=STOPDT con / 16=TESTFR act / 32=TESTFR con。
      // 旧版按低 3 位取值会把 68 04 07 00 00 00 误显示成「0x7」。
      const code = C[0] >> 2;
      const UMAP = { 1: 'STARTDT act', 2: 'STARTDT con', 4: 'STOPDT act', 8: 'STOPDT con', 16: 'TESTFR act', 32: 'TESTFR con' };
      res.uFunc = UMAP[code] || ('0x' + code.toString(16));
      res.uAct = (code === 1 || code === 4 || code === 16);
      res.uCon = (code === 2 || code === 8 || code === 32);
    }
    // 只有 I 帧携带 ASDU；S 帧仅 6 字节确认帧，强行解析会误报「ASDU 过短」。
    if (res.frameType === 'I') {
      const a = parseASDU(asdu);
      if (!a.ok) return { ok: false, err: 'ASDU: ' + a.err };
      res.asdu = a;
    }
    return res;
  }

  function parseASDU(b) {
    if (b.length < 6) return { ok: false, err: 'ASDU 过短' };
    const ti = b[0];
    const meta = TI_META[ti] || { name: '未知类型 0x' + ti.toString(16), kind: 'raw' };
    const vsq = b[1]; const sq = (vsq & 0x80) >> 7; const count = vsq & 0x7f;
    const cot = b[2]; const cotByte2 = b[3];
    const ca = b[4] | (b[5] << 8);
    const test = !!(cotByte2 & 0x80); const pn = !!(cotByte2 & 0x40);
    const originator = cotByte2 & 0x7f;
    let off = 6;
    const objs = [];
    for (let i = 0; i < count; i++) {
      if (off + 3 > b.length) return { ok: false, err: '信息对象 ' + (i + 1) + ' IOA 越界' };
      let ioa = b[off] | (b[off + 1] << 8) | (b[off + 2] << 16); off += 3;
      // SQ=1 时后续对象 IOA 递增，仅首对象带完整 IOA
      const len = meta.kind === 'raw' ? 0 : infoLen(meta.kind, meta.time);
      if (meta.kind === 'raw') { objs.push({ ioa, raw: hx(b.slice(off)) }); break; }
      if (off + len > b.length) return { ok: false, err: '信息对象 ' + (i + 1) + ' 数据越界' };
      const vals = decodeValue(meta.kind, b, off);
      if (meta.time) { const t = time56(b, off + len - 7); vals.push({ label: 'CP56Time2a', value: t.text }); }
      objs.push({ ioa, vals });
      off += len;
      if (sq && i < count - 1) ioa += 1;
    }
    return { ok: true, ti, tiName: meta.name, kind: meta.kind, sq, count, cot, cotName: COT[cot] || ('0x' + cot.toString(16)), test, pn, originator, ca, objs };
  }

  // 默认样本（I 帧：M_ME_NC_1 浮点遥测，站召唤响应，单点 IOA=1，值 123.45）
  function buildSample() {
    const f = new ArrayBuffer(4); const dv = new DataView(f); dv.setFloat32(0, 123.45, true);
    const fb = Array.from(new Uint8Array(f));
    const asdu = [7, 1, 20, 0, 1, 0, 1, 0, 0].concat(fb, [0]);
    return [0x68, asdu.length + 4].concat([1, 0, 0, 0], asdu);
  }

  TB.register({
    id: 'iec104',
    name: 'IEC 104',
    category: '协议报文解析',
    desc: 'IEC 60870-5-104 APDU/ASDU 全字段解析（帧类型、类型标识库、传送原因、CP56Time2a 时标、品质描述词）',
    render(c) {
      const input = T.el('textarea', { class: 'mono', placeholder: '粘贴 HEX，如 68 12 01 00 00 00 07 01 14 00 01 00 01 00 00 ..' });
      const out = T.el('div', { class: 'col' });

      function render(res) {
        out.innerHTML = '';
        if (!res.ok) { out.appendChild(T.el('div', { class: 'error', text: '解析失败：' + res.err })); return; }
        const ov = T.el('div', { class: 'kv' });
        ov.appendChild(T.el('div', { class: 'k', text: '起始字节' })); ov.appendChild(T.el('div', { class: 'v', text: '0x68' }));
        ov.appendChild(T.el('div', { class: 'k', text: '长度 L' })); ov.appendChild(T.el('div', { class: 'v', text: String(res.L) + ' (控制域4 + ASDU ' + (res.L - 4) + ')' }));
        ov.appendChild(T.el('div', { class: 'k', text: '帧类型' })); ov.appendChild(T.el('div', { class: 'v', text: res.frameType + (res.frameType === 'U' ? ' (' + res.uFunc + ')' : '') }));
        if (res.frameType === 'I') {
          ov.appendChild(T.el('div', { class: 'k', text: '发送序号' })); ov.appendChild(T.el('div', { class: 'v', text: String(res.sendSeq) }));
          ov.appendChild(T.el('div', { class: 'k', text: '接收序号' })); ov.appendChild(T.el('div', { class: 'v', text: String(res.recvSeq) }));
        } else if (res.frameType === 'S') {
          ov.appendChild(T.el('div', { class: 'k', text: '接收序号' })); ov.appendChild(T.el('div', { class: 'v', text: String(res.recvSeq) }));
        }
        out.appendChild(T.el('div', { class: 'hint', text: '帧概览' })); out.appendChild(ov);

        if (res.asdu) {
          const a = res.asdu;
          const av = T.el('div', { class: 'kv' });
          av.appendChild(T.el('div', { class: 'k', text: '类型标识 TI' })); av.appendChild(T.el('div', { class: 'v', text: a.ti + '  ' + a.tiName }));
          av.appendChild(T.el('div', { class: 'k', text: '结构限定 SQ' })); av.appendChild(T.el('div', { class: 'v', text: a.sq ? '1 顺序(IOA递增)' : '0 每个带IOA' }));
          av.appendChild(T.el('div', { class: 'k', text: '信息对象数' })); av.appendChild(T.el('div', { class: 'v', text: String(a.count) }));
          av.appendChild(T.el('div', { class: 'k', text: '传送原因 COT' })); av.appendChild(T.el('div', { class: 'v', text: a.cot + '  ' + a.cotName + (a.test ? ' [测试T]' : '') + (a.pn ? ' [否定P/N]' : '') }));
          av.appendChild(T.el('div', { class: 'k', text: '源发址' })); av.appendChild(T.el('div', { class: 'v', text: String(a.originator) }));
          av.appendChild(T.el('div', { class: 'k', text: '公共地址 CA' })); av.appendChild(T.el('div', { class: 'v', text: String(a.ca) }));
          out.appendChild(T.el('div', { class: 'hint', text: 'ASDU' })); out.appendChild(av);

          const tbl = T.el('table', {});
          tbl.appendChild(T.el('tr', {}, [T.el('th', { text: '信息对象地址 IOA' }), T.el('th', { text: '字段' }), T.el('th', { text: '值' })]));
          a.objs.forEach(o => {
            if (o.raw) { tbl.appendChild(T.el('tr', {}, [T.el('td', { text: String(o.ioa) }), T.el('td', { text: '原始' }), T.el('td', { class: 'mono', text: o.raw })])); return; }
            o.vals.forEach((v, idx) => tbl.appendChild(T.el('tr', {}, [
              idx === 0 ? T.el('td', { rowspan: String(o.vals.length), text: String(o.ioa) }) : null,
              T.el('td', { text: v.label }), T.el('td', { class: 'mono', text: v.value })
            ])));
          });
          out.appendChild(tbl);
        }
      }

      input.addEventListener('input', () => {
        const b = parseHex(input.value);
        if (!b) { out.innerHTML = ''; out.appendChild(T.el('div', { class: 'error', text: 'HEX 格式错误（需偶数字符、0-9/A-F）' })); return; }
        render(parseFrame(b));
      });

      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: 'IEC 60870-5-104 报文解析' }),
        T.el('div', { class: 'row' }, [
          T.el('button', { class: 'btn sm primary', text: '载入示例', onclick: () => { input.value = hx(buildSample()); input.dispatchEvent(new Event('input')); } }),
          T.el('button', { class: 'btn sm', text: '清空', onclick: () => { input.value = ''; input.dispatchEvent(new Event('input')); } })
        ]),
        input,
        T.el('div', { class: 'hint', text: 'I 帧含 ASDU；S 帧为接收确认；U 帧为 STARTDT/STOPDT/TESTFR。粘贴完整 APDU（含 68 + 长度）。' }),
        out
      ]));

      // 由「IEC 104 四遥点位计算器」组包后跳转过来时，自动载入待解析报文
      let pending = '';
      try {
        pending = localStorage.getItem('tb_iec104_frame') || '';
        if (pending && localStorage.removeItem) localStorage.removeItem('tb_iec104_frame');
      } catch (e) { pending = ''; }
      input.value = pending || hx(buildSample());
      input.dispatchEvent(new Event('input'));
    }
  });
})();
