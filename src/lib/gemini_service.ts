import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

const API_KEY = process.env.GEMINI_API_KEY || '';

export interface GeminiRecipe {
    title: string;
    url: string;
    source: string;
    cookingTime: number;
    tags: string[];
    ingredients: string;
    steps: string;
    nutrition: string;
    dishwashingTip: string;
    leftoverTip: string;
    searchQuery?: string;
}

export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
}

export class GeminiService {
    private static getClient() {
        if (!API_KEY) {
            throw new Error('GEMINI_API_KEY is not set. Please set it in .env.local');
        }
        return new GoogleGenerativeAI(API_KEY);
    }

    /**
     * Use Gemini to generate 3 recipe suggestions based on user profile,
     * preferences, and recent feedback history.
     */
    static async generateRecipeSuggestions(
        profileMd: string,
        preferencesMd: string,
        recentFeedbackSummary: string
    ): Promise<GeminiRecipe[]> {
        const genAI = this.getClient();

        const today = new Date();
        const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][today.getDay()];

        const prompt = `あなたは日本の家庭料理に詳しい管理栄養士兼料理アドバイザーです。
以下のユーザー情報に基づいて、今日の夕食にふさわしいレシピを3つ提案してください。

## ユーザー プロファイル
${profileMd}

## 学習された嗜好
${preferencesMd}

## 直近のフィードバック履歴
${recentFeedbackSummary || 'まだフィードバックはありません。'}

## 今日の情報
- 曜日: ${dayOfWeek}曜日
- 日付: ${today.toISOString().split('T')[0]}

## 必須条件
1. 各レシピは実在するレシピサイト（クラシル、デリッシュキッチン、NHKきょうの料理、レタスクラブ、白ごはん.com、Nadia、味の素パーク、キッコーマン、Eレシピ など）に掲載されているレシピを参照してください
2. URLは実在するページを指定（「https://www.kurashiru.com/recipes/」「https://delishkitchen.tv/recipes/」「https://www.sirogohan.com/recipe/」などで始まる実際のURL）
3. 調理時間は20分以内を優先
4. 加熱する野菜を2種類以上含む
5. たんぱく質源を必ず1つ含む
6. ソースは複数のサイトに分散させる
7. 味の系統（和 / 洋 / 中 / エスニック）をバラけさせる
8. 週に数回は鉄分（赤身肉/青菜/貝/豆）＋ビタミンCを意識した候補を混ぜる

## 出力形式
以下のJSON配列を返してください。余計なテキストやマークダウンコードブロックは付けないでください。

[
  {
    "title": "レシピ名",
    "url": "実在するレシピページのURL",
    "searchQuery": "サイト内検索用のキーワード（例：豚肉 ピーマン オイスターソース）",
    "source": "サイト名",
    "cookingTime": 15,
    "tags": ["protein", "veg", "iron", "和食", "quick"],
    "ingredients": "主な材料をカンマ区切りで",
    "steps": "手順を3～5行で要約（箇条書き）",
    "nutrition": "栄養の狙い（例：高タンパク、鉄分、ビタミンC）",
    "dishwashingTip": "洗い物削減の工夫（例：ワンパンで完結）",
    "leftoverTip": "余り食材の使い回し案（例：残った小松菜は翌日の味噌汁に）"
  }
]

tagsには以下を適切に含めてください:
- "protein" ... たんぱく質あり
- "veg" ... 加熱野菜2種以上
- "iron" ... 鉄分を意識
- "vitaminC" ... ビタミンCを意識
- "quick" ... 時短
- 味の系統: "和食", "洋食", "中華", "エスニック" のいずれか

3つのレシピをJSON配列で返してください。`;

