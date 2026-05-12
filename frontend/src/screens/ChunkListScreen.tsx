import React, { useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  Alert, 
  Modal, 
  TextInput,
  Button,
  ActivityIndicator
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { TimeChunk } from '../types';
import { ApiClient } from '../api/client';
import { theme } from '../styles/theme';
import { NoiseBackground } from '../components/NoiseBackground';
import { format, parseISO, addHours, startOfHour } from 'date-fns';
import { Swipeable } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

type Props = NativeStackScreenProps<RootStackParamList, 'ChunkList'>;

export const ChunkListScreen: React.FC<Props> = ({ navigation }) => {
  const [chunks, setChunks] = React.useState<TimeChunk[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [modalVisible, setModalVisible] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState('');
  const [startTime, setStartTime] = React.useState(format(startOfHour(new Date()), "yyyy-MM-dd'T'HH:mm:ss'Z'"));
  const [endTime, setEndTime] = React.useState(format(addHours(startOfHour(new Date()), 2), "yyyy-MM-dd'T'HH:mm:ss'Z'"));

  const apiClient = React.useMemo(() => new ApiClient('http://localhost:8080', 'user_1'), []);

  useEffect(() => {
    loadChunks();
  }, []);

  const loadChunks = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getChunks();
      setChunks(data);
    } catch (error) {
      console.error('Failed to load chunks:', error);
      Alert.alert('Error', 'Failed to load your schedules.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }
    try {
      const newChunk = await apiClient.createChunk({
        title: newTitle,
        start_time: startTime,
        end_time: endTime,
      });
      setChunks([...chunks, newChunk]);
      setModalVisible(false);
      setNewTitle('');
      navigation.navigate('ChunkEditor', { chunk: newChunk });
    } catch (error) {
      Alert.alert('Error', 'Failed to create schedule');
    }
  };

  const handleDelete = async (chunkId: string) => {
    try {
      await apiClient.deleteChunk(chunkId);
      setChunks(chunks.filter(c => c.chunk_id !== chunkId));
    } catch (error) {
      Alert.alert('Error', 'Failed to delete schedule');
    }
  };

  const renderRightActions = (chunkId: string) => (
    <TouchableOpacity 
      style={styles.deleteAction}
      onPress={() => handleDelete(chunkId)}
    >
      <Text style={styles.deleteActionText}>DELETE</Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: TimeChunk }) => {
    const start = parseISO(item.start_time);
    const end = parseISO(item.end_time);

    return (
      <Swipeable renderRightActions={() => renderRightActions(item.chunk_id)}>
        <TouchableOpacity 
          style={styles.chunkCard}
          onPress={() => navigation.navigate('ChunkEditor', { chunk: item })}
        >
          <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.cardContent}>
            <View>
              <Text style={styles.chunkTitle}>{item.title.toUpperCase()}</Text>
              <Text style={styles.chunkTime}>
                {format(start, 'HH:mm')} — {format(end, 'HH:mm')}
              </Text>
            </View>
            <Text style={styles.taskCount}>{item.tasks.length} INSTRUMENTS</Text>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <View style={styles.container}>
      <NoiseBackground />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>CHRONOS</Text>
        <Text style={styles.headerSubtitle}>TIMEBLOCK INSTRUMENTATION</Text>
      </View>
      <FlatList
        data={chunks}
        renderItem={renderItem}
        keyExtractor={(item) => item.chunk_id}
        contentContainerStyle={styles.listContent}
        onRefresh={loadChunks}
        refreshing={loading}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No active schedules.</Text>
            </View>
          ) : null
        }
      />
      
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <LinearGradient
          colors={theme.colors.thermal.glow}
          style={styles.fabGradient}
        >
          <Text style={styles.fabText}>+</Text>
        </LinearGradient>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={40} tint="dark" style={styles.modalContent}>
            <Text style={styles.modalTitle}>INITIALIZE SCHEDULE</Text>
            <TextInput
              style={styles.input}
              placeholder="System Designation"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>ABORT</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
                <Text style={styles.createBtnText}>INITIALIZE</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: theme.spacing.m,
    paddingBottom: theme.spacing.l,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  headerTitle: {
    fontFamily: theme.typography.h1.fontFamily,
    fontSize: 32,
    color: theme.colors.text,
    letterSpacing: 4,
  },
  headerSubtitle: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 10,
    color: theme.colors.thermal.core,
    letterSpacing: 2,
    marginTop: 4,
  },
  listContent: {
    padding: theme.spacing.m,
  },
  chunkCard: {
    height: 100,
    backgroundColor: theme.colors.glass.base,
    borderRadius: 12,
    marginBottom: theme.spacing.m,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.glass.border,
  },
  cardContent: {
    flex: 1,
    padding: theme.spacing.m,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  chunkTitle: {
    fontFamily: theme.typography.h2.fontFamily,
    fontSize: 16,
    color: theme.colors.text,
    letterSpacing: 1,
  },
  chunkTime: {
    fontFamily: theme.typography.body.fontFamily,
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  taskCount: {
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 10,
    fontWeight: 'bold',
    color: theme.colors.thermal.core,
    letterSpacing: 1,
  },
  deleteAction: {
    backgroundColor: theme.colors.error,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 30,
    height: 100,
    borderRadius: 12,
    marginBottom: theme.spacing.m,
  },
  deleteActionText: {
    color: '#fff',
    fontFamily: theme.typography.h2.fontFamily,
    fontSize: 12,
    letterSpacing: 1,
  },
  emptyState: {
    marginTop: 100,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.body.fontFamily,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: theme.colors.thermal.core,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  fabGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabText: {
    color: '#fff',
    fontSize: 32,
    fontFamily: theme.typography.h1.fontFamily,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: theme.colors.glass.border,
    overflow: 'hidden',
  },
  modalTitle: {
    fontFamily: theme.typography.h2.fontFamily,
    fontSize: 18,
    color: theme.colors.text,
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: 2,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    fontFamily: theme.typography.body.fontFamily,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.colors.glass.border,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelBtn: {
    padding: 16,
  },
  cancelBtnText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.h2.fontFamily,
    letterSpacing: 1,
  },
  createBtn: {
    backgroundColor: theme.colors.thermal.core,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
  },
  createBtnText: {
    color: '#FFF',
    fontFamily: theme.typography.h2.fontFamily,
    letterSpacing: 1,
  }
});
