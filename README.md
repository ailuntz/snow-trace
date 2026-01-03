# Snow Trace - 访客统计徽章 / Visitor Badge

一个轻量级的访客统计服务，自动生成访问与点赞统计徽章，专为 GitHub README 设计。

---

## 📌 快速使用 / Quick Start


### 效果展示 / Live Demo

[![Combined Badge](https://api.ailuntz.com/v1/ailuntz/ailuntz)](https://api.ailuntz.com/v1/like/ailuntz/ailuntz/add)
<!-- [![Promo Button](https://api.ailuntz.com/v1/promo)](https://github.com/ailuntz/ailuntz) -->

> **⚠️ 重要提示 / Important Notice**
> GitHub 通过 Camo 代理缓存徽章图片，**可能有 5-15 分钟的显示延迟**。直接访问 API 或本地查看 README 可看到实时数据。
> GitHub caches badge images via Camo proxy, which **may cause a 5-15 minute display delay**. Direct API access or local README viewing shows real-time data.

### 什么是组合徽章？

一个完整的访客统计小部件，显示：
- **左栏（紫色）**: 访客统计 - 总访问次数 + 最近10次访问记录 + GitHub 头像
- **右栏（红色）**: 点赞统计 - 总点赞数 + 最近10次点赞记录 + GitHub 头像
- **底部按钮**: 可点击的点赞按钮

### 在你的 GitHub README 中添加徽章

只需一行 Markdown 代码：

```markdown
[![Visitor Badge](https://api.ailuntz.com/v1/your-username/your-repo)](https://api.ailuntz.com/v1/like/your-username/your-repo/add)
```

**示例**：
```markdown
[![Visitor Badge](https://api.ailuntz.com/v1/ailuntz/ailuntz)](https://api.ailuntz.com/v1/like/ailuntz/ailuntz/add)
```

**路径参数**：
- 第一个字段：GitHub 用户名
- 第二个字段：项目/仓库名称

**交互说明**：
- 访问徽章 = 自动增加访问计数
- 点击徽章 = 触发点赞操作（显示成功页面后自动返回）

**⚠️ GitHub 显示延迟说明**：
- GitHub README 中的徽章可能有 **5-15 分钟**的缓存延迟（GitHub Camo 代理缓存）
- 直接访问 API URL 可看到实时数据：`https://api.ailuntz.com/v1/your-username/your-repo`
- 本地查看 README 也能看到实时数据

---

## 🛠 开发者文档 / Developer Guide

### 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 服务运行在 http://localhost:3000
```

### API 端点

#### 徽章类
- `GET /v1/:namespace/:key` - 组合徽章（推荐）
- `GET /v1/badge/:namespace/:key` - 组合徽章（明确路径）
- `GET /v1/visit/:namespace/:key` - 访客统计徽章
- `GET /v1/like/:namespace/:key` - 点赞统计徽章
- `GET /v1/button/:namespace/:key` - 独立点赞按钮
- `GET /v1/promo` - 项目推广按钮

#### 操作类
- `GET /v1/like/:namespace/:key/add` - 点赞操作（显示成功页面，1秒后跳回）

#### 系统类
- `GET /health` - 服务健康检查

### 核心特性

1. **动态头像**
   - 特定用户（ailuntz）使用本地自定义头像
   - 其他用户自动从 GitHub API 加载头像 (`https://github.com/{username}.png`)

2. **地理位置追踪**
   - 基于 IP 自动识别访客国家、地区、城市
   - 本地 IP 显示为 "LOCAL / localhost"

3. **双语界面**
   - 所有文本均为中英双语显示
   - 时间格式：刚刚 / just now，X分钟前 / Xm ago

4. **防刷机制**
   - 同一 IP 在 **30 秒**内只计数一次（访问和点赞）
   - 基于 IP + namespace + key 的组合进行防刷
   - 内存缓存，自动清理过期记录
   - 冷却期内仍可查看徽章（只是不计数）

5. **实时更新**
   - 所有徽章设置增强的反缓存响应头（`no-cache`, `Pragma`, `ETag`, `Expires`）
   - API 直接访问可获取最新数据
   - ⚠️ **GitHub README 中有 5-15 分钟的缓存延迟**（GitHub Camo 代理缓存）
   - 支持 URL 查询参数强制刷新（如 `?t=timestamp`）

### 数据存储架构

```
data/
├── counters.json                # 访问计数（内存缓存）
├── likes.json                   # 点赞计数（内存缓存）
├── visits/                      # 访问日志（按用户分文件）
│   └── {namespace}/
│       └── {key}.jsonl         # 每个项目一个 JSONL 文件
└── likes_visits/                # 点赞日志（按用户分文件）
    └── {namespace}/
        └── {key}.jsonl
```

**性能优化**：
- 每个用户/项目独立文件存储（避免单文件过大）
- JSONL 格式追加写入（O(1) 操作）
- 读取仅加载单个用户文件（7ms 响应时间）
- 支持 100,000 用户 × 1,000 条记录规模

**日志格式** (JSONL):
```json
{
  "timestamp": "2025-12-30T12:34:56.789Z",
  "namespace": "ailuntz",
  "key": "snow-trace",
  "count": 42,
  "type": "visit",
  "userAgent": "Mozilla/5.0...",
  "ip": "123.45.67.89",
  "country": "CN",
  "city": "Beijing"
}
```

### 部署

**环境要求**：Node.js 20+ / Bun

**环境变量配置**：

创建 `.env` 文件（或设置环境变量）：
```bash
PORT=3000
BASE_URL=https://api.ailuntz.com  # ⚠️ 修改为你的实际域名
DATA_DIR=./data
```

**⚠️ 重要**：`BASE_URL` 必须设置为实际的域名，否则点赞等功能链接会错误！

#### 使用 Docker Hub 镜像（推荐）

```bash
# 拉取最新镜像
docker pull ailuntz/snow-trace:latest

# 运行容器
docker run -d \
  --name snow-trace \
  -p 3000:3000 \
  -e BASE_URL=https://api.your-domain.com \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  ailuntz/snow-trace:latest

# 修复权限（如遇到 EACCES 错误）
sudo chown -R 1000:1000 ./data
```

**服务器部署**：
```bash
# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 修改 BASE_URL 为你的域名

# 生产环境运行（使用 tsx 直接运行 TypeScript）
pnpm start
```

**Docker 部署（本地构建）**：

如果需要自行构建镜像：

```bash
# 1. 构建镜像
docker build -t snow-trace:latest .

# 2. 运行容器（设置环境变量）
docker run -d \
  --name snow-trace \
  -p 3000:3000 \
  -e BASE_URL=https://api.your-domain.com \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  snow-trace:latest

# 3. 修复权限（如遇到错误）
sudo chown -R 1000:1000 ./data

# 4. 查看日志
docker logs -f snow-trace

# 5. 健康检查
curl http://localhost:3000/health
```

**Docker Compose 部署**（推荐）：

创建 `docker-compose.yml`：
```yaml
services:
  snow-trace:
    build: .
    image: snow-trace:latest
    container_name: snow-trace
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
```

运行：
```bash
docker-compose up -d
```

**Dockerfile 特性**：
- ✅ 多架构支持（AMD64 + ARM64）
- ✅ 使用 tsx 直接运行 TypeScript（无需编译）
- ✅ 基于 Alpine Linux（镜像更小）
- ✅ 使用非 root 用户运行（node, UID 1000）
- ✅ 环境变量配置支持
- ✅ 内置健康检查

**数据持久化**：
- 数据目录 `/app/data` 必须挂载到宿主机
- 容器以 UID 1000 运行，需确保挂载目录权限正确（见故障排查）
- 定期备份 `data/` 目录以防数据丢失

### 徽章规格

**组合徽章**：
- 尺寸：780×440px（左右各380px + 10px间隔 + 70px底部按钮）
- 左栏：紫色渐变 (#667eea → #764ba2)
- 右栏：红色渐变 (#f093fb → #f5576c)
- 圆形头像：40×40px

**点赞按钮**：
- 尺寸：780×70px
- 渐变背景：粉色 → 红色

**推广按钮**：
- 尺寸：780×60px
- 渐变背景：紫色 → 深紫色

### 技术栈

- **运行时**: Node.js 20+ / Bun
- **语言**: TypeScript
- **依赖**:
  - `geoip-lite` - IP 地理位置查询
  - `node:fs` - 文件系统操作
  - `node:http` - HTTP 服务器

### 数据备份

**重要**：定期备份 `data/` 目录以防数据丢失。

**备份内容**：
```
data/
├── counters.json       # 访问计数（关键）
├── likes.json          # 点赞计数（关键）
├── visits/             # 访问日志（JSONL 格式）
└── likes_visits/       # 点赞日志（JSONL 格式）
```

**本地备份脚本**：
```bash
# 创建带时间戳的备份
BACKUP_DIR="backup/snow-trace-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r data "$BACKUP_DIR/"
echo "备份完成: $BACKUP_DIR"

# 或使用 tar 压缩备份
tar -czf "snow-trace-backup-$(date +%Y%m%d).tar.gz" data/
```

**Docker 环境备份**：
```bash
# 备份容器中的数据
docker cp snow-trace:/app/data ./backup-data

# 或直接备份挂载的 volume
cp -r ./data ./backup-data-$(date +%Y%m%d)
```

**恢复数据**：
```bash
# 停止服务
docker-compose down  # 或 kill 进程

# 恢复数据
cp -r backup-data/* data/

# 重启服务
docker-compose up -d  # 或 pnpm start
```

**建议**：
- 每天自动备份一次
- 保留最近 7-30 天的备份
- 重要数据可以备份到云存储（如 S3、OSS）

---

## 🔍 故障排查 / Troubleshooting

### 问题 1: 容器启动后无法写入数据

**症状**：
```
Failed to save visit log: Error: EACCES: permission denied, mkdir '/app/data/visits/...'
Failed to save counters: Error: EACCES: permission denied, open '/app/data/counters.json.tmp'
```

**原因**：容器以 `node` 用户（UID 1000）运行，主机目录权限不匹配

**解决方案**：
```bash
# 方法 1: 修改目录所有者（推荐）
sudo chown -R 1000:1000 ./data

# 方法 2: 设置宽松权限（仅开发环境）
sudo chmod -R 777 ./data
```

### 问题 2: 点赞按钮链接错误

**症状**：点击徽章后跳转到 localhost 或错误的域名

**原因**：未正确设置 `BASE_URL` 环境变量

**解决方案**：
```bash
# Docker Run 方式
docker run ... -e BASE_URL=https://api.your-domain.com ...

# Docker Compose 方式
# 在 docker-compose.yml 的 environment 部分添加
environment:
  - BASE_URL=https://api.your-domain.com
```

### 问题 3: 徽章无法加载 GitHub 头像

**症状**：徽章显示但头像位置为空

**原因**：GitHub API 限流或网络问题

**解决方案**：
- GitHub 头像使用 `https://github.com/{username}.png`
- 检查服务器是否能访问 GitHub
- 特定用户可以在 `src/utils/render.ts` 中配置本地头像

### 问题 4: 数据目录为空

**症状**：访问徽章后 data 目录没有生成文件

**原因**：
1. 权限问题（见问题 1）
2. 未正确挂载数据目录
3. BASE_URL 配置错误导致访问了错误的端点

**解决方案**：
```bash
# 检查容器日志
docker logs snow-trace

# 检查挂载
docker inspect snow-trace | grep -A 5 Mounts

# 测试访问
curl http://localhost:3000/v1/test/demo
```

---

## 📄 License

MIT License - 自由使用，保留署名
