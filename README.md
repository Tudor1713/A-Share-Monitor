# A-Share Monitor · 复盘台 Windows 桌面版

面向 A 股日常观察的本地桌面工作台：**择时、择股、大势、资讯**。保留现有 HTML 的行情来源、计算逻辑与四板块界面，提供 Windows 安装程序、GitHub 正式版本通知与安装包校验。

<img src="assets/icon.png" alt="A-Share Monitor 环绕轨道图标" width="96" height="96">

## 下载安装

在 [最新正式版本](https://github.com/Tudor1713/A-Share-Monitor/releases/latest) 下载 `FuPanTai-Setup-版本号-x64.exe`，双击后选择安装位置。安装程序自带运行环境，可创建桌面和开始菜单快捷方式，无需 Node.js、Python 或浏览器。

支持 Windows 10/11 x64。安装程序暂未购买商业代码签名证书，Windows 可能显示未知发布者或 SmartScreen 提示；不要关闭系统安全防护。可用发行页的 `SHA256SUMS.txt` 核对文件：

```powershell
Get-FileHash .\FuPanTai-Setup-1.0.0-x64.exe -Algorithm SHA256
```

## 软件更新通知

- 启动后检查一次，运行期间每 6 小时检查一次公开 GitHub Releases。
- 有更高的正式版本时，在软件内显示提醒，并尝试发送 Windows 通知。
- 点击左侧底部的版本入口，或菜单“软件 → 检查更新”，可随时手动检查。
- 可查看更新说明、下载安装包；通过 SHA-256 校验后才出现安装入口，安装前再次确认。
- 检查更新可关闭。软件退出时不会继续运行常驻服务，也不会接收离线推送。
- **提交源码不等于发布版本**。必须创建更高版本号的正式 Release；草稿、预发布版和相同版本不会提醒普通用户。

## 本地数据与隐私

自选、扫描缓存和界面设置存储在本机应用数据目录中，升级默认保留。行情和资讯按原模块请求相应公开数据源；更新功能只请求本仓库的公开发行 API 和发行文件，不上传个人观察名单或本机文件。

已移除个人复盘、交易系统文档、研报库、打印页及对应内嵌数据。源码和安装包只包含 `baseline / breadth / scan / themeMap / universe` 五组公开市场相关数据。

## 开发与构建

```powershell
npm ci
npm start
npm test
npm run test:coverage
npm run smoke
npm run build:win
npm run release:checksums
```

产物位于 `dist/`。`app/dashboard.html` 是完整界面，`src/main.cjs` 为隔离的桌面主进程，`src/preload.cjs` 为本地更新界面，更新与下载的核心逻辑具有独立测试。网络受限时可设置 Electron 官方下载的镜像后安装依赖；不要把凭据或私人 npm 配置提交到仓库。

实际安装版检查、测试覆盖范围与发布后下载验证见 [验证记录](docs/testing/windows-desktop.tdd.md)。图标由内置生图功能生成，原图和提示词保存在 `assets/`；`scripts/make-icon.py` 仅在重新导出图标时需要 Pillow，常规构建与软件运行不需要 Python。

替换界面 HTML 后，执行 `node scripts/prepare-html.cjs 路径`。该脚本会拒绝仍含已移除个人资料模块的输入，并为本地 JavaScript 生成 CSP 哈希；不会关闭 Electron 的浏览器安全保护。

## 发布下一版

先修改源码并测试，再执行：

```powershell
git add .
git commit -m "改进页面和修复问题"
npm version patch
git push origin HEAD
git push origin --tags
```

`npm version patch` 会把 `1.0.0` 变为 `1.0.1` 并创建 `v1.0.1` 标签。推送标签会触发 GitHub Actions，在 Windows 环境构建安装包、生成 SHA-256 并创建正式 Release。随后在发行页面补充清晰的更新说明，用户下次启动或定期检查时即可收到通知。

也可手动运行 `npm run build:win` 和 `npm run release:checksums`，在同一个正式 Release 中同时上传安装 `.exe` 和 `SHA256SUMS.txt`。缺少校验清单时，客户端只提供版本页面入口，不会执行未校验的安装包。

## 安全边界

桌面窗口开启进程沙箱与上下文隔离，关闭 Node 集成和 webview，阻止页面跳转，限制 IPC 来源。版本说明使用纯文本，安装包 URL 必须属于配置仓库，重定向仅允许 GitHub 下载域名，下载有大小与时间限制。

原 HTML 需要动态插入样式和公开行情 JSONP，因此 CSP 为样式保留 `unsafe-inline`，JavaScript 使用本地脚本哈希和固定 HTTPS 来源，不允许 `unsafe-eval` 或任意内联脚本。第三方行情服务可能改变可用性，界面保留真实的加载与错误状态。

## 许可

桌面应用代码使用 [MIT](LICENSE) 许可。第三方组件与公开行情、资讯的权利说明见 [NOTICE.md](NOTICE.md)。
