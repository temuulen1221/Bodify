import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import BackButton from '../components/BackButton';
import {
  generateMealPlan,
  getFoodJoke,
  getFoodNutrition,
  getFoodTrivia,
  getIngredientSubstitutes,
  getRandomRecipes,
  getRecipeDetails,
  getSimilarRecipes,
  searchFoods,
  searchRecipes,
  searchRecipesByIngredients,
} from '../services/diet';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type Category = 'foods' | 'recipes' | 'fridge' | 'mealplan' | 'random';

const CATEGORIES: { id: Category; label: string; icon: string; color: string }[] = [
  { id: 'foods',    label: 'Foods',     icon: 'nutrition',  color: '#3cffb3' },
  { id: 'recipes',  label: 'Recipes',   icon: 'restaurant', color: '#00eaff' },
  { id: 'fridge',   label: 'Fridge',    icon: 'basket',     color: '#a29bfe' },
  { id: 'mealplan', label: 'Meal Plan', icon: 'calendar',   color: '#ff9f43' },
  { id: 'random',   label: 'Random',    icon: 'shuffle',    color: '#ff6b9d' },
];

const CUISINES = [
  '', 'italian', 'mexican', 'indian', 'chinese', 'american',
  'french', 'japanese', 'thai', 'mediterranean', 'greek', 'spanish',
];
const DIETS  = ['', 'vegetarian', 'vegan', 'keto', 'paleo', 'gluten free', 'primal'];
const TIMES  = [0, 15, 30, 45, 60];
const IMG_ING = 'https://img.spoonacular.com/ingredients_100x100/';

// ---------------------------------------------------------------------------
// Small reusable components
// ---------------------------------------------------------------------------

function MacroPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[s.macroPill, { borderColor: color + '55', backgroundColor: color + '18' }]}>
      <Text style={[s.macroVal, { color }]}>{value}</Text>
      <Text style={s.macroLbl}>{label}</Text>
    </View>
  );
}

