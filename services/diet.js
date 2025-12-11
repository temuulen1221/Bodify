// Spoonacular Diet API Service
// API docs: https://spoonacular.com/food-api/docs

const API_KEY = 'd753d6245f434567867516ca6c96b5d5';
const BASE_URL = 'https://api.spoonacular.com';

export async function searchFoods(query) {
  const url = `${BASE_URL}/food/ingredients/search?query=${encodeURIComponent(query)}&apiKey=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch foods');
  return res.json();
}

export async function getFoodNutrition(id) {
  const url = `${BASE_URL}/food/ingredients/${id}/information?amount=1&apiKey=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch nutrition info');
  return res.json();
}

// Recipe Search
export async function searchRecipes(query) {
  const url = `${BASE_URL}/recipes/complexSearch?query=${encodeURIComponent(query)}&apiKey=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch recipes');
  return res.json();
}

// Recipe Details
export async function getRecipeDetails(id) {
  const url = `${BASE_URL}/recipes/${id}/information?apiKey=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch recipe details');
  return res.json();
}

// Meal Plan Generator
export async function generateMealPlan(timeFrame = 'day', targetCalories = 2000, diet = '') {
  const url = `${BASE_URL}/mealplanner/generate?timeFrame=${timeFrame}&targetCalories=${targetCalories}&diet=${encodeURIComponent(diet)}&apiKey=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to generate meal plan');
  return res.json();
}

// Ingredient Info
export async function getIngredientInfo(id) {
  const url = `${BASE_URL}/food/ingredients/${id}/information?amount=1&apiKey=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch ingredient info');
  return res.json();
}

// Food Trivia
export async function getFoodTrivia() {
  const url = `${BASE_URL}/food/trivia/random?apiKey=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch food trivia');
  return res.json();
}


