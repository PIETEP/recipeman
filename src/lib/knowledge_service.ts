import { DBService } from './db_service';
import { MemoryService } from './memory_service';

export interface KnowledgeData {
    profile: string;
    preferences: string;
    recentTrends: string[];
    discoveryLog: { date: string; title: string; url: string; rating: number; note: string }[];
}

export class KnowledgeService {
    static async getKnowledge(userId: string): Promise<KnowledgeData> {
        let profile = 'プロファイルが設定されていません。';
        let preferences = '学習された嗜好はまだありません。';
        let recentTrends: string[] = [];
        let discoveryLog: { date: string; title: string; url: string; rating: number; note: string }[] = [];

        try {
            // 1. Get Profile (Currently returns defaults/userId)
            const userProfile = await MemoryService.getProfile(userId);
            profile = `Name: ${userProfile.name}\nHealth Focus: ${userProfile.healthFocus.join(', ')}\nMax Cooking Time: ${userProfile.maxCookingTime} mins`;

            // 2. Get Preferences (Recent feedback summaries)
            preferences = await MemoryService.getPreferences(userId);

            // 3. Get Discovery Log (Raw recent feedbacks)
            const feedbacks = await DBService.getFeedbacks(userId);
            const sortedFeedbacks = feedbacks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            discoveryLog = sortedFeedbacks.slice(0, 5).map(f => ({
                date: f.date.split('T')[0],
                title: f.recipeTitle,
                url: f.recipeUrl || '#',
                rating: f.rating,
                note: f.improvementNote || ''
            }));

            // 4. Extract recentTrends (Simulated insights from recent feedback)
            recentTrends = sortedFeedbacks
                .filter(f => f.improvementNote)
                .slice(0, 5)
                .map(f => f.improvementNote);

        } catch (e) {
            console.error('Failed to load knowledge:', e);
        }

        return {
            profile,
            preferences,
            recentTrends,
            discoveryLog
        };
    }
}