        const MODEL_NAME = 'gemini-2.0-flash';
        const MAX_RETRIES = 2;
        const RETRY_DELAYS = [0, 15000, 30000]; // 0s, 15s, 30s

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                if (attempt > 0) {
                    const delayMs = RETRY_DELAYS[attempt] || 30000;
                    console.log(`[GeminiService] Retry attempt ${attempt}/${MAX_RETRIES}, waiting ${delayMs / 1000}s...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }

                console.log(`[GeminiService] Calling ${MODEL_NAME} (attempt ${attempt + 1})...`);
                const model = genAI.getGenerativeModel({
                    model: MODEL_NAME,
                    generationConfig: {
                        responseMimeType: 'application/json',
                    },
                });

                const result = await model.generateContent(prompt);
                const text = result.response.text();
                console.log(`[GeminiService] Success! Got response (${text.length} chars)`);

                // Clean response - pull out only the JSON array
                let cleaned = text.trim();
                const startIdx = cleaned.indexOf('[');
                const endIdx = cleaned.lastIndexOf(']');
                if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                    cleaned = cleaned.substring(startIdx, endIdx + 1);
                } else if (cleaned.startsWith('```')) {
                    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
                }

                const recipes: GeminiRecipe[] = JSON.parse(cleaned);

                // Validate and sanitize
                return recipes.slice(0, 3).map((r, i) => {
                    const title = r.title || `レシピ ${i + 1}`;
                    const source = r.source || '不明';
                    const query = r.searchQuery || title;

                    // Generate a reliable search-based fallback URL if the specific URL looks suspicious
                    // or if grounding failed.
                    let finalUrl = r.url || '#';

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

                    return {
                        title,
                        url: finalUrl,
                        source,
                        cookingTime: r.cookingTime || 20,
                        tags: Array.isArray(r.tags) ? r.tags : [],
                        ingredients: r.ingredients || '',
                        steps: r.steps || '',
                        nutrition: r.nutrition || '',
                        dishwashingTip: r.dishwashingTip || '',
                        leftoverTip: r.leftoverTip || '',
                    };
                });
            } catch (error: any) {
                const msg = error?.message || '';
                const status = error?.status;
                const isRateLimit = msg.includes('429') || msg.includes('quota') || msg.includes('Resource has been exhausted') || status === 429;

                console.error(`[GeminiService] Attempt ${attempt + 1} failed:`, {
                    status,
                    message: msg.slice(0, 500),
                    isRateLimit
                });

                if (!isRateLimit || attempt >= MAX_RETRIES) {
                    throw error;
                }
                // Rate limit - will retry with increased delay
            }
        }

        throw new Error('Gemini API rate limit exceeded. Please wait a minute and try again.');
    }

    /**
     * Build a summary of recent feedbacks to include in the prompt.
     */
    static buildFeedbackSummary(feedbacks: any[]): string {
        if (!feedbacks || feedbacks.length === 0) return '';

        // Take the last 14 feedbacks
        const recent = feedbacks.slice(-14);
        const lines = recent.map((f, i) => {
            const date = f.date ? f.date.split('T')[0] : '不明';
            return `- ${date}: 満足度=${f.rating}/5, 手間=${f.easeOfCooking}/5, 体調=${f.physicalCondition > 0 ? '+1' : f.physicalCondition < 0 ? '-1' : '0'}, 栄養感=${f.nutritionalValue}/5, 改善メモ="${f.improvementNote || 'なし'}", 余り食材="${f.leftoverFood || 'なし'}"`;
        });
        return lines.join('\n');
    }

    static async generateSearchQueries(
        profileMd: string,
        preferencesMd: string,
        feedbackSummary: string,
        refinementRequest?: string
    ): Promise<string[]> {
        const genAI = this.getClient();
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `あなたは料理のプロフェッショナルです。以下のユーザー情報に基づき、
今日の夕食に最適なレシピをウェブで検索するための「具体的かつ効果的な日本語の検索キーワード」を3つ生成してください。

## ユーザー情報
${profileMd}
${preferencesMd}
${feedbackSummary}

${refinementRequest ? `## ユーザーからの追加要望\n${refinementRequest}\n\nこの追加要望を最優先し、要望に合致した検索キーワードを考えてください。` : ''}

## 出力形式
JSON配列（文字列のみ）で返してください。
例: ["鶏むね肉 小松菜 レシピ 時短", "鯖缶 ほうれん草 トマト煮 簡単", "豚肉 ピーマン チンジャオロース 低カロリー"]`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        let cleaned = text.trim();
        const startIdx = cleaned.indexOf('[');
        const endIdx = cleaned.lastIndexOf(']');
        if (startIdx !== -1 && endIdx !== -1) {
            cleaned = cleaned.substring(startIdx, endIdx + 1);
        }

        return JSON.parse(cleaned);
    }

    static async summarizeSearchResults(
        searchContext: string,
        profileMd: string,
        preferencesMd: string,
        refinementRequest?: string
    ): Promise<GeminiRecipe[]> {
        const genAI = this.getClient();
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            generationConfig: { responseMimeType: 'application/json' }
        });

        const prompt = `以下の検索結果のリストとユーザー情報に基づき、最適なレシピを3つ厳選して提案してください。
必ず、検索結果に含まれる「実在するURL」を使用してください。URLを捏造しないでください。

## 検索結果
${searchContext}

## ユーザー プロファイル
${profileMd}

## 学習された嗜好
${preferencesMd}

${refinementRequest ? `## ユーザーからの追加要望\n${refinementRequest}\n\nこの構成にする際、追加要望を最優先してレシピを選択・要約してください。` : ''}

## 出力形式
JSON配列で返してください。
[
  {
    "title": "レシピ名",
    "url": "検索結果から選んだ実在するURL",
    "source": "サイト名",
    "cookingTime": 15,
    "tags": ["protein", "veg", "和食"],
    "ingredients": "材料",
    "steps": "手順要約",
    "nutrition": "栄養ポイント",
    "dishwashingTip": "洗い物の工夫",
    "leftoverTip": "使い回し案"
  }
]`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        let cleaned = text.trim();
        const startIdx = cleaned.indexOf('[');
        const endIdx = cleaned.lastIndexOf(']');
        if (startIdx !== -1 && endIdx !== -1) {
            cleaned = cleaned.substring(startIdx, endIdx + 1);
        }

        return JSON.parse(cleaned);
    }
}
