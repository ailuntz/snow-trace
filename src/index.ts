import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { store } from "./storage.js";
import { renderVisitorBadge, renderLikeBadge, renderCombinedBadge, renderLikeButton, renderPromoButton } from "./utils/render.js";
import { PORT } from "./config.js";

// SVG 响应头（强制不缓存，包含时间戳以绕过 GitHub Camo 缓存）
function getSVGHeaders() {
  return {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
    "ETag": `"${Date.now()}"`,
    "Last-Modified": new Date().toUTCString(),
  };
}

// 获取客户端 IP 地址
function getClientIP(req: IncomingMessage): string | undefined {
  // 尝试从 X-Forwarded-For 获取（如果使用了代理）
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ips.split(',')[0].trim();
  }

  // 尝试从 X-Real-IP 获取
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] : realIP;
  }

  // 从 socket 获取
  return req.socket.remoteAddress;
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = req.url || "/";
  console.log(`Request: ${req.method} ${url}`);

  // 健康检查
  if (url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // 访客统计徽章: /v1/visit/:namespace/:key
  if (url.startsWith("/v1/visit/")) {
    const match = url.match(/^\/v1\/visit\/([^/]+)\/([^/]+)/);
    if (match) {
      const namespace = match[1];
      const key = match[2];
      const clientIP = getClientIP(req);
      const data = store.incrementVisit(namespace, key, req.headers["user-agent"], req.headers["referer"], clientIP);
      const svg = renderVisitorBadge(data);
      res.writeHead(200, getSVGHeaders());
      res.end(svg);
      return;
    }
  }

  // 组合徽章: /v1/badge/:namespace/:key
  if (url.startsWith("/v1/badge/")) {
    const match = url.match(/^\/v1\/badge\/([^/]+)\/([^/]+)/);
    if (match) {
      const namespace = match[1];
      const key = match[2];
      const clientIP = getClientIP(req);
      const visitData = store.incrementVisit(namespace, key, req.headers["user-agent"], req.headers["referer"], clientIP);
      const likeData = {
        count: store.getLikeCount(namespace, key),
        recentLikes: store.getRecentLikes(namespace, key)
      };
      const svg = renderCombinedBadge(visitData, likeData, namespace, key);
      res.writeHead(200, getSVGHeaders());
      res.end(svg);
      return;
    }
  }

  // 点赞操作: /v1/like/:namespace/:key/add
  if (url.includes("/v1/like/") && url.endsWith("/add")) {
    const match = url.match(/^\/v1\/like\/([^/]+)\/([^/]+)\/add/);
    if (match) {
      const namespace = match[1];
      const key = match[2];
      const clientIP = getClientIP(req);
      store.incrementLike(namespace, key, req.headers["user-agent"], req.headers["referer"], clientIP);

      // 获取 referer，如果没有则跳转到健康检查页面
      const referer = req.headers["referer"] || req.headers["referrer"];
      const redirectUrl = referer || '/health';

      // 返回点赞成功页面，并自动跳转回原页面
      const successPage = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="1;url=${redirectUrl}">
  <title>点赞成功 · Like Success</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }
    .container {
      text-align: center;
      background: white;
      padding: 40px 60px;
      border-radius: 20px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      animation: slideIn 0.3s ease-out;
    }
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .icon {
      font-size: 60px;
      margin-bottom: 20px;
      animation: heartBeat 0.5s ease-in-out;
    }
    @keyframes heartBeat {
      0%, 100% { transform: scale(1); }
      25% { transform: scale(1.2); }
      50% { transform: scale(1); }
      75% { transform: scale(1.1); }
    }
    h1 {
      color: #f5576c;
      margin: 0 0 10px 0;
      font-size: 28px;
    }
    p {
      color: #666;
      margin: 5px 0;
      font-size: 16px;
    }
    .redirect-text {
      margin-top: 15px;
      font-size: 14px;
      color: #999;
    }
    .notice {
      margin-top: 20px;
      padding: 15px;
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      border-radius: 4px;
      font-size: 13px;
      color: #856404;
      text-align: left;
      line-height: 1.6;
    }
    .notice strong {
      color: #f5576c;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">❤️</div>
    <h1>点赞成功！</h1>
    <p>Like Success!</p>
    <p class="redirect-text">正在跳转回原页面... · Redirecting...</p>
    <div class="notice">
      <strong>💡 提示 · Notice</strong><br>
      GitHub README 中的徽章可能有 <strong>5-15 分钟</strong>的缓存延迟<br>
      Badge on GitHub may have a <strong>5-15 min</strong> cache delay
    </div>
  </div>
</body>
</html>`;

      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      });
      res.end(successPage);
      return;
    }
  }

  // 点赞徽章: /v1/like/:namespace/:key
  if (url.startsWith("/v1/like/")) {
    const match = url.match(/^\/v1\/like\/([^/]+)\/([^/]+)/);
    if (match) {
      const namespace = match[1];
      const key = match[2];
      const count = store.getLikeCount(namespace, key);
      const recentLikes = store.getRecentLikes(namespace, key);
      const svg = renderLikeBadge({ count, recentLikes });
      res.writeHead(200, getSVGHeaders());
      res.end(svg);
      return;
    }
  }

  // 点赞按钮: /v1/button/:namespace/:key
  if (url.startsWith("/v1/button/")) {
    const match = url.match(/^\/v1\/button\/([^/]+)\/([^/]+)/);
    if (match) {
      const namespace = match[1];
      const key = match[2];
      const count = store.getLikeCount(namespace, key);
      const svg = renderLikeButton(namespace, key, count);
      res.writeHead(200, getSVGHeaders());
      res.end(svg);
      return;
    }
  }

  // 推广按钮: /v1/promo
  if (url === "/v1/promo" || url.startsWith("/v1/promo?")) {
    const svg = renderPromoButton();
    res.writeHead(200, getSVGHeaders());
    res.end(svg);
    return;
  }

  // 通用路由: /v1/:namespace/:key (默认返回组合徽章)
  if (url.startsWith("/v1/")) {
    // 支持查询参数（如 ?t=timestamp），方便绕过缓存
    const match = url.match(/^\/v1\/([^/]+)\/([^/?]+)/);
    if (match) {
      const namespace = match[1];
      const key = match[2];
      const clientIP = getClientIP(req);
      const visitData = store.incrementVisit(namespace, key, req.headers["user-agent"], req.headers["referer"], clientIP);
      const likeData = {
        count: store.getLikeCount(namespace, key),
        recentLikes: store.getRecentLikes(namespace, key)
      };
      const svg = renderCombinedBadge(visitData, likeData, namespace, key);
      res.writeHead(200, getSVGHeaders());
      res.end(svg);
      return;
    }
  }

  // 404
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`🚀 Visitor Badge Lite running on http://localhost:${PORT}`);
  console.log(`📊 API Endpoints:`);
  console.log(`   /v1/badge/:namespace/:key   - Combined badge (visit + like)`);
  console.log(`   /v1/visit/:namespace/:key   - Visit badge only`);
  console.log(`   /v1/like/:namespace/:key    - Like badge only`);
  console.log(`   /v1/button/:namespace/:key  - Like button`);
  console.log(`   /v1/promo                   - Promo button`);
  console.log(`   /health                     - Health check`);
});
