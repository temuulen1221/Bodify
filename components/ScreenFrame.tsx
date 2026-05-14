import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

const HOME_FRAME_WIDTH = 414;
const HOME_FRAME_HEIGHT = 896;

type ScreenFrameProps = {
  children: ReactNode;
  backgroundColor?: string;
  shadow?: boolean;
};

export default function ScreenFrame({ children, backgroundColor = 'transparent', shadow = true }: ScreenFrameProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  if (Platform.OS !== 'web') {
    return <View style={[styles.nativeRoot, { backgroundColor }]}>{children}</View>;
  }

  const frameWidth = Math.min(windowWidth, HOME_FRAME_WIDTH);
  const frameHeight = Math.min(windowHeight, HOME_FRAME_HEIGHT);
  const framedViewport = windowWidth > frameWidth + 40 || windowHeight > frameHeight + 40;

  return (
    <View style={styles.webRoot}>
      <View
        style={[
          styles.frame,
          { width: frameWidth, height: frameHeight, backgroundColor },
          framedViewport && shadow && styles.frameDesktop,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nativeRoot: {
    flex: 1,
  },
  webRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    overflow: 'hidden',
  },
  frameDesktop: {
    borderRadius: 28,
    boxShadow: '0px 22px 54px rgba(7, 10, 24, 0.34)',
  },
});