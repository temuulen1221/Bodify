// Hoist mocks before imports
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        exerciseDbApiKey: 'test-rapid-key',
        exerciseDbBaseUrl: 'https://exercisedb.p.rapidapi.com',
        exerciseDbApiHost: 'exercisedb.p.rapidapi.com',
      },
    },
  },
}));

jest.mock('../../services/apiClient', () => ({
  apiRequest: jest.fn(),
}));

import { apiRequest } from '../../services/apiClient';
import {
    listBodyParts,
    listByBodyPart,
    searchExercises,
} from '../../services/exercisedb';

type MockApiRequest = jest.MockedFunction<typeof apiRequest>;
const mockRequest = apiRequest as MockApiRequest;

const OK_RESPONSE = { ok: true as const, data: ['chest', 'back'], status: 200, message: '' };
const ERR_RESPONSE = { ok: false as const, data: null, status: 429, message: 'Rate limited', code: 'HTTP_ERROR' as const };

beforeEach(() => {
  mockRequest.mockResolvedValue(OK_RESPONSE);
});

// ---------------------------------------------------------------------------
// API key guard
// ---------------------------------------------------------------------------
describe('exercisedb service — missing API key', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.mock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: { extra: {} } }, // no key
    }));
  });

  it('listBodyParts throws when the ExerciseDB key is absent', async () => {
    const { listBodyParts: lb } = await import('../../services/exercisedb');
    await expect(lb()).rejects.toThrow(/Missing ExerciseDB API key/i);
  });
});

// ---------------------------------------------------------------------------
// Happy-path: correct URLs and headers
// ---------------------------------------------------------------------------
describe('exercisedb service — correct URLs', () => {
  it('listBodyParts calls /exercises/bodyPartList', async () => {
    await listBodyParts();
    expect(mockRequest).toHaveBeenCalledWith(
      expect.stringContaining('/exercises/bodyPartList'),
      expect.anything(),
    );
  });

  it('listByBodyPart includes the body part in the URL', async () => {
    await listByBodyPart('chest');
    expect(mockRequest).toHaveBeenCalledWith(
      expect.stringContaining('/exercises/bodyPart/chest'),
      expect.anything(),
    );
  });

  it('listByBodyPart URL-encodes parts with spaces', async () => {
    await listByBodyPart('upper arms');
    expect(mockRequest).toHaveBeenCalledWith(
      expect.stringContaining('/exercises/bodyPart/upper%20arms'),
      expect.anything(),
    );
  });

  it('listByBodyPart forwards offset and limit as query params', async () => {
    await listByBodyPart('back', 10, 5);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ query: expect.objectContaining({ offset: 10, limit: 5 }) }),
    );
  });

  it('searchExercises includes the encoded query in the URL', async () => {
    await searchExercises('push up');
    expect(mockRequest).toHaveBeenCalledWith(
      expect.stringContaining('/exercises/name/push%20up'),
      expect.anything(),
    );
  });

  it('searchExercises forwards offset and limit as query params', async () => {
    await searchExercises('squat', 5, 10);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ query: expect.objectContaining({ offset: 5, limit: 10 }) }),
    );
  });

  it('every request includes the RapidAPI key header', async () => {
    await listBodyParts();
    expect(mockRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-RapidAPI-Key': 'test-rapid-key' }),
      }),
    );
  });

  it('every request includes the RapidAPI host header', async () => {
    await listBodyParts();
    expect(mockRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com' }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe('exercisedb service — API errors', () => {
  it('listBodyParts throws when apiRequest returns ok:false', async () => {
    mockRequest.mockResolvedValue(ERR_RESPONSE);
    await expect(listBodyParts()).rejects.toThrow(/Rate limited/i);
  });

  it('listByBodyPart throws when apiRequest returns ok:false', async () => {
    mockRequest.mockResolvedValue(ERR_RESPONSE);
    await expect(listByBodyPart('back')).rejects.toThrow();
  });

  it('searchExercises throws when apiRequest returns ok:false', async () => {
    mockRequest.mockResolvedValue(ERR_RESPONSE);
    await expect(searchExercises('lunge')).rejects.toThrow();
  });
});
