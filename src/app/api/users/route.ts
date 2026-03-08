import { NextResponse } from 'next/server';
import { DBService } from '@/lib/db_service';

export async function GET() {
    try {
        const users = await DBService.getUsers();
        return NextResponse.json(users);
    } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await request.json();
        if (!user.id || !user.name) {
            return NextResponse.json({ error: 'ID and Name are required' }, { status: 400 });
        }
        await DBService.saveUser(user);
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to save user' }, { status: 500 });
    }
}
