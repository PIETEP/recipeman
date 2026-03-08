import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock fs module
vi.mock('fs');

const MOCK_DB_PATH = path.join(process.cwd(), 'local_db.json');

// We need to import after mocking
const { DBService } = await import('../db_service');

function makeRecipe(overrides: Partial<any> = {}) {
    return {
        id: 'test-1',
        title: 'テスト鶏肉レシピ',
        url: 'https://www.kurashiru.com/recipes/test-1',
        source: 'クラシル',
        cookingTime: 15,
        tags: ['protein', 'veg', '和食'],
        ingredients: '鶏もも肉, 小松菜',
        steps: '1. 切る 2. 炒める',
        nutrition: '高タンパク',
        dishwashingTip: 'ワンパン',
        leftoverTip: '味噌汁に',
        baseScore: 0,
        generatedAt: '2026-03-05T00:00:00.000Z',
        ...overrides,
    };
}

function makeFeedback(overrides: Partial<any> = {}) {
    return {
        userId: 'default',
        recipeId: 'test-1',
        recipeTitle: 'テスト鶏肉レシピ',
        rating: 4,
        easeOfCooking: 3,
        physicalCondition: 0,
        nutritionalValue: 4,
        improvementNote: '',
        leftoverFood: '',
        date: '2026-03-05T00:00:00.000Z',
        ...overrides,
    };
}

function mockDB(data: any = { recipes: [], suggestions: [], feedbacks: [] }) {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(data));
    vi.mocked(fs.writeFileSync).mockImplementation(() => { });
}

describe('DBService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('saveRecipe', () => {
        it('レシピを保存できる', async () => {
            mockDB();
            const recipe = makeRecipe();
            await DBService.saveRecipe(recipe);

            expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
            const written = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
            expect(written.recipes).toHaveLength(1);
            expect(written.recipes[0].title).toBe('テスト鶏肉レシピ');
        });

        it('同一URLのレシピは二重保存されない', async () => {
            const existing = makeRecipe();
            mockDB({ recipes: [existing], suggestions: [], feedbacks: [] });

            await DBService.saveRecipe(makeRecipe({ id: 'test-2' }));

            // writeFileSync should NOT be called because URL already exists
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        it('異なるURLのレシピは追加保存される', async () => {
            const existing = makeRecipe();
            mockDB({ recipes: [existing], suggestions: [], feedbacks: [] });

            await DBService.saveRecipe(makeRecipe({ id: 'test-2', url: 'https://example.com/different' }));

            expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
            const written = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
            expect(written.recipes).toHaveLength(2);
        });
    });

    describe('saveFeedback / getFeedbacks', () => {
        it('フィードバックを保存できる', async () => {
            mockDB();
            await DBService.saveFeedback(makeFeedback());

            expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
            const written = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
            expect(written.feedbacks).toHaveLength(1);
            expect(written.feedbacks[0].rating).toBe(4);
        });

        it('ユーザーIDでフィルタリングされる', async () => {
            mockDB({
                recipes: [],
                suggestions: [],
                feedbacks: [
                    makeFeedback({ userId: 'default' }),
                    makeFeedback({ userId: 'other-user' }),
                    makeFeedback({ userId: 'default', rating: 5 }),
                ],
            });

            const results = await DBService.getFeedbacks('default');
            expect(results).toHaveLength(2);
            expect(results.every(f => f.userId === 'default')).toBe(true);
        });
    });

    describe('saveSuggestionLog', () => {
        it('提案ログにタイムスタンプ付きで保存される', async () => {
            mockDB();
            const recipes = [makeRecipe()];
            await DBService.saveSuggestionLog('default', recipes);

            const written = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
            expect(written.suggestions).toHaveLength(1);
            expect(written.suggestions[0].userId).toBe('default');
            expect(written.suggestions[0].date).toBeTruthy();
            expect(written.suggestions[0].recipes).toHaveLength(1);
        });
    });

    describe('init (DB初期化)', () => {
        it('DBファイル未存在時に空DBを作成する', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);
            vi.mocked(fs.writeFileSync).mockImplementation(() => { });
            vi.mocked(fs.readFileSync).mockReturnValue('{}');

            await DBService.getRecipes();

            expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
            const written = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
            expect(written).toEqual({ recipes: [], suggestions: [], feedbacks: [] });
        });
    });
});
