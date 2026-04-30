/**
 * 統合テスト: 実際のGroq API + Serper APIを使用
 * 実行: npm run test:integration
 *
 * CI には含めない（実APIキーが必要なため）
 */
import { describe, it, expect, beforeAll } from "vitest";

let RecipeService: any;

beforeAll(async () => {
  ({ RecipeService } = await import("../recipe_service"));
});

describe("統合テスト: 食材指定（実API）", () => {
  it("エリンギを指定したらエリンギを含むレシピが1件以上返る", async () => {
    const recipes = await RecipeService.findSuggestions(
      "default",
      "エリンギを使ったレシピにして",
    );

    expect(recipes.length).toBeGreaterThan(0);

    const containsEringi = recipes.some(
      (r: any) =>
        r.ingredients.includes("エリンギ") ||
        r.title.includes("エリンギ") ||
        r.steps.includes("エリンギ"),
    );

    if (!containsEringi) {
      console.warn(
        "⚠️ エリンギが含まれていません。返ってきたレシピ:",
        recipes.map((r: any) => ({
          title: r.title,
          ingredients: r.ingredients,
        })),
      );
    }

    expect(containsEringi).toBe(true);
  });

  it("鶏肉を指定したら鶏肉を含むレシピが1件以上返る", async () => {
    const recipes = await RecipeService.findSuggestions(
      "default",
      "鶏肉を使ったレシピにして",
    );

    expect(recipes.length).toBeGreaterThan(0);

    const keywords = ["鶏", "チキン", "とり"];
    const containsChicken = recipes.some((r: any) =>
      keywords.some(
        (kw) =>
          r.ingredients.includes(kw) ||
          r.title.includes(kw) ||
          r.steps.includes(kw),
      ),
    );

    if (!containsChicken) {
      console.warn(
        "⚠️ 鶏肉が含まれていません。返ってきたレシピ:",
        recipes.map((r: any) => ({
          title: r.title,
          ingredients: r.ingredients,
        })),
      );
    }

    expect(containsChicken).toBe(true);
  });

  it("食材指定なしで3件のレシピが返る", async () => {
    const recipes = await RecipeService.findSuggestions("default");
    expect(recipes.length).toBe(3);
  });

  it("全レシピに必須フィールドが揃っている", async () => {
    const recipes = await RecipeService.findSuggestions("default");

    recipes.forEach((r: any) => {
      expect(r.title, "titleが空").toBeTruthy();
      expect(r.url, "urlが空").toBeTruthy();
      expect(r.url, "urlが不正").toMatch(/^https?:\/\//);
      expect(r.ingredients, "ingredientsが空").toBeTruthy();
      expect(r.cookingTime, "cookingTimeが不正").toBeGreaterThan(0);
      expect(Array.isArray(r.tags), "tagsが配列でない").toBe(true);
    });
  });

  it("全レシピのURLがアクセス可能（404でない）", async () => {
    const recipes = await RecipeService.findSuggestions("default");

    const results = await Promise.allSettled(
      recipes.map(async (r: any) => {
        const res = await fetch(r.url, {
          method: "HEAD",
          signal: AbortSignal.timeout(5000),
        });
        return { title: r.title, url: r.url, status: res.status };
      }),
    );

    const failures = results
      .filter(
        (r) =>
          r.status === "fulfilled" &&
          (r.value.status === 404 || r.value.status === 410),
      )
      .map((r) => (r as any).value);

    if (failures.length > 0) {
      console.warn("⚠️ 404/410のURL:", failures);
    }

    // 3件中2件以上は存在するURLであること
    expect(failures.length).toBeLessThanOrEqual(1);
  });

  it("レスポンスが15秒以内に返る", async () => {
    const start = Date.now();
    await RecipeService.findSuggestions("default");
    const elapsed = Date.now() - start;

    console.log(`⏱ 実API応答時間: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(15000);
  });
});
