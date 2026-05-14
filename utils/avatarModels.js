const avatarModelModules = {
  'AvatarSample_F.vrm': require('../assets/models/AvatarSample_F.vrm'),
  'AvatarSample_K_F.vrm': require('../assets/models/AvatarSample_K_F.vrm'),
  'AvatarSample_L.vrm': require('../assets/models/AvatarSample_L.vrm'),
  'AvatarSample_M.vrm': require('../assets/models/AvatarSample_M.vrm'),
};

export const LOCAL_AVATAR_MODELS = [
  {
    id: 'AvatarSample_M.vrm',
    label: 'Classic Male',
    description: 'Default masculine Bodify avatar',
    gender: 'male',
  },
  {
    id: 'AvatarSample_F.vrm',
    label: 'Classic Female',
    description: 'Default feminine Bodify avatar',
    gender: 'female',
  },
  {
    id: 'AvatarSample_K_F.vrm',
    label: 'K-Fit',
    description: 'Alternate feminine avatar',
    gender: 'female',
  },
  {
    id: 'AvatarSample_L.vrm',
    label: 'Fit Style',
    description: 'Alternate masculine avatar',
    gender: 'male',
  },
];

export const getLocalAvatarModelModule = (modelId) => {
  if (!modelId || typeof modelId !== 'string') return null;
  return avatarModelModules[modelId] || null;
};

export const getDefaultAvatarModelId = (gender = 'male') => {
  const normalizedGender = String(gender || '').toLowerCase();
  if (normalizedGender === 'female') return 'AvatarSample_F.vrm';
  return 'AvatarSample_M.vrm';
};

export const isKnownLocalAvatarModel = (modelId) => Boolean(getLocalAvatarModelModule(modelId));

export const getAvatarModelOptionsForGender = (gender = 'neutral') => {
  const normalizedGender = String(gender || '').toLowerCase();
  if (normalizedGender === 'female') {
    return LOCAL_AVATAR_MODELS.filter((model) => model.gender === 'female' || model.gender === 'neutral');
  }
  if (normalizedGender === 'male') {
    return LOCAL_AVATAR_MODELS.filter((model) => model.gender === 'male' || model.gender === 'neutral');
  }
  return LOCAL_AVATAR_MODELS.slice();
};

export const resolveAvatarModelSelection = (modelId, gender = 'male') => {
  if (isKnownLocalAvatarModel(modelId)) return modelId;
  return getDefaultAvatarModelId(gender);
};