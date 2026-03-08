import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';

// Mock all external dependencies
vi.mock('fs');
vi.mock('../db_service', () => ({
    DBService: {
        getFeedbacks: vi.fn().mockResolvedValue([]),
        saveRecipe: vi.fn().mockResolvedValue(undefined),
        saveSuggestionLog: vi.fn().mockResolvedValue(undefined),
    },
}));
vi.mock('../memory_service', () => ({
    MemoryService: {
        getProfile: vi.fn().mockResolvedValue({
            name: 'default',
            allergies: [],
            ngIngredients: [],
            healthFocus: ['Protein'],
            maxCookingTime: 20,
            preferredStyles: ['Quick'],
        }),
    },
}));
vi.mock('../gemini_service', () => ({
    GeminiService: {
        buildFeedbackSummary: vi.fn().mockReturnValue(''),
        generateSearchQueries: vi.fn(),
        summarizeSearchResults: vi.fn(),
    },
}));

const { RecipeService } = await import('../recipe_service');
const { GeminiService } = await import('../gemini_service');
const { DBService } = await import('../db_service');

// Helper: mock fetch globally
function mockFetch(responses: any[]) {
    let callCount = 0;
    global.fetch = vi.fn(async () => {
        const resp = responses[callCount] || responses[responses.length - 1];
        callCount++;
        return {
            ok: resp.ok ?? true,
            status: resp.status ?? 200,
            json: async () => resp.data,
        } as Response;
    }) as any;
}

