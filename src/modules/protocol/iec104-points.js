// IEC 60870-5-104 四遥点位计算器：点表检索 / 点号↔IOA 换算 / ASDU 组包 / 自定义点表导入
// 内置点表来自 SmartLogger V300R024C10SPC275 IEC104 转发协议接口描述（见 src/data/iec104-points.js）。
// 纯离线：桌面版可经 /api/points/xlsx 直接导入 .xlsx；纯前端可导入 CSV / TSV / JSON。
(function () {
  const T = TB.util;
  const STORE = 'tb_iec104_dataset';
  const FALLBACK = {
    bases: { yx: 0x0001, yc: 0x4001, yk: 0x6001, yt: 0x6201 },
    byteCfg: { ca: 2, cot: 2, ioa: 3 },
    catNames: { yx: '遥信', yc: '遥测', yk: '遥控', yt: '遥调' },
    catOrder: ['yx', 'yc', 'yk', 'yt'],
    ti: { huawei: { yx: 1, yc: 13, yk: 45, yt: 50 }, standard: { yx: 1, yc: 7, yk: 45, yt: 50 } },
    slaves: [{ name: 'SmartLogger', slave: 0, yx: [1, 8192], yc: [1, 8192], yk: [1, 512], yt: [1, 512] }],
    devices: [],
    meta: { source: '内置默认配置（点表数据未加载）', sheets: 0, points: 0 }
  };
  const TI_NAME = {
    1: 'M_SP_NA_1 单点信息 / 单点遥信', 7: '测量值·短浮点数（标准 IEC 104）',
    13: '测量值·短浮点数（SmartLogger 文档 TI=13，厂商/101 体系）',
    45: 'C_SC_NA_1 单点命令 / 单点遥控', 46: 'C_DC_NA_1 双点命令', 50: '设定值命令·短浮点数 / 遥调'
  };
  const COT_NAME = {
    1: '周期/循环', 2: '背景扫描', 3: '突发', 5: '请求', 6: '激活', 7: '激活确认',
    8: '停止激活', 10: '激活终止', 20: '响应站召唤'
  };

  // ---------- 数据归一化 ----------
  function num(v, def) { const n = Number(v); return isFinite(n) ? n : def; }
  function normalize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const src = raw;
    const out = {
      bases: {}, basesDesc: {}, byteCfg: {}, catNames: FALLBACK.catNames,
      catOrder: FALLBACK.catOrder, ti: FALLBACK.ti, slaves: [], devices: [], meta: {}
    };
    for (const k of out.catOrder) {
      const v = src.bases && src.bases[k];
      if (typeof v === 'object' && v != null && isFinite(Number(v.from))) out.bases[k] = Number(v.from);
      else out.bases[k] = num(v, FALLBACK.bases[k]);
      if (src.basesDesc && src.basesDesc[k]) out.basesDesc[k] = src.basesDesc[k];
      else if (typeof v === 'object' && v != null && v.hex) out.basesDesc[k] = v;
    }
    for (const k of ['ca', 'cot', 'ioa']) out.byteCfg[k] = num(src.byteCfg && src.byteCfg[k], FALLBACK.byteCfg[k]);
    if (src.catNames) out.catNames = src.catNames;
    if (src.ti && src.ti.huawei && src.ti.standard) out.ti = src.ti;
    out.slaves = Array.isArray(src.slaves) && src.slaves.length ? src.slaves : FALLBACK.slaves;
    out.devices = (Array.isArray(src.devices) ? src.devices : []).map((d, i) => ({
      id: d.id || 'imp' + i, name: d.name || ('导入表 ' + (i + 1)),
      sheet: num(d.sheet, i + 1), models: Array.isArray(d.models) ? d.models : [],
      g: d.g || {}
    }));
    out.meta = src.meta || { source: '自定义点表' };
    return out;
  }

  // ---------- 纯函数（挂到 TB 上便于回归测试直接调用） ----------
  const calc = {
    data: null,
    setData(raw) { this.data = normalize(raw); return this.data; },
    base(cat) { const d = this.data || FALLBACK; return num(d.bases[cat], FALLBACK.bases[cat]); },
    ioaOf(cat, globalNo) {
      const g = Math.round(num(globalNo, NaN));
      if (!isFinite(g) || g < 1) return null;
      return this.base(cat) + g - 1;
    },
    globalOf(cat, ioa) {
      const i = Math.round(num(ioa, NaN));
      if (!isFinite(i)) return null;
      const g = i - this.base(cat) + 1;
      return g >= 1 ? g : null;
    },
    catOfIoa(ioa) {
      const i = Math.round(num(ioa, NaN));
      if (!isFinite(i) || i < 0) return null;
      const d = this.data || FALLBACK;
      // 按基地址升序找最后一个不超过 ioa 的类别，并校验该段容量。
      // 文档给出 to 时用 to；否则用下一段基地址 − 1 作为上界，避免越界地址被误判。
      const ordered = ['yx', 'yc', 'yk', 'yt'].sort((a, b) => this.base(a) - this.base(b));
      let hit = null;
      for (let n = 0; n < ordered.length; n++) {
        const k = ordered[n];
        const desc = d.basesDesc && d.basesDesc[k];
        let to = desc && isFinite(Number(desc.to)) ? Number(desc.to) : null;
        if (to === null && n + 1 < ordered.length) to = this.base(ordered[n + 1]) - 1;
        if (i >= this.base(k) && (to === null || i <= to)) hit = k;
      }
      return hit;
    },
    slaveOf(cat, globalNo) {
      const d = this.data || FALLBACK;
      const g = Math.round(num(globalNo, NaN));
      if (!isFinite(g)) return null;
      const list = d.slaves || [];
      return list.find(s => Array.isArray(s[cat]) && g >= num(s[cat][0], 0) && g <= num(s[cat][1], -1)) || null;
    },
    localOf(slave, cat, globalNo) {
      if (!slave || !Array.isArray(slave[cat])) return null;
      const g = Math.round(num(globalNo, NaN));
      if (!isFinite(g)) return null;
      return g - num(slave[cat][0], 1) + 1;
    },
    ioaBytes(ioa) {
      const i = Math.round(num(ioa, NaN));
      if (!isFinite(i) || i < 0 || i > 0xFFFFFF) return null;
      return [i & 255, (i >> 8) & 255, (i >> 16) & 255];
    },
    hex(n, w) { return (Number(n) >>> 0).toString(16).toUpperCase().padStart(w || 2, '0'); },
    bytesHex(b) { return b.map(x => this.hex(x, 2)).join(' '); },
    // 值编码：短浮点 4 字节小端 / 单点状态 1 字节 / 品质字节
    encodeValue(cat, rawValue, flags) {
      const f = flags || {};
      if (cat === 'yc' || cat === 'yt') {
        const v = Number(rawValue);
        if (!isFinite(v)) return null;
        const buf = new ArrayBuffer(4), dv = new DataView(buf);
        dv.setFloat32(0, v, true);
        const b = Array.from(new Uint8Array(buf));
        let q = 0;
        if (f.iv) q |= 1; if (f.nt) q |= 2; if (f.sb) q |= 4; if (f.bl) q |= 8; if (f.ov) q |= 16;
        if (f.se) q |= 128;
        return b.concat([q]);
      }
      if (cat === 'yx') {
        let b = (num(rawValue, 0) ? 1 : 0);
        if (f.bl) b |= 16; if (f.sb) b |= 32; if (f.nt) b |= 64; if (f.iv) b |= 128;
        return [b];
      }
      if (cat === 'yk') {
        let b = (num(rawValue, 0) ? 1 : 0);
        if (f.qu) b |= (num(f.qu, 0) & 31) << 2;
        if (f.se) b |= 128;
        return [b];
      }
      return null;
    },
    // 生成 I 帧 APDU：68 L 控制域(4) ASDU
    frame(cfg) {
      const c = cfg || {};
      const cat = c.cat || 'yc';
      const ti = num(c.ti, (this.data || FALLBACK).ti.huawei[cat]);
      const ca = num(c.ca, 1), cot = num(c.cot, cat === 'yk' || cat === 'yt' ? 6 : 3);
      const ioaB = this.ioaBytes(c.ioa);
      const val = c.valueBytes || this.encodeValue(cat, c.value, c.flags);
      if (!ioaB || !val) return null;
      const asdu = [ti & 255, 0x01, cot & 255, 0x00, ca & 255, (ca >> 8) & 255]
        .concat(ioaB, val);
      const ctrl = [c.sendSeq || 0, ((c.sendSeq || 0) >> 8) & 255, c.recvSeq || 0, ((c.recvSeq || 0) >> 8) & 255]
        .map((x, i) => i % 2 === 0 ? (x & 255) : (x & 0x7f));
      ctrl[0] &= 0xfe; ctrl[2] &= 0xfe; // I 帧：bit0=0
      const apdu = [0x68, asdu.length + 4].concat(ctrl, asdu);
      return { bytes: apdu, hex: this.bytesHex(apdu), asduHex: this.bytesHex(asdu), ti: ti & 255, ioa: c.ioa, cat, cot, ca };
    },
    // 全文检索：返回 [{cat, dev, p, global, ioa}]，按相关度（名称命中优先）+ 点号排序
    search(q, opts) {
      const o = opts || {};
      const d = this.data || FALLBACK;
      const terms = String(q || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
      const out = [];
      for (const dev of d.devices) {
        if (o.device && dev.name !== o.device) continue;
        for (const cat of d.catOrder) {
          if (o.cat && o.cat !== cat) continue;
          const list = dev.g[cat] || [];
          for (const p of list) {
            if (terms.length) {
              const hay = (p.s + ' ' + (p.u || '') + ' ' + (p.x || '') + ' ' + (p.g || '') + ' ' +
                (p.r || '') + ' ' + dev.name + ' ' + (dev.models || []).join(' ')).toLowerCase();
              if (!terms.every(t => hay.indexOf(t) >= 0)) continue;
            }
            const global = num(o.start, 1) + p.n - 1;
            out.push({ cat, dev: dev.name, p, global, ioa: this.ioaOf(cat, global) });
          }
        }
      }
      return out;
    },
    // CSV / TSV：兼容「四遥分区布局」（xlsx 另存）与「扁平表头」两种格式
    splitTable(text) {
      const sep = (String(text).indexOf('\t') >= 0 && String(text).indexOf(',') < 0) ? '\t' : ',';
      const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim() !== '');
      return lines.map(line => {
        const cells = []; let cur = '', quoted = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted; }
          else if (ch === sep && !quoted) { cells.push(cur.trim()); cur = ''; }
          else cur += ch;
        }
        cells.push(cur.trim());
        return cells;
      });
    },
    parseCSV(text) {
      const rows = this.splitTable(text);
      if (!rows.length) return null;
      const catKeys = { '遥测': 'yc', '遥信': 'yx', '遥控': 'yk', '遥调': 'yt', yc: 'yc', yx: 'yx', yk: 'yk', yt: 'yt' };
      const marks = [];
      rows[0].forEach((v, i) => { if (catKeys[v]) marks.push({ col: i, cat: catKeys[v] }); });
      const g = {};
      if (marks.length && rows.length > 1) {
        const hdr = rows[1], width = Math.max.apply(null, rows.map(r => r.length));
        for (let k = 0; k < marks.length; k++) {
          const m = marks[k], end = k + 1 < marks.length ? marks[k + 1].col : width;
          const fields = {};
          for (let c = m.col; c < end && c < hdr.length; c++) {
            const label = hdr[c] || '';
            for (const [token, key] of [['序号', 'n'], ['信号名称', 's'], ['单位', 'u'], ['精度', 'p'], ['范围', 'g'], ['状态', 'x'], ['命令', 'x'], ['备注', 'r']]) {
              if (label.indexOf(token) >= 0 && fields[key] === undefined) fields[key] = c;
            }
          }
          if (fields.n === undefined || fields.s === undefined) continue;
          const list = [];
          for (let i = 2; i < rows.length; i++) {
            const row = rows[i], no = parseInt(row[fields.n], 10), name = row[fields.s] || '';
            if (!name || !isFinite(no) || no < 1) continue;
            const p = { n: no, s: name.slice(0, 120) };
            for (const [key, lim] of [['u', 20], ['p', 24], ['g', 60], ['x', 120], ['r', 180]]) {
              if (fields[key] !== undefined) p[key] = String(row[fields[key]] || '').slice(0, lim);
            }
            list.push(p);
          }
          if (list.length) g[m.cat] = list.sort((a, b) => a.n - b.n);
        }
      }
      if (Object.keys(g).length) {
        return { meta: { source: '导入的 CSV / TSV 点表', sheets: 1, points: Object.keys(g).reduce((s, k) => s + g[k].length, 0) },
          devices: [{ id: 'csv', name: '导入点表', sheet: 1, models: [], g }] };
      }
      // 扁平表头：类别 / 序号 / 信号名称 / ...
      const head = rows[0].map(x => x.toLowerCase());
      const idx = (names) => names.map(n => head.findIndex(h => h.indexOf(n) >= 0)).find(i => i >= 0);
      const ci = idx(['类别', 'cat', '四遥']), ni = idx(['序号', '点号', 'no']), si = idx(['信号名称', '名称', 'name']);
      if (ci === undefined || ni === undefined || si === undefined) return null;
      const flat = {};
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i], cat = catKeys[r[ci]] || catKeys[String(r[ci] || '').toLowerCase()];
        const no = parseInt(r[ni], 10);
        if (!cat || !isFinite(no) || no < 1 || !r[si]) continue;
        (flat[cat] = flat[cat] || []).push({
          n: no, s: String(r[si]).slice(0, 120),
          u: (r[idx(['单位', 'unit'])] || '').slice(0, 20),
          x: (r[idx(['状态', '命令', 'state'])] || '').slice(0, 120),
          r: (r[idx(['备注', 'remark'])] || '').slice(0, 180)
        });
      }
      if (!Object.keys(flat).length) return null;
      return { meta: { source: '导入的扁平 CSV 点表', sheets: 1, points: Object.keys(flat).reduce((s, k) => s + flat[k].length, 0) },
        devices: [{ id: 'csv', name: '导入点表', sheet: 1, models: [], g: flat }] };
    }
  };
  TB.iec104calc = calc;

  function hx(n) { return '0x' + calc.hex(n, 4); }
  function copyBtn(getText) { return T.copyBtn(getText); }

  TB.register({
    id: 'iec104-points', name: 'IEC 104 四遥点位计算器', category: '协议报文解析', icon: '📍',
    desc: 'SmartLogger 点表全文检索 + 四遥点号/信息体地址换算 + ASDU 报文组包；支持导入 xlsx / CSV / TSV / JSON 自定义点表。',
    accepts: ['*'],
    tips: [
      '内置 40 张设备表 / 5561 条四遥点位，可直接搜「有功功率」「DI1」「开机」等关键词',
      '全局点号 = 转发设备起始点号 + 表内序号 − 1；IOA = 该类基地址 + 全局点号 − 1',
      '桌面版可直接导入 .xlsx 原表；网页预览请另存为 CSV / TSV 再导入',
      '点击搜索结果行可把点位一键填入上方计算器并生成 ASDU 报文'
    ],
    ref: [
      { k: '遥信', v: '基地址 0001H–2000H，8192 点，TI=1 单点信息' },
      { k: '遥测', v: '基地址 4001H–6000H，8192 点，文档 TI=13 短浮点' },
      { k: '遥控', v: '基地址 6001H–6200H，512 点，TI=45/46 单/双点命令' },
      { k: '遥调', v: '基地址 6201H–6400H，512 点，TI=50 短浮点设定' },
      { k: '字节数', v: '公共地址 2 / 传送原因 2 / 信息体地址 3（低字节在前）' }
    ],
    refs: [
      'SmartLogger V300R024C10SPC275《IEC104 转发协议接口描述》「总体描述」：信息体基地址范围与字节数配置',
      '同文档「转发设备配置」：每个从机在四遥转发队列中的起始/结束点号',
      'IEC 60870-5-104：APDU = 68 + L + 控制域(4) + ASDU；ASDU = TI + VSQ + COT(2) + CA(2) + IOA(3) + 信息对象',
      'IEEE 754 单精度短浮点按小端传输；QDS / SIQ / SCO / QOS 品质与命令字节按位组合'
    ],
    limits: [
      '文档遥测类型标识为 TI=13（厂商/101 体系），标准 IEC 104 短浮点为 TI=7；组包前请按主站实际规约选择，选错会导致对端不识别',
      '点表为事实性点位清单整理，仅供现场点号核对；正式工程请以设备厂商随附文档与现场点表为准',
      '转发设备起始点号取决于数采 WEB 的 IEC104 转发参数配置，本工具用的是文档中的示例配置，现场可能不同',
      '生成的报文为主站/子站模拟帧，未做传输层序号、超时与总召唤流程；下发遥控前务必确认点号与对象'
    ],
    render(c, ctx) {
      const builtin = window.TB_IEC104_POINTS || null;
      let data;
      let custom = null;
      try { custom = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { custom = null; }
      function use(raw, persist) {
        let d = calc.setData(raw || FALLBACK);
        if (!d) d = calc.setData(FALLBACK); // 自定义数据损坏时安全回退
        data = d;
        if (persist) { try { localStorage.setItem(STORE, JSON.stringify(raw)); } catch (e) {} }
        return d;
      }
      use(custom || builtin || FALLBACK, false);

      const msg = T.el('div', { class: 'hint', id: 'ip_msg', text: '' });
      function say(t, warn) { msg.textContent = t; msg.className = 'hint' + (warn ? ' warn-text' : ''); }

      // ---------- 1. 点表来源与配置 ----------
      const infoBox = T.el('div', { class: 'kv', id: 'ip_info' });
      const tiSel = T.el('select', { id: 'ip_ti', 'aria-label': '类型标识方案' }, [
        T.el('option', { value: 'huawei', text: 'SmartLogger 文档（遥测 TI=13）' }),
        T.el('option', { value: 'standard', text: '标准 IEC 104（遥测 TI=7）' })
      ]);
      const slaveSel = T.el('select', { id: 'ip_slave', 'aria-label': '转发设备 / 从机地址' });
      const startInp = T.el('input', { type: 'number', id: 'ip_start', value: '1', min: '1', 'aria-label': '转发设备起始点号' });
      const devSel = T.el('select', { id: 'ip_dev', 'aria-label': '设备点表' });
      const catSel = T.el('select', { id: 'ip_cat', 'aria-label': '四遥类别' });
      const fileInp = T.el('input', { type: 'file', id: 'ip_file', accept: '.xlsx,.csv,.tsv,.json', 'aria-label': '导入点表文件' });
      const pasteInp = T.el('textarea', { class: 'mono', id: 'ip_paste', rows: '3', placeholder: '或粘贴 CSV / TSV / JSON 点表内容…' });

      function fillSelect(sel, items, keep) {
        const old = keep ? sel.value : '';
        sel.innerHTML = '';
        items.forEach(it => sel.appendChild(T.el('option', { value: it.v, text: it.t })));
        if (old && items.some(it => it.v === old)) sel.value = old;
      }
      function paintInfo() {
        infoBox.innerHTML = '';
        const rows = [
          ['点表来源', (data.meta && data.meta.source) || '自定义'],
          ['设备表 / 点位', (data.meta && data.meta.sheets != null ? data.meta.sheets : data.devices.length) + ' 张 / ' +
            (data.meta && data.meta.points != null ? data.meta.points : data.devices.reduce((s, d) => s + Object.keys(d.g).reduce((a, k) => a + d.g[k].length, 0), 0)) + ' 条'],
          ['四遥基地址', data.catOrder.map(k => data.catNames[k] + ' ' + hx(data.bases[k])).join('  ·  ')],
          ['字节数', 'CA ' + data.byteCfg.ca + ' / COT ' + data.byteCfg.cot + ' / IOA ' + data.byteCfg.ioa],
          ['转发设备', data.slaves.length + ' 台（含示例配置）']
        ];
        rows.forEach(([k, v]) => { infoBox.appendChild(T.el('div', { class: 'k', text: k })); infoBox.appendChild(T.el('div', { class: 'v', text: v })); });
      }
      function paintSelects() {
        fillSelect(slaveSel, data.slaves.map((s, i) => ({ v: String(i), t: '#' + s.slave + ' ' + s.name + '（遥测 ' + s.yc[0] + '–' + s.yc[1] + '）' })), true);
        fillSelect(devSel, data.devices.map(d => ({ v: d.name, t: d.name })), true);
        fillSelect(catSel, data.catOrder.map(k => ({ v: k, t: data.catNames[k] })), true);
        const idx = parseInt(slaveSel.value || '0', 10) || 0;
        const s = data.slaves[idx] || data.slaves[0];
        const cat = catSel.value || 'yc';
        if (s && Array.isArray(s[cat])) startInp.value = String(s[cat][0]);
        paintInfo();
      }

      function afterImport(raw, label) {
        if (!raw) { say('导入失败：无法识别点表格式。需含「遥测/遥信/遥控/遥调」分区或「类别,序号,信号名称」表头。', true); return; }
        use(raw, true);
        paintSelects();
        say('已' + label + '：' + data.devices.length + ' 张表 / ' +
          data.devices.reduce((s, d) => s + Object.keys(d.g).reduce((a, k) => a + d.g[k].length, 0), 0) + ' 条点位。');
        runSearch();
      }
      function importText(text, name) {
        const t = String(text || '').trim();
        if (!t) { say('没有可导入的内容。', true); return; }
        if (t.charAt(0) === '{') {
          try { afterImport(JSON.parse(t), '导入 ' + name); } catch (e) { say('JSON 解析失败：' + e.message, true); }
          return;
        }
        afterImport(calc.parseCSV(t), '导入 ' + name);
      }
      async function importFile(file) {
        const name = file && file.name ? file.name : '点表';
        const lower = name.toLowerCase();
        if (lower.endsWith('.xlsx')) {
          if (typeof fetch !== 'function') { say('当前环境无法导入 xlsx：请在桌面版打开，或另存为 CSV / TSV。', true); return; }
          try {
            say('正在解析 ' + name + ' …');
            const r = await fetch('/api/points/xlsx', { method: 'POST', body: file });
            const j = await r.json();
            if (!j.ok) { say('导入失败：' + (j.error || '服务端拒绝'), true); return; }
            afterImport(j, '导入 ' + name);
          } catch (e) { say('导入 xlsx 失败：' + (e && e.message ? e.message : e) + '（网页预览请另存为 CSV）', true); }
          return;
        }
        if (typeof FileReader === 'undefined') { say('当前环境不支持读取文件，请直接粘贴点表内容。', true); return; }
        const fr = new FileReader();
        fr.onload = () => importText(String(fr.result || ''), name);
        fr.onerror = () => say('读取文件失败。', true);
        fr.readAsText(file, 'utf-8');
      }
      fileInp.addEventListener('change', () => { if (fileInp.files && fileInp.files[0]) importFile(fileInp.files[0]); });

      function exportCSV() {
        const rows = [['类别', '设备表', '表内序号', '信号名称', '单位', '精度', '范围', '状态/命令', '备注', '全局点号', 'IOA', 'IOA(HEX)']];
        const start = num(startInp.value, 1);
        data.devices.forEach(d => data.catOrder.forEach(cat => (d.g[cat] || []).forEach(p => {
          const g = start + p.n - 1, ioa = calc.ioaOf(cat, g);
          rows.push([data.catNames[cat], d.name, p.n, p.s, p.u || '', p.p || '', p.g || '', p.x || '', p.r || '', g, ioa, calc.hex(ioa, 6)]);
        })));
        const text = rows.map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\n');
        if (typeof URL === 'undefined' || !URL.createObjectURL || typeof document === 'undefined') { say('当前环境不支持下载，请复制下方结果。', true); return; }
        try {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' }));
          a.download = 'iec104-points.csv';
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          say('已导出当前点表（' + (rows.length - 1) + ' 条）为 CSV。');
        } catch (e) { say('导出失败：' + e.message, true); }
      }

      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '点表来源与配置' }),
        infoBox,
        T.el('div', { class: 'hint', text: '点表为 SmartLogger IEC104 转发协议接口描述的事实性点位整理，仅作现场核对参考；正式工程以厂商随设备提供的文档为准。' }),
        T.el('div', { class: 'form-grid' }, [
          T.el('div', { class: 'field' }, [T.el('label', { text: '设备点表' }), devSel]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '转发设备 / 从机' }), slaveSel]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '四遥类别' }), catSel]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '转发设备起始点号' }), startInp]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '类型标识方案' }), tiSel])
        ]),
        T.el('div', { class: 'row', style: 'margin-top:12px' }, [
          fileInp,
          T.el('button', { class: 'btn sm primary', text: '导入粘贴内容', onclick: () => importText(pasteInp.value, '粘贴点表') }),
          T.el('button', { class: 'btn sm ghost', text: '导出当前点表 CSV', onclick: exportCSV }),
          T.el('button', { class: 'btn sm ghost', text: '恢复内置点表', onclick: () => {
            try { localStorage.removeItem(STORE); } catch (e) {}
            use(builtin || FALLBACK, false); paintSelects(); runSearch(); say('已恢复内置 SmartLogger 点表。');
          } })
        ]),
        pasteInp, msg
      ]));

      // ---------- 2. 四遥点位计算（正向 / 反向） ----------
      const localInp = T.el('input', { type: 'number', id: 'ip_local', value: '1', min: '1', 'aria-label': '表内序号' });
      const ioaInp = T.el('input', { type: 'text', id: 'ip_ioa', value: '16385', 'aria-label': 'IOA 十进制或 0x 十六进制' });
      const calcOut = T.el('div', { class: 'col', id: 'ip_calc' });
      function pointFor(cat, localNo) {
        const dev = data.devices.find(d => d.name === devSel.value) || data.devices[0];
        if (!dev) return null;
        return (dev.g[cat] || []).find(p => p.n === Math.round(num(localNo, -1))) || null;
      }
      function renderCalc(res) {
        calcOut.innerHTML = '';
        if (!res.ok) { calcOut.appendChild(T.el('div', { class: 'error', text: res.err })); return; }
        const kv = T.el('div', { class: 'kv' });
        const add = (k, v) => { kv.appendChild(T.el('div', { class: 'k', text: k })); kv.appendChild(T.el('div', { class: 'v', text: String(v) })); };
        add('四遥类别', data.catNames[res.cat] + ' (' + res.cat + ')');
        add('类基地址', hx(data.bases[res.cat]) + ' / 十进制 ' + data.bases[res.cat]);
        add('全局点号', res.global + '（起始 ' + res.start + ' + 表内序号 ' + res.local + ' − 1）');
        add('信息体地址 IOA', res.ioa + '  ·  ' + calc.hex(res.ioa, 6) + 'H  ·  十进制');
        add('IOA 三字节(低在前)', calc.bytesHex(calc.ioaBytes(res.ioa) || []));
        add('所属转发设备', res.slave ? ('#' + res.slave.slave + ' ' + res.slave.name) : '未落在示例配置区间');
        add('ASDU 类型标识', 'TI=' + res.ti + '  ' + (TI_NAME[res.ti] || ''));
        if (res.p) {
          add('信号名称', res.p.s);
          if (res.p.u) add('单位', res.p.u);
          if (res.p.p) add('精度', res.p.p);
          if (res.p.g) add('范围', res.p.g);
          if (res.p.x) add('状态 / 命令', res.p.x);
          if (res.p.r) add('备注', res.p.r);
        } else add('信号名称', '（当前设备表无此序号的点位）');
        calcOut.appendChild(kv);
        calcOut.appendChild(T.el('div', { class: 'row' }, [
          T.el('button', { class: 'btn sm primary', text: '生成 ASDU 报文 →', onclick: () => {
            valueInp.value = guessValue(res);
            buildFrame();
            if (frameBox.scrollIntoView) frameBox.scrollIntoView();
          } }),
          T.el('button', { class: 'btn sm ghost', text: '发布 IOA 到中转站', onclick: () => {
            if (TB.bus) { TB.bus.publish('iec104-points', (res.p && res.p.s) || (data.catNames[res.cat] + ' 点号 ' + res.global), res.ioa, 'IOA'); say('已发布 IOA ' + res.ioa + ' 到结果中转站。'); }
          } }),
          copyBtn(() => String(res.ioa))
        ]));
      }
      function guessValue(res) {
        if (res.p && res.p.x && /[-+]?\d+(\.\d+)?/.test(res.p.x)) {
          const m = res.p.x.match(/[-+]?\d+(\.\d+)?/); if (m) return m[0];
        }
        return res.cat === 'yx' || res.cat === 'yk' ? '1' : '0';
      }
      function forward() {
        const cat = catSel.value || 'yc';
        const start = num(startInp.value, 1), local = num(localInp.value, NaN);
        const global = start + local - 1, ioa = calc.ioaOf(cat, global);
        if (ioa == null) { renderCalc({ ok: false, err: '表内序号或起始点号无效' }); return; }
        renderCalc({ ok: true, cat, start, local, global, ioa, slave: calc.slaveOf(cat, global),
          ti: (data.ti[tiSel.value] || data.ti.huawei)[cat], p: pointFor(cat, local) });
      }
      function parseIoa(s) {
        const v = String(s || '').trim();
        if (/^0x[0-9a-f]+$/i.test(v)) return parseInt(v.slice(2), 16);
        if (/^[0-9a-f]+H$/i.test(v)) return parseInt(v.slice(0, -1), 16);
        return num(v, NaN);
      }
      function reverse() {
        const ioa = parseIoa(ioaInp.value);
        const cat = calc.catOfIoa(ioa);
        if (cat == null) { renderCalc({ ok: false, err: 'IOA 无效或不在四遥地址范围内（0x0001–0x6400）' }); return; }
        const global = calc.globalOf(cat, ioa);
        const slave = calc.slaveOf(cat, global);
        const start = slave ? num(slave[cat][0], 1) : 1;
        const local = calc.localOf(slave || { [cat]: [start, start + 8191] }, cat, global);
        startInp.value = String(start); localInp.value = String(local); catSel.value = cat;
        renderCalc({ ok: true, cat, start, local, global, ioa, slave,
          ti: (data.ti[tiSel.value] || data.ti.huawei)[cat], p: pointFor(cat, local) });
        runSearch();
      }
      [localInp, startInp, catSel, devSel, tiSel].forEach(el => el.addEventListener('input', forward));
      [catSel, devSel, tiSel].forEach(el => el.addEventListener('change', forward));
      slaveSel.addEventListener('change', () => {
        const s = data.slaves[parseInt(slaveSel.value || '0', 10) || 0];
        if (s && Array.isArray(s[catSel.value])) { startInp.value = String(s[catSel.value][0]); forward(); runSearch(); }
      });
      ioaInp.addEventListener('input', reverse);
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '四遥点位计算（点号 ⇄ 信息体地址）' }),
        T.el('div', { class: 'form-grid' }, [
          T.el('div', { class: 'field' }, [T.el('label', { text: '表内序号 → 计算 IOA' }), localInp,
            T.el('button', { class: 'btn sm primary', text: '正向计算', onclick: forward })]),
          T.el('div', { class: 'field' }, [T.el('label', { text: 'IOA → 反查类别 / 点号 / 信号' }), ioaInp,
            T.el('button', { class: 'btn sm ghost', text: '反向反查', onclick: reverse })])
        ]),
        T.el('div', { class: 'hint', text: '全局点号 = 起始点号 + 表内序号 − 1；IOA = 类基地址 + 全局点号 − 1。IOA 可输入十进制、0x4001 或 4001H。' }),
        calcOut
      ]));

      // ---------- 3. ASDU 报文组包（四遥结果） ----------
      const valueInp = T.el('input', { type: 'text', id: 'ip_value', value: '123.45', 'aria-label': '遥测/遥调值或遥信/遥控状态' });
      const caInp = T.el('input', { type: 'number', id: 'ip_ca', value: '1', min: '0', 'aria-label': '公共地址 CA' });
      const cotSel = T.el('select', { id: 'ip_cot', 'aria-label': '传送原因' },
        Object.keys(COT_NAME).map(k => T.el('option', { value: k, text: k + ' ' + COT_NAME[k] })));
      cotSel.value = '3';
      const flagBox = T.el('div', { class: 'row', id: 'ip_flags' });
      const flags = {};
      [['iv', 'IV 无效'], ['nt', 'NT 非当前'], ['sb', 'SB 替代'], ['bl', 'BL 封锁'], ['ov', 'OV 溢出'], ['se', 'SE 选择(遥控/遥调)']].forEach(([k, label]) => {
        const cb = T.el('input', { type: 'checkbox', id: 'ip_f_' + k, 'aria-label': label });
        cb.checked = false;
        cb.addEventListener('change', () => { flags[k] = !!cb.checked; buildFrame(); });
        flagBox.appendChild(T.el('label', { class: 'pill', text: label }, [cb]));
      });
      const frameBox = T.el('div', { class: 'col', id: 'ip_frame' });
      let lastFrame = null;
      function buildFrame() {
        frameBox.innerHTML = '';
        const cat = catSel.value || 'yc';
        const start = num(startInp.value, 1), local = num(localInp.value, 1);
        const global = start + local - 1, ioa = calc.ioaOf(cat, global);
        const ti = (data.ti[tiSel.value] || data.ti.huawei)[cat];
        if (ioa == null) { frameBox.appendChild(T.el('div', { class: 'error', text: '点号无效，无法组包' })); return; }
        const f = calc.frame({ cat, ti, ioa, ca: num(caInp.value, 1), cot: num(cotSel.value, 3),
          value: valueInp.value, flags });
        if (!f) { frameBox.appendChild(T.el('div', { class: 'error', text: '数值无效：遥测/遥调需填数字' })); return; }
        lastFrame = f;
        const kv = T.el('div', { class: 'kv' });
        const add = (k, v) => { kv.appendChild(T.el('div', { class: 'k', text: k })); kv.appendChild(T.el('div', { class: 'v', text: v })); };
        add('类型标识 TI', f.ti + '  ' + (TI_NAME[f.ti] || ''));
        add('传送原因 COT', f.cot + '  ' + (COT_NAME[f.cot] || ''));
        add('公共地址 CA', String(f.ca));
        add('信息体地址 IOA', f.ioa + ' / ' + calc.hex(f.ioa, 6) + 'H / 三字节 ' + calc.bytesHex(calc.ioaBytes(f.ioa) || []));
        add('ASDU HEX', f.asduHex);
        add('APDU 长度', String(f.bytes.length) + ' 字节（L=' + f.bytes[1] + '）');
        frameBox.appendChild(kv);
        frameBox.appendChild(T.el('div', { class: 'hint', text: '完整 I 帧（68 L + 控制域 4B + ASDU）' }));
        frameBox.appendChild(T.el('div', { class: 'pre mono', id: 'ip_frame_hex', text: f.hex }));
        frameBox.appendChild(T.el('div', { class: 'row' }, [
          copyBtn(() => lastFrame ? lastFrame.hex : ''),
          T.el('button', { class: 'btn sm ghost', text: '发布报文到中转站', onclick: () => {
            if (TB.bus) { TB.bus.publish('iec104-points', data.catNames[cat] + ' IOA ' + ioa + ' 报文', f.hex, 'HEX'); say('已发布报文到结果中转站，可在设备联调中复制使用。'); }
          } }),
          T.el('button', { class: 'btn sm ghost', text: '在 IEC 104 解析器中打开', onclick: () => {
            try { localStorage.setItem('tb_iec104_frame', f.hex); } catch (e) {}
            say('报文已暂存，切换到「IEC 104」工具可粘贴解析。');
            if (typeof location !== 'undefined' && location.hash !== undefined) location.hash = '#/m/iec104';
          } }),
          T.el('button', { class: 'btn sm ghost', text: '送入设备联调 →', onclick: () => {
            try { localStorage.setItem('tb_bridge_frame', JSON.stringify({ hex: f.hex, mode: 'tcp', at: Date.now() })); } catch (e) {}
            say('报文已送入设备联调（裸 TCP 模式，IEC 104 常用端口 2404）。');
            if (typeof location !== 'undefined' && location.hash !== undefined) location.hash = '#/m/device-bridge';
          } })
        ]));
      }
      [valueInp, caInp, cotSel, localInp, startInp, catSel, tiSel].forEach(el => {
        el.addEventListener('input', buildFrame); el.addEventListener('change', buildFrame);
      });
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '四遥结果 / ASDU 报文组包' }),
        T.el('div', { class: 'form-grid' }, [
          T.el('div', { class: 'field' }, [T.el('label', { text: '值（遥测/遥调数值，遥信/遥控 0 或 1）' }), valueInp]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '公共地址 CA' }), caInp]),
          T.el('div', { class: 'field' }, [T.el('label', { text: '传送原因 COT' }), cotSel])
        ]),
        T.el('div', { class: 'hint', text: '品质 / 命令位（QDS / SIQ / SCO / QOS）' }), flagBox,
        frameBox
      ]));

      // ---------- 4. 点表快速搜索 ----------
      const qInp = T.el('input', { type: 'text', id: 'ip_q', placeholder: '搜信号名 / 点号 / 单位 / 状态 / 型号，如：有功功率、DI1、JUPITER', 'aria-label': '点表关键词' });
      const qCat = T.el('select', { id: 'ip_qcat', 'aria-label': '搜索类别' },
        [{ v: '', t: '全部四遥' }].concat(data.catOrder.map(k => ({ v: k, t: data.catNames[k] }))).map(x => T.el('option', { value: x.v, text: x.t })));
      const qDev = T.el('select', { id: 'ip_qdev', 'aria-label': '搜索设备表' });
      const resultBox = T.el('div', { class: 'table-wrap', id: 'ip_results' });
      let shown = 40;
      function runSearch() {
        resultBox.innerHTML = '';
        const start = num(startInp.value, 1);
        const hits = calc.search(qInp.value, { cat: qCat.value || '', device: qDev.value || '', start });
        const head = T.el('tr', {}, ['类别', '设备表', '序号', '信号名称', '单位 / 状态', '全局点号', 'IOA', 'IOA(HEX)']
          .map(t => T.el('th', { text: t })));
        const body = T.el('tbody', {});
        hits.slice(0, shown).forEach(h => {
          const tr = T.el('tr', {}, [
            T.el('td', { text: data.catNames[h.cat] }), T.el('td', { text: h.dev }), T.el('td', { text: String(h.p.n) }),
            T.el('td', { text: h.p.s }), T.el('td', { text: (h.p.u || '') + (h.p.x ? ' / ' + h.p.x : '') }),
            T.el('td', { text: String(h.global) }), T.el('td', { class: 'mono', text: String(h.ioa) }),
            T.el('td', { class: 'mono', text: calc.hex(h.ioa, 6) })
          ]);
          tr.addEventListener('click', () => {
            catSel.value = h.cat; devSel.value = h.dev; localInp.value = String(h.p.n);
            ioaInp.value = String(h.ioa); valueInp.value = guessValue({ cat: h.cat, p: h.p });
            forward(); buildFrame(); say('已选中「' + h.p.s + '」，IOA=' + h.ioa + '。');
          });
          body.appendChild(tr);
        });
        resultBox.appendChild(T.el('table', { class: 'data-table' }, [T.el('thead', {}, [head]), body]));
        resultBox.appendChild(T.el('div', { class: 'hint', id: 'ip_count',
          text: '命中 ' + hits.length + ' 条，显示 ' + Math.min(shown, hits.length) + ' 条；点击任一行填入上方计算器。' }));
        if (hits.length > shown) {
          resultBox.appendChild(T.el('button', { class: 'btn sm ghost', text: '显示更多', onclick: () => { shown += 60; runSearch(); } }));
        }
      }
      qInp.addEventListener('input', () => { shown = 40; runSearch(); });
      qCat.addEventListener('change', () => { shown = 40; runSearch(); });
      qDev.addEventListener('change', () => { shown = 40; runSearch(); });
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: '点表快速搜索' }),
        T.el('div', { class: 'row' }, [qInp, qCat, qDev,
          T.el('button', { class: 'btn sm primary', text: '搜索', onclick: runSearch }),
          T.el('button', { class: 'btn sm ghost', text: '清空', onclick: () => { qInp.value = ''; shown = 40; runSearch(); } })
        ]),
        T.el('div', { class: 'hint', text: '支持多关键词（空格分隔，需全部命中）；可搜信号名称、单位、状态描述、备注与设备型号别名。' }),
        resultBox
      ]));

      // 右侧面板：点表概览
      if (ctx && ctx.aside) {
        const ov = T.el('div', { class: 'col' });
        data.catOrder.forEach(k => {
          const n = data.devices.reduce((s, d) => s + (d.g[k] || []).length, 0);
          ov.appendChild(T.el('div', { class: 'ref-row' }, [
            T.el('span', { class: 'rk', text: data.catNames[k] }),
            T.el('span', { class: 'rv', text: n + ' 点 · ' + hx(data.bases[k]) })
          ]));
        });
        ctx.aside.appendChild(T.el('div', { class: 'aside-card' }, [
          T.el('div', { class: 'aside-title' }, [T.el('span', { class: 'dot' }), T.el('span', { text: '内置点表概览' })]),
          ov,
          T.el('p', { class: 'hint', text: (data.meta && data.meta.source) || '自定义点表' })
        ]));
      }

      // 初始化
      paintSelects();
      forward();
      buildFrame();
      runSearch();
      if (TB.bus && TB.bus.consume) {
        const p = TB.bus.consume('iec104-points', [{ el: ioaInp, family: '*', label: 'IOA / 点号' }]);
        if (p && p.filled) { reverse(); say('已引用结果「' + p.label + '」=' + p.value + '，正在反查点位。'); }
      }
    }
  });
})();
