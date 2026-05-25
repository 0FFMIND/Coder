# 编码面试解题助手

![使用演示](https://github.com/user-attachments/assets/19781594-3108-4711-a54b-9d36496787bc)

## 项目简介

这是一个面向中文用户的编程解题助手，适配国内AI生态，简单易用。

### 软件适用场景

- 编程面试，分析屏幕上的题目，实时给出解题思路和代码，即便面试官要求分享屏幕，也不会被发现
- 笔试题目，不会导致笔试网页失焦，可规避“跳出网页”检测
- 其他场景（如：英语机试 等）可以通过在设置界面中配置“自定义提示词”来自行扩展

### 核心能力

- 通过快捷键抓取屏幕内容、电脑声音等信息，发送给大模型进行分析
- 窗口在屏幕分享时，不会被发现
- 窗口置顶半透明展示，不会导致原页面失焦，从而规避“跳出网页”检测

### 项目特点

- 简单易用，只需要配置 API_BASE_URL 和 API_KEY 即可开始使用。
- 重点支持编程相关算法题目，同时也支持其他题型（单选、多选，解答等题型）。
- 支持多种编程语言，包括 Python、JavaScript、Java、C++ 等。
- 本应用具有隐身能力，即使被要求分享屏幕，面试官也看不到解题助手的界面。

### 核心技术原理

- 通过快捷键抓取屏幕内容
- 将截屏内容发送给 AI 模型，生成解题思路和代码

## 如何使用

> 注意：项目有编译安装包，你也可以直接下载安装包使用（如何安装，以及安装完后如何配置，请参考 [Wiki 教程](https://github.com/ooboqoo/interview-coder-cn/wiki/%E7%9B%B4%E6%8E%A5%E4%B8%8B%E8%BD%BD%E5%AE%89%E8%A3%85%E5%8C%85%E4%BD%BF%E7%94%A8)）。

> 注意：详细的使用教程请移步本项目的 [Wiki](https://github.com/ooboqoo/interview-coder-cn/wiki) 页面查看。

### 1. 安装依赖

注：项目运行依赖 Node.js 环境，如未安装请先安装 [下载地址](https://nodejs.org/zh-cn/download)。

```bash
$ npm install
```

### 2. 启动程序开始正常使用

```bash
$ npm run dev
```

### 3. 配置 API Key

> 注意，应大家的要求，从 1.6 版本开始，添加了对「硅基流动」API 的支持，方便大家使用国内模型。

启动程序后，进入「设置」页面，配置 `API Base URL` 和 `API Key`。

API 地址和 API Key 需要从支持 OpenAI API 的代理服务商处获取。如国内的 [硅基流动](https://cloud.siliconflow.cn/i/SG8C0772) 或国外的 [OpenRouter](https://openrouter.ai/) 等服务商，支持支付宝付款。

当然，如果你（人在海外）可以直接使用 OpenAI 官方的 API 更好，只需要配置 `API Key` 就够了。

> 也可以在项目根目录创建 `.env` 文件预配置，程序启动后会自动读取作为默认值。

```env
API_BASE_URL="https://openrouter.ai/api/v1" # 聚合服务的 API 地址，这里以 OpenRouter 为例
API_KEY="sk-1234567890" # 代理服务商的 API Key，这里只是示例，需要改成你自己的
```

### 4. （可选）配置语音转录

语音转录功能可以实时将面试官的语音转为文字，并在截图时一起提交给 AI 辅助分析题意。

目前该功能固定使用 Fun-ASR 模型 (0.02元/分钟，新用户有10小时免费额度)，需要配置阿里云百炼平台的 API Key：

1. 访问 [百炼平台控制台](https://help.aliyun.com/zh/model-studio/get-api-key) 注册并创建 API Key
2. 在应用「设置」页面的「语音转录」部分填入 API Key
3. 使用快捷键（默认 `Alt+T` / `Ctrl+T`）开始/暂停语音转录

## 关于隐身能力的说明

目前隐身功能适配市面上大部分会议软件(如 腾讯会议 等)，但很少部分软件和浏览器可能无法正常隐身。使用前自己做好测试，本项目不承担任何责任。相关问题欢迎大家提 Issue 讨论。

## 视频教程

具体可到 [Wiki](https://github.com/ooboqoo/interview-coder-cn/wiki) 页面查看。

## 许可协议（License）

> 虽然这套代码目前在 GitHub 上以「解题助手」的形式做推广，但实际应用场景非常广泛。后续期望在更多场景做商业落地，欢迎有兴趣朋友洽谈合作事项。

本项目采用 **[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/deed.zh)** 协议许可。

您可以自由使用、复制、修改本项目代码，但 **禁止任何形式的商业用途**，包括但不限于售卖、集成入商业产品、SaaS 服务等。

如需商业授权，请联系作者获得书面许可。

## 类似项目

原 [Interview-Coder](https://github.com/ibttf/interview-coder) 项目在网络上爆火之后，出现了很多类似的项目（本项目也是其中一个），每个项目都各有特色，这里列举一些比较火的项目供参考。

- https://github.com/sohzm/cheating-daddy 作者是前段时间在硅谷大热的争议程序员 Soham Parekh
- https://github.com/pickle-com/glass
- https://github.com/j4wg/interview-coder-withoupaywall-opensource

## 本地开发启动

首次运行先安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

如果需要把启动日志保存到项目根目录，建议使用能表达含义的文件名，例如开发启动日志可以写入 `dev.log`：

```bash
npm run dev > dev.log 2>&1
```

Windows 环境下，如果系统里设置了 `ELECTRON_RUN_AS_NODE=1`，Electron 可能会被当作 Node 进程启动，并报
`Cannot read properties of undefined (reading 'isPackaged')`。可以临时清理该变量后启动，并把日志写入
`electron-dev.log`：

```cmd
cmd /c "set ELECTRON_RUN_AS_NODE=&& set NODE_ENV=development&& npm run dev >> electron-dev.log 2>&1"
```

这里的 `dev.log` / `electron-dev.log` 是有语义的日志文件名，分别表示开发启动日志和 Electron 开发启动日志；`xx.log` 只适合作为临时占位，不建议写进文档或长期使用。
