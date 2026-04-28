import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;
const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_client) {
      _client = createClient(
        process.env.SUPABASE_URL || "http://localhost",
        process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
      );
    }
    return (_client as any)[prop];
  },
});

export interface RecipeCandidate {
  id: string;
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
  baseScore: number;
  generatedAt: string;
}

export interface User {
  id: string;
  name: string;
}

export interface Feedback {
  userId: string;
  recipeId: string;
  recipeTitle: string;
  recipeUrl: string;
  rating: number;
  easeOfCooking: number;
  physicalCondition: number;
  nutritionalValue: number;
  improvementNote: string;
  leftoverFood: string;
  date: string;
}

export class DBService {
  static async getRecipes(): Promise<RecipeCandidate[]> {
    const { data, error } = await supabase.from("recipes").select("*");

    if (error) {
      console.error("Error fetching recipes:", error);
      return [];
    }

    return data.map((r) => ({
      id: r.id,
      title: r.title,
      url: r.url,
      source: r.source,
      cookingTime: r.cooking_time,
      tags: r.tags,
      ingredients: r.ingredients,
      steps: r.steps,
      nutrition: r.nutrition,
      dishwashingTip: r.dishwashing_tip,
      leftoverTip: r.leftover_tip,
      baseScore: r.base_score,
      generatedAt: r.generated_at,
    }));
  }

  static async saveRecipe(recipe: RecipeCandidate) {
    await supabase.from("recipes").upsert({
      id: recipe.id,
      title: recipe.title,
      url: recipe.url,
      source: recipe.source,
      cooking_time: recipe.cookingTime,
      tags: recipe.tags,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      nutrition: recipe.nutrition,
      dishwashing_tip: recipe.dishwashingTip,
      leftover_tip: recipe.leftoverTip,
      base_score: recipe.baseScore,
      generated_at: recipe.generatedAt,
    });
  }

  static async saveSuggestionLog(userId: string, recipes: RecipeCandidate[]) {
    await supabase.from("suggestion_logs").insert({
      user_id: userId,
      recipes: recipes,
      date: new Date().toISOString(),
    });
  }

  static async saveFeedback(feedback: Feedback) {
    await supabase.from("feedbacks").insert({
      user_id: feedback.userId,
      recipe_id: feedback.recipeId,
      recipe_title: feedback.recipeTitle,
      recipe_url: feedback.recipeUrl,
      rating: feedback.rating,
      ease_of_cooking: feedback.easeOfCooking,
      physical_condition: feedback.physicalCondition,
      nutritional_value: feedback.nutritionalValue,
      improvement_note: feedback.improvementNote,
      leftover_food: feedback.leftoverFood,
      date: feedback.date,
    });
  }

  static async getFeedbacks(userId: string): Promise<Feedback[]> {
    const { data, error } = await supabase
      .from("feedbacks")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching feedbacks:", error);
      return [];
    }

    return data.map((f) => ({
      userId: f.user_id,
      recipeId: f.recipe_id,
      recipeTitle: f.recipe_title,
      recipeUrl: f.recipe_url,
      rating: f.rating,
      easeOfCooking: f.ease_of_cooking,
      physicalCondition: f.physical_condition,
      nutritionalValue: f.nutritional_value,
      improvementNote: f.improvement_note,
      leftoverFood: f.leftover_food,
      date: f.date,
    }));
  }

  static async getUsers(): Promise<User[]> {
    const { data, error } = await supabase.from("users").select("*");
    if (error) {
      console.error("Error fetching users:", error);
      return [];
    }
    return data as User[];
  }

  static async saveUser(user: User) {
    await supabase.from("users").upsert({
      id: user.id,
      name: user.name,
    });
  }

  static async deleteUser(userId: string) {
    await supabase.from("users").delete().eq("id", userId);
  }
}
