import { NextResponse } from 'next/server';
import { KnowledgeService } from '@/lib/knowledge_service';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId') || 'default';
        const knowledge = await KnowledgeService.getKnowledge(userId);
        return NextResponse.json(knowledge);
    } catch (error) {
        console.error('Knowledge API Error:', error);
        return NextResponse.json({ error: 'ナレッジの取得に失敗しました。' }, { status: 500 });
    }
}
