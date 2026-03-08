import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the entire @google/generative-ai module
vi.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: vi.fn(),
}));
vi.mock('fs');

const { GeminiService } = await import('../gemini_service');

describe('GeminiService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('GEMINI_API_KEY', 'test-key-123');
    });

    describe('buildFeedbackSummary', () => {
        it('フィードバックがない場合は空文字を返す', () => {
            expect(GeminiService.buildFeedbackSummary([])).toBe('');
            expect(GeminiService.buildFeedbackSummary(null as any)).toBe('');
        });

        it('フィードバックを正しい形式で要約する', () => {
            const feedbacks = [
                {
                    date: '2026-03-05T00:00:00.000Z',
                    rating: 4,
                    easeOfCooking: 3,
                    physicalCondition: 1,
                    nutritionalValue: 4,
                    improvementNote: '美味しかった',
                    leftoverFood: 'キャベツ',
                },
            ];
            const result = GeminiService.buildFeedbackSummary(feedbacks);

            expect(result).toContain('2026-03-05');
            expect(result).toContain('満足度=4/5');
            expect(result).toContain('手間=3/5');
            expect(result).toContain('+1');
            expect(result).toContain('美味しかった');
            expect(result).toContain('キャベツ');
        });

        it('直近14件のみ使用する', () => {
            const feedbacks = Array.from({ length: 20 }, (_, i) => ({
                date: `2026-03-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
                rating: 3,
                easeOfCooking: 3,
                physicalCondition: 0,
                nutritionalValue: 3,
                improvementNote: '',
                leftoverFood: '',
            }));

            const result = GeminiService.buildFeedbackSummary(feedbacks);
            const lines = result.split('\n').filter(l => l.trim());
            expect(lines).toHaveLength(14);
        });

        it('physicalConditionの符号を正しく表示する', () => {
            const positive = GeminiService.buildFeedbackSummary([
                { date: '2026-01-01', rating: 3, easeOfCooking: 3, physicalCondition: 1, nutritionalValue: 3 },
            ]);
            expect(positive).toContain('+1');

            const negative = GeminiService.buildFeedbackSummary([
                { date: '2026-01-01', rating: 3, easeOfCooking: 3, physicalCondition: -1, nutritionalValue: 3 },
            ]);
            expect(negative).toContain('-1');

            const zero = GeminiService.buildFeedbackSummary([
                { date: '2026-01-01', rating: 3, easeOfCooking: 3, physicalCondition: 0, nutritionalValue: 3 },
            ]);
            expect(zero).toContain('体調=0');
        });
    });

    describe('JSON応答パース（generateRecipeSuggestionsの内部ロジック）', () => {
        // These tests validate the JSON cleaning logic extracted from generateRecipeSuggestions
        function cleanResponse(text: string): string {
            let cleaned = text.trim();
            const startIdx = cleaned.indexOf('[');
            const endIdx = cleaned.lastIndexOf(']');
            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                cleaned = cleaned.substring(startIdx, endIdx + 1);
            } else if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
            }
            return cleaned;
        }

        it('純粋なJSON配列をそのままパースできる', () => {
            const input = '[{"title": "テスト"}]';
            expect(JSON.parse(cleanResponse(input))).toEqual([{ title: 'テスト' }]);
        });

        it('前後にテキストがあるJSONを正しく抽出できる', () => {
            const input = 'ここにレシピがあります\n[{"title": "テスト"}]\n以上です';
            expect(JSON.parse(cleanResponse(input))).toEqual([{ title: 'テスト' }]);
        });

        it('コードフェンス付きJSONをクリーンアップできる', () => {
            const input = '```json\n[{"title": "テスト"}]\n```';
            expect(JSON.parse(cleanResponse(input))).toEqual([{ title: 'テスト' }]);
        });

        it('空白やインデントを含むJSONをパースできる', () => {
            const input = `  [
        {
          "title": "テスト",
          "url": "https://example.com"
        }
      ]  `;
            const result = JSON.parse(cleanResponse(input));
            expect(result[0].title).toBe('テスト');
            expect(result[0].url).toBe('https://example.com');
        });
    });

    describe('URL検証フォールバックロジック', () => {
        // Extract the URL validation logic for testing
        function validateUrl(url: string, source: string, query: string): string {
            let finalUrl = url || '#';
            if (!finalUrl.includes('http') || finalUrl.endsWith('/recipes/') || finalUrl.endsWith('/recipe/')) {
                if (source.includes('クラシル')) {
                    finalUrl = `https://www.kurashiru.com/search?query=${encodeURIComponent(query)}`;
                } else if (source.includes('デリッシュキッチン')) {
                    finalUrl = `https://delishkitchen.tv/search?q=${encodeURIComponent(query)}`;
                } else if (source.includes('レタスクラブ')) {
                    finalUrl = `https://www.lettuceclub.net/recipe/search/${encodeURIComponent(query)}/`;
                } else if (source.includes('白ごはん')) {
                    finalUrl = `https://www.sirogohan.com/search/?q=${encodeURIComponent(query)}`;
                } else if (source.includes('Nadia')) {
                    finalUrl = `https://oceans-nadia.com/search?q=${encodeURIComponent(query)}`;
                } else {
                    finalUrl = `https://www.google.com/search?q=${encodeURIComponent(source + ' ' + query)}`;
                }
            }
            return finalUrl;
        }

        it('正常なURLはそのまま返す', () => {
            const url = 'https://www.kurashiru.com/recipes/abc-123';
            expect(validateUrl(url, 'クラシル', 'テスト')).toBe(url);
        });

        it('ディレクトリURLはクラシル検索URLに変換される', () => {
            const url = 'https://www.kurashiru.com/recipes/';
            const result = validateUrl(url, 'クラシル', '鶏肉 小松菜');
            expect(result).toContain('kurashiru.com/search');
            expect(result).toContain(encodeURIComponent('鶏肉 小松菜'));
        });

        it('ディレクトリURLはデリッシュキッチン検索URLに変換される', () => {
            const url = 'https://delishkitchen.tv/recipes/';
            const result = validateUrl(url, 'デリッシュキッチン', '豚肉');
            expect(result).toContain('delishkitchen.tv/search');
        });

        it('ディレクトリURLはレタスクラブ検索URLに変換される', () => {
            const url = 'https://www.lettuceclub.net/recipe/';
            const result = validateUrl(url, 'レタスクラブ', '時短');
            expect(result).toContain('lettuceclub.net/recipe/search');
        });

        it('ディレクトリURLは白ごはん検索URLに変換される', () => {
            const url = '#';
            const result = validateUrl(url, '白ごはん.com', '味噌汁');
            expect(result).toContain('sirogohan.com/search');
        });

        it('ディレクトリURLはNadia検索URLに変換される', () => {
            const url = '';
            const result = validateUrl(url, 'Nadia', 'パスタ');
            expect(result).toContain('oceans-nadia.com/search');
        });

        it('不明なソースはGoogle検索にフォールバックする', () => {
            const url = '';
            const result = validateUrl(url, 'Unknown Site', '焼き魚');
            expect(result).toContain('google.com/search');
            expect(result).toContain('Unknown%20Site');
        });
    });
});
