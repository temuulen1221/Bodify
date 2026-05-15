// Hoist mocks before imports
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: { spoonacularApiKey: 'test-spoon-key' },
    },
  },
}));

jest.mock('../../services/apiClient', () => ({
  apiRequest: jest.fn(),
}));

import { apiRequest } from '../../services/apiClient';
import {
    generateMealPlan,
    getFoodNutrition,
    getFoodTrivia,
    getIngredientInfo,
    getRecipeDetails,
    searchFoods,
    searchRecipes,
} from '../../services/diet';

type MockApiRequest = jest.MockedFunction<typeof apiRequest>;
const mockRequest = apiRequest as MockApiRequest;

const OK_RESPONSE = { ok: true as const, data: { results: [] }, status: 200, message: '' };
const ERR_RESPONSE = { ok: false as const, data: null, status: 500, message: 'Server error', code: 'HTTP_ERROR' as const };

beforeEach(() => {
  mockRequest.mockResolvedValue(OK_RESPONSE);
});

// ---------------------------------------------------------------------------
// API key guard
// ---------------------------------------------------------------------------
describe('diet service — missing API key', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.mock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: { extra: {} } }, // no key
    }));
  });

  it('searchFoods throws when the Spoonacular key is absent', async () => {
    // Re-import after resetting modules so the empty-key mock takes effect
    const { searchFoods: sf } = await import('../../services/diet');
    await expect(sf('test')).rejects.toThrow(/Missing Spoonacular API key/i);
  });
});

// ---------------------------------------------------------------------------
// Happy-path: correct URL and query params forwarded
// ---------------------------------------------------------------------------
describe('diet service — correct URLs', () => {
  it('searchFoods includes /food/ingredients/search and the query term', async () => {
    await searchFoods('chicken');
    expect(mockRequest).toHaveBeenCalledWith(
      expect.stringContaining('/food/ingredients/search'),
      expect.objectContaining({ query: expect.objectContaining({ query: 'chicken' }) }),
    );
  });

  it('getFoodNutrition includes the ingredient id in the URL', async () => {
    await getFoodNutrition(42);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.stringContaining('/food/ingredients/42/information'),
      expect.anything(),
    );
  });

  it('searchRecipes includes /recipes/complexSearch and the query term', async () => {
    await searchRecipes('pasta');
    expect(mockRequest).toHaveBeenCalledWith(
      expect.stringContaining('/recipes/complexSearch'),
      expect.objectContaining({ query: expect.objectContaining({ query: 'pasta' }) }),
    );
  });

  it('getRecipeDetails includes the recipe id in the URL', async () => {
    await getRecipeDetails(99);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.stringContaining('/recipes/99/information'),
      expect.anything(),
    );
  });

  it('generateMealPlan forwards timeFrame, targetCalories and diet', async () => {
    await generateMealPlan('week', 1800, 'vegan');
    expect(mockRequest).toHaveBeenCalledWith(
      expect.stringContaining('/mealplanner/generate'),
      expect.objectContaining({
        query: expect.objectContaining({ timeFrame: 'week', targetCalories: 1800, diet: 'vegan' }),
      }),
    );
  });

  it('getIngredientInfo includes the ingredient id in the URL', async () => {
    await getIngredientInfo(7);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.stringContaining('/food/ingredients/7/information'),
      expect.anything(),
    );
  });

  it('getFoodTrivia calls the trivia endpoint', async () => {
    await getFoodTrivia();
    expect(mockRequest).toHaveBeenCalledWith(
      expect.stringContaining('/food/trivia/random'),
      expect.anything(),
    );
  });

  it('injects the apiKey into every request query', async () => {
    await searchFoods('egg');
    expect(mockRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ query: expect.objectContaining({ apiKey: 'test-spoon-key' }) }),
    );
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe('diet service — API errors', () => {
  it('searchFoods throws when apiRequest returns ok:false', async () => {
    mockRequest.mockResolvedValue(ERR_RESPONSE);
    await expect(searchFoods('burger')).rejects.toThrow(/Server error/i);
  });

  it('getFoodNutrition throws when apiRequest returns ok:false', async () => {
    mockRequest.mockResolvedValue(ERR_RESPONSE);
    await expect(getFoodNutrition(1)).rejects.toThrow();
  });

  it('getFoodTrivia throws when apiRequest returns ok:false', async () => {
    mockRequest.mockResolvedValue(ERR_RESPONSE);
    await expect(getFoodTrivia()).rejects.toThrow();
  });
});
