import { LinearGradient } from 'expo-linear-gradient';
import { Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import BackButton from '../components/BackButton';
import { addOwnedShopItem, consumeDiscountTicket, spendEnergy } from '../store';

const ITEMS = [
  // Avatar > Clothes
  { id: 'a1', name: 'Cyber Jacket', price: 80, icon: require('../assets/icons/home_icon.png'), category: 'Avatar', sub: 'Clothes' },
  { id: 'a2', name: 'Neon Sneakers', price: 60, icon: require('../assets/icons/shop/cyberpunk_sneakers.png'), category: 'Avatar', sub: 'Clothes' },
  // Avatar > Appearance
  { id: 'a3', name: 'Glowing Hair', price: 90, icon: require('../assets/icons/shop/neon_gray_hair.png'), category: 'Avatar', sub: 'Appearance' },
  // Avatar > Accessories
  { id: 'a4', name: 'Visor Glasses', price: 70, icon: require('../assets/icons/shop/neon_visor.png'), category: 'Avatar', sub: 'Accessories' },
  { id: 'a5', name: 'Badge: Achiever', price: 100, icon: require('../assets/icons/shop/badge.png'), category: 'Avatar', sub: 'Accessories' },
  // Other > Themes
  { id: 'o1', name: 'Cyberpunk Theme', price: 120, icon: require('../assets/icons/shop/cyberpunk_theme.png'), category: 'Other', sub: 'Themes' },
  // Other > Full Workout Course
  { id: 'o2', name: 'Full Workout Course', price: 200, icon: require('../assets/icons/workout_icon.png'), category: 'Other', sub: 'Full Workout Course' },
  // Other > Meditation
  { id: 'o3', name: 'Meditation Pack', price: 80, icon: require('../assets/icons/home_icon.png'), category: 'Other', sub: 'Meditation' },
];

import { useState } from 'react';

const MAIN_CATEGORIES = ['Avatar', 'Other'];
const SUB_CATEGORIES = {
  Avatar: ['Clothes', 'Appearance', 'Accessories'],
  Other: ['Themes', 'Full Workout Course', 'Meditation'],
};

export default function Shop() {
  const energy = useSelector((s) => s.user?.energy ?? 0);
  const discountTickets = useSelector((s) => s.user?.discountTickets ?? 0);
  const streakShields = useSelector((s) => s.user?.streakShields ?? 0);
  const ownedShopItems = useSelector((s) => s.user?.ownedShopItems ?? []);
  const dispatch = useDispatch();
  const [mainCat, setMainCat] = useState('Avatar');
  const [subCat, setSubCat] = useState(SUB_CATEGORIES['Avatar'][0]);
  const [ticketItemId, setTicketItemId] = useState(null);

  const isOwned = (itemId) => Array.isArray(ownedShopItems) && ownedShopItems.includes(itemId);
  const getItemPrice = (item) => {
    const basePrice = Math.max(0, Number(item?.price) || 0);
    if (ticketItemId === item?.id && discountTickets > 0) {
      return Math.max(1, Math.floor(basePrice * 0.75));
    }
    return basePrice;
  };

  const handleBuy = (item) => {
    if (isOwned(item.id)) {
      Alert.alert('Already owned', `${item.name} is already unlocked.`);
      return;
    }
    const price = getItemPrice(item);
    if (energy < price) {
      Alert.alert('Not enough energy', `You need ${price} energy to buy ${item.name}.`);
      return;
    }
    if (ticketItemId === item.id && discountTickets > 0) {
      dispatch(consumeDiscountTicket());
      setTicketItemId(null);
    }
    dispatch(spendEnergy(price));
    dispatch(addOwnedShopItem(item.id));
    Alert.alert('Purchase successful', `You bought ${item.name} for ${price} energy!`);
  };

  // Filter items by selected category/subcategory
  const filteredItems = ITEMS.filter(
    (item) => item.category === mainCat && item.sub === subCat
  );

  return (
    <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={styles.container}>
      <View style={{ alignSelf: 'flex-start', marginBottom: 12 }}>
        <BackButton />
      </View>
      <Text style={styles.title}>Shop</Text>
      <View style={styles.pointsRow}>
        <Text style={styles.pointsLabel}>Your Energy:</Text>
        <Text style={styles.pointsValue}>{energy}</Text>
      </View>
      <Text style={styles.energyHint}>Earn energy when you level up, then spend it here.</Text>
      <View style={styles.inventoryRow}>
        <View style={styles.inventoryChip}><Text style={styles.inventoryChipText}>{`${discountTickets} ticket${discountTickets === 1 ? '' : 's'}`}</Text></View>
        <View style={styles.inventoryChip}><Text style={styles.inventoryChipText}>{`${streakShields} shield${streakShields === 1 ? '' : 's'}`}</Text></View>
        <View style={styles.inventoryChip}><Text style={styles.inventoryChipText}>{`${Array.isArray(ownedShopItems) ? ownedShopItems.length : 0} owned`}</Text></View>
      </View>
      {/* Main category neon tab bar */}
      <View style={styles.tabBar}>
        {MAIN_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.tabBtn, mainCat === cat && styles.tabBtnActive]}
            onPress={() => {
              setMainCat(cat);
              setSubCat(SUB_CATEGORIES[cat][0]);
            }}
          >
            <Text style={[styles.tabBtnText, mainCat === cat && styles.tabBtnTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {/* Subcategory dropdown */}
      <View style={styles.subBar}>
        {SUB_CATEGORIES[mainCat].map((sub) => (
          <TouchableOpacity
            key={sub}
            style={[styles.subBtn, subCat === sub && styles.subBtnActive]}
            onPress={() => setSubCat(sub)}
          >
            <Text style={[styles.subBtnText, subCat === sub && styles.subBtnTextActive]}>{sub}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>No items in this category.</Text>}
        renderItem={({ item }) => (
          <LinearGradient colors={['#00eaff', '#7f00ff']} style={styles.itemCard} start={{x:0,y:0}} end={{x:1,y:1}}>
            <View style={styles.itemInnerCard}>
              <View style={styles.iconCube}>
                <Image source={item.icon} style={styles.itemIcon} />
              </View>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>{`${getItemPrice(item)} energy${ticketItemId === item.id && discountTickets > 0 ? ' with ticket' : ''}`}</Text>
              {isOwned(item.id) ? <Text style={styles.ownedText}>Milestone unlocked</Text> : null}
              {!isOwned(item.id) && discountTickets > 0 ? (
                <TouchableOpacity
                  style={[styles.ticketBtn, ticketItemId === item.id && styles.ticketBtnActive]}
                  onPress={() => setTicketItemId((current) => current === item.id ? null : item.id)}
                >
                  <Text style={[styles.ticketBtnText, ticketItemId === item.id && styles.ticketBtnTextActive]}>{ticketItemId === item.id ? 'Ticket applied' : 'Use ticket -25%'}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[styles.buyBtn, (energy < getItemPrice(item) || isOwned(item.id)) && styles.buyBtnDisabled]}
                onPress={() => handleBuy(item)}
                disabled={energy < getItemPrice(item) || isOwned(item.id)}
              >
                <Text style={styles.buyBtnText}>{isOwned(item.id) ? 'Owned' : energy < getItemPrice(item) ? 'Not enough' : 'Buy'}</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        )}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 32,
    paddingHorizontal: 8,
  },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: '#00eaff',
      marginBottom: 8,
      textAlign: 'center',
      boxShadow: '0px 2px 12px #7f00ff',
      letterSpacing: 1.5,
    },
    pointsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
      backgroundColor: 'rgba(0,231,255,0.08)',
      borderRadius: 12,
      padding: 8,
      borderWidth: 1,
      boxShadow: '0px 2px 12px #7f00ff',
    },
    pointsLabel: {
      fontWeight: '700',
      boxShadow: '0px 1px 6px #7f00ff',
    },
    pointsValue: {
      fontSize: 22,
      boxShadow: '0px 1px 8px #00eaff',
      justifyContent: 'center',
      marginBottom: 8,
    },
    energyHint: {
      color: '#CFF7FF',
      textAlign: 'center',
      marginBottom: 14,
      fontSize: 13,
      fontWeight: '600',
    },
    inventoryRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 14,
    },
    inventoryChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.07)',
      borderWidth: 1,
      borderColor: 'rgba(0,231,255,0.22)',
    },
    inventoryChipText: {
      color: '#DDF9FF',
      fontSize: 12,
      fontWeight: '700',
    },
    tabBar: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: 8,
      marginTop: 2,
      gap: 12,
    },
    tabBtn: {
      paddingHorizontal: 18,
      borderWidth: 1,
      borderColor: '#00eaff',
      boxShadow: '0px 1px 6px #00eaff',
    },
    tabBtnText: {
      color: '#00eaff',
      boxShadow: '0px 0px 12px #00eaff2D',
    },
    tabBtnTextActive: {
      color: '#fff',
      boxShadow: '0px 0px 16px #0ffCC',
      marginBottom: 8,
    },
    subBar: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: 8,
      gap: 8,
    },
    subBtn: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: 'rgba(127,0,255,0.08)',
      borderWidth: 1,
      borderColor: '#7f00ff',
    },
    subBtnActive: {
      backgroundColor: '#00eaff',
      borderColor: '#7f00ff',
      boxShadow: '0px 0px 8px #7f00ff2D',
    },
    subBtnText: {
      color: '#7f00ff',
      fontWeight: '700',
      fontSize: 15,
      letterSpacing: 1.1,
    },
    subBtnTextActive: {
      color: '#fff',
      boxShadow: '0px 1px 6px #00eaff',
    },
    list: {
      paddingBottom: 32,
    },
    emptyText: {
      color: '#fff',
      fontSize: 16,
      textAlign: 'center',
      marginTop: 32,
      fontWeight: '700',
      boxShadow: '0px 1px 6px #00eaff',
    },
    itemCard: {
      flex: 1,
      borderRadius: 18,
      margin: 8,
      padding: 2,
      boxShadow: '0px 0px 12px #00eaff2D',
      elevation: 4,
      borderWidth: 2,
      borderColor: 'rgba(127,0,255,0.18)',
    },
    itemInnerCard: {
      backgroundColor: 'rgba(20,20,40,0.95)',
      borderRadius: 14,
      alignItems: 'center',
      padding: 16,
      minHeight: 180,
    },
    iconCube: {
      width: 64,
      height: 64,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 10,
      borderRadius: 14,
      backgroundColor: 'rgba(30,30,40,0.7)',
      borderWidth: 2,
      borderColor: '#0ff',
      boxShadow: '0px 0px 16px #0ffCC',
      elevation: 12,
    },
    itemIcon: {
      width: 40,
      height: 40,
      resizeMode: 'contain',
      backgroundColor: 'transparent',
    },
    itemName: {
      fontSize: 17,
      fontWeight: '700',
      color: '#00eaff',
      marginBottom: 4,
      textAlign: 'center',
      boxShadow: '0px 1px 8px #7f00ff',
      letterSpacing: 1.1,
    },
    itemPrice: {
      fontSize: 15,
      color: '#fff',
      marginBottom: 10,
      fontWeight: '600',
      boxShadow: '0px 1px 6px #00eaff',
    },
    ownedText: {
      color: '#86EFAC',
      fontSize: 12,
      fontWeight: '800',
      marginBottom: 8,
    },
    ticketBtn: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginBottom: 8,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(0,231,255,0.18)',
    },
    ticketBtnActive: {
      backgroundColor: 'rgba(0,231,255,0.22)',
      borderColor: '#00eaff',
    },
    ticketBtnText: {
      color: '#CFF7FF',
      fontSize: 12,
      fontWeight: '700',
    },
    ticketBtnTextActive: {
      color: '#fff',
    },
    buyBtn: {
      backgroundColor: '#7f00ff',
      borderRadius: 8,
      paddingHorizontal: 18,
      paddingVertical: 8,
      marginTop: 2,
      boxShadow: '0px 2px 8px #00eaff',
      borderWidth: 1,
      borderColor: '#00eaff',
    },
    buyBtnDisabled: {
      backgroundColor: '#333',
      borderColor: '#555',
    },
    buyBtnText: {
      color: '#00eaff',
      fontWeight: '700',
      fontSize: 15,
      boxShadow: '0px 1px 6px #7f00ff',
      letterSpacing: 1.1
    }
  });
