import { DBService, RecipeCandidate } from './db_service';
import { MemoryService } from './memory_service';
import { GeminiService } from './groq_service';
import fs from 'fs';
import path from 'path';

const MEMORY_ROOT = path.join(process.cwd(), 'memory/users');

export class RecipeService {
    /**
     * Main entry point: generate 3 recipe suggestions for the user.
     * Uses a multi-stage Search-Verify-Summarize flow to ensure valid links.
     */
    static async findSuggestions(userId: string, refinementRequest?: string): Promise<RecipeCandidate[]> {
        const profile = await MemoryService.getProfile(userId);
        const feedbacks = await DBService.getFeedbacks(userId);

        const profileMd = this.readMemoryFile(userId, 'profile.md');
        const preferencesMd = this.readMemoryFile(userId, 'preferences.md');
        const feedbackSummary = GeminiService.buildFeedbackSummary(feedbacks);

        try {
            console.log('[RecipeService] Starting refined search flow...');
            if (refinementRequest) {
                console.log('[RecipeService] Refinement request:', refinementRequest);
            }

            // 1. Generate search queries
            const queries = await GeminiService.generateSearchQueries(
                profileMd,
                preferencesMd,
                feedbackSummary,
                refinementRequest
            );
            console.log('[RecipeService] Generated queries:', queries);

            // 2. Perform Web Search (Simulated or triggered via external tool)
            // Note: In this environment, the agent (me) performs the searches.
            // I will now pause implementation to actually perform the searches
            // and then I will update the code with the results or 
            // implement a way to pass them.
            // For the sake of the "code" implementation, we'll assume a searchContext is built.

            // This is a special marker for the agent to know it needs to provide search results.
            const searchResultsContext = await this.gatherSearchResults(queries);

            // 3. Summarize into final recipes
            const geminiRecipes = await GeminiService.summarizeSearchResults(
                searchResultsContext,
                profileMd,
                preferencesMd,
                refinementRequest
            );

            // Convert to RecipeCandidate
            const candidates: RecipeCandidate[] = geminiRecipes.map((r, i) => ({
                id: `gemini-${Date.now()}-${i}`,
                title: r.title,
                url: r.url,
                source: r.source,
                cookingTime: r.cookingTime,
                tags: r.tags,
                ingredients: r.ingredients,
                steps: r.steps,
                nutrition: r.nutrition,
                dishwashingTip: r.dishwashingTip,
                leftoverTip: r.leftoverTip,
                baseScore: 0,
                generatedAt: new Date().toISOString(),
            }));

            // Save to audit log
            for (const c of candidates) {
                await DBService.saveRecipe(c);
            }
            await DBService.saveSuggestionLog(userId, candidates);

            return candidates;
        } catch (error) {
            console.error('Refined search flow failed:', error);
            return this.getFallbackCandidates();
        }
    }

    /**
     * Perform real-time web search using Serper.dev (Google Search API).
     * Returns formatted search results for Gemini to summarize.
     */
    private static async gatherSearchResults(queries: string[]): Promise<string> {
        const SERPER_API_KEY = process.env.SERPER_API_KEY;
        if (!SERPER_API_KEY) {
            console.warn('[RecipeService] SERPER_API_KEY not set, skipping web search');
            return 'No search results available.';
        }

        const allResults: any[] = [];

        for (const query of queries) {
            try {
                console.log(`[RecipeService] Searching: "${query}"`);
                const res = await fetch('https://google.serper.dev/search', {
                    method: 'POST',
                    headers: {
                        'X-API-KEY': SERPER_API_KEY,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        q: query + ' レシピ',
                        gl: 'jp',
                        hl: 'ja',
                        num: 5,
                    }),
                });

                if (!res.ok) {
                    console.error(`[RecipeService] Serper error: ${res.status}`);
                    continue;
                }

                const data = await res.json();
                const organic = data.organic || [];

                allResults.push({
                    query,
                    results: organic.slice(0, 5).map((o: any) => ({
                        title: o.title,
                        url: o.link,
                        snippet: o.snippet || '',
                    })),
                });

                console.log(`[RecipeService] Found ${organic.length} results for "${query}"`);
            } catch (e) {
                console.error(`[RecipeService] Search failed for "${query}":`, e);
            }
        }

        if (allResults.length === 0) {
            return 'No search results available.';
        }

        return JSON.stringify(allResults, null, 2);
    }

    private static readMemoryFile(userId: string, filename: string): string {
        try {
            const filePath = path.join(MEMORY_ROOT, userId, filename);
            return fs.readFileSync(filePath, 'utf-8');
        } catch {
            return '';
        }
    }

    private static getFallbackCandidates(): RecipeCandidate[] {
        return [
            {
                id: 'fallback-1',
                title: '鶏肉と小松菜のワンパン炒め',
                url: 'https://www.kurashiru.com/recipes/ec05e5a0-5237-4677-9203-b986015f1551',
                source: 'クラシル',
                cookingTime: 15,
                tags: ['protein', 'veg', 'iron', '和食', 'quick'],
                ingredients: '鶏もも肉, 小松菜, しめじ, 醤油, 酒, みりん',
                steps: '1. 材料を切る\n2. フライパンで鶏肉を炒める\n3. 野菜を加えて調味料で味付けする',
                nutrition: '高タンパク, 鉄分(小松菜)',
                dishwashingTip: 'ワンパンで完結',
                leftoverTip: '残った小松菜は翌日の味噌汁に',
                baseScore: 50,
                generatedAt: new Date().toISOString(),
            },
            {
                id: 'fallback-2',
                title: '鯖缶とほうれん草のトマト煮',
                url: 'https://delishkitchen.tv/recipes/208293099498415481',
                source: 'デリッシュキッチン',
                cookingTime: 10,
                tags: ['protein', 'veg', 'iron', 'vitaminC', '洋食', 'quick'],
                ingredients: '鯖水煮缶, ほうれん草, カットトマト缶, ニンニク',
                steps: '1. 鍋にニンニクを炒める\n2. トマト缶と鯖缶を加える\n3. ほうれん草を入れて5分煮る',
                nutrition: 'DHA, EPA, 鉄分, ビタミンC',
                dishwashingTip: '鍋ひとつで完結',
                leftoverTip: '残ったトマト缶はパスタソースに',
                baseScore: 60,
                generatedAt: new Date().toISOString(),
            },
            {
                id: 'fallback-3',
                title: '豚肉とピーマンの時短チンジャオロース',
                url: 'https://www.lettuceclub.net/recipe/dish/10125/',
                source: 'レタスクラブ',
                cookingTime: 12,
                tags: ['protein', 'veg', '中華', 'quick'],
                ingredients: '豚こま肉, ピーマン, たけのこ, オイスターソース',
                steps: '1. 肉に下味をつける\n2. 野菜と肉を強火で一気に炒める\n3. オイスターソースで仕上げ',
                nutrition: 'ビタミンB1, ビタミンC',
                dishwashingTip: 'フライパンと菜箸だけ',
                leftoverTip: '残ったピーマンは翌日の焼きそばに',
                baseScore: 40,
                generatedAt: new Date().toISOString(),
            }
        ];
    }
}
