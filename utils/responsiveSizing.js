import { Dimensions, StyleSheet } from 'react-native';

const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

const HORIZONTAL_KEYS = new Set([
  'left',
  'right',
  'width',
  'minWidth',
  'maxWidth',
  'marginLeft',
  'marginRight',
  'paddingLeft',
  'paddingRight',
  'translateX',
]);

const VERTICAL_KEYS = new Set([
  'top',
  'bottom',
  'height',
  'minHeight',
  'maxHeight',
  'marginTop',
  'marginBottom',
  'paddingTop',
  'paddingBottom',
  'translateY',
]);

const UNIFORM_KEYS = new Set([
  'margin',
  'marginHorizontal',
  'marginVertical',
  'padding',
  'paddingHorizontal',
  'paddingVertical',
  'gap',
  'rowGap',
  'columnGap',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'borderWidth',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'shadowRadius',
]);

const NON_SCALABLE_KEYS = new Set([
  'flex',
  'flexGrow',
  'flexShrink',
  'opacity',
  'zIndex',
  'elevation',
  'fontWeight',
  'aspectRatio',
]);

let initialized = false;
let originalStyleSheetCreate = null;
let metrics = null;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const computeMetrics = (windowDims = Dimensions.get('window')) => {
  const width = Math.max(1, windowDims.width || BASE_WIDTH);
  const height = Math.max(1, windowDims.height || BASE_HEIGHT);
  const fontScale = Math.max(1, windowDims.fontScale || 1);

  return {
    scaleX: width / BASE_WIDTH,
    scaleY: height / BASE_HEIGHT,
    scaleUniform: Math.min(width / BASE_WIDTH, height / BASE_HEIGHT),
    fontScale,
  };
};

const roundPx = (value) => Number(value.toFixed(2));

const scaleNumericValue = (key, value) => {
  if (!Number.isFinite(value) || value === 0 || NON_SCALABLE_KEYS.has(key)) {
    return value;
  }

  if (!metrics) {
    metrics = computeMetrics();
  }

  if (HORIZONTAL_KEYS.has(key)) {
    return roundPx(value * metrics.scaleX);
  }

  if (VERTICAL_KEYS.has(key)) {
    return roundPx(value * metrics.scaleY);
  }

  if (UNIFORM_KEYS.has(key)) {
    if (key === 'fontSize' || key === 'lineHeight' || key === 'letterSpacing') {
      const fontFactor = clamp(metrics.fontScale, 1, 1.2);
      return roundPx(value * metrics.scaleUniform * fontFactor);
    }
    return roundPx(value * metrics.scaleUniform);
  }

  return value;
};

const scaleStyleNode = (node) => {
  if (Array.isArray(node)) {
    return node.map(scaleStyleNode);
  }

  if (!node || typeof node !== 'object') {
    return node;
  }

  const scaled = {};
  Object.keys(node).forEach((key) => {
    const value = node[key];

    if (Array.isArray(value) || (value && typeof value === 'object')) {
      scaled[key] = scaleStyleNode(value);
      return;
    }

    if (typeof value === 'number') {
      scaled[key] = scaleNumericValue(key, value);
      return;
    }

    scaled[key] = value;
  });

  return scaled;
};

export const initializeResponsiveSizing = () => {
  if (initialized) {
    return;
  }

  initialized = true;
  metrics = computeMetrics();
  originalStyleSheetCreate = StyleSheet.create;

  StyleSheet.create = (styles) => {
    const scaledStyles = scaleStyleNode(styles);
    return originalStyleSheetCreate(scaledStyles);
  };

  Dimensions.addEventListener('change', ({ window }) => {
    metrics = computeMetrics(window);
  });
};
