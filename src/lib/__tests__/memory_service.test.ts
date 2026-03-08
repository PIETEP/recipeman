import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';

vi.mock('fs');

const { MemoryService } = await import('../memory_service');

const SAMPLE_PROFILE_MD = `# User Profile: default

- Name: テストユーザー
- Allergies: エビ, カニ
- NG Ingredients: パクチー
- Health Focus: Protein, Iron, Vitamin C
- Max Cooking Time: 15
- Preferred Style: 和食, 時短
`;

describe('MemoryService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getProfile', () => {
        it('Markdownからプロファイルを正しくパースする', async () => {
            vi.mocked(fs.readFileSync).mockReturnValue(SAMPLE_PROFILE_MD);
            const profile = await MemoryService.getProfile('default');

            expect(profile.allergies).toEqual(['エビ', 'カニ']);
            expect(profile.ngIngredients).toEqual(['パクチー']);
            expect(profile.healthFocus).toEqual(['Protein', 'Iron', 'Vitamin C']);
            expect(profile.maxCookingTime).toBe(15);
            expect(profile.preferredStyles).toEqual(['和食', '時短']);
        });

        it('ファイル未存在時にデフォルト値を返す', async () => {
            vi.mocked(fs.readFileSync).mockImplementation(() => { throw new Error('ENOENT'); });
            const profile = await MemoryService.getProfile('nonexistent');

            expect(profile.name).toBe('nonexistent');
            expect(profile.allergies).toEqual([]);
            expect(profile.healthFocus).toEqual(['Protein', 'Iron', 'Vitamin C']);
            expect(profile.maxCookingTime).toBe(20);
        });

        it('空のリスト値を正しく処理する', async () => {
            const mdWithEmpty = `# Profile\n- Allergies: None\n- NG Ingredients: []\n- Health Focus: \n- Max Cooking Time: 20\n- Preferred Style: Easy`;
            vi.mocked(fs.readFileSync).mockReturnValue(mdWithEmpty);
            const profile = await MemoryService.getProfile('default');

            expect(profile.allergies).toEqual([]);
            expect(profile.ngIngredients).toEqual([]);
            expect(profile.healthFocus).toEqual([]);
        });
    });

    describe('updatePreferences', () => {
        it('手間が高いフィードバックで時短メモが追加される', async () => {
            vi.mocked(fs.readFileSync).mockReturnValue('# Preferences\n\n## Recent Insights\n');
            vi.mocked(fs.writeFileSync).mockImplementation(() => { });
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.appendFileSync).mockImplementation(() => { });

            await MemoryService.updatePreferences('default', {
                easeOfCooking: 1,
                physicalCondition: 0,
                recipeTitle: 'テストレシピ',
                rating: 3,
                nutritionalValue: 3,
            });

            const written = vi.mocked(fs.writeFileSync).mock.calls[0]?.[1] as string;
            expect(written).toContain('時短・簡単');
        });

        it('体調マイナスのフィードバックでメモが追加される', async () => {
            vi.mocked(fs.readFileSync).mockReturnValue('# Preferences\n\n## Recent Insights\n');
            vi.mocked(fs.writeFileSync).mockImplementation(() => { });
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.appendFileSync).mockImplementation(() => { });

            await MemoryService.updatePreferences('default', {
                easeOfCooking: 3,
                physicalCondition: -1,
                recipeTitle: 'テストレシピ',
                rating: 3,
                nutritionalValue: 3,
            });

            const written = vi.mocked(fs.writeFileSync).mock.calls[0]?.[1] as string;
            expect(written).toContain('脂っこい');
        });

        it('改善メモがそのまま保存される', async () => {
            vi.mocked(fs.readFileSync).mockReturnValue('# Preferences\n\n## Recent Insights\n');
            vi.mocked(fs.writeFileSync).mockImplementation(() => { });
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.appendFileSync).mockImplementation(() => { });

            await MemoryService.updatePreferences('default', {
                easeOfCooking: 3,
                physicalCondition: 0,
                improvementNote: '味が薄かった',
                recipeTitle: 'テスト',
                rating: 2,
                nutritionalValue: 3,
            });

            const written = vi.mocked(fs.writeFileSync).mock.calls[0]?.[1] as string;
            expect(written).toContain('味が薄かった');
        });

        it('余り食材が保存される', async () => {
            vi.mocked(fs.readFileSync).mockReturnValue('# Preferences\n\n## Recent Insights\n');
            vi.mocked(fs.writeFileSync).mockImplementation(() => { });
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.appendFileSync).mockImplementation(() => { });

            await MemoryService.updatePreferences('default', {
                easeOfCooking: 3,
                physicalCondition: 0,
                leftoverFood: 'ピーマン2個',
                recipeTitle: 'テスト',
                rating: 3,
                nutritionalValue: 3,
            });

            const written = vi.mocked(fs.writeFileSync).mock.calls[0]?.[1] as string;
            expect(written).toContain('ピーマン2個');
        });
    });
});
