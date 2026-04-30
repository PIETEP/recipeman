import { readFileSync } from "fs";
import { resolve } from "path";

// .env.local を読み込む（Next.js外のテスト環境用）
try {
  const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  for (const line of envFile.split("\n")) {
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const value = line.slice(eqIdx + 1).trim();
    if (key && !key.startsWith("#")) {
      process.env[key] = value;
    }
  }
} catch {
  console.warn("[integration-setup] .env.local が見つかりません");
}
