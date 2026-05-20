/**
 * Migrates deprecated react-native-web shadow* / textShadow* style props
 * to the unified boxShadow / textShadow CSS string properties supported by:
 *   - React Native 0.76+ (native)
 *   - react-native-web 0.19+ (web)
 *
 * Usage: node scripts/fix-shadow-props.js [--dry-run]
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');

// ── colour helpers ────────────────────────────────────────────────────────────

function hexToRgba(hex, opacity) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

function resolveColor(color, opacity) {
  if (opacity === undefined || opacity === null || opacity === 1) return color;
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return hexToRgba(color, opacity);
  return color;
}

// ── value extraction helpers ──────────────────────────────────────────────────

function extractPropValue(lines, propName) {
  const re = new RegExp(`^\\s*${propName}\\s*:\\s*(.*?)\\s*,?\\s*$`);
  for (const l of lines) {
    const m = l.match(re);
    if (m) return m[1].replace(/,$/, '').trim();
  }
  return null;
}

function parseColorValue(raw) {
  if (!raw) return null;
  const quoted = raw.match(/^(['"`])(.*?)\1$/);
  if (quoted) return { type: 'literal', value: quoted[2] };
  return { type: 'variable', value: raw };
}

function parseOffset(raw) {
  if (!raw) return { x: 0, y: 0 };
  const wx = raw.match(/width\s*:\s*(-?[\d.]+)/);
  const hy = raw.match(/height\s*:\s*(-?[\d.]+)/);
  return { x: wx ? parseFloat(wx[1]) : 0, y: hy ? parseFloat(hy[1]) : 0 };
}

// ── single-line shadow replacement ───────────────────────────────────────────

function replaceSingleLineShadows(src) {
  // box shadow: all 4 props on one line
  src = src.replace(
    /shadowColor\s*:\s*(['"`])(.*?)\1\s*,\s*shadowOffset\s*:\s*\{[^}]*width\s*:\s*(-?[\d.]+)[^}]*height\s*:\s*(-?[\d.]+)[^}]*\}\s*,\s*shadowOpacity\s*:\s*([\d.]+)\s*,\s*shadowRadius\s*:\s*([\d.]+)/g,
    (_, _q, color, ox, oy, op, blur) =>
      `boxShadow: '${parseFloat(ox)}px ${parseFloat(oy)}px ${parseFloat(blur)}px ${resolveColor(color, parseFloat(op))}'`
  );
  // textShadow: 3 props on one line
  src = src.replace(
    /textShadowColor\s*:\s*(['"`])(.*?)\1\s*,\s*textShadowOffset\s*:\s*\{[^}]*width\s*:\s*(-?[\d.]+)[^}]*height\s*:\s*(-?[\d.]+)[^}]*\}\s*,\s*textShadowRadius\s*:\s*([\d.]+)/g,
    (_, _q, color, ox, oy, blur) =>
      `textShadow: '${parseFloat(ox)}px ${parseFloat(oy)}px ${parseFloat(blur)}px ${color}'`
  );
  return src;
}

// ── multi-line shadow group replacement ───────────────────────────────────────

const SHADOW_PROPS = new Set(['shadowColor', 'shadowOffset', 'shadowOpacity', 'shadowRadius']);
const TEXT_SHADOW_PROPS = new Set(['textShadowColor', 'textShadowOffset', 'textShadowRadius']);

function getPropName(line) {
  const m = line.match(/^\s*(shadow(?:Color|Offset|Opacity|Radius)|textShadow(?:Color|Offset|Radius))\s*:/);
  return m ? m[1] : null;
}

function replaceMultiLineShadows(src, filePath) {
  const lines = src.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const prop = getPropName(lines[i]);

    if (!prop) {
      out.push(lines[i]);
      i++;
      continue;
    }

    const isShadow = SHADOW_PROPS.has(prop);
    const isTextShadow = TEXT_SHADOW_PROPS.has(prop);

    if (!isShadow && !isTextShadow) {
      out.push(lines[i]);
      i++;
      continue;
    }

    const propSet = isShadow ? SHADOW_PROPS : TEXT_SHADOW_PROPS;
    const windowLines = [];
    let j = i;
    while (j < lines.length) {
      const p = getPropName(lines[j]);
      if (p && propSet.has(p)) {
        windowLines.push(lines[j]);
        j++;
      } else {
        break;
      }
    }

    if (windowLines.length < 2) {
      out.push(lines[i]);
      i++;
      continue;
    }

    if (isShadow) {
      const colorRaw = extractPropValue(windowLines, 'shadowColor');
      const offsetRaw = extractPropValue(windowLines, 'shadowOffset');
      const opacityRaw = extractPropValue(windowLines, 'shadowOpacity');
      const radiusRaw = extractPropValue(windowLines, 'shadowRadius');

      if (!colorRaw || !radiusRaw) {
        console.warn(`  ⚠  ${path.relative(process.cwd(), filePath)}:${i + 1} – incomplete shadow group (no color/radius) – left as-is`);
        windowLines.forEach((l) => out.push(l));
        i += windowLines.length;
        continue;
      }

      const colorInfo = parseColorValue(colorRaw);
      const { x: ox, y: oy } = parseOffset(offsetRaw);
      const opacity = opacityRaw ? parseFloat(opacityRaw) : 1;
      const blur = parseFloat(radiusRaw);

      const indentMatch = windowLines[0].match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : '';
      const trailingComma = windowLines[windowLines.length - 1].trimEnd().endsWith(',') ? ',' : '';

      let line;
      if (colorInfo.type === 'literal') {
        const cssColor = resolveColor(colorInfo.value, opacity);
        line = `${indent}boxShadow: '${ox}px ${oy}px ${blur}px ${cssColor}'${trailingComma}`;
      } else {
        // Runtime variable – use makeShadow helper
        line = `${indent}...require('../utils/shadow').makeShadow(${colorInfo.value}, ${ox}, ${oy}, ${blur}, ${opacity})${trailingComma}`;
      }

      out.push(line);
      i += windowLines.length;
    } else {
      // textShadow
      const colorRaw = extractPropValue(windowLines, 'textShadowColor');
      const offsetRaw = extractPropValue(windowLines, 'textShadowOffset');
      const radiusRaw = extractPropValue(windowLines, 'textShadowRadius');

      if (!colorRaw || !radiusRaw) {
        console.warn(`  ⚠  ${path.relative(process.cwd(), filePath)}:${i + 1} – incomplete textShadow group – left as-is`);
        windowLines.forEach((l) => out.push(l));
        i += windowLines.length;
        continue;
      }

      const colorInfo = parseColorValue(colorRaw);
      const { x: ox, y: oy } = parseOffset(offsetRaw);
      const blur = parseFloat(radiusRaw);

      const indentMatch = windowLines[0].match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : '';
      const trailingComma = windowLines[windowLines.length - 1].trimEnd().endsWith(',') ? ',' : '';

      out.push(`${indent}textShadow: '${ox}px ${oy}px ${blur}px ${colorInfo.value}'${trailingComma}`);
      i += windowLines.length;
    }
  }

  return out.join('\n');
}

// ── pointerEvents JSX prop fixer ─────────────────────────────────────────────

function fixPointerEventsProps(src) {
  return src.replace(
    /([ \t]+)pointerEvents=["']([^"']+)["']/g,
    (match, ws, value, offset, str) => {
      const before = str.slice(0, offset);
      const lineStart = before.lastIndexOf('\n') + 1;
      const linePrefix = before.slice(lineStart);
      // Skip if already inside an object literal or style prop
      if (/[{,]\s*$/.test(linePrefix.trim())) return match;
      if (linePrefix.includes('style=')) return match;
      return `${ws}style={{ pointerEvents: '${value}' }}`;
    }
  );
}

// ── file walker ───────────────────────────────────────────────────────────────

const TARGET_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'build', 'dist', 'android', 'ios', 'CharacterStudio', 'scripts']);
const NATIVE_ONLY_RE = /\.native\.(js|ts|tsx|jsx)$/;

function shouldProcess(filePath) {
  if (NATIVE_ONLY_RE.test(filePath)) return false;
  if (!TARGET_EXTS.has(path.extname(filePath))) return false;
  const parts = filePath.replace(/\\/g, '/').split('/');
  return !parts.some((p) => EXCLUDE_DIRS.has(p));
}

function processFile(filePath) {
  let src;
  try { src = fs.readFileSync(filePath, 'utf8'); } catch { return; }

  const original = src;
  src = replaceSingleLineShadows(src);
  src = replaceMultiLineShadows(src, filePath);
  src = fixPointerEventsProps(src);

  if (src !== original) {
    const rel = path.relative(process.cwd(), filePath);
    console.log(`  + ${rel}`);
    if (!DRY_RUN) fs.writeFileSync(filePath, src, 'utf8');
  }
}

function walkDir(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full);
    else if (entry.isFile()) processFile(full);
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

const root = path.resolve(__dirname, '..');
if (DRY_RUN) console.log('\n[DRY RUN]\n');
console.log(`Scanning: ${root}\n`);
walkDir(root);
console.log('\nDone.\n');
