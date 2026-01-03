import fs from "node:fs";
import path from "node:path";
import geoip from "geoip-lite";

const DATA_DIR = path.join(process.cwd(), "data");
const COUNTERS_FILE = path.join(DATA_DIR, "counters.json");
const LIKES_FILE = path.join(DATA_DIR, "likes.json");
const VISITS_DIR = path.join(DATA_DIR, "visits");
const LIKES_VISITS_DIR = path.join(DATA_DIR, "likes_visits");

// 获取用户专属的日志文件路径
const getVisitLogPath = (namespace: string, key: string) => {
  const userDir = path.join(VISITS_DIR, namespace);
  return path.join(userDir, `${key}.jsonl`);
};

const getLikeLogPath = (namespace: string, key: string) => {
  const userDir = path.join(LIKES_VISITS_DIR, namespace);
  return path.join(userDir, `${key}.jsonl`);
};

// 数据结构
interface CounterData {
  [key: string]: number; // "namespace:key" => count
}

interface LikeData {
  [key: string]: number; // "namespace:key" => count
}

interface LogEntry {
  timestamp: string;
  namespace: string;
  key: string;
  count: number;
  type: "visit" | "like"; // 区分访问和点赞
  userAgent?: string;
  referer?: string;
  ip?: string; // IP 地址
  country?: string; // 国家代码，如 CN, US, JP
  region?: string; // 地区/省份
  city?: string; // 城市
  timezone?: string; // 时区
}

class Store {
  private counters: CounterData = {};
  private likes: LikeData = {};

  // 防刷缓存：存储最后访问/点赞的时间 (IP → timestamp)
  private visitCooldown: Map<string, number> = new Map();
  private likeCooldown: Map<string, number> = new Map();

  // 冷却时间：30秒（30000毫秒）
  private readonly COOLDOWN_MS = 30000;

  constructor() {
    // 确保目录存在
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    // 加载数据
    this.loadCounters();
    this.loadLikes();

    // 进程退出时保存
    process.once("SIGINT", () => this.cleanup());
    process.once("SIGTERM", () => this.cleanup());

    // 定期清理过期的冷却记录（每5分钟清理一次）
    setInterval(() => this.cleanupCooldown(), 5 * 60 * 1000);
  }

  private loadCounters() {
    try {
      if (fs.existsSync(COUNTERS_FILE)) {
        const data = fs.readFileSync(COUNTERS_FILE, "utf-8");
        this.counters = JSON.parse(data);
      }
    } catch (error) {
      console.error("Failed to load counters:", error);
      this.counters = {};
    }
  }

  private loadLikes() {
    try {
      if (fs.existsSync(LIKES_FILE)) {
        const data = fs.readFileSync(LIKES_FILE, "utf-8");
        this.likes = JSON.parse(data);
      }
    } catch (error) {
      console.error("Failed to load likes:", error);
      this.likes = {};
    }
  }

