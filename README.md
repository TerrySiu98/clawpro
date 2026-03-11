# ClawPro (大龙虾)

<p align="center">
  <strong>🦞 基于 OpenClaw 的中文 AI 智能体桌面客户端</strong>
</p>

[English](#english) | [中文](#中文)

<a name="中文"></a>
## 中文

ClawPro（大龙虾）是 [OpenClaw](https://github.com/openclaw-ai/openclaw) 的中文可视化桌面客户端。它将 OpenClaw 的强大能力封装在一个简洁易用的桌面应用中，无需命令行操作，开箱即用。

### 核心特性

- **中文聊天界面：** 内置流式对话，支持多会话管理和模型切换
- **一键安装：** 全自动化 OpenClaw 引擎安装，无需手动配置
- **API 中转集成：** 内置 [oneapi.gs](https://oneapi.gs) 推荐配置，兼容 OpenAI 格式 API
- **聊天平台管理：** 可视化接入 QQ、Telegram、飞书、Discord、Slack 等聊天渠道
- **完全遵循原版：** 复用 OpenClaw 的 `~/.openclaw/` 数据结构、Gateway API 和 CLI

### 下载安装

#### 桌面版（macOS / Windows / Linux 桌面）

从 [Releases](https://github.com/TerrySiu98/clawpro/releases) 下载对应平台的安装包：

| 平台 | 架构 | 格式 |
|------|------|------|
| macOS | Apple M 芯片 (M1/M2/M3/M4) | `.dmg` 安装包 |
| macOS | Intel 芯片 | `.dmg` 安装包 |
| Windows | 64 位 | `.exe` |
| Linux | x64 | 二进制文件 |
| Linux | ARM64 | 二进制文件 |

下载后安装即可运行，首次启动会自动引导安装 OpenClaw 引擎和配置 API Key。

> **macOS 用户注意：** 首次打开如果提示"已损坏，无法打开"，请在终端运行：
> ```bash
> xattr -cr /Applications/ClawPro.app
> ```
> 这是因为应用未经 Apple 签名，不是真的损坏。运行上述命令后再次打开即可。

#### Linux 命令行版（服务器 / WSL / 无 GUI 环境）

一键安装脚本，交互式配置 API 中转 + 聊天平台 + 后台服务：

```bash
curl -fsSL https://raw.githubusercontent.com/TerrySiu98/clawpro/main/install.sh | bash
```

### 架构

```
┌─────────────────────────────┐
│   ClawPro (Wails 桌面应用)    │
│  ┌───────────┬────────────┐ │
│  │ React 前端 │ Go 桥接层   │ │
│  └───────────┴──────┬─────┘ │
└─────────────────────┼───────┘
                      │ CLI / Gateway API
              ┌───────▼───────┐
              │  OpenClaw 引擎  │
              │  (~/.openclaw/) │
              └───────────────┘
```

### 技术栈

- **桌面框架：** Wails v2
- **后端：** Go 1.23
- **前端：** React 18 + Vite + TypeScript + TailwindCSS 4
- **AI 引擎：** OpenClaw

### 构建

环境要求：Go 1.23+、Node.js 18+、[Wails CLI](https://wails.io/docs/gettingstarted/installation)

```bash
make dev           # 开发模式
make build         # 构建所有平台
make package       # 打包发布归档
```

---

<a name="english"></a>
## English

ClawPro is a Chinese-language desktop AI chat client built on [OpenClaw](https://github.com/openclaw-ai/openclaw). No command line required.

### Features

- **Chat Interface:** Streaming conversation UI with multi-session and model switching
- **One-Click Install:** Fully automated OpenClaw engine installation
- **API Relay:** Pre-configured [oneapi.gs](https://oneapi.gs) integration, OpenAI-compatible
- **Chat Platforms:** Visual management for QQ, Telegram, Feishu, Discord, Slack, and more

### Download

Download from [Releases](https://github.com/TerrySiu98/clawpro/releases). macOS `.dmg`, Windows `.exe`, Linux binary.

**Linux CLI:** `curl -fsSL https://raw.githubusercontent.com/TerrySiu98/clawpro/main/install.sh | bash`

### Build

Requires: Go 1.23+, Node.js 18+, [Wails CLI](https://wails.io/docs/gettingstarted/installation)

```bash
make dev           # Dev server with hot reload
make build         # Build all platform targets
```

---

Website: [clawpro.app](https://clawpro.app)
