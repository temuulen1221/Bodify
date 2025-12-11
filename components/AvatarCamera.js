import { CameraView, useCameraPermissions } from 'expo-camera';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const AvatarCamera = ({ onCapture }, ref) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [open, setOpen] = useState(false);
  const cameraRef = useRef(null);

  useEffect(() => {
    if (!permission || permission.granted) return;
    // Auto-request permission when first opened
    if (open) requestPermission();
  }, [open, permission, requestPermission]);

  const takePhoto = async () => {
    try {
      if (!cameraRef.current) return;
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, skipProcessing: true });
      onCapture?.(photo?.uri);
      setOpen(false);
    } catch (e) {
      console.warn('Failed to take photo', e);
    }
  };

  // Expose imperative methods for parent components (e.g., Retake button)
  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
  }));

  return (
    <>
      <TouchableOpacity style={styles.fab} onPress={() => setOpen(true)}>
        <Text style={styles.fabIcon}>📷</Text>
      </TouchableOpacity>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        {!permission || !permission.granted ? (
          <View style={styles.permissionFSWrap}>
            <Text style={styles.permissionFSText}>Camera permission needed</Text>
            <TouchableOpacity style={styles.permFSBtn} onPress={requestPermission}>
              <Text style={styles.permFSBtnText}>Allow</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.permFSBtn, { backgroundColor: '#999' }]} onPress={() => setOpen(false)}>
              <Text style={styles.permFSBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.fullscreen}>
            <CameraView ref={cameraRef} style={styles.fullCam} facing="front" enableTorch={false} />
            <View style={styles.fsTopBar}>
              <TouchableOpacity style={styles.fsTopBtn} onPress={() => setOpen(false)}>
                <Text style={styles.fsTopText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.fsBottomBar}>
              <TouchableOpacity style={styles.shutter} onPress={takePhoto}>
                <View style={styles.shutterInner} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: { color: '#fff', fontSize: 16 },
  fullscreen: { flex: 1, backgroundColor: '#000' },
  fullCam: { flex: 1 },
  fsTopBar: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fsTopBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsTopText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  fsBottomBar: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  permissionFSWrap: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24 },
  permissionFSText: { color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 12 },
  permFSBtn: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#4F8EF7', borderRadius: 10, marginVertical: 6 },
  permFSBtnText: { color: '#fff', fontWeight: '700' },
});

export default forwardRef(AvatarCamera);
