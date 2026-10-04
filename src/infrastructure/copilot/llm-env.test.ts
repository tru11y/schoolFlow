import { describe, expect, it } from "vitest";
import { chatApiKey, llmFromEnv } from "./llm-env";

describe("llmFromEnv", () => {
  it("is off without any key", () => {
    expect(llmFromEnv({})).toBeNull();
    expect(llmFromEnv({ AI_PROVIDER: "anthropic" })).toBeNull();
  });

  it("works with ANTHROPIC_API_KEY alone (anthropic implied)", () => {
    expect(llmFromEnv({ ANTHROPIC_API_KEY: "sk-ant-test-key" })?.model).toBe("claude-haiku-4-5-20251001");
  });

  it("works with AI_API_KEY + provider, honouring AI_MODEL", () => {
    expect(llmFromEnv({ AI_PROVIDER: "openai", AI_API_KEY: "sk-test-key-123" })?.model).toBe("gpt-4o-mini");
    expect(llmFromEnv({ AI_PROVIDER: "anthropic", AI_API_KEY: "sk-ant-test-key", AI_MODEL: "claude-3-5-haiku-latest" })?.model).toBe("claude-3-5-haiku-latest");
  });
});

describe("pasted secrets", () => {
  it("tolerates surrounding whitespace, newlines and quotes", () => {
    expect(chatApiKey({ ANTHROPIC_API_KEY: "  sk-ant-abc123\n" })).toBe("sk-ant-abc123");
    expect(chatApiKey({ ANTHROPIC_API_KEY: '"sk-ant-abc123"' })).toBe("sk-ant-abc123");
    expect(chatApiKey({ ANTHROPIC_API_KEY: "  \n" })).toBeUndefined();
  });
});

describe("chatApiKey", () => {
  it("prefers ANTHROPIC_API_KEY, falls back to AI_API_KEY only for anthropic", () => {
    expect(chatApiKey({ ANTHROPIC_API_KEY: "a", AI_API_KEY: "b" })).toBe("a");
    expect(chatApiKey({ AI_API_KEY: "b", AI_PROVIDER: "anthropic" })).toBe("b");
    expect(chatApiKey({ AI_API_KEY: "b" })).toBe("b");
    expect(chatApiKey({ AI_API_KEY: "b", AI_PROVIDER: "openai" })).toBeUndefined();
    expect(chatApiKey({})).toBeUndefined();
  });
});
