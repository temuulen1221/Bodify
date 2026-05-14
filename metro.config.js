const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// Ensure Metro treats 3D formats as assets
config.resolver.assetExts = Array.from(
	new Set([...(config.resolver.assetExts || []), 'vrm', 'glb', 'gltf', 'fbx', 'bin'])
);
// Deduplicate Three.js — force ALL imports of 'three' (including nested deps like stats-gl)
// to resolve to the single root-level copy, preventing the "Multiple instances" warning.
const threeEntry = path.resolve(__dirname, 'node_modules/three');
config.resolver.extraNodeModules = {
	...config.resolver.extraNodeModules,
	three: threeEntry,
};
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
	if (moduleName === 'three') {
		return { filePath: require.resolve('three'), type: 'sourceFile' };
	}
	return defaultResolveRequest
		? defaultResolveRequest(context, moduleName, platform)
		: context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
 
