# Sonic Atlas

Sonic Atlas 是一个面向个人学习与研究的桌面沉浸式音乐播放器。0.2 版把程序化 Demo、网易云音乐或本地音乐的实时频谱映射为声音地形，并加入混合播放队列、多种歌词动效、自适应画质、视觉导出与脱敏诊断。

- 产品介绍网站：[cgc1965565186-lab.github.io/sonic-atlas](https://cgc1965565186-lab.github.io/sonic-atlas/)
- macOS 安装包：[下载 Sonic Atlas 0.2.1（Apple Silicon）](https://github.com/cgc1965565186-lab/sonic-atlas/releases/download/v0.2.1/SonicAtlas-0.2.1-arm64.dmg)
- DMG SHA-256：`e5989bed31c24a6006f24a90c49d1a3a4de9dd26362d1598149861db90ae6d88`

默认视觉主题为「煤黑琥珀」。工程借鉴 Sonic Topography 的 Electron / Express / React / R3F 分层方式，并只参考 Mineradio 的电影感与玻璃视觉语言，没有复制其 GPL 单文件代码或资源。

## 技术基线与理由

- Electron 42 + `main.js` / `preload.cjs`：桌面窗口、官方登录窗口、系统安全存储及最小化 IPC 桥接。Renderer 始终使用 `sandbox`、`contextIsolation`，且关闭 Node 集成。
- React 19 + TypeScript strict + Vite：拆分 UI、音频与 3D 场景，提供类型安全和快速热更新。
- Three 0.184 + React Three Fiber + Drei：以声明式场景管理一个动态 `InstancedMesh`，避免数千个独立 Mesh。
- React Three Postprocessing：提供克制的 Bloom 与 Vignette；地形实例颜色仍由单次 draw call 更新。
- Tailwind CSS v4 + Framer Motion：构建玻璃 HUD、抽屉和可跳过开场；未引入 GSAP。
- Web Audio API：程序化 Demo 和真实媒体流统一进入 `AnalyserNode`，约 30 Hz 采样、逐帧平滑。
- Express + `NeteaseCloudMusicApi@4.32.0`：只绑定 `127.0.0.1`，处理登录态、查询、歌词、封面以及网易云/本地音频 Range。
- `music-metadata`：只在 Electron 主进程读取用户主动选择的本地文件标签、内嵌封面与歌词。
- Zustand：保存队列、播放会话、UI 与视觉参数；Cookie 从不进入 Renderer Store、localStorage 或视觉预设。

Node.js 要求 18 或更高版本。首版以 macOS ARM64 为验收目标。

## 目录

```text
desktop/                  Electron 主进程、安全存储、本地资料库、诊断和 preload
server/                   Express 服务、网易云 DTO、本地媒体与代理
scripts/                  Electron 开发编排
src/audio/                AudioEngine、8 段 FFT、节拍与 BPM
src/components/           玻璃 HUD、搜索、歌单、歌词、账号与视觉设置
src/config/               主题、网格、镜头和开场共享参数
src/export/               带水印截图与最长 15 秒的视觉短片
src/local/                本地资料库 Renderer API
src/netease/              Renderer API Client、DTO 与 LRC 解析
src/palette/              封面 OKLab 聚类、LRU 缓存与自动配色控制器
src/scene/                 R3F 地形、粒子、运镜与后处理
src/store/                 player / auth / ui / visual Zustand Store
src/test/                  测试环境配置
```

## 运行

```bash
npm install
npm run dev
npm run dev:electron
```

- `npm run dev`：浏览器内预览完整 UI 与程序化 Demo；网易云功能会提示使用桌面版。
- `npm run dev:electron`：同时启动 Vite、随机端口 Express 和 Electron。
- 首次进入后点击「启动程序化演示」即可听到确定性的 110 BPM 合成节奏并看到地形起伏。

质量与构建命令：

```bash
npm run lint
npm test
npm run build
npm run build:electron:dir
npm run build:electron
```

`build:electron:dir` 生成 macOS ARM64 目录包；`build:electron` 使用新版 macOS 的 `diskutil image create` 生成未签名 DMG。没有 Apple 签名与公证凭据时，系统可能显示安全提示。0.2 版本不制作或发布 Windows 构建。

### macOS 首次安装

当前 DMG 是未签名测试构建。仅在确认安装包来自 [产品官网](https://cgc1965565186-lab.github.io/sonic-atlas/#macos-install) 或本项目的 GitHub Releases、且来源可信时继续：将应用拖入“应用程序”后先正常打开一次；若被拦截，前往“系统设置 → 隐私与安全性”，在“安全性”区域选择“仍要打开（Open Anyway）”。无需关闭 Gatekeeper，也不要使用终端命令移除隔离保护。受管理的 Mac 请联系 IT 管理员。

## 使用与快捷键

- `Space`：播放/暂停。
- `F7`：上一首；`F8`：播放/暂停；`F9`：下一首（同时支持 Mac 键盘上的媒体键图标）。
- `←` / `→`：真实曲目后退/前进 5 秒。
- `Cmd/Ctrl + K`：打开搜索。
- `I`：切换沉浸模式。
- `L`：在沉浸模式或 macOS 全屏模式中显示/隐藏歌词。
- `Escape`：跳过开场、关闭面板或退出沉浸模式。
- 左侧资料库可导入文件或文件夹。本地音乐只保存原文件引用，支持 MP3、M4A/AAC、FLAC、WAV、OGG/Opus，并优先读取内嵌歌词、其次读取同名 LRC。
- 播放队列允许混合网易云与本地曲目，支持拖动排序、下一首播放、顺序/列表/单曲/随机模式；重启后恢复队列和进度但保持暂停。
- 声场入口提供自动/低/中/高画质、五种歌词模式、八套主题、8 段 Ground EQ、涟漪、亮度、速度与四种镜头模式。
- 真实曲目默认从本地代理封面提取主色、两种辅助色与节拍高光；大面积封面颜色优先，四种可见色会以不同方向缓慢漂移。选择任一主题会锁定预设，重新打开「封面自适应」即可恢复自动模式。提取结果仅缓存在本次运行的内存中。
- 歌词采用当前行前后各两行的电影舞台；普通模式位于左侧，沉浸模式自动居中。系统减少动态效果时会关闭逐字与歌词粒子。

扫码登录会打开网易云官方页面。捕获到 `MUSIC_U` 或 `MUSIC_A` 后，主进程先验证账号，再使用 Electron `safeStorage` 加密写入应用用户目录；macOS 上由 Keychain 保护。系统加密不可用时只保留当前会话，绝不降级为明文文件。手动 Cookie 输入只在高级调试区提供，提交后立即清空。

## 安全与合规边界

- 本地服务只监听 `127.0.0.1` 随机端口；主窗口禁止任意导航和新窗口。
- Preload 只暴露受限的登录、本地资料库、诊断与导出 IPC；渲染进程不能提交任意读取路径或 Shell 命令。
- 本地文件完整路径只保存在权限为当前用户可读的主进程资料库索引中，不发送给 Renderer、网络或诊断报告。
- 音频只使用账号当前有权访问的标准音质，不解灰、不换源、不绕过会员、版权或地区限制。
- 完整音乐不缓存、不重新分发；视频导出为实时 5/10/15 秒片段且始终带 Sonic Atlas 水印，不提供纯音频或完整歌曲导出。
- Cookie、Authorization、`MUSIC_U`、完整网络地址和本地文件路径不写入诊断报告。
- 封面与音频代理都有网易云域名白名单，音频保留 Range 相关响应头。
- 本地标签解析只处理用户通过系统文件选择器明确选择的支持格式；隐藏目录和符号链接不会被递归扫描。

## 验证范围

48 项自动化测试覆盖：本地文件夹导入、重复文件、丢失文件、LRC、Range、安全脱敏、音频响应头超时、FFT、节拍、歌词窗口、封面配色、队列边界、自适应画质、网易云 DTO、媒体白名单与桌面状态原子持久化。首次向导、队列、导出面板及 1040×700 最小窗口已完成本地浏览器视觉验收。

网易云扫码、账号歌单和受版权保护曲目的最终可用性依赖用户自己的账号权限和网易云当前上游接口，测试仓库不包含任何账号凭据。

Mac 媒体键在应用前台可直接使用；若希望应用位于后台时仍由 F7/F8/F9 控制，macOS 可能要求在“系统设置 → 隐私与安全性 → 辅助功能”中允许 Sonic Atlas。是否需要该权限由 macOS 版本和键盘设置决定。

## Electron 重启规则

修改 `desktop/main.js`、`desktop/preload.cjs`、`desktop/auth-store.mjs`、`server/`、Electron Builder 配置或 IPC 后，必须完整退出并重新运行 `npm run dev:electron`。单纯修改 `src/` 前端文件可由 Vite 热更新。
