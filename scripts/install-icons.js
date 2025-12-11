const fs = require('fs');
const path = require('path');

const workspace = path.resolve(__dirname, '..');
const srcBase = path.join(workspace, 'assets', 'icons', 'icon', 'icon', 'android');
const destRes = path.join(workspace, 'android', 'app', 'src', 'main', 'res');
const destImages = path.join(workspace, 'assets', 'images');
const srcApple = path.join(workspace, 'assets', 'icons', 'icon', 'icon', 'apple-devices');

const mipmapDirs = ['mipmap-mdpi','mipmap-hdpi','mipmap-xhdpi','mipmap-xxhdpi','mipmap-xxxhdpi','mipmap-anydpi-v26'];

function copyIfExists(src, dest) {
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log('copied', src, '->', dest);
    return true;
  }
  return false;
}

try {
  // ensure images folder exists
  fs.mkdirSync(destImages, { recursive: true });

  // copy common playstore or launcher images into assets/images
  const candidateImages = ['playstore-icon.png','ic_launcher_foreground.png','ic_launcher.png','ic_launcher_round.png','ic_launcher.png'];
  candidateImages.forEach(name => {
    const src = path.join(srcBase, name);
    const dest = path.join(destImages, name);
    if (copyIfExists(src, dest)) return;
    // also try density folders
    for (const d of mipmapDirs) {
      const s = path.join(srcBase.replace(/android$/,''), d, name);
      if (copyIfExists(s, path.join(destImages, name))) break;
    }
  });

  // copy density images into android res
  for (const d of mipmapDirs) {
    const srcDir = path.join(srcBase, d);
    if (!fs.existsSync(srcDir)) continue;
    const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.png'));
    for (const f of files) {
      const src = path.join(srcDir, f);
      const destDir = path.join(destRes, d);
      const dest = path.join(destDir, f);
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(src, dest);
      console.log('copied', src, '->', dest);
    }
  }

  // iOS: copy AppIcon.appiconset into any ios asset catalogs if present
  try {
    const appIconSet = path.join(srcApple, 'AppIcon.appiconset');
    if (fs.existsSync(appIconSet)) {
      // look for ios asset catalog folders
      const iosRoot = path.join(workspace, 'ios');
      if (fs.existsSync(iosRoot)) {
        // search recursively for *.xcassets folders
        const walk = dir => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
              if (e.name.endsWith('.xcassets')) {
                const dest = path.join(full, 'AppIcon.appiconset');
                fs.rmSync(dest, { recursive: true, force: true });
                copyDir(appIconSet, dest);
                console.log('copied iOS AppIcon to', dest);
              } else {
                walk(full);
              }
            }
          }
        };
        walk(iosRoot);
      } else {
        // fallback: copy into assets/images for later manual use
        const dest = path.join(destImages, 'AppIcon.appiconset');
        fs.rmSync(dest, { recursive: true, force: true });
        copyDir(appIconSet, dest);
        console.log('copied iOS AppIcon.appiconset to', dest);
      }
    }
  } catch (err) {
    console.warn('iOS icon copy skipped or failed:', err.message || err);
  }

  console.log('Icon install complete.');
} catch (err) {
  console.error('Error installing icons:', err);
  process.exit(1);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}
