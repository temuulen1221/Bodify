import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../services/firebase';

export type BattleFriend = {
  id: string;
  name: string;
  pushups: number;
  plankSec: number;
  tag: string;
  avatar?: string;
  points?: number;
};

// Local fallback used when Firestore is unavailable or returns no data.
export const fallbackFriends: BattleFriend[] = [
  { id: 'f1', name: 'Alice', pushups: 26, plankSec: 55, tag: 'Agile', avatar: 'https://i.pravatar.cc/150?img=47', points: 1200 },
  { id: 'f2', name: 'Bob', pushups: 28, plankSec: 42, tag: 'Bruiser', avatar: 'https://i.pravatar.cc/150?img=12', points: 1100 },
  { id: 'f3', name: 'Charlie', pushups: 18, plankSec: 70, tag: 'Tank', avatar: 'https://i.pravatar.cc/150?img=32', points: 950 },
  { id: 'f4', name: 'Dana', pushups: 32, plankSec: 60, tag: 'Sweat Pro', avatar: 'https://i.pravatar.cc/150?img=15', points: 900 },
  { id: 'f5', name: 'Evan', pushups: 24, plankSec: 50, tag: 'Balanced', avatar: 'https://i.pravatar.cc/150?img=23', points: 880 },
  { id: 'f6', name: 'Farah', pushups: 22, plankSec: 65, tag: 'Endurance', avatar: 'https://i.pravatar.cc/150?img=9', points: 860 },
  { id: 'f7', name: 'Gabe', pushups: 30, plankSec: 48, tag: 'Power', avatar: 'https://i.pravatar.cc/150?img=41', points: 840 },
  { id: 'f8', name: 'Sam', pushups: 20, plankSec: 58, tag: 'Steady', avatar: 'https://i.pravatar.cc/150?img=45', points: 820 },
];

export async function fetchFriendsForBattle(): Promise<BattleFriend[]> {
  try {
    const q = query(collection(db, 'friends'), limit(20));
    const snap = await getDocs(q);
    const items: BattleFriend[] = [];
    snap.forEach((doc) => {
      const data: any = doc.data();
      if (!data) return;
      items.push({
        id: doc.id,
        name: data.name || 'Friend',
        pushups: Number(data.pushups) || 0,
        plankSec: Number(data.plankSec) || 0,
        tag: data.tag || 'Friend',
        avatar: data.avatar || undefined,
        points: Number(data.points) || undefined,
      });
    });
    if (items.length === 0) return fallbackFriends;
    return items;
  } catch (err) {
    console.warn('[friends] fetchFriendsForBattle failed', err);
    return fallbackFriends;
  }
}

export async function fetchFriendsForLeaderboard(): Promise<BattleFriend[]> {
  try {
    const q = query(collection(db, 'friends'), limit(50));
    const snap = await getDocs(q);
    const items: BattleFriend[] = [];
    snap.forEach((doc) => {
      const data: any = doc.data();
      if (!data) return;
      items.push({
        id: doc.id,
        name: data.name || 'Friend',
        pushups: Number(data.pushups) || 0,
        plankSec: Number(data.plankSec) || 0,
        tag: data.tag || 'Friend',
        avatar: data.avatar || undefined,
        points: Number(data.points) || 0,
      });
    });
    if (!items.length) return fallbackFriends;
    return items;
  } catch (err) {
    console.warn('[friends] fetchFriendsForLeaderboard failed', err);
    return fallbackFriends;
  }
}
