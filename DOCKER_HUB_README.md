# Snow Trace - Visitor Badge Service

一个轻量级的访客统计服务，自动生成访问与点赞统计徽章，专为 GitHub README 设计。

![Docker Pulls](https://img.shields.io/docker/pulls/ailuntz/snow-trace)
![Docker Image Size](https://img.shields.io/docker/image-size/ailuntz/snow-trace/latest)

## 🎯 Features

- ✅ **多架构支持**: AMD64 和 ARM64 (Apple Silicon, AWS Graviton)
- ✅ **零配置**: 开箱即用，无需数据库
- ✅ **双语界面**: 中英文双语显示
- ✅ **地理位置**: 基于 IP 自动识别访客位置
- ✅ **实时更新**: 每次访问都返回最新数据
- ✅ **组合徽章**: 访问统计 + 点赞统计 + 点赞按钮一体化

## 🚀 Quick Start

### 使用 Docker Run

```bash
docker run -d \
  --name snow-trace \
  -p 3000:3000 \
  -e BASE_URL=https://api.ailuntz.com \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  ailuntz/snow-trace:latest
```

### 使用 Docker Compose

```yaml
services:
  snow-trace:
    image: ailuntz/snow-trace:latest
    container_name: snow-trace
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - BASE_URL=https://api.your-domain.com  # 修改为你的实际域名
    restart: unless-stopped
```

运行：
```bash
docker-compose up -d
```

## 📖 Usage

### 在 GitHub README 中使用

```markdown
[![Visitor Badge](https://your-domain.com/v1/your-username/your-repo)](https://your-domain.com/v1/like/your-username/your-repo/add)
```

### API 端点

- `GET /v1/:namespace/:key` - 组合徽章（访问 + 点赞 + 按钮）
- `GET /v1/visit/:namespace/:key` - 访问统计徽章
- `GET /v1/like/:namespace/:key` - 点赞统计徽章
- `GET /v1/like/:namespace/:key/add` - 点赞操作
- `GET /health` - 健康检查

**路径参数**：
- `namespace`: GitHub 用户名
- `key`: 项目/仓库名称

## 💾 Data Persistence

**重要**: 请挂载 `/app/data` 目录以持久化数据

```bash
-v /path/to/your/data:/app/data
```

数据目录结构：
```
data/
├── counters.json       # 访问计数
├── likes.json          # 点赞计数
├── visits/             # 访问日志（按用户分文件）
└── likes_visits/       # 点赞日志（按用户分文件）
```

### ⚠️ 权限问题修复

容器以 `node` 用户（UID 1000）运行。如果遇到权限错误（如 `EACCES: permission denied`），请执行：

```bash
# 方法 1: 修改目录所有者为容器用户
sudo chown -R 1000:1000 ./data

# 方法 2: 设置宽松权限（仅开发环境）
sudo chmod -R 777 ./data
```

## 🔧 Configuration

### 环境变量

| 变量 | 默认值 | 描述 |
|------|--------|------|
| `PORT` | `3000` | 服务端口 |
| `BASE_URL` | `http://localhost:3000` | ⚠️ **服务基础 URL（必须设置为实际域名）** |

**重要提示**：
- `BASE_URL` 必须设置为你的实际域名（如 `https://api.your-domain.com`）
- 如果使用默认的 localhost，点赞等功能链接将无法正常工作
- 生产环境部署时务必通过 `-e BASE_URL=https://...` 或 docker-compose.yml 设置

### 端口

- `3000` - HTTP 服务端口

## 📊 Health Check

容器内置健康检查：
```bash
curl http://localhost:3000/health
```

预期响应：
```json
{"status":"ok"}
```

## 🏗️ Architecture

- **运行时**: Node.js 20 Alpine
- **语言**: TypeScript (使用 tsx 直接运行)
- **数据存储**: JSON + JSONL 文件
- **依赖**:
  - `geoip-lite` - IP 地理位置查询
  - `dotenv` - 环境变量管理

## 📦 Image Tags

- `latest` - 最新稳定版本
- `v1.0.1` - 当前最新版本（支持环境变量配置）
- `v1.0.0` - 初始版本

## 🔒 Security

- ✅ 以非 root 用户运行 (`node`)
- ✅ 基于 Alpine Linux (更小、更安全)
- ✅ 最小化依赖

## 📝 Example

完整的 Docker Compose 示例：

```yaml
services:
  snow-trace:
    image: ailuntz/snow-trace:latest
    container_name: snow-trace
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - PORT=3000
      - BASE_URL=https://api.your-domain.com  # ⚠️ 必须修改为你的实际域名
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
```

## 🔗 Links

- **GitHub**: https://github.com/ailuntz/snow-trace
- **Documentation**: https://github.com/ailuntz/snow-trace#readme
- **Issues**: https://github.com/ailuntz/snow-trace/issues

## 📄 License

MIT License - Free to use, attribution appreciated

---

**Built with ❤️ by ailuntz**
