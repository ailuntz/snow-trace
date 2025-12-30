# 使用 Node.js 20 Alpine 镜像
FROM node:20-alpine

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖（包括 tsx 用于运行 TypeScript）
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY src ./src

# 创建数据目录
RUN mkdir -p /app/data && chown -R node:node /app

# 设置默认环境变量（可在运行时覆盖）
ENV PORT=3000 \
    BASE_URL=http://localhost:3000 \
    DATA_DIR=./data

# 使用非 root 用户
USER node

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动应用（使用 tsx 直接运行 TypeScript）
CMD ["pnpm", "start"]
