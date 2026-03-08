import { NextResponse } from 'next/server';
import { DBService } from '@/lib/db_service';
import { MemoryService } from '@/lib/memory_service';

export async function POST(request: Request) {
    try {
        const feedback = await request.json();
        const userId = feedback.userId || 'default';

        // Save to local JSON DB
        await DBService.saveFeedback({
            ...feedback,
            userId,
            date: new Date().toISOString()
        });

        // Update learned preferences in Markdown + monthly log
        await MemoryService.updatePreferences(userId, feedback);

        return NextResponse.json({ success: true, message: 'フィードバックを保存し、プロファイルを更新しました。' });
    } catch (error) {
        console.error('Feedback API Error:', error);
        return NextResponse.json({ error: 'フィードバックの保存に失敗しました。' }, { status: 500 });
    }
}
