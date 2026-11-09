# 参与贡献

欢迎提交 Issue 与 Pull Request。项目是纯前端 + 极薄 Go 壳，新增一个工具通常只需要一个 JS 文件。

## 新增模块

1. 在 `src/modules/<分类>/` 下新建 `.js`，用声明式注册：

   ```js
   TB.register({
     id: 'my-tool', name: '我的工具', category: '开发常用',
     desc: '一句话说明',
     tips: ['使用提示'],
     refs: ['公式依据或参考标准（计算类必填）'],
     render(body, ctx) { /* ctx.aside 为右侧面板 */ }
   });
   ```

2. 在 `src/index.html` 的模块脚本区加入 `<script src="modules/.../my-tool.js"></script>`。
3. 若新增分类，同步更新 `src/app.js` 的 `CATEGORY_ORDER` 与 `CAT_ICON`。
4. 更新 `README.md` / `design.md` / `docs/index.html` 中的工具数量，并运行 `node scripts/check-docs.mjs`。
5. 计算类模块必须在 `scripts/test.formulas.mjs` 中补至少一组标准答案（golden case）。

## 本地验证

```bash
node scripts/check-syntax.mjs       # 语法 + 命名空间误用
node scripts/verify.mjs             # 全部模块注册 + 渲染
node scripts/test.interact.mjs      # 交互逻辑
node scripts/test.boot.mjs          # app.js 入口启动（防白屏）
node scripts/test.formulas.mjs      # 数值标准答案
node scripts/check-docs.mjs         # 跨文档计数一致性
node scripts/check-light-theme.mjs  # 真实浏览器 dark/light 逐模块渲染 + 对比度
python scripts/verify_syso.py       # 已提交的 PE 资源对象
python scripts/verify_icon.py       # exe 的 PE 图标资源
```

> 新增或修改模块后，务必跑 `check-light-theme.mjs`：它会在真实 Chromium 里逐个执行 `render()`，
> 能捕获 DOM 桩测不触发的 `T.util.copyBtn` 这类浏览器端 TypeError。

## 构建

```bash
CGO_ENABLED=0 GOOS=windows go build -ldflags "-H windowsgui -s -w" -o 能源测试工具箱.exe .
```

图标资源已提交为 `rsrc_windows_amd64.syso`；若修改了 `assets/app.ico`，按 README 的说明用 `rsrc` 重新生成。

## 提交规范

- 提交信息使用 `feat:` / `fix:` / `docs:` / `test:` / `chore:` 前缀。
- 发布版本时打 `vX.Y.Z` tag，CI 会自动构建、校验并发布 Release。
