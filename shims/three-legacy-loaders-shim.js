// Generic shim for legacy three/examples/js loaders referenced by expo-three
// Provides minimal classes that satisfy constructor calls and basic methods.
import * as THREE from 'three';

function noop() {}
function promiseLoadLike(loader, url, onProgress, onError) {
  // Return a Promise resolving to a minimal object to keep callers from crashing.
  return new Promise((res) => {
    // Resolve with a basic geometry or object depending on loader name
    const name = loader.constructor.name;
    if (name.includes('STL') || name.includes('PLY') || name.includes('TDS') || name.includes('BVH')) {
      res(new THREE.BufferGeometry());
    } else if (name.includes('PCD')) {
      res({});
    } else if (name.includes('Collada')) {
      res({ scene: new THREE.Group() });
    } else if (name.includes('OBJ')) {
      res(new THREE.Group());
    } else if (name.includes('MTL')) {
      const materials = { preload: noop };
      res(materials);
    } else {
      res({});
    }
  });
}

class BaseShimLoader {
  setPath() {}
  setMaterials() {}
  parse() { return {}; }
  load(url, onLoad, onProgress, onError) {
    promiseLoadLike(this, url, onProgress, onError).then((result) => {
      if (typeof onLoad === 'function') onLoad(result);
    });
  }
}

class STLLoader extends BaseShimLoader {}
class PCDLoader extends BaseShimLoader {}
class VTKLoader extends BaseShimLoader {}
class BabylonLoader extends BaseShimLoader {}
class AssimpLoader extends BaseShimLoader {}
class TDSLoader extends BaseShimLoader {}
class BVHLoader extends BaseShimLoader {}
class PLYLoader extends BaseShimLoader {}
class ColladaLoader extends BaseShimLoader {
  parse() { return { scene: new THREE.Group() }; }
}
class XLoader extends BaseShimLoader {
  load(args, onLoad) { if (typeof onLoad === 'function') onLoad(new THREE.Group()); }
}
class OBJLoader extends BaseShimLoader {
  parse() { return new THREE.Group(); }
}
class MTLLoader extends BaseShimLoader {
  parse() { return { preload: noop }; }
}

// Attach to THREE namespace to mimic side-effect modules
Object.assign(THREE, {
  STLLoader,
  PCDLoader,
  VTKLoader,
  BabylonLoader,
  AssimpLoader,
  TDSLoader,
  BVHLoader,
  PLYLoader,
  ColladaLoader,
  XLoader,
  OBJLoader,
  MTLLoader,
});

export {
    AssimpLoader, BabylonLoader, BVHLoader, ColladaLoader, MTLLoader, OBJLoader, PCDLoader, PLYLoader, STLLoader, TDSLoader, VTKLoader, XLoader
};

