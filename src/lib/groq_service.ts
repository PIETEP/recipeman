import Groq from 'groq-sdk';

const MODEL = 'llama-3.3-70b-versatile';

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

function getClient(): Groq {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY is not set. Please set it in .env.local');
    return new Groq({ apiKey: key });
}

function parseJsonArray(text: string): any[] {
    let cleaned = text.trim();
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start !== -1 && end !== -1) cleaned = cleaned.substring(start, end + 1);
    return JSON.parse(cleaned);
}

export class GeminiService {
    static buildFeedbackSummary(feedbacks: any[]): string {
        if (!feedbacks || feedbacks.length === 0) return '';
        return feedbacks.slice(-14).map(f => {
            const date = f.date ? f.date.split('T')[0] : '不明';
            return `- ${date}: 満足度=${f.rating}/5, 手間=${f.easeOfCooking}/5, 体調=${f.physicalCondition > 0 ? '+1' : f.physicalCondition < 0 ? '-1' : '0'}, 栄養感=${f.nutritionalValue}/5, 改善メモ="${f.improvementNote || 'なし'}", 余り食材="${f.leftoverFood || 'なし'}"`;
        }).join('\n');
    }

    static async generateSearchQueries(
        profileMd: string,
        preferencesMd: string,
        feedbackSummary: string,
        refinementRequest?: string
    ): Promise<string[]> {
        const client = getClient();

        const prompt = `あなたは料理のプロフェッショナルです。以下のユーザー情報に基づき、今日の夕食に最適なレシピをウェブで検索するための「具体的かつ効果的な日本語の検索キーワード」を3つ生成してください。

## ユーザー情報
${profileMd}
${preferencesMd}
${feedbackSummary}

${refinementRequest ? `## ユーザーからの追加要望\n${refinementRequest}\n\nこの追加要望を最優先し、要望に合致した検索キーワードを考えてください。` : ''}

## 出力形式
JSON配列（文字列のみ）で返してください。コードブロックは不要です。
例: ["鶏むね肉 小松菜 レシピ 時短", "鯖缶 ほうれん草 トマト煮 簡単", "豚肉 ピーマン チンジャオロース 低カロリー"]`;

        const res = await client.chat.completions.create({
            model: MODEL,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
        });

        const text = res.choices[0].message.content || '[]';
        // response_format: json_object wraps in an object, extract the array
        const parsed = JSON.parse(text);
        const queries = Array.isArray(parsed) ? parsed : Object.values(parsed)[0];
        return Array.isArray(queries) ? queries : [];
    }

    static async summarizeSearchResults(
        searchContext: string,
        profileMd: string,
        preferencesMd: string,
        refinementRequest?: string
    ): Promise<GeminiRecipe[]> {
        const client = getClient();

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
以下のJSON形式で返してください。コードブロックは不要です。
{"recipes": [{"title": "レシピ名", "url": "検索結果から選んだ実在するURL", "source": "サイト名", "cookingTime": 15, "tags": ["protein", "veg", "和食"], "ingredients": "材料", "steps": "手順要約", "nutrition": "栄養ポイント", "dishwashingTip": "洗い物の工夫", "leftoverTip": "使い回し案"}]}`;

        const res = await client.chat.completions.create({
            model: MODEL,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
        });

        const text = res.choices[0].message.content || '{"recipes":[]}';
        const parsed = JSON.parse(text);
        const recipes = parsed.recipes || parsed;
        return Array.isArray(recipes) ? recipes : [];
    }
}
