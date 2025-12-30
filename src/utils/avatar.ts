import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 读取 avatar.svg 文件并转换为 base64 data URI
function loadAvatarSvg(): string {
  const avatarPath = join(__dirname, '..', 'avatar.svg');
  const svgContent = readFileSync(avatarPath, 'utf-8');
  // 将 SVG 内容转换为 base64
  const base64 = Buffer.from(svgContent).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

// 导出为常量，只加载一次
export const AILUNTZ_AVATAR_URL = loadAvatarSvg();
