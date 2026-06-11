import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

export default function TitleSelectorModal({ visible, onClose }) {
  const dispatch = useDispatch();
  const unlockedTitles = useSelector((s) => s.user?.unlockedTitles || []);
  const selectedTitle = useSelector((s) => s.user?.selectedTitle);
  const [localSelection, setLocalSelection] = useState(selectedTitle);

  const sortedTitles = useMemo(
    () => [...(Array.isArray(unlockedTitles) ? unlockedTitles : [])].sort(
      (a, b) => (a.id || '').localeCompare(b.id || '')
    ),
    [unlockedTitles]
  );

  const handleSelect = useCallback((titleId) => {
    setLocalSelection(titleId);
  }, []);

  const handleConfirm = useCallback(() => {
    if (localSelection && dispatch) {
      dispatch({ type: 'user/selectTitle', payload: localSelection });
    }
    onClose();
  }, [localSelection, dispatch, onClose]);

  const handleClear = useCallback(() => {
    setLocalSelection(null);
    if (dispatch) {
      dispatch({ type: 'user/selectTitle', payload: null });
    }
    onClose();
  }, [dispatch, onClose]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <LinearGradient
          colors={['#0B1120', '#1B2339', '#3A3D53']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.container}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Select Display Title</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
            {sortedTitles.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🎖️</Text>
                <Text style={styles.emptyText}>No titles unlocked yet</Text>
              </View>
            ) : (
              sortedTitles.map((titleItem) => (
                <Pressable
                  key={titleItem.id}
                  onPress={() => handleSelect(titleItem.id)}
                  style={[
                    styles.titleOption,
                    localSelection === titleItem.id && styles.titleOptionSelected,
                  ]}
                >
                  <LinearGradient
                    colors={
                      localSelection === titleItem.id
                        ? ['#12D9FF', '#7F00FF']
                        : ['rgba(18,217,255,0.08)', 'rgba(127,0,255,0.04)']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.titleGradient}
                  >
                    <View style={styles.titleContent}>
                      <Text style={styles.titleText}>{titleItem.title}</Text>
                      {localSelection === titleItem.id && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </View>
                  </LinearGradient>
                </Pressable>
              ))
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={handleClear} style={styles.clearButton}>
              <Text style={styles.buttonText}>Clear Selection</Text>
            </Pressable>
            <Pressable onPress={handleConfirm} style={styles.confirmButton}>
              <LinearGradient
                colors={['#12D9FF', '#7F00FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.confirmButtonGradient}
              >
                <Text style={styles.confirmButtonText}>Apply</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(18,217,255,0.1)',
  },
  title: {
    color: '#12D9FF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(18,217,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#12D9FF',
    fontSize: 18,
    fontWeight: '700',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    color: '#A7B5CD',
    fontSize: 14,
  },
  titleOption: {
    overflow: 'hidden',
    borderRadius: 12,
  },
  titleOptionSelected: {
    borderWidth: 2,
    borderColor: '#12D9FF',
  },
  titleGradient: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(18,217,255,0.16)',
  },
  titleContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleText: {
    color: '#F8FBFF',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  checkmark: {
    color: '#12D9FF',
    fontSize: 18,
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(18,217,255,0.2)',
    alignItems: 'center',
  },
  buttonText: {
    color: '#CFF7FF',
    fontSize: 13,
    fontWeight: '700',
  },
  confirmButton: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  confirmButtonGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#0B1120',
    fontSize: 13,
    fontWeight: '800',
  },
});
