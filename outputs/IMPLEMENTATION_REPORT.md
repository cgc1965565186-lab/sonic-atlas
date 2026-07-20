# Sonic Atlas 实施结果

已从空目录完成 Electron 42 + React 19 + TypeScript + R3F 桌面播放器首版。

## 已交付

- 单个动态 `InstancedMesh` + 自定义 `ShaderMaterial` 的 32/48/64/80 棋盘声音地形，默认 64×64。
- 封面 OKLab 五簇配色、四种可见封面色、64 项内存 LRU、自动/预设锁定和 1.35 秒跨场景颜色过渡。
- 8 套内置视觉主题，覆盖暖金、青灰、暗红、森林铜、暮紫、冰川靛蓝、砂岩金与黑玫瑰；每套均包含场景底色、双辅助色、主色和高光色。
- 有序 8 段频谱响应、满载不覆盖的双涟漪合并、约 3% 稀疏尖峰，以及缓慢漂移、均匀柔和的连续多色场。
- 确定性 110 BPM 有声 Demo；真实媒体流复用同一 Web Audio 分析图。
- 环绕巡航、低空贴地、缓慢推近与手动镜头；开场可跳过并支持 reduced-motion。
- 玻璃导航、播放台、五行电影歌词、逐字聚散与 Canvas 粒子、搜索、账号歌单、视觉 EQ、账号安全面板与沉浸模式。
- 网易云官方窗口扫码登录、safeStorage 加密、搜索、歌单、标准音质流、Range 转发和歌词。
- macOS ARM64 与 Windows NSIS 构建配置、严格 CSP、最小 preload API 和代理域名白名单。
- Mac F7/F8/F9 上一首、播放/暂停和下一首控制，兼容前台键盘事件、Media Session 与 Electron 全局媒体键。

## 已通过门禁

- TypeScript strict 类型检查
- ESLint
- 15 个测试文件、36 个测试用例
- Vite 生产构建
- 本地 Express 随机端口启动/关闭及核心响应
- Electron + Vite + Express 实际启动
- macOS ARM64 目录包构建
- 程序化音频进入 LIVE 状态并驱动地形

## 使用

在项目根目录运行：

```bash
npm run dev:electron
```

首次进入后点击「启动程序化演示」。网易云功能通过左侧搜索、歌单和账号入口使用。

修改 Electron 主进程、preload、本地服务或打包配置后需要完整重启 Electron。

最新 DMG：`outputs/SonicAtlas-0.1.0-eight-themes-media-keys-arm64.dmg`（186 MB）  
SHA-256：`452bd8ad2eb9463cccd44178ce3b804f72f28c92dd0cca9ca5d307286a80101a`
