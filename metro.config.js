const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// Ensure Metro treats 3D formats as assets
config.resolver.assetExts = Array.from(
	new Set([...(config.resolver.assetExts || []), 'vrm', 'glb', 'gltf', 'fbx', 'bin'])
);
module.exports = config;
 
