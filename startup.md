# 本地启动说明

## 普通启动

首次运行先安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

## 静默后台启动

Windows PowerShell 中可以用下面的命令在后台静默启动，不弹出新的命令行窗口，并把日志写入项目根目录的
`electron-dev.log`：

```powershell
Start-Process -FilePath "cmd.exe" -ArgumentList "/c set ELECTRON_RUN_AS_NODE=&& set NODE_ENV=development&& npm run dev >> electron-dev.log 2>&1" -WorkingDirectory "." -WindowStyle Hidden
```

如果从项目外部执行，把 `-WorkingDirectory "."` 改成项目根目录的绝对路径，例如：

```powershell
Start-Process -FilePath "cmd.exe" -ArgumentList "/c set ELECTRON_RUN_AS_NODE=&& set NODE_ENV=development&& npm run dev >> electron-dev.log 2>&1" -WorkingDirectory "C:\Users\ALIENWARE\Downloads\interview-coder-cn-main\interview-coder-cn-main" -WindowStyle Hidden
```

说明：

- `electron-dev.log` 表示 Electron 开发环境启动日志。
- `ELECTRON_RUN_AS_NODE` 会被临时清理，避免 Electron 被当作 Node 进程启动。
- `NODE_ENV=development` 会让主进程按开发环境加载本地 renderer。
- `xx.log` 只是临时占位名称，不建议作为固定日志文件名。

## 查看日志

```powershell
Get-Content .\electron-dev.log -Tail 80
```

## 停止后台进程

可以先查看相关进程：

```powershell
Get-Process | Where-Object { $_.ProcessName -match 'electron|node|cmd' }
```

确认是本项目启动的进程后，再停止对应进程 ID：

```powershell
Stop-Process -Id <PID> -Force
```

## 提示词预设配置

主界面左侧栏的提示词预设从项目根目录的 `prompt-presets.yml` 读取。修改该文件后重启开发进程即可生效。

默认结构：

```yaml
presets:
  - id: debug-lc
    label: Debug LC
    description: 截图代码与错误信息，定位 bug 并给出修复方案。
    prompt: ''

  - id: new-lc
    label: New LC
    description: 截图题目，按 LeetCode Python 题解格式输出（新版）。
    prompt: ''

  - id: spoken-lc
    label: 口述 LC
    description: 适合面试官口述题目或语音转录不完整的场景。
    prompt: >-
      你是一个编程面试助手...
```

也可以在 `.env` 中指定其它配置文件：

```env
PROMPT_PRESETS_FILE="my-prompts.yml"
```

或按预设 `id` 覆盖单个提示词，`id` 会转成大写下划线：

```env
PROMPT_PRESET_SPOKEN_LC="这里写口述 LC 的覆盖提示词"
PROMPT_PRESET_QA="这里写问题回答的覆盖提示词"
```
