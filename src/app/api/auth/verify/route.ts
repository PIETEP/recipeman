import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { code } = await request.json();
        const familyCode = process.env.FAMILY_CODE || 'recipe2024'; // Fallback for dev

        if (code === familyCode) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ success: false, error: '合言葉が違います。' }, { status: 401 });
        }
    } catch (error) {
        return NextResponse.json({ error: '認証エラーが発生しました。' }, { status: 500 });
    }
}
