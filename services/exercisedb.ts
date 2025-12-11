import Constants from 'expo-constants';
import { apiRequest, ApiResult } from './apiClient';

const DEFAULT_BASE = 'https://exercisedb.p.rapidapi.com';
const DEFAULT_HOST = 'exercisedb.p.rapidapi.com';

function requireEnv() {
  const extra = Constants.expoConfig?.extra ?? {};
  const apiKey = extra.exerciseDbApiKey ?? '';
  const baseUrl = extra.exerciseDbBaseUrl ?? DEFAULT_BASE;
  const host = extra.exerciseDbApiHost ?? DEFAULT_HOST;

  if (!apiKey) {
    throw new Error('Missing ExerciseDB API key. Set EXERCISEDB_API_KEY in .env and rebuild.');
  }

  return { apiKey, baseUrl, host };
}

function describeError(result: ApiResult<unknown>): string {
  if (result.ok) return '';
  const status = result.status ? `status ${result.status}` : 'no status';
  return `${result.message} (${status})`;
}

async function getJson<T>(path: string, query?: Record<string, string | number>) {
  const { apiKey, baseUrl, host } = requireEnv();
  const result = await apiRequest<T>(`${baseUrl}${path}`, {
    query,
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': host,
    },
    timeoutMs: 10000,
    retries: 1,
  });

  if (!result.ok) {
    throw new Error(describeError(result));
  }

  return result.data;
}

export async function listBodyParts() {
  return getJson<string[]>('/exercises/bodyPartList');
}

export async function listByBodyPart(part: string, offset = 0, limit = 20) {
  return getJson(`/exercises/bodyPart/${encodeURIComponent(part)}`, { offset, limit });
}

export async function searchExercises(query: string, offset = 0, limit = 20) {
  return getJson(`/exercises/name/${encodeURIComponent(query)}`, { offset, limit });
}