describe('RecipeService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('SERPER_API_KEY', 'test-serper-key');
        // Mock readFileSync for profile.md / preferences.md
        vi.mocked(fs.readFileSync).mockReturnValue('# Profile\n- Allergies: None');
    });

    describe('findSuggestions — 正常フロー', () => {
        it('クエリ生成→Serper検索→AI要約→候補変換→DB保存の一連動作', async () => {
            // Step 1: Gemini generates search queries
            vi.mocked(GeminiService.generateSearchQueries).mockResolvedValue([
                '鶏むね肉 小松菜 レシピ 時短',
                '鯖缶 トマト煮 レシピ',
                '豚肉 ピーマン チンジャオロース',
            ]);

            // Step 2: Serper returns real search results
            mockFetch([
                {
                    ok: true, data: {
                        organic: [
                            { title: '鶏むね肉と小松菜の炒め', link: 'https://www.kurashiru.com/recipes/abc', snippet: '15分' },
                            { title: '小松菜チキン', link: 'https://delishkitchen.tv/recipes/123', snippet: '簡単' },
                        ]
                    }
                },
                {
                    ok: true, data: {
                        organic: [
                            { title: '鯖缶トマト煮', link: 'https://www.kurashiru.com/recipes/def', snippet: '10分' },
                        ]
                    }
                },
                {
                    ok: true, data: {
                        organic: [
                            { title: 'チンジャオロース', link: 'https://www.lettuceclub.net/recipe/dish/10125/', snippet: '時短' },
                        ]
                    }
                },
            ]);

            // Step 3: Gemini summarizes into final recipes
            vi.mocked(GeminiService.summarizeSearchResults).mockResolvedValue([
                {
                    title: '鶏むね肉と小松菜の炒め',
                    url: 'https://www.kurashiru.com/recipes/abc',
                    source: 'クラシル',
                    cookingTime: 15,
                    tags: ['protein', 'veg', '和食'],
                    ingredients: '鶏むね肉, 小松菜',
                    steps: '1. 切る 2. 炒める',
                    nutrition: '高タンパク',
                    dishwashingTip: 'ワンパン',
                    leftoverTip: '味噌汁に',
                },
                {
                    title: '鯖缶トマト煮',
                    url: 'https://www.kurashiru.com/recipes/def',
                    source: 'クラシル',
                    cookingTime: 10,
                    tags: ['protein', 'iron', '洋食'],
                    ingredients: '鯖缶, トマト缶',
                    steps: '1. 煮る',
                    nutrition: 'DHA, 鉄分',
                    dishwashingTip: '鍋ひとつ',
                    leftoverTip: 'パスタに',
                },
                {
                    title: 'チンジャオロース',
                    url: 'https://www.lettuceclub.net/recipe/dish/10125/',
                    source: 'レタスクラブ',
                    cookingTime: 12,
                    tags: ['protein', '中華'],
                    ingredients: '豚肉, ピーマン',
                    steps: '1. 炒める',
                    nutrition: 'ビタミンB1',
                    dishwashingTip: 'フライパンだけ',
                    leftoverTip: 'ピーマンは焼きそばに',
                },
            ]);

            const result = await RecipeService.findSuggestions('default');

            // Verify: 3 recipes returned
            expect(result).toHaveLength(3);

            // Verify: IDs start with 'gemini-'
            result.forEach(r => {
                expect(r.id).toMatch(/^gemini-/);
            });

            // Verify: URLs are from search results (not hallucinated)
            expect(result[0].url).toBe('https://www.kurashiru.com/recipes/abc');
            expect(result[2].url).toBe('https://www.lettuceclub.net/recipe/dish/10125/');

            // Verify: titles preserved
            expect(result[0].title).toBe('鶏むね肉と小松菜の炒め');

            // Verify: DB interactions
            expect(DBService.saveRecipe).toHaveBeenCalledTimes(3);
            expect(DBService.saveSuggestionLog).toHaveBeenCalledTimes(1);

            // Verify: Serper was called 3 times (once per query)
            expect(global.fetch).toHaveBeenCalledTimes(3);
        });
    });

    describe('findSuggestions — エラーハンドリング', () => {
        it('Geminiエラー時にフォールバックレシピが返される', async () => {
            vi.mocked(GeminiService.generateSearchQueries).mockRejectedValue(
                new Error('429 Rate limited')
            );

            const result = await RecipeService.findSuggestions('default');

            // Should return fallback recipes
            expect(result).toHaveLength(3);
            expect(result[0].id).toMatch(/^fallback-/);
            expect(result[0].title).toBeTruthy();
            expect(result[0].url).toContain('http');
        });

        it('Serperエラー時でもAI要約が実行される（空の結果で）', async () => {
            vi.mocked(GeminiService.generateSearchQueries).mockResolvedValue(['test query']);

            // Serper returns error
            mockFetch([{ ok: false, status: 500, data: {} }]);

            // Summarize still called with "No search results"
            vi.mocked(GeminiService.summarizeSearchResults).mockResolvedValue([
                {
                    title: 'フォールバック',
                    url: 'https://example.com',
                    source: 'Test',
                    cookingTime: 15,
                    tags: [],
                    ingredients: '',
                    steps: '',
                    nutrition: '',
                    dishwashingTip: '',
                    leftoverTip: '',
                },
            ]);

            const result = await RecipeService.findSuggestions('default');
            expect(result.length).toBeGreaterThan(0);
        });
    });

    describe('フォールバックレシピの品質', () => {
        it('フォールバックは3件で必須フィールド完備', async () => {
            vi.mocked(GeminiService.generateSearchQueries).mockRejectedValue(new Error('fail'));

            const result = await RecipeService.findSuggestions('default');

            expect(result).toHaveLength(3);
            result.forEach(r => {
                expect(r.id).toBeTruthy();
                expect(r.title).toBeTruthy();
                expect(r.url).toContain('http');
                expect(r.source).toBeTruthy();
                expect(r.cookingTime).toBeGreaterThan(0);
                expect(Array.isArray(r.tags)).toBe(true);
                expect(r.ingredients).toBeTruthy();
                expect(r.steps).toBeTruthy();
                expect(r.generatedAt).toBeTruthy();
            });
        });

        it('フォールバックレシピのサイトが多様化されている', async () => {
            vi.mocked(GeminiService.generateSearchQueries).mockRejectedValue(new Error('fail'));

            const result = await RecipeService.findSuggestions('default');
            const sources = new Set(result.map(r => r.source));
            expect(sources.size).toBeGreaterThanOrEqual(2);
        });
    });

    describe('SERPER_API_KEY未設定時', () => {
        it('APIキーなしでもクラッシュせずにフォールバックが返る', async () => {
            vi.stubEnv('SERPER_API_KEY', '');

            vi.mocked(GeminiService.generateSearchQueries).mockResolvedValue(['test']);
            vi.mocked(GeminiService.summarizeSearchResults).mockResolvedValue([
                {
                    title: 'テスト',
                    url: 'https://example.com',
                    source: 'Test',
                    cookingTime: 10,
                    tags: [],
                    ingredients: '',
                    steps: '',
                    nutrition: '',
                    dishwashingTip: '',
                    leftoverTip: '',
                },
            ]);

            const result = await RecipeService.findSuggestions('default');
            expect(result.length).toBeGreaterThan(0);
        });
    });
});
