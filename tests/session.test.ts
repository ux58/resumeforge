import { describe, expect, it } from "vitest";
import { createHash, randomBytes } from "node:crypto";

// 会话 token 机制的核心不变量：入库哈希可复现、随机 token 不碰撞
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

describe("会话令牌", () => {
  it("SHA-256 哈希稳定可复现（查询索引依赖此行为）", () => {
    const token = randomBytes(32).toString("base64url");
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toHaveLength(64);
  });

  it("不同 token 哈希不同", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });

  it("base64url token 无 URL 不安全字符", () => {
    for (let i = 0; i < 20; i++) {
      const token = randomBytes(32).toString("base64url");
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });
});
