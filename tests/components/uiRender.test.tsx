// @ts-nocheck
/**
 * Render tests for presentational components.
 * Uses react-test-renderer (no DOM required) with all native / expo
 * dependencies replaced by lightweight React stubs.
 */

// ---------------------------------------------------------------------------
// react-native mock — factories must be self-contained (no outer refs)
// because jest.mock() is hoisted above variable declarations.
// ---------------------------------------------------------------------------
jest.mock('react-native', () => {
  const React = require('react');
  return {
    Image: (props) => React.createElement('Image', props),
    View: ({ children, ...p }) => React.createElement('View', p, children),
    Text: ({ children, ...p }) => React.createElement('Text', p, children),
    Pressable: ({ children, onPress, ...p }) =>
      React.createElement('Pressable', { onPress, ...p }, children),
    StyleSheet: { create: (s) => s },
    Platform: { OS: 'ios', select: (obj) => (obj.ios !== undefined ? obj.ios : obj.default) },
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
  };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  return {
    LinearGradient: ({ children, ...p }) =>
      React.createElement('LinearGradient', p, children),
  };
});

// Navigation mocks use a shared state object mutated in tests
var _nav = { canGoBack: false, calls: { goBack: 0, navigate: 0 } };
var _router = { canGoBack: false, calls: { back: 0, replace: [], push: [] } };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    canGoBack: () => _nav.canGoBack,
    goBack: () => { _nav.calls.goBack += 1; },
    navigate: (r) => { _nav.calls.navigate += 1; },
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    canGoBack: () => _router.canGoBack,
    back: () => { _router.calls.back += 1; },
    replace: (r) => { _router.calls.replace.push(r); },
    push: (r) => { _router.calls.push.push(r); },
  }),
  usePathname: () => '/Home',
}));

// Redux selector proxies through a shared state object
var _store = { stepsByDate: {} };
jest.mock('react-redux', () => ({
  useSelector: (selector) => selector({ steps: { stepsByDate: _store.stepsByDate } }),
  useDispatch: () => () => {},
}));

jest.mock('../../utils/constants', () => ({
  COLORS: { neonPurple: '#a855f7' },
  GRADIENTS: { neonBar: ['#a855f7', '#6366f1'] },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import BackButton from '../../components/BackButton';
import GoogleLogo from '../../components/GoogleLogo';
import StepsWidget from '../../components/StepsWidget';

// React 19 react-test-renderer uses a concurrent scheduler; suppress its
// deprecation warning and configure act() environment.
beforeAll(() => {
  (global as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  (console.error as any).mockRestore?.();
});

/** Synchronously create a renderer instance with act() flushing. */
function render(element: React.ReactElement) {
  let instance: ReturnType<typeof renderer.create>;
  act(() => { instance = renderer.create(element); });
  return instance!;
}

// ===========================================================================
// GoogleLogo
// ===========================================================================
describe('<GoogleLogo />', () => {
  it('renders without crashing', () => {
    const tree = render(<GoogleLogo />).toJSON();
    expect(tree).not.toBeNull();
  });

  it('renders an Image element', () => {
    const tree = render(<GoogleLogo />).toJSON();
    expect(tree.type).toBe('Image');
  });

  it('applies the default size of 26', () => {
    const tree = render(<GoogleLogo />).toJSON();
    expect(tree.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: 26, height: 26 })]),
    );
  });

  it('respects a custom size prop', () => {
    const tree = render(<GoogleLogo size={48} />).toJSON();
    expect(tree.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: 48, height: 48 })]),
    );
  });

  it('merges an extra style prop', () => {
    const tree = render(<GoogleLogo style={{ borderRadius: 4 }} />).toJSON();
    expect(tree.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ borderRadius: 4 })]),
    );
  });
});

// ===========================================================================
// BackButton
// ===========================================================================
describe('<BackButton />', () => {
  beforeEach(() => {
    _nav.canGoBack = false;
    _nav.calls = { goBack: 0, navigate: 0 };
    _router.canGoBack = false;
    _router.calls = { back: 0, replace: [], push: [] };
  });

  it('renders without crashing', () => {
    const tree = render(<BackButton />).toJSON();
    expect(tree).not.toBeNull();
  });

  it('renders a Pressable at the root', () => {
    const tree = render(<BackButton />).toJSON();
    expect(tree.type).toBe('Pressable');
  });

  it('has accessibility label "Go back"', () => {
    const tree = render(<BackButton />).toJSON();
    expect(tree.props.accessibilityLabel).toBe('Go back');
  });

  it('renders the ← chevron text inside', () => {
    const json = JSON.stringify(render(<BackButton />).toJSON());
    expect(json).toContain('←');
  });

  it('calls a custom onPress prop when pressed', () => {
    const onPress = jest.fn();
    const tree = render(<BackButton onPress={onPress} />).toJSON();
    act(() => { tree.props.onPress(); });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('calls nav.goBack() when nav.canGoBack is true', () => {
    _nav.canGoBack = true;
    const tree = render(<BackButton />).toJSON();
    act(() => { tree.props.onPress(); });
    expect(_nav.calls.goBack).toBe(1);
  });

  it('falls back to router when nav cannot go back', () => {
    _nav.canGoBack = false;
    _router.canGoBack = false;
    const tree = render(<BackButton />).toJSON();
    act(() => { tree.props.onPress(); });
    expect(_router.calls.replace.length + _router.calls.push.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// StepsWidget
// ===========================================================================
describe('<StepsWidget />', () => {
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  beforeEach(() => {
    _store.stepsByDate = {};
    require('react-native').Platform.OS = 'ios';
  });

  it('renders without crashing when steps are 0', () => {
    const tree = render(<StepsWidget />).toJSON();
    expect(tree).not.toBeNull();
  });

  it('renders the steps count from the Redux store', () => {
    _store.stepsByDate = { [today]: 4321 };
    const json = JSON.stringify(render(<StepsWidget />).toJSON());
    expect(json).toContain('4,321');
  });

  it('renders "0" when no steps recorded for today', () => {
    _store.stepsByDate = {};
    const json = JSON.stringify(render(<StepsWidget />).toJSON());
    expect(json).toContain('0');
  });

  it('renders the 👟 icon', () => {
    const json = JSON.stringify(render(<StepsWidget />).toJSON());
    expect(json).toContain('👟');
  });

  it('renders null on web platform', () => {
    require('react-native').Platform.OS = 'web';
    const tree = render(<StepsWidget />).toJSON();
    expect(tree).toBeNull();
  });

  it('applies a custom style prop to the outer gradient', () => {
    const tree = render(<StepsWidget style={{ marginTop: 0 }} />).toJSON();
    const styleArr = [].concat(tree.props.style ?? []);
    const flat = Object.assign({}, ...styleArr.map((s: any) => s ?? {}));
    expect(flat.marginTop).toBe(0);
  });
});