function FilterChips({
  values, selected, onSelect, labelFn, color,
}: {
  values: (string | number)[];
  selected: string | number;
  onSelect: (v: any) => void;
  labelFn?: (v: any) => string;
  color: string;
}) {
  const fmt = (v: string | number) =>
    labelFn ? labelFn(v) : v === '' || v === 0 ? 'Any' : String(v);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: 6, paddingVertical: 2 }}>
        {values.map((v) => {
          const active = v === selected;
          return (
            <TouchableOpacity
              key={String(v)}
              onPress={() => onSelect(v)}
              style={[s.chip, active && { borderColor: color, backgroundColor: color + '22' }]}
              activeOpacity={0.8}
            >
              <Text style={[s.chipText, active && { color }]}>{fmt(v)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function DietScreen() {
  // Shared search state
  const [category, setCategory]         = useState<Category>('foods');
  const [query,     setQuery]           = useState('');
  const [results,   setResults]         = useState<any[]>([]);
  const [loading,   setLoading]         = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [details,   setDetails]         = useState<any>(null);
  const [substitutes, setSubstitutes]   = useState<string[]>([]);
  const [similar,   setSimilar]         = useState<any[]>([]);
  const [error,     setError]           = useState('');

  // Recipe filter state
  const [recCuisine,   setRecCuisine]   = useState('');
  const [recDiet,      setRecDiet]      = useState('');
  const [recMaxTime,   setRecMaxTime]   = useState(0);
  const [showFilters,  setShowFilters]  = useState(false);

  // Fridge state
  const [fridgeInput,       setFridgeInput]       = useState('');
  const [fridgeIngredients, setFridgeIngredients] = useState<string[]>([]);

  // Meal plan state
  const [mpCalories,  setMpCalories]  = useState('2000');
  const [mpDiet,      setMpDiet]      = useState('');
  const [mpTimeFrame, setMpTimeFrame] = useState<'day' | 'week'>('day');

  // Random tab state (independent per card)
  const [rndRecipe,  setRndRecipe]  = useState<any>(null);
  const [rndTrivia,  setRndTrivia]  = useState('');
  const [rndJoke,    setRndJoke]    = useState('');
  const [rndLoading, setRndLoading] = useState<'recipe' | 'trivia' | 'joke' | null>(null);
  const [rndError,   setRndError]   = useState('');

  // ---- cleanup on unmount ----
  useEffect(() => {
    return () => {
      setCategory('foods');
      setQuery('');
      setResults([]);
      setSelectedItem(null);
      setDetails(null);
      setSubstitutes([]);
      setSimilar([]);
      setError('');
      setShowFilters(false);
      setFridgeInput('');
      setFridgeIngredients([]);
      setRecCuisine('');
      setRecDiet('');
      setRecMaxTime(0);
      setMpCalories('2000');
      setMpDiet('');
      setMpTimeFrame('day');
      setRndRecipe(null);
      setRndTrivia('');
      setRndJoke('');
      setRndLoading(null);
      setRndError('');
    };
  }, []);

  // ---- helpers ----

  const reset = () => {
    setResults([]);
    setSelectedItem(null);
    setDetails(null);
    setSubstitutes([]);
    setSimilar([]);
    setError('');
  };

  const changeCategory = (cat: Category) => {
    setCategory(cat);
    setQuery('');
    setResults([]);
    setSelectedItem(null);
    setDetails(null);
    setSubstitutes([]);
    setSimilar([]);
    setError('');
    setShowFilters(false);
    setFridgeInput('');
    setFridgeIngredients([]);
    setRndRecipe(null);
    setRndTrivia('');
    setRndJoke('');
  };

  const getNutrient = (nutrients: any[], name: string) => {
    const n = nutrients?.find((x: any) => x.name === name);
    return n ? `${Math.round(n.amount)}${n.unit || ''}` : '--';
  };

  // ---- search / fetch ----

  const handleSearch = async () => {
    if (loading) return;
    setLoading(true);
    reset();
    try {
      if (category === 'foods') {
        const d: any = await searchFoods(query);
        setResults(d.results || []);
      } else if (category === 'recipes') {
        const d: any = await searchRecipes(query, {
          cuisine:      recCuisine   || undefined,
          diet:         recDiet      || undefined,
          maxReadyTime: recMaxTime   || undefined,
        });
        setResults(d.results || []);
      } else if (category === 'fridge') {
        if (!fridgeIngredients.length) throw new Error('Add at least one ingredient first');
        const d: any = await searchRecipesByIngredients(fridgeIngredients.join(','));
        setResults(Array.isArray(d) ? d : []);
      } else if (category === 'mealplan') {
        const d: any = await generateMealPlan(mpTimeFrame, Number(mpCalories) || 2000, mpDiet);
        setResults(d.meals || []);
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItem = async (item: any) => {
    if (selectedItem?.id === item.id && details) {
      setSelectedItem(null);
      setDetails(null);
      setSubstitutes([]);
      setSimilar([]);
      return;
    }
    setSelectedItem(item);
    setDetails(null);
    setSubstitutes([]);
    setSimilar([]);
    setLoading(true);
    setError('');
    try {
      if (category === 'foods') {
        const [info, subs]: any[] = await Promise.allSettled([
          getFoodNutrition(item.id),
          getIngredientSubstitutes(item.id),
        ]).then(r => r.map((x: any) => (x.status === 'fulfilled' ? x.value : null)));
        setDetails(info);
        if (subs?.substitutes?.length) setSubstitutes(subs.substitutes);
      } else {
        // recipes, fridge, mealplan
        const [info, sim]: any[] = await Promise.allSettled([
          getRecipeDetails(item.id),
          getSimilarRecipes(item.id),
        ]).then(r => r.map((x: any) => (x.status === 'fulfilled' ? x.value : null)));
        setDetails(info);
        if (Array.isArray(sim)) setSimilar(sim);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  const addFridgeIngredient = () => {
    const val = fridgeInput.trim().toLowerCase();
    if (!val || fridgeIngredients.includes(val)) return;
    setFridgeIngredients(prev => [...prev, val]);
    setFridgeInput('');
  };

  const fetchRandom = async (type: 'recipe' | 'trivia' | 'joke') => {
    if (rndLoading) return;
    setRndLoading(type);
    setRndError('');
    try {
      if (type === 'recipe') {
        const d: any = await getRandomRecipes(1);
        setRndRecipe(d?.recipes?.[0] || null);
      } else if (type === 'trivia') {
        const d: any = await getFoodTrivia();
        setRndTrivia(d?.text || '');
      } else {
        const d: any = await getFoodJoke();
        setRndJoke(d?.text || '');
      }
    } catch (e: any) {
      setRndError(e.message || 'Request failed');
    } finally {
      setRndLoading(null);
    }
  };

  const needsQuery   = category === 'foods' || category === 'recipes';
  const catColor     = CATEGORIES.find(c => c.id === category)?.color ?? '#00eaff';
  const searchDisabled =
    loading ||
    (needsQuery && !query.trim()) ||
    (category === 'fridge' && fridgeIngredients.length === 0);

  // ---- detail renderers ----

  const renderFoodDetail = (det: any) => {
    const nutrients = det.nutrition?.nutrients || [];
    return (
      <View style={s.detailCard}>
        <Text style={s.detailName}>{det.name}</Text>
        <View style={s.macroRow}>
          <MacroPill label="kcal"    value={getNutrient(nutrients, 'Calories')}      color="#ff9f43" />
          <MacroPill label="protein" value={getNutrient(nutrients, 'Protein')}       color="#3cffb3" />
          <MacroPill label="carbs"   value={getNutrient(nutrients, 'Carbohydrates')} color="#00eaff" />
          <MacroPill label="fat"     value={getNutrient(nutrients, 'Fat')}           color="#a29bfe" />
        </View>
        {nutrients.slice(0, 12).map((n: any, i: number) => (
          <View key={i} style={s.nutrientRow}>
            <Text style={s.nutrientName}>{n.name}</Text>
            <Text style={s.nutrientVal}>{Math.round(n.amount)}{n.unit}</Text>
          </View>
        ))}
        {substitutes.length > 0 && (
          <>
            <Text style={s.section}>Substitutes</Text>
            {substitutes.map((sub, i) => (
              <Text key={i} style={s.listLine}>{'\u2022'} {sub}</Text>
            ))}
          </>
        )}
      </View>
    );
  };

  const renderRecipeDetail = (det: any) => {
    const ingredients = det.extendedIngredients || [];
    const steps       = det.analyzedInstructions?.[0]?.steps || [];
    return (
      <View style={s.detailCard}>
        {!!det.image && <Image source={{ uri: det.image }} style={s.recipeImage} resizeMode="cover" />}
        <Text style={s.detailName}>{det.title}</Text>
        <View style={s.metaRow}>
          {!!det.readyInMinutes && (
            <View style={s.metaChip}>
              <Ionicons name="time-outline" size={13} color="#00eaff" />
              <Text style={s.metaText}>{det.readyInMinutes} min</Text>
            </View>
          )}
          {!!det.servings && (
            <View style={s.metaChip}>
              <Ionicons name="people-outline" size={13} color="#00eaff" />
              <Text style={s.metaText}>{det.servings} servings</Text>
            </View>
          )}
          {!!det.healthScore && (
            <View style={s.metaChip}>
              <Ionicons name="heart-outline" size={13} color="#3cffb3" />
              <Text style={[s.metaText, { color: '#3cffb3' }]}>{Math.round(det.healthScore)}% healthy</Text>
            </View>
          )}
        </View>
        {ingredients.length > 0 && (
          <>
            <Text style={s.section}>Ingredients</Text>
            {ingredients.map((ing: any, i: number) => (
              <Text key={i} style={s.listLine}>{'\u00b7'} {ing.original}</Text>
            ))}
          </>
        )}
        {steps.length > 0 && (
          <>
            <Text style={s.section}>Instructions</Text>
            {steps.map((step: any, i: number) => (
              <View key={i} style={s.stepRow}>
                <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
                <Text style={s.stepText}>{step.step}</Text>
              </View>
            ))}
          </>
        )}
        {similar.length > 0 && (
          <>
            <Text style={s.section}>Similar Recipes</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                {similar.map((r: any) => (
                  <TouchableOpacity
                    key={r.id}
                    style={s.similarCard}
                    onPress={() => handleSelectItem(r)}
                    activeOpacity={0.8}
                  >
                    <Text style={s.similarTitle} numberOfLines={2}>{r.title}</Text>
                    {!!r.readyInMinutes && <Text style={s.similarMeta}>{r.readyInMinutes} min</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </>
        )}
      </View>
    );
  };

  // ---- list item renderer ----

  const renderItem = ({ item }: { item: any }) => {
    const isOpen = selectedItem?.id === item.id && !!details;

    if (category === 'foods') {
      const imgUri = item.image ? `${IMG_ING}${item.image}` : null;
      return (
        <View>
          <TouchableOpacity style={s.card} onPress={() => handleSelectItem(item)} activeOpacity={0.8}>
            <View style={s.cardRow}>
              {imgUri && <Image source={{ uri: imgUri }} style={s.thumbSm} />}
              <Text style={[s.cardTitle, { flex: 1 }]} numberOfLines={1}>{item.name}</Text>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#9feaff" />
            </View>
          </TouchableOpacity>
          {isOpen && loading && <ActivityIndicator style={s.itemLoader} color="#3cffb3" />}
          {isOpen && !loading && details && renderFoodDetail(details)}
        </View>
      );
    }

    if (category === 'fridge') {
      return (
        <View>
          <TouchableOpacity style={s.card} onPress={() => handleSelectItem(item)} activeOpacity={0.8}>
            <View style={s.cardRow}>
              {item.image && <Image source={{ uri: item.image }} style={s.thumbMd} />}
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <Text style={[s.badge, { color: '#3cffb3' }]}>{'\u2713'} {item.usedIngredientCount} used</Text>
                  <Text style={[s.badge, { color: '#ff9f43' }]}>{'\u2715'} {item.missedIngredientCount} missing</Text>
                </View>
              </View>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#9feaff" />
            </View>
          </TouchableOpacity>
          {isOpen && loading && <ActivityIndicator style={s.itemLoader} color="#a29bfe" />}
          {isOpen && !loading && details && renderRecipeDetail(details)}
        </View>
      );
    }

    // recipes / mealplan
    return (
      <View>
        <TouchableOpacity style={s.card} onPress={() => handleSelectItem(item)} activeOpacity={0.8}>
          <View style={s.cardRow}>
            {item.image && <Image source={{ uri: item.image }} style={s.thumbMd} />}
            <Text style={[s.cardTitle, { flex: 1 }]} numberOfLines={2}>{item.title || item.name}</Text>
            <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#9feaff" />
          </View>
        </TouchableOpacity>
        {isOpen && loading && <ActivityIndicator style={s.itemLoader} color="#00eaff" />}
        {isOpen && !loading && details && renderRecipeDetail(details)}
      </View>
    );
  };

  // ---- random tab ----

  const renderRandom = () => (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 80 }}>
      {!!rndError && (
        <View style={s.errorBox}>
          <Ionicons name="warning" size={14} color="#ff6b6b" />
          <Text style={s.errorText}>{rndError}</Text>
        </View>
      )}

      {/* Random Recipe card */}
      <TouchableOpacity style={[s.rndCard, { borderColor: 'rgba(0,234,255,0.4)' }]} onPress={() => fetchRandom('recipe')} activeOpacity={0.8}>
        <LinearGradient colors={['rgba(0,234,255,0.12)', 'rgba(122,92,255,0.08)']} style={s.rndCardInner}>
          <Ionicons name="restaurant" size={22} color="#00eaff" />
          <Text style={[s.rndCardTitle, { color: '#00eaff' }]}>Random Recipe</Text>
          {rndLoading === 'recipe' ? <ActivityIndicator size="small" color="#00eaff" /> : <Ionicons name="shuffle" size={18} color="#00eaff" />}
        </LinearGradient>
      </TouchableOpacity>
      {rndRecipe && (
        <View style={s.detailCard}>
          {rndRecipe.image && <Image source={{ uri: rndRecipe.image }} style={s.recipeImage} />}
          <Text style={s.detailName}>{rndRecipe.title}</Text>
          <View style={s.metaRow}>
            {!!rndRecipe.readyInMinutes && (
              <View style={s.metaChip}>
                <Ionicons name="time-outline" size={13} color="#00eaff" />
                <Text style={s.metaText}>{rndRecipe.readyInMinutes} min</Text>
              </View>
            )}
            {!!rndRecipe.servings && (
              <View style={s.metaChip}>
                <Ionicons name="people-outline" size={13} color="#00eaff" />
                <Text style={s.metaText}>{rndRecipe.servings} servings</Text>
              </View>
            )}
          </View>
          {(rndRecipe.extendedIngredients || []).length > 0 && (
            <>
              <Text style={s.section}>Ingredients</Text>
              {rndRecipe.extendedIngredients.map((ing: any, i: number) => (
                <Text key={i} style={s.listLine}>{'\u00b7'} {ing.original}</Text>
              ))}
            </>
          )}
          {(rndRecipe.analyzedInstructions?.[0]?.steps || []).length > 0 && (
            <>
              <Text style={s.section}>Instructions</Text>
              {rndRecipe.analyzedInstructions[0].steps.map((step: any, i: number) => (
                <View key={i} style={s.stepRow}>
                  <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
                  <Text style={s.stepText}>{step.step}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      )}

      {/* Food Trivia card */}
      <TouchableOpacity style={[s.rndCard, { borderColor: 'rgba(255,215,0,0.4)', marginTop: 12 }]} onPress={() => fetchRandom('trivia')} activeOpacity={0.8}>
        <LinearGradient colors={['rgba(255,215,0,0.12)', 'rgba(255,159,67,0.08)']} style={s.rndCardInner}>
          <Ionicons name="bulb" size={22} color="#ffd700" />
          <Text style={[s.rndCardTitle, { color: '#ffd700' }]}>Food Trivia</Text>
          {rndLoading === 'trivia' ? <ActivityIndicator size="small" color="#ffd700" /> : <Ionicons name="shuffle" size={18} color="#ffd700" />}
        </LinearGradient>
      </TouchableOpacity>
      {!!rndTrivia && (
        <View style={[s.detailCard, { borderColor: 'rgba(255,215,0,0.3)' }]}>
          <Text style={[s.stepText, { fontSize: 14, lineHeight: 24 }]}>{rndTrivia}</Text>
        </View>
      )}

      {/* Food Joke card */}
      <TouchableOpacity style={[s.rndCard, { borderColor: 'rgba(255,107,157,0.4)', marginTop: 12 }]} onPress={() => fetchRandom('joke')} activeOpacity={0.8}>
        <LinearGradient colors={['rgba(255,107,157,0.12)', 'rgba(122,92,255,0.08)']} style={s.rndCardInner}>
          <Ionicons name="happy" size={22} color="#ff6b9d" />
          <Text style={[s.rndCardTitle, { color: '#ff6b9d' }]}>Food Joke</Text>
          {rndLoading === 'joke' ? <ActivityIndicator size="small" color="#ff6b9d" /> : <Ionicons name="shuffle" size={18} color="#ff6b9d" />}
        </LinearGradient>
      </TouchableOpacity>
      {!!rndJoke && (
        <View style={[s.detailCard, { borderColor: 'rgba(255,107,157,0.3)' }]}>
          <Text style={[s.stepText, { fontSize: 14, lineHeight: 24 }]}>{rndJoke}</Text>
        </View>
      )}
    </ScrollView>
  );

  // ---- main render ----

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      {/* Header */}
      <LinearGradient
        colors={['rgba(0,234,255,0.22)', 'rgba(122,92,255,0.16)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.header}
      >
        <BackButton />
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Diet Tracker</Text>
          <Text style={s.headerSub}>Food {'\u00b7'} Recipes {'\u00b7'} Nutrition {'\u00b7'} Meal Plans</Text>
        </View>
      </LinearGradient>

      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabsScroll}
        contentContainerStyle={s.tabsContent}
      >
        {CATEGORIES.map((cat) => {
          const active = category === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              onPress={() => changeCategory(cat.id)}
              style={[s.tab, active && { borderColor: cat.color, backgroundColor: cat.color + '22' }]}
              activeOpacity={0.8}
            >
              <Ionicons name={cat.icon as any} size={14} color={active ? cat.color : '#5a6e9e'} />
              <Text style={[s.tabText, active && { color: cat.color }]}>{cat.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Controls (hidden for random tab) */}
      {category !== 'random' && (
        <View style={s.controls}>

          {/* Fridge ingredient input */}
          {category === 'fridge' && (
            <>
              <View style={s.fridgeRow}>
                <View style={[s.inputWrap, { flex: 1 }]}>
                  <Ionicons name="basket-outline" size={14} color="#5a6e9e" style={s.searchIcon} />
                  <TextInput
                    style={s.searchInput}
                    placeholder="Add an ingredient..."
                    placeholderTextColor="#4a5a7e"
                    value={fridgeInput}
                    onChangeText={setFridgeInput}
                    returnKeyType="done"
                    onSubmitEditing={addFridgeIngredient}
                  />
                </View>
                <TouchableOpacity onPress={addFridgeIngredient} style={s.addBtn} activeOpacity={0.8}>
                  <Ionicons name="add" size={20} color="#a29bfe" />
                </TouchableOpacity>
              </View>
              {fridgeIngredients.length > 0 && (
                <View style={s.tagWrap}>
                  {fridgeIngredients.map((ing) => (
                    <TouchableOpacity
                      key={ing}
                      style={s.tag}
                      onPress={() => setFridgeIngredients(prev => prev.filter(x => x !== ing))}
                      activeOpacity={0.7}
                    >
                      <Text style={s.tagText}>{ing}</Text>
                      <Ionicons name="close" size={11} color="#a29bfe" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Meal plan controls */}
          {category === 'mealplan' && (
            <>
              <View style={s.mpRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Calories</Text>
                  <TextInput
                    style={s.input}
                    placeholder="2000"
                    placeholderTextColor="#4a5a7e"
                    value={mpCalories}
                    onChangeText={setMpCalories}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Timeframe</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                    {(['day', 'week'] as const).map((tf) => (
                      <TouchableOpacity
                        key={tf}
                        onPress={() => setMpTimeFrame(tf)}
                        style={[s.chip, mpTimeFrame === tf && { borderColor: '#ff9f43', backgroundColor: 'rgba(255,159,67,0.2)' }]}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.chipText, mpTimeFrame === tf && { color: '#ff9f43' }]}>
                          {tf.charAt(0).toUpperCase() + tf.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
              <View>
                <Text style={s.fieldLabel}>Diet type</Text>
                <FilterChips values={DIETS} selected={mpDiet} onSelect={setMpDiet} color="#ff9f43"
                  labelFn={(v) => v === '' ? 'Any' : (v as string).charAt(0).toUpperCase() + (v as string).slice(1)}
                />
              </View>
            </>
          )}

          {/* Foods search */}
          {category === 'foods' && (
            <View style={s.inputWrap}>
              <Ionicons name="search" size={14} color="#5a6e9e" style={s.searchIcon} />
              <TextInput
                style={s.searchInput}
                placeholder="Search foods & ingredients..."
                placeholderTextColor="#4a5a7e"
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
                onSubmitEditing={() => query.trim() && handleSearch()}
              />
              {!!query && (
                <TouchableOpacity onPress={() => setQuery('')}>
                  <Ionicons name="close-circle" size={16} color="#5a6e9e" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Recipes search + expandable filters */}
          {category === 'recipes' && (
            <>
              <View style={s.inputWrap}>
                <Ionicons name="search" size={14} color="#5a6e9e" style={s.searchIcon} />
                <TextInput
                  style={s.searchInput}
                  placeholder="Search recipes..."
                  placeholderTextColor="#4a5a7e"
                  value={query}
                  onChangeText={setQuery}
                  returnKeyType="search"
                  onSubmitEditing={() => query.trim() && handleSearch()}
                />
                {!!query && (
                  <TouchableOpacity onPress={() => setQuery('')}>
                    <Ionicons name="close-circle" size={16} color="#5a6e9e" />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity onPress={() => setShowFilters(f => !f)} style={s.filtersBtn} activeOpacity={0.8}>
                <Ionicons name="options-outline" size={14} color="#9feaff" />
                <Text style={s.filtersBtnText}>Filters</Text>
                {(recCuisine || recDiet || recMaxTime > 0) && (
                  <View style={s.filtersBadge}><Text style={s.filtersBadgeText}>ON</Text></View>
                )}
                <Ionicons name={showFilters ? 'chevron-up' : 'chevron-down'} size={13} color="#9feaff" />
              </TouchableOpacity>
              {showFilters && (
                <View style={{ gap: 10 }}>
                  <View>
                    <Text style={s.fieldLabel}>Cuisine</Text>
                    <FilterChips
                      values={CUISINES} selected={recCuisine} onSelect={setRecCuisine} color="#00eaff"
                      labelFn={(v) => v === '' ? 'Any' : (v as string).charAt(0).toUpperCase() + (v as string).slice(1)}
                    />
                  </View>
                  <View>
                    <Text style={s.fieldLabel}>Diet</Text>
                    <FilterChips
                      values={DIETS} selected={recDiet} onSelect={setRecDiet} color="#00eaff"
                      labelFn={(v) => v === '' ? 'Any' : (v as string).charAt(0).toUpperCase() + (v as string).slice(1)}
                    />
                  </View>
                  <View>
                    <Text style={s.fieldLabel}>Max Ready Time</Text>
                    <FilterChips
                      values={TIMES} selected={recMaxTime} onSelect={setRecMaxTime} color="#00eaff"
                      labelFn={(v) => v === 0 ? 'Any' : `${v} min`}
                    />
                  </View>
                </View>
              )}
            </>
          )}

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={handleSearch}
              disabled={searchDisabled}
              activeOpacity={0.85}
              style={[s.searchBtn, { flex: 1 }, searchDisabled && { opacity: 0.4 }]}
            >
              <LinearGradient
                colors={[catColor, '#7a5cff']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.searchBtnGrad}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <>
                      <Ionicons
                        name={category === 'mealplan' ? 'calendar' : category === 'fridge' ? 'basket' : 'search'}
                        size={15} color="#fff"
                      />
                      <Text style={s.searchBtnText}>
                        {category === 'mealplan' ? 'Generate Plan'
                          : category === 'fridge' ? 'Find Recipes'
                          : 'Search'}
                      </Text>
                    </>
                }
              </LinearGradient>
            </TouchableOpacity>
            {results.length > 0 && (
              <TouchableOpacity
                onPress={reset}
                activeOpacity={0.85}
                style={[s.searchBtn, { width: 45 }]}
              >
                <LinearGradient
                  colors={['#ff6b9d33', '#7a5cff22']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[s.searchBtnGrad, { paddingHorizontal: 8 }]}
                >
                  <Ionicons name="close" size={18} color="#ff6b9d" />
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

          {!!error && (
            <View style={s.errorBox}>
              <Ionicons name="warning" size={14} color="#ff6b6b" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}
        </View>
      )}

      {/* Results / random content */}
      {category === 'random' ? renderRandom() : (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.id ?? Math.random())}
          renderItem={renderItem}
          contentContainerStyle={s.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            !loading ? (
              <View style={s.emptyWrap}>
                <Ionicons name="nutrition-outline" size={44} color="#1a2a4e" />
                <Text style={s.emptyText}>
                  {category === 'foods'
                    ? 'Search for any food or ingredient to see nutrition info'
                    : category === 'recipes'
                    ? 'Search recipes by name, ingredient, or use the filters'
                    : category === 'fridge'
                    ? 'Add ingredients you have and discover matching recipes'
                    : 'Set your target calories and diet type, then tap Generate'}
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080b16' },

  // Header
  header: {
    paddingTop: 24, paddingHorizontal: 16, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,234,255,0.15)',
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  headerTitle: { color: '#e8f3ff', fontSize: 20, fontWeight: '900', letterSpacing: 0.3 },
  headerSub:   { color: '#5a7a9e', fontSize: 12, fontWeight: '700', marginTop: 2 },

  // Tabs
  tabsScroll:   { height: 56, borderBottomWidth: 1, borderBottomColor: 'rgba(122,92,255,0.18)', flexGrow: 0, flexShrink: 0 },
  tabsContent:  { paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: 'row', alignItems: 'center', flexGrow: 0, flexShrink: 0 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(122,92,255,0.25)',
    backgroundColor: 'rgba(122,92,255,0.06)',
  },
  tabText: { color: '#5a6e9e', fontSize: 12, fontWeight: '800' },

  // Controls panel
  controls: {
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(122,92,255,0.12)', gap: 10,
  },

  // Fridge ingredient input
  fridgeRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addBtn: {
    width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(162,155,254,0.15)', borderWidth: 1, borderColor: 'rgba(162,155,254,0.4)',
  },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16,
    backgroundColor: 'rgba(162,155,254,0.15)', borderWidth: 1, borderColor: 'rgba(162,155,254,0.35)',
  },
  tagText: { color: '#c5bcff', fontSize: 12, fontWeight: '700' },

  // Meal plan
  mpRow: { flexDirection: 'row', gap: 12 },

  // Shared input
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,234,255,0.25)', paddingHorizontal: 10,
  },
  searchIcon:  { marginRight: 6 },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, paddingVertical: 10 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)', color: '#fff',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,234,255,0.25)',
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 14,
  },
  fieldLabel: {
    color: '#9feaff', fontSize: 11, fontWeight: '800', marginBottom: 5,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  chip: {
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(122,92,255,0.3)',
    backgroundColor: 'rgba(122,92,255,0.06)',
  },
  chipText: { color: '#5a6e9e', fontSize: 12, fontWeight: '800' },

  // Filters button
  filtersBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(0,234,255,0.25)', backgroundColor: 'rgba(0,234,255,0.07)',
  },
  filtersBtnText:  { color: '#9feaff', fontSize: 12, fontWeight: '800' },
  filtersBadge:    { backgroundColor: '#00eaff', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  filtersBadgeText:{ color: '#080b16', fontSize: 9, fontWeight: '900' },

  // Action button
  searchBtn:     { borderRadius: 12, overflow: 'hidden' },
  searchBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 12,
  },
  searchBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },

  // Error
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,107,107,0.1)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,107,107,0.3)', padding: 10,
  },
  errorText: { color: '#ff6b6b', fontSize: 12, flex: 1 },

  // List content
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 80 },

  // Result card
  card: {
    backgroundColor: 'rgba(13,19,48,0.9)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(122,92,255,0.25)', marginBottom: 10,
  },
  cardRow:   { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  cardTitle: { color: '#d9eaff', fontSize: 14, fontWeight: '800' },
  thumbSm:   { width: 36, height: 36, borderRadius: 8 },
  thumbMd:   { width: 54, height: 44, borderRadius: 8 },
  badge:     { fontSize: 11, fontWeight: '800' },
  itemLoader:{ marginVertical: 8 },

  // Detail card
  detailCard: {
    backgroundColor: 'rgba(0,234,255,0.04)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(0,234,255,0.2)', padding: 14, marginBottom: 10,
  },
  detailName: { color: '#e8f3ff', fontSize: 15, fontWeight: '900', marginBottom: 10 },
  macroRow:   { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  macroPill: {
    alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 10, borderWidth: 1, minWidth: 54,
  },
  macroVal: { fontSize: 14, fontWeight: '900' },
  macroLbl: { color: '#8aa4ff', fontSize: 10, fontWeight: '700', marginTop: 1 },
  nutrientRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4,
    borderBottomWidth: 1, borderBottomColor: 'rgba(122,92,255,0.1)',
  },
  nutrientName: { color: '#9feaff', fontSize: 12, fontWeight: '700' },
  nutrientVal:  { color: '#cfe6ff', fontSize: 12, fontWeight: '800' },
  section: {
    color: '#9feaff', fontSize: 11, fontWeight: '900', marginTop: 12, marginBottom: 5,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  listLine:  { color: '#cfe6ff', fontSize: 13, lineHeight: 20 },
  recipeImage: { width: '100%', height: 150, borderRadius: 10, marginBottom: 10 },
  metaRow:   { flexDirection: 'row', gap: 10, marginBottom: 10, flexWrap: 'wrap' },
  metaChip:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:  { color: '#00eaff', fontSize: 12, fontWeight: '800' },
  stepRow:   { flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'flex-start' },
  stepNum: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,234,255,0.2)', alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  stepNumText: { color: '#00eaff', fontSize: 10, fontWeight: '900' },
  stepText:    { flex: 1, color: '#cfe6ff', fontSize: 13, lineHeight: 20 },

  // Similar recipes
  similarCard: {
    width: 120, padding: 10, borderRadius: 10,
    backgroundColor: 'rgba(122,92,255,0.12)', borderWidth: 1, borderColor: 'rgba(122,92,255,0.3)',
  },
  similarTitle: { color: '#d9eaff', fontSize: 12, fontWeight: '800' },
  similarMeta:  { color: '#5a6e9e', fontSize: 11, marginTop: 4 },

  // Random tab
  rndCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  rndCardInner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  rndCardTitle: { flex: 1, fontSize: 16, fontWeight: '900' },

  // Empty
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { color: '#2a3a5e', fontSize: 13, fontWeight: '700', textAlign: 'center', maxWidth: 270 },
} as any);
