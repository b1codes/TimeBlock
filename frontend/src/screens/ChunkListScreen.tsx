import React, { useEffect, useState, useMemo } from 'react';
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

type Props = NativeStackScreenProps<RootStackParamList, 'ChunkList'>;

export const ChunkListScreen: React.FC<Props> = ({ navigation }) => {
  const [chunks, setChunks] = useState<TimeChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [startTime, setStartTime] = useState(format(startOfHour(new Date()), "yyyy-MM-dd'T'HH:mm:ss'Z'"));
  const [endTime, setEndTime] = useState(format(addHours(startOfHour(new Date()), 2), "yyyy-MM-dd'T'HH:mm:ss'Z'"));

  const apiClient = useMemo(() => new ApiClient('http://localhost:8000', 'user_1'), []);

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
      <Text style={styles.deleteActionText}>Delete</Text>
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
          <View>
            <Text style={styles.chunkTitle}>{item.title}</Text>
            <Text style={styles.chunkTime}>
              {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
            </Text>
          </View>
          <Text style={styles.taskCount}>{item.tasks.length} tasks</Text>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <View style={styles.container}>
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
              <Text style={styles.emptyText}>No schedules yet. Create one!</Text>
            </View>
          ) : null
        }
      />
      
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Schedule</Text>
            <TextInput
              style={styles.input}
              placeholder="Title (e.g., Morning Routine)"
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder="Start Time (ISO)"
              value={startTime}
              onChangeText={setStartTime}
            />
            <TextInput
              style={styles.input}
              placeholder="End Time (ISO)"
              value={endTime}
              onChangeText={setEndTime}
            />
            <View style={styles.modalButtons}>
              <Button title="Cancel" color={theme.colors.error} onPress={() => setModalVisible(false)} />
              <Button title="Create" onPress={handleCreate} />
            </View>
          </View>
        </View>
      </Modal>

      <NoiseBackground />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContent: {
    padding: theme.spacing.m,
  },
  chunkCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.m,
    borderRadius: 12,
    marginBottom: theme.spacing.m,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  chunkTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  chunkTime: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  taskCount: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  deleteAction: {
    backgroundColor: theme.colors.error,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    height: 70, // Matches card height approx
    borderRadius: 12,
    marginBottom: theme.spacing.m,
    marginLeft: -10,
  },
  deleteActionText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyState: {
    marginTop: 100,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabText: {
    color: '#fff',
    fontSize: 32,
    lineHeight: 32,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  }
});
