import Constants from 'expo-constants';

const BASE = Constants.expoConfig?.extra?.exerciseDbBaseUrl || 'https://exercisedb.p.rapidapi.com';
const HOST = Constants.expoConfig?.extra?.exerciseDbApiHost || 'exercisedb.p.rapidapi.com';
const KEY = Constants.expoConfig?.extra?.exerciseDbApiKey || '';

function headers() {
  if (!KEY) throw new Error('Missing ExerciseDB API key. Set expo.extra.exerciseDbApiKey in app.json');
  return {
    'X-RapidAPI-Key': KEY,
    'X-RapidAPI-Host': HOST,
  };
}

export async function listBodyParts() {
  const url = `${BASE}/exercises/bodyPartList`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`ExerciseDB body parts failed: ${res.status}`);
  return res.json();
}

export async function listByBodyPart(part, offset = 0, limit = 20) {
  const url = `${BASE}/exercises/bodyPart/${encodeURIComponent(part)}?offset=${offset}&limit=${limit}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`ExerciseDB list failed: ${res.status}`);
  return res.json();
}

export async function searchExercises(query, offset = 0, limit = 20) {
  const url = `${BASE}/exercises/name/${encodeURIComponent(query)}?offset=${offset}&limit=${limit}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`ExerciseDB search failed: ${res.status}`);
  return res.json();
}
