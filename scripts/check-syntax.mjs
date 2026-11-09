// 逐个编译检查 src/ 下所有 JS 的语法（不执行），专门拦截 app.js 级别的语法错误。
// 另加静态防线：拦截 `T.util.xxx` 这类把 TB.util 误当成命名空间的调用，
// 它在 DOM 桩测里可能不触发，但在真实浏览器里会抛 TypeError。
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function walk(dir, acc = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, acc);
    else if (p.endsWith('.js')) acc.push(p.split(path.sep).join('/'));
  }
  return acc;
}

const files = walk('src').sort();
let bad = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  try { new vm.Script(src, { filename: f }); }
  catch (e) { console.log('  ✗ 语法错误:', f, '->', e.message); bad++; }
  // 模块里约定 `const T = TB.util;` 或 `const U = TB.util;`，T/U 上不存在 util 属性
  const hit = src.match(/\b(?:T|U)\.util\./);
  if (hit) {
    console.log('  ✗ 命名空间误用:', f, '->', hit[0], '（应为 T.copyBtn 等，不是 T.util.copyBtn）');
    bad++;
  }
}
console.log('语法/静态检查:', files.length, '个 JS 文件,', bad, '个失败');
if (bad) process.exit(1);
console.log('✓ 全部脚本语法正确，无命名空间误用');
