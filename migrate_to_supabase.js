const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
    const dbPath = path.join(process.cwd(), 'local_db.json');
    if (!fs.existsSync(dbPath)) {
        console.log('No local_db.json found. Skipping migration.');
        return;
    }

    const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

    console.log('Migrating users...');
    for (const user of data.users || []) {
        const { error } = await supabase.from('users').upsert({ id: user.id, name: user.name });
        if (error) console.error('Error migrating user:', user.name, error);
    }

    console.log('Migrating recipes...');
    for (const recipe of data.recipes || []) {
        const { error } = await supabase.from('recipes').upsert({
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
            generated_at: recipe.generatedAt
        });
        if (error) console.error('Error migrating recipe:', recipe.title, error);
    }

    console.log('Migrating feedbacks...');
    for (const f of data.feedbacks || []) {
        const { error } = await supabase.from('feedbacks').insert({
            user_id: f.userId,
            recipe_id: f.recipeId,
            recipe_title: f.recipeTitle,
            recipe_url: f.recipeUrl,
            rating: f.rating,
            ease_of_cooking: f.easeOfCooking,
            physical_condition: f.physicalCondition,
            nutritional_value: f.nutritionalValue,
            improvement_note: f.improvementNote,
            leftover_food: f.leftoverFood,
            date: f.date
        });
        if (error) console.error('Error migrating feedback:', f.recipeTitle, error);
    }

    console.log('Migrating suggestion logs...');
    for (const log of data.suggestions || []) {
        const { error } = await supabase.from('suggestion_logs').insert({
            user_id: log.userId,
            recipes: log.recipes,
            date: log.date
        });
        if (error) console.error('Error migrating suggestion log:', log.date, error);
    }

    console.log('Migration completed!');
}

migrate();
