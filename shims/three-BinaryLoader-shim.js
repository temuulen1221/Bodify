// Shim for deprecated three/examples/js/loaders/BinaryLoader
// Newer versions of three removed BinaryLoader. expo-three's parseAsync still requires it.
// This shim prevents bundling failures and provides a minimal no-op implementation.

import * as THREE from 'three';

class BinaryLoader {
  constructor() {}
  setPath() {}
  // Legacy signature: parse(arrayBuffer, onLoad, path, materials)
  // We return an empty BufferGeometry to keep downstream code from crashing if invoked.
  parse(arrayBuffer, onLoad /*, path, materials */) {
    try {
      const geometry = new THREE.BufferGeometry();
      if (typeof onLoad === 'function') onLoad(geometry);
    } catch (e) {
      // no-op
    }
  }
}

// Attach to THREE namespace to mimic legacy side-effect module behavior
// so that `require('three/examples/js/loaders/BinaryLoader')` makes THREE.BinaryLoader available.
THREE.BinaryLoader = BinaryLoader;

export default BinaryLoader;
