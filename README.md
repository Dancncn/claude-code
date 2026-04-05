# Claude Code Codex 666

这是我基于 Claude Code 源码思路，以及 [claude-code-best/claude-code](https://github.com/claude-code-best/claude-code) 继续二次开发的个人版本。

来源说明：

- 底层能力与工程结构来源于 Claude Code 源码体系
- 本仓库开发过程中参考了 [claude-code-best/claude-code](https://github.com/claude-code-best/claude-code) 的部分工程改造思路

这份 README 主要记录我这个分支当前做了什么，以及怎么直接使用。

## 我这个分支的重点改动

- 增加 OpenAI 兼容链路
- 增加通过官方 `Codex CLI` 复用 ChatGPT 登录态的接入方式
- 默认模型切到 `gpt-5.4`
- 增加独立隔离配置目录，避免污染原版 Claude Code
- 增加全局启动器，支持在任意目录直接启动
- 增加 Codex 重连中的实时进度提示，不再长时间无反馈

## 当前版本

- 版本号：`666.0.0-V666`
- 默认独立配置目录：`~/.claude-666`
- 推荐全局启动命令：`ccb666`
- 兼容启动命令：`claude-code-codex`、`claude-code-v666`

## 项目结构

和这次改动最相关的目录大致如下：

- `src/entrypoints/cli.tsx`
  入口启动。这里会为 `666` 版本注入独立配置目录，并在首启时写入默认的 `Codex CLI + gpt-5.4` 设置。
- `src/services/api/openai/`
  OpenAI 兼容链路所在目录。这次新增了 `codexCli.ts`，用来把官方 `codex` 命令接进现有请求流程。
- `src/components/ConsoleOAuthFlow.tsx`
  `/login` 界面逻辑。这里新增了 `Codex / ChatGPT OAuth` 登录选项。
- `src/utils/model/` 和 `src/utils/logoV2Utils.ts`
  模型显示、Logo 区域展示、当前 provider 文案。这里做了 `GPT-5.4` 和 `ChatGPT OAuth (Codex CLI)` 的显示适配。
- `src/utils/messages.ts` 和 `src/screens/REPL.tsx`
  流式消息处理和终端界面。这里接入了 Codex 重连进度提示。
- `scripts/install-global-launchers.ts`
  Windows / macOS 全局启动器安装脚本。这里负责生成 `ccb666`、`claude-code-codex`、`claude-code-v666`。
- `README.md` / `README_EN.md`
  本分支自己的说明文档。

## 这个分支相对原仓库的主要改动

如果只看这次二次开发，核心变化可以概括为：

- 增加 `Codex CLI` 后端桥接
  关键文件：`src/services/api/openai/codexCli.ts`
- 在 OpenAI provider 中增加走 `Codex CLI` 的分支
  关键文件：`src/services/api/openai/index.ts`
- 增加 `/login -> Codex / ChatGPT OAuth`
  关键文件：`src/components/ConsoleOAuthFlow.tsx`
- 增加 `666` 版本的独立配置目录和默认设置
  关键文件：`src/entrypoints/cli.tsx`、`src/utils/envUtils.ts`、`src/utils/settings/settings.ts`
- 增加模型与计费文案展示修正
  关键文件：`src/utils/model/model.ts`、`src/utils/logoV2Utils.ts`
- 增加重连中的实时等待提示
  关键文件：`src/utils/messages.ts`、`src/screens/REPL.tsx`
- 增加 Windows / macOS 全局启动命令
  关键文件：`package.json`、`scripts/install-global-launchers.ts`、`scripts/defines.ts`

## 运行原理

这条 ChatGPT 路线不是 `API Key` 调用，也不是网页抓 Cookie。

它现在的方式是：

- 先在本机用官方 `codex login` 登录 ChatGPT
- 本项目运行时调用本机 `codex` 命令
- 由官方 `Codex CLI` 自己管理认证状态
- 本仓库只负责把它接进 Claude Code 这套交互壳里

所以这套实现：

- 不需要 `OPENAI_API_KEY`
- 不在仓库里保存 ChatGPT Cookie
- 不在仓库里保存浏览器 session
- 不会把你的登录态写进项目源码文件

## 安装要求

- [Bun](https://bun.sh/) >= `1.3.11`
- 本机可用的官方 `Codex CLI`

先确认 Codex 已登录：

```bash
codex login
codex login status
```

看到 `Logged in using ChatGPT` 再继续。

如果你已经在 VS Code 插件、VS Code 终端，或者其他本机环境里登录过官方 Codex，并且 `codex login status` 能看到已登录状态，那么这里可以直接复用那份本机登录态，不需要重新登录。

## 安装与构建

在仓库目录执行：

```bash
bun install
bun run build
bun run install:launcher
```

安装完成后，可以在任意目录直接启动：

```bash
ccb666
```

在 macOS 上，启动器会优先安装到 Bun 所在目录；如果该目录不可写，则会回退到当前 `PATH` 中第一个可写目录，必要时再回退到 `~/.bun/bin` 或 `~/.local/bin`。如果脚本提示目标目录不在 `PATH` 中，把提示里的 `export PATH=...` 加到你的 shell 配置里即可。

也可以用：

```bash
claude-code-codex
claude-code-v666
```

## 首次使用

1. 启动 `ccb666`
2. 进入后执行 `/login`
3. 选择 `Codex / ChatGPT OAuth`
4. 如果提示未登录，先去终端执行一次 `codex login`

首次启动后，本分支会默认使用独立配置目录：

```text
~/.claude-666
```

不会动你原来的：

```text
~/.claude
```

## 快速验收

可以直接跑一条非交互命令：

```bash
ccb666 --print "Reply with exactly OK"
```

预期输出：

```text
OK
```

## 交互体验补充

Codex 在某些情况下会先重连几次再正式返回结果。这个分支已经补了提示信息，等待时会看到类似：

```text
Connecting to ChatGPT OAuth...
Codex reconnecting 1/5...
Codex reconnecting 2/5...
Codex falling back to HTTP...
```

这样就不是单纯卡住干等。

## 开源注意事项

我目前已经把本地临时目录加入忽略：

- `.tmp-codex-cli/`
- `.tmp-codex-inspect/`

这套实现依赖本机 `Codex CLI` 登录态，但仓库本身不应提交下列内容：

- `~/.codex/`
- `~/.claude/`
- `~/.claude-666/`
- 任何导出的 cookie、token、session 文件

另外再补一条：

- `.vscode/launch.json` 如果保留，最好不要带你本机当前会话生成的调试 URL。我已经把仓库里的值改成了占位符 `ws://localhost:8888/replace-me`。

当前仓库里我额外检查过几类内容：

- `node_modules/`、`dist/`、`.env`、`.tmp-codex-cli/`、`.tmp-codex-inspect/` 都已被 `.gitignore` 忽略
- `.claude/agents/hello-agent.md` 当前看起来只是示例 agent，不包含敏感信息
- `.vscode/tasks.json` 是通用任务配置，可以上传
- `.vscode/launch.json` 原先是本机临时调试地址，现在已去本地化

## 免责声明

本项目仅用于学习、研究与个人工程实验。

Claude Code 相关能力与权利归其原始权利方所有。这里的二次开发内容仅代表本分支自身的工程改造。 
