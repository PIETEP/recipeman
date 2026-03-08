import { NextResponse } from 'next/server';
import { RecipeService } from '@/lib/recipe_service';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const refinementRequest = searchParams.get('q') || undefined;
        const userId = searchParams.get('userId') || 'default';
        const suggestions = await RecipeService.findSuggestions(userId, refinementRequest);
        return NextResponse.json(suggestions);
    } catch (error) {
        console.error('Suggestions API Error:', error);
        return NextResponse.json(
            { error: 'レシピ提案の取得に失敗しました。APIキーの設定を確認してください。' },
            { status: 500 }
        );
    }
}
