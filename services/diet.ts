import Constants from 'expo-constants';
import { apiRequest, ApiResult } from './apiClient';

const BASE_URL = 'https://api.spoonacular.com';

function requireApiKey(): string {
  const key = Constants.expoConfig?.extra?.spoonacularApiKey ?? '';
  if (!key) {
    throw new Error('Missing Spoonacular API key. Set SPOONACULAR_API_KEY in .env and rebuild.');
  }
  return key;
}

function describeError(result: ApiResult<unknown>): string {
  if (result.ok) return '';
  const status = result.status ? `status ${result.status}` : 'no status';
  return `${result.message} (${status})`;
}

async function getJson<T>(path: string, query?: Record<string, string | number | boolean>) {
  const apiKey = requireApiKey();
  const result = await apiRequest<T>(`${BASE_URL}${path}`, {
    query: { ...query, apiKey },
    timeoutMs: 12000,
    retries: 1,
  });

  if (!result.ok) {
    throw new Error(describeError(result));
  }

  return result.data;
}

export async function searchFoods(query: string) {
  return getJson(`${BASE_URL}/food/ingredients/search`, { query });
}

export async function getFoodNutrition(id: number | string) {
  return getJson(`${BASE_URL}/food/ingredients/${id}/information`, { amount: 1 });
}

export async function searchRecipes(query: string) {
  return getJson(`${BASE_URL}/recipes/complexSearch`, { query });
}

export async function getRecipeDetails(id: number | string) {
  return getJson(`${BASE_URL}/recipes/${id}/information`);
}

export async function generateMealPlan(timeFrame = 'day', targetCalories = 2000, diet = '') {
  return getJson(`${BASE_URL}/mealplanner/generate`, {
    timeFrame,
    targetCalories,
    diet,
  });
}

export async function getIngredientInfo(id: number | string) {
  return getJson(`${BASE_URL}/food/ingredients/${id}/information`, { amount: 1 });
}

export async function getFoodTrivia() {
  return getJson(`${BASE_URL}/food/trivia/random`);
}
