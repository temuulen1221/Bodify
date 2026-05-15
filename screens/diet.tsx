import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, FlatList, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import BackButton from '../components/BackButton';
import { generateMealPlan, getFoodNutrition, getFoodTrivia, getRecipeDetails, searchFoods, searchRecipes } from '../services/diet';

export default function DietScreen() {
  // Meal Plan Generator state
  const [mealPlanCalories, setMealPlanCalories] = useState('2000');
  const [mealPlanDiet, setMealPlanDiet] = useState('');
  const [mealPlanTimeFrame, setMealPlanTimeFrame] = useState('day');

  // Meal Plan Generator handler
  const handleMealPlanGenerate = async () => {
    setLoading(true);
    setError('');
    setResults([]);
    setSelectedItem(null);
    setDetails(null);
    try {
      const data = await generateMealPlan(mealPlanTimeFrame, Number(mealPlanCalories), mealPlanDiet) as any;
      setResults((data as any).meals || []);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('foods');

  // Clear search state when leaving the screen
  useEffect(() => {
    // Clear search history when unmounting (leaving screen)
    return () => {
      setQuery('');
      setResults([]);
      setSelectedItem(null);
      setDetails(null);
      setError('');
    };
  }, []);

  // Clear search history when refreshing (e.g., pull-to-refresh or manual refresh)
  const handleRefresh = () => {
    setQuery('');
    setResults([]);
    setSelectedItem(null);
    setDetails(null);
    setError('');
  };

  const handleSearch = async () => {
    setLoading(true);
    setError('');
    setDetails(null);
    setSelectedItem(null);
    try {
      let data;
      if (category === 'foods') {
        data = await searchFoods(query) as any;
        setResults((data as any).results || []);
      } else if (category === 'recipes') {
        data = await searchRecipes(query) as any;
        setResults((data as any).results || []);
      } else if (category === 'mealplans') {
        data = await generateMealPlan('day', 2000, '') as any;
        setResults((data as any).meals || []);
      } else if (category === 'ingredients') {
        data = await searchFoods(query) as any;
        setResults((data as any).results || []);
      } else if (category === 'trivia') {
        data = await getFoodTrivia();
        setResults([data] as any[]);
      }
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItem = async (item: any) => {
    setSelectedItem(item);
    setDetails(null);
    setLoading(true);
    setError('');
    try {
      let info;
      if (category === 'foods' || category === 'ingredients') {
        info = await getFoodNutrition(item.id);
      } else if (category === 'recipes') {
        info = await getRecipeDetails(item.id);
      } else if (category === 'mealplans') {
        info = await getRecipeDetails(item.id);
      } else if (category === 'trivia') {
        info = item;
      }
      setDetails(info);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Explanation for each category
  const categoryExplanations = {
    foods: 'Search for foods and view their nutrition information.',
    recipes: 'Find recipes by name or ingredient and view recipe details.',
    mealplans: 'Generate a daily meal plan based on calories and diet preferences.',
    ingredients: 'Search for ingredients and view their nutrition details.',
    trivia: 'Get a random food trivia or fun fact.',
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <LinearGradient colors={["#5421FF", "#6A00FF", "#00E7FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={{ marginBottom: 12 }}>
          <BackButton />
        </View>
        <Text style={styles.title}>Diet Tracker</Text>
        <Text style={styles.subtitle}>Search for foods, recipes, meal plans, ingredients, or trivia.</Text>
        <Picker
          selectedValue={category}
          style={styles.picker}
          onValueChange={(itemValue) => {
            setCategory(itemValue);
            setQuery('');
            setResults([]);
            setSelectedItem(null);
            setDetails(null);
            setError('');
          }}
        >
          <Picker.Item label="Foods" value="foods" />
          <Picker.Item label="Recipes" value="recipes" />
          <Picker.Item label="Ingredients" value="ingredients" />
          <Picker.Item label="Trivia" value="trivia" />
          <Picker.Item label="Meal Plan Generator" value="mealplan_gen" />
        </Picker>
        <Text style={styles.explanation}>{category === 'mealplan_gen' ? 'Generate a custom meal plan for a day or week based on your calorie and diet preferences.' : categoryExplanations[category as keyof typeof categoryExplanations]}</Text>
        {(category === 'mealplan_gen') && (
          <View style={styles.mealPlanOptions}>
            <Text style={styles.detailLabel}>Calories:</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 2000"
              value={mealPlanCalories}
              onChangeText={setMealPlanCalories}
              keyboardType="numeric"
            />
            <Text style={styles.detailLabel}>Diet Type:</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. vegetarian, keto, etc. (optional)"
              value={mealPlanDiet}
              onChangeText={setMealPlanDiet}
            />
            <Text style={styles.detailLabel}>Time Frame:</Text>
            <Picker
              selectedValue={mealPlanTimeFrame}
              style={styles.picker}
              onValueChange={setMealPlanTimeFrame}
            >
              <Picker.Item label="Day" value="day" />
              <Picker.Item label="Week" value="week" />
            </Picker>
            <Button title="Generate Meal Plan" onPress={handleMealPlanGenerate} disabled={loading || !mealPlanCalories.trim()} />
            {/* Show meal plan results */}
            {results.length > 0 && (
              <View style={{ marginTop: 18 }}>
                <Text style={styles.nutritionTitle}>Meal Plan Results</Text>
                {results.map((meal, idx) => (
                  <View key={meal.id || idx} style={styles.foodItem}>
                    <Text style={styles.foodName}>{meal.title}</Text>
                    <Text style={styles.detailValue}>Ready in: {meal.readyInMinutes} min</Text>
                    <Text style={styles.detailValue}>Servings: {meal.servings}</Text>
                    {selectedItem && selectedItem.id === meal.id && details ? (
                      <View style={styles.nutritionBox}>
                        <Text style={styles.nutritionTitle}>Details</Text>
                        <View style={styles.detailSection}>
                          <Text style={styles.detailLabel}>Title:</Text>
                          <Text style={styles.detailValue}>{details.title}</Text>
                          <Text style={styles.detailLabel}>Ready in:</Text>
                          <Text style={styles.detailValue}>{details.readyInMinutes} min</Text>
                          <Text style={styles.detailLabel}>Servings:</Text>
                          <Text style={styles.detailValue}>{details.servings}</Text>
                          <Text style={styles.detailLabel}>Summary:</Text>
                          <Text style={styles.detailValue}>{details.summary ? details.summary.replace(/<[^>]+>/g, '') : 'N/A'}</Text>
                <Text style={styles.detailValue} numberOfLines={2} ellipsizeMode="tail">{details.summary ? details.summary.replace(/<[^>]+>/g, '') : 'N/A'}</Text>
                          {details.image && (
                            <View style={styles.detailImageBox}>
                              <Image source={{ uri: details.image }} style={styles.detailImage} />
                            </View>
                          )}
                          {details.extendedIngredients && details.extendedIngredients.length > 0 && (
                            <View style={styles.detailSubSection}>
                              <Text style={styles.detailLabel}>Ingredients:</Text>
                              {details.extendedIngredients.map((ing: any, idx: number) => (
                                <Text key={idx} style={styles.detailValue} numberOfLines={2} ellipsizeMode="tail">• {ing.original}</Text>
                              ))}
                            </View>
                          )}
                          {details.analyzedInstructions && details.analyzedInstructions.length > 0 && (
                            <View style={styles.detailSubSection}>
                              <Text style={styles.detailLabel}>Instructions:</Text>
                              {details.analyzedInstructions[0].steps.map((step: any, idx: number) => (
                                <Text key={idx} style={styles.detailValue} numberOfLines={2} ellipsizeMode="tail">{idx + 1}. {step.step}</Text>
                              ))}
                            </View>
                          )}
                        </View>
                      </View>
                    ) : (
                      <Button title="View Details" onPress={() => handleSelectItem(meal)} />
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
        {(category !== 'mealplan_gen' && category !== 'trivia') && (
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, query.length > 0 ? { paddingRight: 32 } : null]}
              placeholder={`Search ${category}...`}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              onSubmitEditing={() => {
                if (!loading && query.trim()) handleSearch();
              }}
            />
      {query.length > 0 && (
        <View style={styles.clearButtonBox}>
          <Text style={styles.clearButton} onPress={() => setQuery('')}> clear </Text>
        </View>
      )}
    </View>
  )}
        <Button title="Search" onPress={handleSearch} disabled={loading || ((category !== 'mealplans' && category !== 'trivia') && !query.trim())} />
        {loading && <ActivityIndicator style={{ marginTop: 12 }} />}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </LinearGradient>
      <FlatList
        data={results}
        keyExtractor={item => String(item.id || item.text || item.title || Math.random())}
        renderItem={({ item }) => (
          <View>
            <View style={styles.foodItem}>
              {category === 'trivia' ? (
                <Text style={styles.foodName} numberOfLines={2} ellipsizeMode="tail">{item.text}</Text>
              ) : (
                <Text style={styles.foodName} numberOfLines={2} ellipsizeMode="tail">{item.name || item.title}</Text>
              )}
              {(category !== 'trivia') && (
                <Button title="View Details" onPress={() => handleSelectItem(item)} />
              )}
            </View>
            {selectedItem && ((selectedItem.id || selectedItem.text || selectedItem.title) === (item.id || item.text || item.title)) && details && (
              <View style={styles.nutritionBox}>
                <Text style={styles.nutritionTitle}>Details</Text>
                {category === 'foods' || category === 'ingredients' ? (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Name:</Text>
                    <Text style={styles.detailValue}>{details.name}</Text>
                    <Text style={styles.detailLabel}>Calories:</Text>
                    <Text style={styles.detailValue}>{details.nutrition?.nutrients?.find((n: any) => n.name === 'Calories')?.amount || 'N/A'}</Text>
                    <Text style={styles.detailLabel}>Protein:</Text>
                    <Text style={styles.detailValue}>{details.nutrition?.nutrients?.find((n: any) => n.name === 'Protein')?.amount || 'N/A'}g</Text>
                    <Text style={styles.detailLabel}>Fat:</Text>
                    <Text style={styles.detailValue}>{details.nutrition?.nutrients?.find((n: any) => n.name === 'Fat')?.amount || 'N/A'}g</Text>
                    <Text style={styles.detailLabel}>Carbs:</Text>
                    <Text style={styles.detailValue}>{details.nutrition?.nutrients?.find((n: any) => n.name === 'Carbohydrates')?.amount || 'N/A'}g</Text>
                  </View>
                ) : null}
                {category === 'recipes' || category === 'mealplans' ? (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Title:</Text>
                    <Text style={styles.detailValue}>{details.title}</Text>
                    <Text style={styles.detailLabel}>Ready in:</Text>
                    <Text style={styles.detailValue}>{details.readyInMinutes} min</Text>
                    <Text style={styles.detailLabel}>Servings:</Text>
                    <Text style={styles.detailValue}>{details.servings}</Text>
                    <Text style={styles.detailLabel}>Summary:</Text>
                    <Text style={styles.detailValue}>{details.summary ? details.summary.replace(/<[^>]+>/g, '') : 'N/A'}</Text>
                    {details.image && (
                      <View style={styles.detailImageBox}>
                        <Image source={{ uri: details.image }} style={styles.detailImage} />
                      </View>
                    )}
                    {details.extendedIngredients && details.extendedIngredients.length > 0 && (
                      <View style={styles.detailSubSection}>
                        <Text style={styles.detailLabel}>Ingredients:</Text>
                        {details.extendedIngredients.map((ing: any, idx: number) => (
                          <Text key={idx} style={styles.detailValue}>• {ing.original}</Text>
                        ))}
                      </View>
                    )}
                    {details.analyzedInstructions && details.analyzedInstructions.length > 0 && (
                      <View style={styles.detailSubSection}>
                        <Text style={styles.detailLabel}>Instructions:</Text>
                        {details.analyzedInstructions[0].steps.map((step: any, idx: number) => (
                          <Text key={idx} style={styles.detailValue}>{idx + 1}. {step.step}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                ) : null}
                {category === 'trivia' ? (
                  <Text style={styles.detailValue}>{details.text}</Text>
                ) : null}
              </View>
            )}
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 120 }}
        style={{ width: '100%' }}
        keyboardShouldPersistTaps="handled"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingTop: 24, paddingHorizontal: 16, paddingBottom: 120, backgroundColor: '#18143A' },
  card: { borderRadius: 18, padding: 16, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', textShadowColor: 'rgba(0,231,255,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  subtitle: { color: 'rgba(255,255,255,0.8)', marginTop: 6, marginBottom: 12 },
  picker: {
    width: '100%',
    maxWidth: 340,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderColor: '#4F8EF7',
    borderWidth: 1,
  },
  explanation: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    marginBottom: 10,
    marginTop: -2,
    fontStyle: 'italic',
    textAlign: 'left',
    maxWidth: 340,
  },
  mealPlanOptions: {
    width: '100%',
    maxWidth: 340,
    marginVertical: 8,
  },
  inputWrapper: {
    position: 'relative',
    width: '100%',
    maxWidth: 340,
    marginBottom: 10,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  input: {
    width: '100%',
    maxWidth: 340,
    height: 44,
    borderColor: '#4F8EF7',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 0,
  },
  clearButtonBox: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 42,
    height: '100%',
    zIndex: 2,
  },
  clearButton: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -10 }],
    fontSize: 18,
    color: '#4F8EF7',
    backgroundColor: 'transparent',
    padding: 2,
    zIndex: 1,
  },
  error: {
    color: '#d00',
    marginTop: 10,
    marginBottom: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  foodItem: {
    backgroundColor: '#e9f1ff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  foodName: {
    fontSize: 16,
    color: '#222',
    fontWeight: 'bold',
    flex: 1,
    flexWrap: 'wrap',
    maxWidth: '75%',
  },
  nutritionBox: {
    backgroundColor: 'rgba(30, 20, 60, 0.85)',
    borderRadius: 14,
    padding: 18,
    marginTop: 18,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#4F8EF7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  nutritionTitle: {
    fontSize: 19,
    fontWeight: 'bold',
  color: '#4F8EF7',
  marginBottom: 10,
  letterSpacing: 0.5,
  textAlign: 'left',
  },
  detailSection: {
    marginBottom: 8,
  },
  detailLabel: {
    fontWeight: 'bold',
  color: '#4F8EF7',
  fontSize: 15,
  marginTop: 6,
  },
  detailValue: {
    color: '#000',
    fontSize: 15,
    marginLeft: 4,
    marginBottom: 2,
  },
  detailImageBox: {
    alignItems: 'center',
    marginVertical: 8,
  },
  detailImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#00E7FF',
  },
  detailSubSection: {
    marginTop: 8,
    marginBottom: 4,
  },
});
