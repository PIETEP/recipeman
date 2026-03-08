import fs from 'fs';
import path from 'path';

const MEMORY_ROOT = path.join(process.cwd(), 'memory/users');

export interface KnowledgeData {
    profile: string;
    preferences: string;
    recentTrends: string[];
    discoveryLog: { date: string; title: string; url: string; rating: number; note: string }[];
}

export class KnowledgeService {
    static async getKnowledge(userId: string): Promise<KnowledgeData> {
        const profilePath = path.join(MEMORY_ROOT, userId, 'profile.md');
        const preferencesPath = path.join(MEMORY_ROOT, userId, 'preferences.md');

        let profile = 'プロファイルが設定されていません。';
        let preferences = '学習された嗜好はまだありません。';
        let recentTrends: string[] = [];
        let discoveryLog: { date: string; title: string; url: string; rating: number; note: string }[] = [];

        try {
            const logDir = path.join(MEMORY_ROOT, userId, 'log');
            if (fs.existsSync(logDir)) {
                const logFiles = fs.readdirSync(logDir).sort().reverse();
                if (logFiles.length > 0) {
                    const latestLog = fs.readFileSync(path.join(logDir, logFiles[0]), 'utf-8');
                    const entries = latestLog.split('### ').slice(1);
                    discoveryLog = entries.map(entry => {
                        const lines = entry.split('\n');
                        const date = lines[0].trim();
                        const recipeMatch = entry.match(/- レシピ: \[(.*?)\]\((.*?)\)/);
                        const ratingMatch = entry.match(/- 満足度: (\d)\/5/);
                        const noteMatch = entry.match(/- 改善メモ: (.*)/);

                        return {
                            date,
                            title: recipeMatch ? recipeMatch[1] : '不明',
                            url: recipeMatch ? recipeMatch[2] : '#',
                            rating: ratingMatch ? parseInt(ratingMatch[1]) : 0,
                            note: noteMatch ? noteMatch[1] : ''
                        };
                    }).slice(0, 5);
                }
            }
            if (fs.existsSync(profilePath)) {
                profile = fs.readFileSync(profilePath, 'utf-8');
            }
            if (fs.existsSync(preferencesPath)) {
                preferences = fs.readFileSync(preferencesPath, 'utf-8');
            }

            // Extract recent insights from preferences or logs
            const insightMatch = preferences.match(/## Recent Insights\n([\s\S]*)/);
            if (insightMatch && insightMatch[1]) {
                recentTrends = insightMatch[1]
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.startsWith('-'))
                    .map(line => line.replace(/^- \[\d{4}-\d{2}-\d{2}\] /, '').trim())
                    .slice(0, 5);
            }
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
