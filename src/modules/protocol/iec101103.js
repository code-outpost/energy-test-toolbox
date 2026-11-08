// IEC 60870-5-101 / 103 报文解析：固定帧 / 可变帧识别 + 链路控制域 + 可变帧内 ASDU
(function () {
  const T = TB.util;
  function parseHex(s) { s = (s || '').replace(/[^0-9a-fA-F]/g, ''); if (s.length % 2) return null; const a = []; for (let i = 0; i < s.length; i += 2) a.push(parseInt(s.substr(i, 2), 16)); return a; }
  function hx(arr, sep) { return arr.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(sep || ' '); }

  const TI101 = {
    1: 'M_SP_NA_1 单点遥信', 2: 'M_DP_NA_1 双点遥信', 3: 'M_ST_NA_1 步位置', 4: 'M_BO_NA_1 32位遥信',
    5: 'M_ME_NA_1 归一化遥测', 6: 'M_ME_TA_1 标度化遥测', 9: 'M_ME_NC_1 短浮点遥测', 11: 'M_ME_ND_1 不带品质遥测',
    13: 'M_IT_NB_1 标度化累计', 15: 'M_IT_TB_1 累计带时标', 20: 'M_PS_NA_1 保护装置状态', 21: 'M_ME_ND_1',
    30: 'M_SP_TA_1 单点遥信带时标', 31: 'M_DP_TA_1 双点遥信带时标', 32: 'M_ST_TA_1 步位置带时标', 34: 'M_BO_TA_1 32位遥信带时标',
    35: 'M_ME_TA_1 归一化遥测带时标', 36: 'M_ME_TB_1 标度化遥测带时标', 37: 'M_ME_TC_1 短浮点遥测带时标', 38: 'M_IT_TA_1 累计带时标',
    45: 'M_TI_TA_1 集成总召唤带时标', 46: 'M_TI_TB_1', 48: 'M_TI_TC_1', 50: 'M_FT_NA_1 文件传输',
    70: 'M_EI_NA_1 初始化结束', 100: 'C_IC_NA_1 总召唤', 101: 'C_CI_NA_1 计数量召唤', 102: 'C_RD_NA_1 读命令',
    103: 'C_CS_NA_1 时钟同步', 104: 'C_RP_NA_1 复位进程', 105: 'C_CD_NA_1 延时获得', 107: 'C_TS_NA_1 测试命令',
    110: 'P_ME_NA_1 参数命令', 112: 'P_AC_NA_1 激活参数', 113: 'F_FR_NA_1 文件就绪', 120: 'F_SC_NA_1 节记录'
  };
  const TI103 = {
    1: 'GI 通用分类数据', 2: 'GI 通用分类标识', 3: 'GI 通用分类读', 4: 'GI 通用分类写', 5: 'GI 通用分类确认', 6: 'GI 通用分类目录', 7: 'GI 通用分类计划',
    10: '定值组切换', 20: '带标志的运行中断', 21: '故障起动', 23: '保护事件', 24: '保护成组事件', 25: '保护成组起动', 26: '保护系统复位',
    27: '保护设备事件', 28: '保护设备成组事件', 29: '保护设备成组起动', 30: '保护设备系统复位', 31: '失步检测', 32: '定值修改',
    33: '保护故障距离', 34: '保护故障距离(透明通道)', 38: '扰动数据', 39: '扰动数据传输准备', 40: '扰动数据传输命令', 41: '扰动数据传输结束',
    42: '通道接收', 43: 'ASDU 标识', 44: 'ASDU 标签', 45: '触发条件列表', 46: '触发条件', 47: '故障值', 48: '通道定义',
    49: '定值定义', 50: '通道定义请求', 51: '定值定义请求', 52: '透明数据', 53: '被记录的扰动表', 54: '扰动目录',
    55: '扰动数据选择', 56: '读单个条目', 57: '读多个条目', 58: '写单个条目', 59: '写多个条目', 60: '进入/退出命令',
    61: '进入/退出确认', 62: '退出所有', 63: '复位', 64: '延时获得', 65: '延时获得确认', 66: '同步', 67: '同步确认',
    68: '测试模式', 69: '测试模式确认', 70: '复位事件', 71: '复位事件确认', 72: '自由分配', 73: '自由分配确认',
    74: '通道使能', 75: '通道使能确认', 76: '信息序号', 77: '扰动数据请求'
  };
  const COT101 = { 1: '周期/循环', 2: '背景扫描', 3: '突发(自发)', 4: '初始化', 5: '请求/被请求', 6: '激活', 7: '激活确认', 8: '停止激活', 9: '停止激活确认', 10: '激活终止', 11: '反馈总召唤', 12: '反馈全数据', 13: '反馈总召唤终止', 20: '响应站呼叫', 31: '带时标', 44: '等待' };
  const LINKFN = { 0: '复位远方链路', 3: '发送/确认', 7: '复位远动', 9: '请求链路状态', 10: '请求1级数据', 11: '请求2级数据', 8: '以数据响应', 11: '链路服务未完工' };

  function cp56(b, o) {
    const ms = b[o] | (b[o + 1] << 8); const min = b[o + 2]; const hr = b[o + 3] & 0x1f;
    const day = b[o + 4] & 0x1f; const mon = b[o + 5] & 0x0f; const yr = (b[o + 6] & 0x7f);
    const iv = (b[o + 3] & 0x80) ? ' [无效]' : ''; const su = (b[o + 6] & 0x80) ? ' [夏时制]' : '';
    return `20${String(yr).padStart(2, '0')}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(ms / 1000 | 0).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}${iv}${su}`;
  }

  function parse101(bytes, is103) {
    const TI = is103 ? TI103 : TI101;
    if (bytes[0] === 0x10) {
      // 固定帧: 10 ctrl addr chk 16
      if (bytes.length < 6) return { ok: false, err: '固定帧过短' };
      const ctrl = bytes[1], addr = bytes[2];
      const prm = (ctrl & 0x40) ? 1 : 0;
      return { ok: true, kind: '固定帧', info: [
        { k: '启动符', v: '0x10' },
        { k: 'PRM', v: prm ? '1 (主站)' : '0 (子站)' },
        { k: '功能码', v: (ctrl & 0x0f) + ' (' + (LINKFN[ctrl & 0x0f] || '未知') + ')' },
        { k: '链路地址', v: String(addr) },
        { k: '帧校验', v: '0x' + bytes[3].toString(16).toUpperCase() },
        { k: '结束符', v: '0x16' }
      ] };
    }
    if (bytes[0] !== 0x68) return { ok: false, err: '起始符应为 0x10(固定帧) 或 0x68(可变帧)，实际 0x' + bytes[0].toString(16) };
    const L = bytes[1];
    if (bytes[2] !== L) return { ok: false, err: '长度字节不一致' };
    const ctrl = bytes[4], addr = bytes[5];
    const prm = (ctrl & 0x40) ? 1 : 0, fcbacd = (ctrl & 0x20) ? 1 : 0, fcvcdf = (ctrl & 0x10) ? 1 : 0, lfn = ctrl & 0x0f;
    let p = 6; // ASDU 起点
    const ti = bytes[p], vsq = bytes[p + 1], sq = (vsq & 0x80) ? 1 : 0, num = vsq & 0x3f;
    const cot = bytes[p + 2]; const ca = bytes[p + 3];
    let q = p + 4;
    const objs = [];
    let objSize = 0;
    if (!is103) {
      if ([1, 2, 3, 4, 5].includes(ti)) objSize = 4; // IOA3 + 1值
      else if ([9, 11].includes(ti)) objSize = 6;     // IOA3 + 2值 + 1品质
      else if (ti === 13) objSize = 8;                // IOA3 + 4浮点 + 1品质
      else if ([30, 31, 32, 35, 36, 37].includes(ti)) objSize = 11; // IOA3 + 数据 + 7时标
      else objSize = 0;
      for (let i = 0; i < num && q + objSize <= bytes.length - 2; i++) {
        const ioa = bytes[q] | (bytes[q + 1] << 8) | (bytes[q + 2] << 16);
        let val = '';
        if (objSize === 4) val = '状态=' + (bytes[q + 3] & 1) + ' 品质=0x' + bytes[q + 3].toString(16);
        else if (objSize === 6) { const v = bytes[q + 3] | (bytes[q + 4] << 8); val = '值=' + v + ' 品质=0x' + bytes[q + 5].toString(16); }
        else if (objSize === 8) { const f = new DataView(new Uint8Array([bytes[q + 3], bytes[q + 4], bytes[q + 5], bytes[q + 6]]).buffer).getFloat32(0, true); val = '值=' + f.toFixed(3) + ' 品质=0x' + bytes[q + 7].toString(16); }
        else if (objSize === 11) val = '值=0x' + hx(bytes.slice(q + 3, q + 4)) + ' 时标=' + cp56(bytes, q + 4);
        objs.push({ ioa, val });
        q += objSize;
      }
    }
    const info = [
      { k: '起始符', v: '0x68 长度=' + L },
      { k: '链路控制', v: 'PRM=' + prm + (prm ? ' FCB=' + fcbacd + ' FCV=' + fcvcdf : ' ACD=' + fcbacd + ' DFC=' + fcvcdf) + ' 功能=' + (LINKFN[lfn] || lfn) },
      { k: '链路地址', v: String(addr) },
      { k: '类型标识 TI', v: ti + ' (' + (TI[ti] || '未知') + ')' },
      { k: 'VSQ', v: 'SQ=' + sq + ' 个数=' + num },
      { k: '传送原因 COT', v: cot + ' (' + (COT101[cot] || '未知') + ')' + (cot & 0x40 ? ' [否定]' : '') + (cot & 0x80 ? ' [测试]' : '') },
      { k: '公共地址 CA', v: String(ca) }
    ];
    if (objs.length) info.push({ k: '信息对象(' + objs.length + ')', v: objs.map(o => 'IOA=' + o.ioa + ' ' + o.val).join('\n') });
    if (is103 && q < bytes.length - 2) info.push({ k: 'ASDU 原始', v: hx(bytes.slice(p, bytes.length - 2)) });
    return { ok: true, kind: '可变帧', info };
  }

  function buildSample101() {
    const asdu = [1, 3, 20, 1, 0, 0, 1, 1, 0, 0, 2, 1, 0, 0, 3, 0]; // TI1 SQ0 N3 COT20 CA1, 3个单点
    let chk = 0; for (const b of [0x08, 0x01, ...asdu]) chk = (chk + b) & 0xff;
    return [0x68, asdu.length + 2, asdu.length + 2, 0x68, 0x08, 0x01, ...asdu, chk, 0x16];
  }

  TB.register({
    id: 'iec101103', name: 'IEC 101/103', category: '协议报文解析',
    desc: 'IEC 60870-5-101(串口远动)/103(继电保护)：固定帧与可变帧识别、链路控制域、可变帧内 ASDU(TI/VSQ/COT/CA/IOA)解析',
    render(c) {
      let mode = '101';
      const input = T.el('textarea', { class: 'mono', placeholder: '粘贴 IEC 101/103 帧 HEX' });
      const out = T.el('div', { class: 'col' });
      const seg = T.el('div', { class: 'row' }, [
        T.el('button', { class: 'btn sm primary', text: 'IEC 101', onclick: () => { mode = '101'; input.value = hx(buildSample101()); input.dispatchEvent(new Event('input')); } }),
        T.el('button', { class: 'btn sm', text: 'IEC 103', onclick: () => { mode = '103'; input.value = hx(buildSample103()); input.dispatchEvent(new Event('input')); } })
      ]);
      function render(r) {
        out.innerHTML = '';
        if (!r.ok) { out.appendChild(T.el('div', { class: 'error', text: '解析失败：' + r.err })); return; }
        out.appendChild(T.el('div', { class: 'tag', text: r.kind }));
        const kv = T.el('div', { class: 'kv' });
        r.info.forEach(f => { kv.appendChild(T.el('div', { class: 'k', text: f.k })); const v = T.el('div', { class: 'v' }); v.textContent = f.v; kv.appendChild(v); });
        out.appendChild(kv);
      }
      input.addEventListener('input', () => { const b = parseHex(input.value); if (!b) { out.innerHTML = ''; out.appendChild(T.el('div', { class: 'error', text: 'HEX 格式错误' })); return; } render(parse101(b, mode === '103')); });
      c.appendChild(T.el('div', { class: 'card' }, [
        T.el('h3', { text: 'IEC 60870-5-101 / 103 报文解析' }),
        seg,
        input,
        T.el('div', { class: 'hint', text: '101=串口远动(ASDU 与104一致); 103=继电保护(专用类型标识库)。固定帧 10..16，可变帧 68 L L 68 .. 16。' }),
        out
      ]));
      input.value = hx(buildSample101()); input.dispatchEvent(new Event('input'));
    }
  });

  // 103 默认样本：可变帧，TI=23(保护事件)，仅帧头 + 类型 + 长度 + 原始 ASDU
  function buildSample103() {
    // 帧头: 68 L L 68 ctrl addr ; ASDU: TI=23, VSQ=01, COT=03, CA=01, 功能类型FT=01, 信息序号=01, RII=00, 故障序号=01, 保护动作=... 
    const asdu = [23, 1, 3, 1, 1, 1, 0, 1, 0x80, 0, 0, 0, 0, 0];
    let chk = 0; for (const b of [0x08, 0x01, ...asdu]) chk = (chk + b) & 0xff;
    return [0x68, asdu.length + 2, asdu.length + 2, 0x68, 0x08, 0x01, ...asdu, chk, 0x16];
  }
})();
