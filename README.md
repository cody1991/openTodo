# OpenTodo - 智能任务管理系统

[![GitHub Stars](https://img.shields.io/github/stars/cody1991/openTodo?style=social)](https://github.com/cody1991/openTodo)

科技感十足的全栈 TODO 应用，支持 Markdown 编写、日历视图、企业微信通知、GitHub 图片存储。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React + Vite + Ant Design 5 |
| 状态管理 | Zustand + React Query |
| Markdown | bytemd（字节开源，掘金同款） |
| 日历 | FullCalendar |
| 图表 | @ant-design/charts |
| 后端 | Node.js + Express |
| 数据库 | SQLite (better-sqlite3) |
| 认证 | JWT (httpOnly Cookie) |
| 图片存储 | GitHub API |
| 通知 | 企业微信群机器人 Webhook |
| 进程管理 | PM2 |

## 快速开始

### 1. 安装依赖

```bash
# 安装前端依赖
cd client && npm install

# 安装后端依赖
cd ../server && npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，至少配置：
- `JWT_SECRET`：改为随机长字符串
- `GITHUB_TOKEN`、`GITHUB_OWNER`、`GITHUB_REPO`：用于图片上传（需要先创建 GitHub repo）
- `WECOM_WEBHOOK_URL`：企业微信群机器人 Webhook

### 3. 开发模式启动

```bash
# 终端1：启动后端
cd server && npm run dev

# 终端2：启动前端
cd client && npm run dev
```

访问：http://localhost:5173

默认管理员账号：`admin` / `Admin123456!`

### 4. 生产部署

```bash
# 构建前端
cd client && npm run build

# 安装 PM2
npm install -g pm2

# 在项目根目录启动（修改 ecosystem.config.js 中的 cwd 路径）
pm2 start ecosystem.config.js

# 查看状态
pm2 status
pm2 logs
```

## 功能介绍

### 📊 Dashboard 总览
- 实时统计：全部待办、今日截止、紧急任务、完成率
- 近 7 天完成趋势折线图
- 各分类进度环形图
- 紧急任务高亮卡片（红色脉冲动画）

### ✅ TODO 列表
- 左侧分类导航，显示各分类待办数
- 列表视图 / 看板视图（按状态分列）自由切换
- 按状态、优先级、关键词筛选
- 优先级颜色编码：🔴 紧急 / 🟠 高 / 🟡 中 / 🟢 低
- 逾期任务自动标红

### 📝 Markdown 编辑器
- bytemd 编辑器，支持预览模式
- 支持 GFM（表格、任务列表等）
- 代码高亮
- 拖拽/粘贴图片自动上传到 GitHub

### 📅 日历视图
- 月视图 / 列表视图
- TODO 按优先级着色显示在对应日期
- 点击空白日期快速新建
- 点击事件直接编辑

### 🔔 企业微信通知
- 每天 09:00 自动发送日报（昨日完成 + 今日待办）
- 每小时检查 24h 内到期任务，推送提醒
- 支持每个用户独立配置 Webhook

### 👑 管理员后台
- 用户 CRUD（创建、编辑、删除、重置密码）
- 角色权限可视化编辑（Checkbox 勾选权限项）
- 内置 `admin` 和 `user` 两个角色，可自由扩展

## 项目结构

```
todo/
├── client/          # React 前端
│   └── src/
│       ├── pages/   # 各页面组件
│       ├── components/
│       ├── stores/  # Zustand 状态管理
│       └── services/ # API 封装
├── server/          # Node.js 后端
│   └── src/
│       ├── routes/  # Express 路由
│       ├── middleware/ # JWT + RBAC
│       ├── services/ # 微信通知、日报
│       └── db/      # SQLite + migrations
├── scheduler.js     # PM2 定时任务进程
├── ecosystem.config.js
└── .env.example
```

## GitHub 图片仓库配置

1. 在 GitHub 创建一个公开仓库（如 `my-todo-images`）
2. 生成 Personal Access Token（需要 `repo` 权限）
3. 在 `.env` 中配置：
   ```
   GITHUB_TOKEN=ghp_xxx
   GITHUB_OWNER=your_username
   GITHUB_REPO=my-todo-images
   IMAGE_BASE_URL=https://raw.githubusercontent.com/your_username/my-todo-images/main
   ```

## 移动端

支持响应式布局：
- 桌面端：左侧导航栏
- 移动端：底部 TabBar

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=cody1991/openTodo&type=Date)](https://star-history.com/#cody1991/openTodo&Date)

---

Made with ❤️ by OpenTodo