  private saveCounters() {
    try {
      const tmp = COUNTERS_FILE + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(this.counters, null, 2));
      fs.renameSync(tmp, COUNTERS_FILE); // 原子操作
    } catch (error) {
      console.error("Failed to save counters:", error);
    }
  }

  private saveLikes() {
    try {
      const tmp = LIKES_FILE + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(this.likes, null, 2));
      fs.renameSync(tmp, LIKES_FILE); // 原子操作
    } catch (error) {
      console.error("Failed to save likes:", error);
    }
  }

  // 立即保存访问日志到文件（按用户分文件存储）
  private saveVisitLog(entry: LogEntry) {
    try {
      const logPath = getVisitLogPath(entry.namespace, entry.key);
      const logDir = path.dirname(logPath);

      // 确保目录存在
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const line = JSON.stringify(entry) + "\n";
      fs.appendFileSync(logPath, line);
    } catch (error) {
      console.error("Failed to save visit log:", error);
    }
  }

  // 立即保存点赞日志到文件（按用户分文件存储）
  private saveLikeLog(entry: LogEntry) {
    try {
      const logPath = getLikeLogPath(entry.namespace, entry.key);
      const logDir = path.dirname(logPath);

      // 确保目录存在
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const line = JSON.stringify(entry) + "\n";
      fs.appendFileSync(logPath, line);
    } catch (error) {
      console.error("Failed to save like log:", error);
    }
  }

  // 清理过期的冷却记录（释放内存）
  private cleanupCooldown() {
    const now = Date.now();
    const expiryTime = now - this.COOLDOWN_MS;

    // 清理访问冷却
    for (const [key, timestamp] of this.visitCooldown.entries()) {
      if (timestamp < expiryTime) {
        this.visitCooldown.delete(key);
      }
    }

    // 清理点赞冷却
    for (const [key, timestamp] of this.likeCooldown.entries()) {
      if (timestamp < expiryTime) {
        this.likeCooldown.delete(key);
      }
    }
  }

  // 检查是否在冷却期内
  private isInCooldown(cooldownMap: Map<string, number>, key: string): boolean {
    const lastTime = cooldownMap.get(key);
    if (!lastTime) return false;

    const now = Date.now();
    return (now - lastTime) < this.COOLDOWN_MS;
  }

  // 生成冷却键（namespace:key:ip）
  private getCooldownKey(namespace: string, key: string, ip?: string): string {
    const cleanIP = ip || 'unknown';
    return `${namespace}:${key}:${cleanIP}`;
  }

  private cleanup() {
    // 保存当前数据
    this.saveCounters();
    this.saveLikes();

    console.log("Data saved. Exiting...");
    process.exit(0);
  }

  // 从 IP 获取地理位置信息
  private getLocationFromIP(ip?: string) {
    if (!ip) return {};

    // 移除 IPv6 前缀，如果存在
    const cleanIP = ip.replace(/^::ffff:/, '');

    // 本地 IP 跳过查询（包括 IPv4 和 IPv6）
    if (cleanIP === '127.0.0.1' || cleanIP === 'localhost' || cleanIP === '::1' ||
        cleanIP.startsWith('192.168.') || cleanIP.startsWith('10.') || cleanIP.startsWith('172.')) {
      return { ip: cleanIP, country: 'LOCAL', city: 'localhost' };
    }

    const geo = geoip.lookup(cleanIP);
    if (!geo) return { ip: cleanIP };

    return {
      ip: cleanIP,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      timezone: geo.timezone,
    };
  }

  // 增加访问计数（带防刷机制）
  incrementVisit(namespace: string, key: string, userAgent?: string, referer?: string, ip?: string) {
    const storeKey = `${namespace}:${key}`;
    const cooldownKey = this.getCooldownKey(namespace, key, ip);

    // 检查是否在冷却期内
    const inCooldown = this.isInCooldown(this.visitCooldown, cooldownKey);

    // 只有不在冷却期内才增加计数
    if (!inCooldown) {
      this.counters[storeKey] = (this.counters[storeKey] || 0) + 1;

      // 获取地理位置信息
      const location = this.getLocationFromIP(ip);

      // 立即保存日志到文件
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        namespace,
        key,
        count: this.counters[storeKey],
        type: "visit",
        userAgent,
        referer,
        ...location, // 包含 ip, country, region, city, timezone
      };
      this.saveVisitLog(logEntry);

      // 立即保存计数
      this.saveCounters();

      // 更新冷却时间
      this.visitCooldown.set(cooldownKey, Date.now());
    }

    // 无论是否计数，都返回当前数据（这样徽章仍然可以显示）
    return {
      count: this.counters[storeKey] || 0,
      recentVisits: this.getRecentVisits(namespace, key)
    };
  }

  // 获取访问计数
  getVisitCount(namespace: string, key: string): number {
    const storeKey = `${namespace}:${key}`;
    return this.counters[storeKey] || 0;
  }

  // 增加点赞（带防刷机制）
  incrementLike(namespace: string, key: string, userAgent?: string, referer?: string, ip?: string): number {
    const storeKey = `${namespace}:${key}`;
    const cooldownKey = this.getCooldownKey(namespace, key, ip);

    // 检查是否在冷却期内
    const inCooldown = this.isInCooldown(this.likeCooldown, cooldownKey);

    // 只有不在冷却期内才增加计数
    if (!inCooldown) {
      this.likes[storeKey] = (this.likes[storeKey] || 0) + 1;

      // 获取地理位置信息
      const location = this.getLocationFromIP(ip);

      // 立即保存日志到文件
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        namespace,
        key,
        count: this.likes[storeKey],
        type: "like",
        userAgent,
        referer,
        ...location, // 包含 ip, country, region, city, timezone
      };
      this.saveLikeLog(logEntry);

      // 立即保存点赞数
      this.saveLikes();

      // 更新冷却时间
      this.likeCooldown.set(cooldownKey, Date.now());
    }

    // 无论是否计数，都返回当前数据
    return this.likes[storeKey] || 0;
  }

  // 获取点赞数
  getLikeCount(namespace: string, key: string): number {
    const storeKey = `${namespace}:${key}`;
    return this.likes[storeKey] || 0;
  }

  // 从文件中读取最近的访问记录（只读取单个用户的文件）
  getRecentVisits(namespace: string, key: string, limit: number = 10) {
    try {
      const logPath = getVisitLogPath(namespace, key);

      if (!fs.existsSync(logPath)) {
        return [];
      }

      const content = fs.readFileSync(logPath, "utf-8");
      const lines = content.trim().split("\n").filter(line => line);

      const logs: LogEntry[] = lines
        .map(line => {
          try {
            return JSON.parse(line) as LogEntry;
          } catch {
            return null;
          }
        })
        .filter((log): log is LogEntry => log !== null);

      return logs
        .slice(-limit)
        .reverse()
        .map(log => ({
          count: log.count,
          time: log.timestamp,
          country: log.country,
          city: log.city,
          ip: log.ip
        }));
    } catch (error) {
      console.error("Failed to read visit logs:", error);
      return [];
    }
  }

  // 从文件中读取最近的点赞记录（只读取单个用户的文件）
  getRecentLikes(namespace: string, key: string, limit: number = 10) {
    try {
      const logPath = getLikeLogPath(namespace, key);

      if (!fs.existsSync(logPath)) {
        return [];
      }

      const content = fs.readFileSync(logPath, "utf-8");
      const lines = content.trim().split("\n").filter(line => line);

      const logs: LogEntry[] = lines
        .map(line => {
          try {
            return JSON.parse(line) as LogEntry;
          } catch {
            return null;
          }
        })
        .filter((log): log is LogEntry => log !== null);

      return logs
        .slice(-limit)
        .reverse()
        .map(log => ({
          count: log.count,
          time: log.timestamp,
          country: log.country,
          city: log.city,
          ip: log.ip
        }));
    } catch (error) {
      console.error("Failed to read like logs:", error);
      return [];
    }
  }
}

// 单例
export const store = new Store();
