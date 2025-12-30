import { config } from "dotenv";

// 加载 .env 文件
config();

export const PORT = process.env.PORT || "3000";
export const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
export const DATA_DIR = process.env.DATA_DIR || "./data";
