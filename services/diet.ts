import { apiRequest } from './apiClient';

const BASE_URL = 'https://api.spoonacular.com';

// Hardcoded API key - bypass Constants entirely for now
const SPOONACULAR_API_KEY = '6e98d55344b8493198a5271b06202a3c';

function getApiKey(): string {
  return SPOONACULAR_API_KEY;
}

async function get(path: string, params: Record<string, string | number | boolean> = {}): Promise<any> {
  const apiKey = getApiKey();
  const fullParams = { ...params, apiKey };
  const url = `${BASE_URL}${path}`;
  
  const result = await apiRequest<any>(url, {
    query: fullParams,
    timeoutMs: 14000,
    retries: 1,
  });
  
  if (!result.ok) {
    // More detailed error for debugging
    const details = {
      status: result.status,
      message: result.message,
      url,
      hasApiKey: !!apiKey,
      body: result.body,
    };
    console.error('[Spoonacular Error]', details);
    throw new Error(`Spoonacular ${result.status ?? 'error'}: ${result.message}`);
  }
  
  return result.data;
}

// ── Foods / Ingredients ──────────────────────────────────────────────────────

export function searchFoods(query: string, number = 20) {
  return get('/food/ingredients/search', { query, number });
}

export function getFoodNutrition(id: number | string) {
  return get(`/food/ingredients/${id}/information`, { amount: 1, unit: 'serving' });
}

export function getIngredientSubstitutes(id: number | string) {
  return get(`/food/ingredients/${id}/substitutes`);
}

// ── Recipes ──────────────────────────────────────────────────────────────────

export function searchRecipes(
  query: string,
  opts: {
    cuisine?: string;
    diet?: string;
    maxReadyTime?: number;
    intolerances?: string;
    number?: number;
  } = {}
) {
  const params: Record<string, string | number | boolean> = {
    query,
    number: opts.number ?? 20,
  };
  if (opts.cuisine)       params.cuisine      = opts.cuisine;
  if (opts.diet)          params.diet         = opts.diet;
  if (opts.maxReadyTime)  params.maxReadyTime = opts.maxReadyTime;
  if (opts.intolerances)  params.intolerances = opts.intolerances;
  return get('/recipes/complexSearch', params);
}

export function getRecipeDetails(id: number | string) {
  return get(`/recipes/${id}/information`);
}

export function getSimilarRecipes(id: number | string) {
  return get(`/recipes/${id}/similar`, { number: 6 });
}

export function searchRecipesByIngredients(ingredients: string, number = 15) {
  return get('/recipes/findByIngredients', {
    ingredients,
    number,
    ranking: 2,
    ignorePantry: true,
  });
}

export function getRandomRecipes(number = 1, tags = '') {
  const params: Record<string, string | number | boolean> = { number };
  if (tags) params.tags = tags;
  return get('/recipes/random', params);
}

// ── Meal Plan ────────────────────────────────────────────────────────────────

export function generateMealPlan(timeFrame = 'day', targetCalories = 2000, diet = '') {
  const params: Record<string, string | number> = { timeFrame, targetCalories };
  if (diet) params.diet = diet;
  return get('/mealplanner/generate', params);
}

// ── Misc ─────────────────────────────────────────────────────────────────────

export function getFoodTrivia() {
  return get('/food/trivia/random');
}

export function getFoodJoke() {
  return get('/food/jokes/random');
}
