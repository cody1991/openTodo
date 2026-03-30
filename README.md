# OpenTodo

<div align="center">

**一款为个人与小团队打造的全功能开源任务管理系统**

[![GitHub Stars](https://img.shields.io/github/stars/cody1991/openTodo?style=social)](https://github.com/cody1991/openTodo)
[![Status](https://img.shields.io/badge/status-active%20development-orange.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev)

[快速开始](#快速开始) · [功能介绍](#功能介绍) · [部署文档](#生产部署)

> 🚧 **开发预览版，请勿用于生产环境**
>
> 本项目目前处于早期开发阶段，存在已知 Bug，功能和接口随时可能变动。欢迎 Star 关注进展，暂不建议在正式环境中使用。

</div>

---

## ✨ 功能亮点

- 📝 **Markdown 编辑器** — bytemd（掘金同款），支持 GFM、代码高亮、图片拖拽上传
- 📊 **数据看板** — 完成率、趋势折线图、分类进度环形图，一目了然
- 🗂️ **多视图** — 列表视图 / 看板视图自由切换，支持多级分类
- 📅 **日历视图** — 月视图展示截止日期，点击日期快速新建
- 🔗 **分享链接** — 生成带访问权限、有效期、过滤条件的公开分享页
- 🔔 **企业微信通知** — 每日日报 + 截止提醒，支持每用户独立配置 Webhook
- 🖼️ **GitHub 图床** — 图片自动上传到指定 GitHub 仓库，永久可访问
- 👑 **权限管理** — 角色 + 权限可视化配置，支持多用户
- 📱 **响应式** — 桌面端侧边栏 / 移动端底部 TabBar 自动切换

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | React 18 + Vite |
| UI 组件库 | Ant Design 5 |
| 状态管理 | Zustand + TanStack Query |
| Markdown | bytemd（字节开源） |
| 日历 | FullCalendar |
| 图表 | @ant-design/charts |
| 后端 | Node.js + Express |
| 数据库 | SQLite（better-sqlite3） |
| 认证 | JWT（httpOnly Cookie） |
| 图片存储 | GitHub API |
| 进程管理 | PM2 |

---

## 快速开始

### 方式一：一键启动（推荐）

```bash
git clone https://github.com/cody1991/openTodo.git
cd openTodo

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的配置

# 一键安装依赖并启动
./start-dev.sh
```

访问 http://localhost:5173，默认账号：`admin` / `Admin123456!`

### 方式二：分步启动

```bash
# 安装依赖
cd client && npm install
cd ../server && npm install

# 启动后端（端口 3000）
cd server && node src/index.js

# 启动前端（端口 5173）
cd client && npm run dev
```

---

## 环境变量配置

复制 `.env.example` 为 `.env` 并按需填写：

```env
# JWT 密钥（必填，改为随机长字符串）
JWT_SECRET=your_super_secret_jwt_key

# GitHub 图床（用于图片上传）
GITHUB_TOKEN=ghp_xxx
GITHUB_OWNER=your_username
GITHUB_REPO=your_image_repo
IMAGE_BASE_URL=https://raw.githubusercontent.com/your_username/your_image_repo/master

# 企业微信群机器人 Webhook（选填）
WECOM_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx

# 管理员初始账号
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_admin_password
```

### GitHub 图床配置

1. 新建一个 **Public** GitHub 仓库（如 `my-images`）
2. 前往 [Settings → Tokens](https://github.com/settings/tokens) 生成 PAT，勾选 `repo` 权限
3. 将 Token 和仓库信息填入 `.env`

---

## 功能介绍

### 📊 Dashboard 总览
- 全部待办、今日截止、紧急任务、完成率实时统计
- 近 7 天完成趋势折线图
- 各分类进度环形图
- 紧急任务高亮卡片

### ✅ TODO 管理
- 多级分类（父类 / 子类）左侧导航，显示各分类待办数
- 列表视图 / 看板视图（按状态分列）自由切换
- 按状态、优先级、关键词筛选
- 优先级颜色编码：🔴 紧急 / 🟠 高 / 🟡 中 / 🟢 低
- 逾期任务自动标红，截止日期提醒

### 📝 Markdown 编辑
- bytemd 富文本编辑器，所见即所得
- 支持表格、任务列表、代码块高亮
- 拖拽 / 粘贴图片自动上传到 GitHub 图床

### 🔗 公开分享
- 生成带唯一 Key 的公开分享页，无需登录即可访问
- 支持设置有效期（30 分钟 ～ 永久）
- 可过滤分类、状态、时间范围、屏蔽特定项目
- 分享页内容按 Markdown 渲染，支持二维码分享
- 查看浏览量、最近访问时间

### 📅 日历视图
- 月视图展示所有 TODO 截止日期
- 按优先级着色显示
- 点击空白日期快速新建，点击事件直接编辑

### 🔔 企业微信通知
- 每天定时推送日报（昨日完成 + 今日待办）
- 每小时检查 24h 内到期任务并推送提醒
- 每个用户独立配置 Webhook

### 👑 管理员后台
- 用户 CRUD，可重置密码
- 角色权限可视化编辑（Checkbox 勾选权限项）
- 内置 `admin` / `user` 两个角色，可自由扩展

---

## 生产部署

```bash
# 1. 构建前端
cd client && npm run build

# 2. 全局安装 PM2
npm install -g pm2

# 3. 修改 ecosystem.config.js 中的 cwd 路径为服务器实际路径

# 4. 启动服务
pm2 start ecosystem.config.js

# 常用命令
pm2 status        # 查看状态
pm2 logs          # 查看日志
pm2 restart all   # 重启所有进程
```

建议配合 Nginx 反向代理，将 `/api` 转发到 `localhost:3000`，其余请求指向前端 `dist` 目录。

---

## 项目结构

```
openTodo/
├── client/                 # React 前端
│   └── src/
│       ├── pages/          # 页面组件
│       ├── components/     # 公共组件
│       ├── stores/         # Zustand 状态
│       └── services/       # API 封装
├── server/                 # Node.js 后端
│   └── src/
│       ├── routes/         # Express 路由
│       ├── middleware/     # JWT + RBAC
│       ├── services/       # 通知、日报服务
│       └── db/             # SQLite + migrations
├── scheduler.js            # PM2 定时任务进程
├── ecosystem.config.js     # PM2 配置
├── start-dev.sh            # 开发环境一键启动
└── .env.example            # 环境变量示例
```

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=cody1991/openTodo&type=Date)](https://star-history.com/#cody1991/openTodo&Date)

---

## License

[MIT](LICENSE)

---

<div align="center">
Made with ❤️ by <a href="https://github.com/cody1991">cody1991</a>
</div>
