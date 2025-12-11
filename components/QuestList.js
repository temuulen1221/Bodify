import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { currentUserId, db } from '../services/firebase'; // Adjust path

const QuestList = () => {
  const [quests, setQuests] = useState([]);
  const [stepCount, setStepCount] = useState(0);
  const [distance, setDistance] = useState(0);
  const [prevLocation, setPrevLocation] = useState(null);

  useEffect(() => {
    if (!currentUserId) return; // Wait for user auth

    const questsRef = doc(db, 'users', currentUserId, 'quests', 'questList');

    // Load initial quests
    const loadQuests = async () => {
      const docSnap = await getDoc(questsRef);
      if (docSnap.exists()) {
        setQuests(docSnap.data().quests || []);
      } else {
        const initialQuests = [
          { id: '1', title: 'Run 5km', type: 'daily', completed: false, target: 5000, unit: 'meters' },
          { id: '2', title: 'Do 50 Push-ups', type: 'daily', completed: false, target: 50, unit: 'count' },
          { id: '3', title: 'Walk 10k Steps', type: 'weekly', completed: false, target: 10000, unit: 'steps' },
          { id: '4', title: 'Yoga 30 mins', type: 'weekly', completed: false, target: 30, unit: 'minutes' },
          { id: '5', title: 'Cycle 15km', type: 'weekly', completed: false, target: 15000, unit: 'meters' },
        ];
        await setDoc(questsRef, { quests: initialQuests });
        setQuests(initialQuests);
      }
    };
    loadQuests();

    // Real-time updates
    const unsubscribe = onSnapshot(questsRef, (docSnap) => {
      if (docSnap.exists()) {
        setQuests(docSnap.data().quests || []);
      }
    });

    // Sensor setup
    let pedometerSubscription, locationSubscription;
    const startSensors = async () => {
      const isPedometerAvailable = await Pedometer.isAvailableAsync();
      if (isPedometerAvailable) {
        pedometerSubscription = Pedometer.watchStepCount((data) => {
          setStepCount(data.steps);
          checkQuestCompletion(data.steps, '3');
        });
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        locationSubscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
          (newLocation) => {
            const total = calculateDistance(newLocation.coords);
            checkQuestCompletion(total, '1');
          }
        );
      }
    };
  startSensors();

  return () => {
      unsubscribe();
      pedometerSubscription && pedometerSubscription.remove();
      locationSubscription && locationSubscription.remove();
    };
    // NOTE: calculateDistance and checkQuestCompletion are stable helpers defined below; add an
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const calculateDistance = (newCoords) => {
    if (prevLocation && newCoords) {
      const newDistance = getDistanceFromLatLonInMeters(
        prevLocation.latitude, prevLocation.longitude,
        newCoords.latitude, newCoords.longitude
      );
      let nextTotal;
      setDistance((prev) => {
        nextTotal = prev + newDistance;
        return nextTotal;
      });
      setPrevLocation(newCoords);
      return (nextTotal ?? 0);
    } else {
      setPrevLocation(newCoords);
      return distance;
    }
  };

  const getDistanceFromLatLonInMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const deg2rad = (deg) => deg * (Math.PI / 180);

  const checkQuestCompletion = (value, questId) => {
    const quest = quests.find(q => q.id === questId);
    if (quest && !quest.completed && value >= quest.target) {
      toggleQuestCompletion(questId);
    }
  };

  const toggleQuestCompletion = async (questId) => {
    if (!currentUserId) return;
    const questsRef = doc(db, 'users', currentUserId, 'quests', 'questList');
    const updatedQuests = quests.map(quest =>
      quest.id === questId ? { ...quest, completed: !quest.completed } : quest
    );
    await setDoc(questsRef, { quests: updatedQuests });
    setQuests(updatedQuests);
    console.log(`Quest ${questId} marked as ${quests.find(q => q.id === questId).completed ? 'completed' : 'incomplete'}`);
  };

  const renderQuest = ({ item }) => (
    <TouchableOpacity onPress={() => toggleQuestCompletion(item.id)}>
      <View style={styles.questItem}>
        <Text style={styles.questTitle}>{item.title}</Text>
        <Text style={styles.questType}>{item.type}</Text>
        {item.unit === 'steps' && <Text>Steps: {stepCount}</Text>}
        {item.unit === 'meters' && <Text>Distance: {Math.round(distance / 1000)}km</Text>}
        <Text style={[styles.status, { color: item.completed ? 'green' : 'gray' }]}>
          {item.completed ? '✓ Completed' : `○ ${item.target} ${item.unit}`}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your Quests</Text>
      <FlatList
        data={quests}
        renderItem={renderQuest}
        keyExtractor={(item) => item.id}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 10, padding: 10 },
  header: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  questItem: { padding: 10, borderBottomWidth: 1, borderColor: '#ccc', flexDirection: 'row', justifyContent: 'space-between' },
  questTitle: { fontSize: 16 },
  questType: { fontSize: 12, color: '#666' },
  status: { fontSize: 12 },
});

export default QuestList;