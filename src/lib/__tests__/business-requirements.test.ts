import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";

// ── モック設定 ──────────────────────────────────────────
vi.mock("fs");
vi.mock("../db_service", () => ({
  DBService: {
    getFeedbacks: vi.fn().mockResolvedValue([]),
    saveRecipe: vi.fn().mockResolvedValue(undefined),
    saveSuggestionLog: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("../memory_service", () => ({
  MemoryService: {
    getProfile: vi.fn().mockResolvedValue({ name: "default" }),
  },
}));

// groq_service をモック化して引数をキャプチャする
const capturedArgs = {
  generateSearchQueries: [] as any[],
  summarizeSearchResults: [] as any[],
};

vi.mock("../groq_service", () => ({
  GeminiService: {
    buildFeedbackSummary: vi.fn().mockReturnValue(""),
    generateSearchQueries: vi
      .fn()
      .mockImplementation(async (profile, prefs, feedback, refinement) => {
        capturedArgs.generateSearchQueries.push({
          profile,
          prefs,
          feedback,
          refinement,
        });
        return ["エリンギ ナツメグ 炒め 時短", "エリンギ 洋食 レシピ"];
      }),
    summarizeSearchResults: vi
      .fn()
      .mockImplementation(async (context, profile, prefs, refinement) => {
        capturedArgs.summarizeSearchResults.push({
          context,
          profile,
          prefs,
          refinement,
        });
        return [
          {
            title: "エリンギとナツメグのクリーム煮",
            url: "https://oceans-nadia.com/user/1/recipe/1",
            source: "Nadia",
            cookingTime: 15,
            tags: ["veg", "洋食"],
            ingredients: "エリンギ, 鶏むね肉, ナツメグ, 生クリーム",
            steps:
              "1. エリンギを炒める 2. ナツメグで香りづけ 3. 生クリームで仕上げ",
            nutrition: "ビタミンD, タンパク質",
            dishwashingTip: "フライパン1つ",
            leftoverTip: "翌日パスタに",
          },
        ];
      }),
  },
}));

const { RecipeService } = await import("../recipe_service");

// ── テスト ────────────────────────────────────────────────
describe("ビジネス要件: 食材指定（refinement）", () => {
  beforeEach(() => {
    capturedArgs.generateSearchQueries.length = 0;
    capturedArgs.summarizeSearchResults.length = 0;
    vi.stubEnv("SERPER_API_KEY", "test-key");
    vi.mocked(fs.readFileSync).mockReturnValue("");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        organic: [
          {
            title: "エリンギとナツメグのクリーム煮",
            link: "https://oceans-nadia.com/user/1/recipe/1",
            snippet: "エリンギ、ナツメグを使った簡単レシピ",
          },
        ],
      }),
    }) as any;
  });

  it("食材指定がgenerateSearchQueriesに渡される", async () => {
    await RecipeService.findSuggestions(
      "default",
      "エリンギとナツメグを使って",
    );

    expect(capturedArgs.generateSearchQueries).toHaveLength(1);
    expect(capturedArgs.generateSearchQueries[0].refinement).toBe(
      "エリンギとナツメグを使って",
    );
  });

  it("食材指定がsummarizeSearchResultsにも渡される", async () => {
    await RecipeService.findSuggestions(
      "default",
      "エリンギとナツメグを使って",
    );

    expect(capturedArgs.summarizeSearchResults).toHaveLength(1);
    expect(capturedArgs.summarizeSearchResults[0].refinement).toBe(
      "エリンギとナツメグを使って",
    );
  });

  it("食材指定なしの場合はrefinementがundefinedで渡される", async () => {
    await RecipeService.findSuggestions("default");

    expect(capturedArgs.generateSearchQueries[0].refinement).toBeUndefined();
    expect(capturedArgs.summarizeSearchResults[0].refinement).toBeUndefined();
  });

  it("返却されたレシピにingredientsフィールドが存在する", async () => {
    const recipes = await RecipeService.findSuggestions(
      "default",
      "エリンギとナツメグを使って",
    );

    expect(recipes.length).toBeGreaterThan(0);
    recipes.forEach((r) => {
      expect(r.ingredients).toBeDefined();
      expect(typeof r.ingredients).toBe("string");
      expect(r.ingredients.length).toBeGreaterThan(0);
    });
  });

  it("指定した食材がレシピのingredientsに含まれている", async () => {
    const recipes = await RecipeService.findSuggestions(
      "default",
      "エリンギとナツメグを使って",
    );

    // AIが返したレシピのingredientsに指定食材が含まれているか
    const hasEringi = recipes.some((r) => r.ingredients.includes("エリンギ"));
    const hasNatmeg = recipes.some((r) => r.ingredients.includes("ナツメグ"));
    expect(hasEringi).toBe(true);
    expect(hasNatmeg).toBe(true);
  });
});

describe("ビジネス要件: レスポンス性能", () => {
  beforeEach(() => {
    vi.mocked(fs.readFileSync).mockReturnValue("");
  });

  it("APIキー未設定時のフォールバックは200ms以内に返る", async () => {
    vi.stubEnv("SERPER_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "");

    const start = Date.now();
    const recipes = await RecipeService.findSuggestions("default");
    const elapsed = Date.now() - start;

    expect(recipes.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(200);
  });

  it("3件の検索が並列実行される（逐次なら150ms超、並列なら75ms以内）", async () => {
    vi.stubEnv("SERPER_API_KEY", "test-key");

    // 各Serperリクエストに50msの遅延を模擬
    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ organic: [] }),
              } as any),
            50,
          ),
        ),
    ) as any;

    const start = Date.now();
    await RecipeService.findSuggestions("default");
    const elapsed = Date.now() - start;

    // 並列: ~50ms、逐次: ~150ms
    expect(elapsed).toBeLessThan(150);
  });
});
