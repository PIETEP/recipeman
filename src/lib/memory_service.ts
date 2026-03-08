import { DBService, Feedback } from './db_service';

export interface UserProfile {
  name: string;
  allergies: string[];
  ngIngredients: string[];
  healthFocus: string[];
  maxCookingTime: number;
  preferredStyles: string[];
}

export class MemoryService {
  /**
   * Fetches user profile. In a cloud-ready app, this can be partially derived
   * from settings or hardcoded defaults for now, as we focus on feedback-based learning.
   */
  static async getProfile(userId: string): Promise<UserProfile> {
    // For now, return a default profile. We could add a 'profiles' table later if needed.
    // The key learning happens in getPreferences via the feedbacks table.
    return {
      name: userId,
      allergies: [],
      ngIngredients: [],
      healthFocus: ['Protein', 'Iron', 'Vitamin C'],
      maxCookingTime: 20,
      preferredStyles: ['Easy', 'Quick']
    };
  }

  /**
   * Generates a context string for the AI based on previous feedbacks stored in Supabase.
   */
  static async getPreferences(userId: string): Promise<string> {
    const feedbacks = await DBService.getFeedbacks(userId);

    if (feedbacks.length === 0) {
      return "まだフィードバックはありません。一般的な健康的なレシピを提案してください。";
    }

    // Sort by date descending and take last 10
    const recentFeedbacks = feedbacks
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    let context = "# Learned Preferences from Recent Feedbacks\n\n";

    recentFeedbacks.forEach(f => {
      const date = f.date.split('T')[0];
      context += `### ${date}: ${f.recipeTitle}\n`;
      context += `- Rating: ${f.rating}/5, Ease: ${f.easeOfCooking}/5\n`;
      if (f.improvementNote) context += `- Note: ${f.improvementNote}\n`;
      if (f.leftoverFood) context += `- Leftovers: ${f.leftoverFood}\n`;
      if (f.physicalCondition < 0) context += `- Status: User felt unwell.\n`;
      context += "\n";
    });

    return context;
  }

  /**
   * Updates preferences. With Supabase, we just save the feedback.
   * The 'learning' happens dynamically in getPreferences.
   */
  static async updatePreferences(userId: string, feedback: any) {
    const feedbackData: Feedback = {
      userId,
      recipeId: feedback.recipeId || 'manual',
      recipeTitle: feedback.recipeTitle,
      recipeUrl: feedback.recipeUrl || '',
      rating: parseInt(feedback.rating),
      easeOfCooking: parseInt(feedback.easeOfCooking),
      physicalCondition: parseInt(feedback.physicalCondition),
      nutritionalValue: parseInt(feedback.nutritionalValue),
      improvementNote: feedback.improvementNote || '',
      leftoverFood: feedback.leftoverFood || '',
      date: new Date().toISOString()
    };

    await DBService.saveFeedback(feedbackData);
  }
}
