import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import {
  AppText,
  Button,
  CardSkeleton,
  Chip,
  IconButton,
  Input,
  SegmentedTabs,
  Skeleton,
} from '../../components/common';
import { FoodSearchRow } from '../../components/nutrition/FoodSearchRow';
import { hapticSuccess } from '../../lib/haptics';
import { fetchProductByBarcode, macrosForPortion, type OffProduct } from '../../services/openFoodFacts';
import { useAuthStore } from '../../stores/authStore';
import { useNutritionStore } from '../../stores/nutritionStore';
import { useTranslation } from '../../stores/i18nStore';
import { useUiStore } from '../../stores/uiStore';
import type { FoodRow, MacroSource, MealType } from '../../types/database';
import type { NutritionStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<NutritionStackParamList, 'FoodDetail'>;

const MEAL_TYPES: MealType[] = ['DES', 'ALM', 'MER', 'CEN'];
const QUICK_PORTIONS = [50, 100, 150, 200];

interface Per100 {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

type OffStatus = 'idle' | 'loading' | 'error' | 'notfound' | 'done';
type PickTab = 'all' | 'favorites' | 'created';

function mealLabelKey(type: MealType): 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'intermediate' {
  switch (type) {
    case 'DES':
      return 'breakfast';
    case 'ALM':
      return 'lunch';
    case 'MER':
      return 'snack';
    case 'CEN':
      return 'dinner';
    default:
      return 'intermediate';
  }
}

export function FoodDetailScreen({ navigation, route }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t, i18n } = useTranslation();

  const insets = useSafeAreaInsets();
  const { mealType, foodId, barcode, mealLogId, entryMode } = route.params;

  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;

  const myFoods = useNutritionStore((s) => s.myFoods);
  const dayMeals = useNutritionStore((s) => s.meals);
  const foodsLoading = useNutritionStore((s) => s.foodsLoading);
  const loadMyFoods = useNutritionStore((s) => s.loadMyFoods);
  const saveFood = useNutritionStore((s) => s.saveFood);
  const toggleFavoriteFood = useNutritionStore((s) => s.toggleFavoriteFood);
  const addMeal = useNutritionStore((s) => s.addMeal);
  const updateMeal = useNutritionStore((s) => s.updateMeal);
  const deleteMeal = useNutritionStore((s) => s.deleteMeal);

  const isEdit = mealLogId !== undefined;
  const isPickList = !isEdit && entryMode === 'pick' && foodId === undefined && barcode === undefined;
  const isManualNew = !isEdit && entryMode === 'manual' && foodId === undefined && barcode === undefined;

  // Modo edición: semilla inicial desde el registro existente (sin efecto, sin flash).
  const editMeal = mealLogId ? dayMeals.find((m) => m.id === mealLogId) ?? null : null;

  const [name, setName] = useState(editMeal?.title ?? editMeal?.product_display_name ?? '');
  const [portion, setPortion] = useState(
    editMeal?.portion_grams != null ? String(editMeal.portion_grams) : '100'
  );
  const [per100, setPer100] = useState<Per100 | null>(null);
  const [kcalText, setKcalText] = useState(editMeal ? String(Math.round(editMeal.energy_kcal ?? 0)) : '');
  const [proteinText, setProteinText] = useState(
    editMeal ? String(Math.round(editMeal.protein_g ?? 0)) : ''
  );
  const [carbsText, setCarbsText] = useState(editMeal ? String(Math.round(editMeal.carbs_g ?? 0)) : '');
  const [fatText, setFatText] = useState(editMeal ? String(Math.round(editMeal.fat_g ?? 0)) : '');
  const [mealTypeIdx, setMealTypeIdx] = useState(() => {
    if (editMeal) {
      const idx = MEAL_TYPES.indexOf(editMeal.meal_type);
      if (idx >= 0) return idx;
    }
    return Math.max(MEAL_TYPES.indexOf(mealType), 0);
  });
  const [offProduct, setOffProduct] = useState<OffProduct | null>(null);
  const [offStatus, setOffStatus] = useState<OffStatus>(barcode !== undefined ? 'loading' : 'idle');
  const [selectedFood, setSelectedFood] = useState<FoodRow | null>(null);
  const [saveToFoods, setSaveToFoods] = useState(false);
  const [search, setSearch] = useState('');
  const [pickTab, setPickTab] = useState<PickTab>('all');
  const [saving, setSaving] = useState(false);

  // Modo barcode: buscar en Open Food Facts
  const loadOff = async () => {
    if (barcode === undefined) return;
    try {
      const product = await fetchProductByBarcode(barcode);
      if (!product) {
        setOffStatus('notfound');
        return;
      }
      setOffProduct(product);
      setName(product.productName);
      setPer100({ kcal: product.kcal100g, protein: product.protein100g, carbs: product.carbs100g, fat: product.fat100g });
      if (product.servingGrams !== null && product.servingGrams > 0) setPortion(String(product.servingGrams));
      setOffStatus('done');
    } catch {
      setOffStatus('error');
    }
  };

  // Carga inicial inline: los setState ocurren después del await.
  useEffect(() => {
    if (barcode === undefined) return;
    let cancelled = false;
    void (async () => {
      try {
        const product = await fetchProductByBarcode(barcode);
        if (cancelled) return;
        if (!product) {
          setOffStatus('notfound');
          return;
        }
        setOffProduct(product);
        setName(product.productName);
        setPer100({
          kcal: product.kcal100g,
          protein: product.protein100g,
          carbs: product.carbs100g,
          fat: product.fat100g,
        });
        if (product.servingGrams !== null && product.servingGrams > 0) {
          setPortion(String(product.servingGrams));
        }
        setOffStatus('done');
      } catch {
        if (!cancelled) setOffStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [barcode]);

  // Cargar mis alimentos para el selector o precarga por foodId
  useEffect(() => {
    if (!userId || (!isPickList && foodId === undefined)) return;
    void loadMyFoods(userId);
  }, [userId, isPickList, foodId, loadMyFoods]);

  // Modo foodId: cargar el catálogo y precargar el alimento elegido.
  // applyFood se llama después del await (no es setState síncrono dentro del efecto).
  useEffect(() => {
    if (foodId === undefined || !userId || selectedFood !== null) return;
    let cancelled = false;
    void (async () => {
      await loadMyFoods(userId);
      if (cancelled) return;
      const food = useNutritionStore.getState().myFoods.find((f) => f.id === foodId);
      if (!food) return;
      setSelectedFood(food);
      setName(food.name);
      if (food.kcal_100g !== null) {
        setPer100({
          kcal: food.kcal_100g,
          protein: food.protein_g_100g,
          carbs: food.carbs_g_100g,
          fat: food.fat_g_100g,
        });
        setPortion(String(food.default_serving_grams ?? 100));
      } else {
        setPer100(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [foodId, userId, selectedFood, loadMyFoods]);

  const portionNum = Number(portion) || 0;
  const computed = per100
    ? macrosForPortion(per100, portionNum)
    : {
        kcal: Number(kcalText) || 0,
        protein: Number(proteinText) || 0,
        carbs: Number(carbsText) || 0,
        fat: Number(fatText) || 0,
      };

  const macroSource: MacroSource = offProduct
    ? 'openfoodfacts'
    : selectedFood
      ? 'user_food'
      : 'manual';

  const filteredFoods = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = myFoods;
    if (pickTab === 'favorites') list = list.filter((f) => f.is_favorite);
    if (pickTab === 'created') list = list.filter((f) => f.source === 'manual' || f.source === 'voice');
    if (query) list = list.filter((f) => f.name.toLowerCase().includes(query) || (f.brand ?? '').toLowerCase().includes(query));
    return [...list].sort((a, b) => {
      if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [myFoods, search, pickTab]);

  const recentFoods = useMemo(
    () => [...myFoods].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 8),
    [myFoods],
  );

  const recentMeals = useMemo(() => {
    const seen = new Set<string>();
    return [...dayMeals]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .filter((m) => {
        const key = m.food_id ?? m.title ?? m.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 5);
  }, [dayMeals]);

  const pickFood = (food: FoodRow) => {
    navigation.replace('FoodDetail', { mealType, foodId: food.id });
  };

  const goToManual = () => {
    navigation.replace('FoodDetail', { mealType, entryMode: 'manual' });
  };

  const goToPick = () => {
    navigation.replace('FoodDetail', { mealType, entryMode: 'pick' });
  };

  if (isPickList) {
    const pickTabs = [t.nutrition.tab_all, t.nutrition.tab_favorites, t.nutrition.tab_created];
    const pickTabIndex = pickTab === 'all' ? 0 : pickTab === 'favorites' ? 1 : 2;
    const mealLabel = t.nutrition[mealLabelKey(mealType)];

    return (
      <View style={styles.flex}>
        <View style={[styles.pickTop, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.pickSearchRow}>
            <Input
              icon="search-outline"
              value={search}
              onChangeText={setSearch}
              placeholder={t.nutrition.search_foods}
              containerStyle={styles.pickSearchInput}
            />
            <IconButton icon="close" onPress={() => navigation.goBack()} accessibilityLabel="Cerrar" />
          </View>
          <SegmentedTabs
            tabs={pickTabs}
            activeIndex={pickTabIndex}
            onChange={(idx) => setPickTab(idx === 0 ? 'all' : idx === 1 ? 'favorites' : 'created')}
          />
          <AppText variant="body12" color={colors.text.tertiary} style={styles.pickMealHint}>
            {i18n(t.nutrition.add_to_meal, { meal: mealLabel })}
          </AppText>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: layout.screenPadding,
            paddingBottom: insets.bottom + 88,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {foodsLoading && myFoods.length === 0 ? (
            <CardSkeleton />
          ) : (
            <>
              {!search.trim() && pickTab === 'all' ? (
                <>
                  <AppText variant="caps11" color={colors.text.tertiary} style={styles.pickSectionLabel}>
                    {t.nutrition.recent_foods}
                  </AppText>
                  {recentFoods.length === 0 ? (
                    <AppText variant="body13" color={colors.text.disabled} style={styles.pickSectionEmpty}>
                      {t.nutrition.pick_empty}
                    </AppText>
                  ) : (
                    recentFoods.map((food) => (
                      <FoodSearchRow
                        key={`recent-${food.id}`}
                        food={food}
                        onPress={() => pickFood(food)}
                        onToggleFavorite={() => void toggleFavoriteFood(food.id)}
                      />
                    ))
                  )}

                  <AppText variant="caps11" color={colors.text.tertiary} style={styles.pickSectionLabelSpaced}>
                    {t.nutrition.recent_meals}
                  </AppText>
                  {recentMeals.length === 0 ? (
                    <AppText variant="body13" color={colors.text.disabled} style={styles.pickSectionEmpty}>
                      {t.nutrition.no_recent_meals}
                    </AppText>
                  ) : (
                    recentMeals.map((meal) => (
                      <Pressable
                        key={`meal-${meal.id}`}
                        accessibilityRole="button"
                        onPress={() => {
                          if (meal.food_id) {
                            const food = myFoods.find((f) => f.id === meal.food_id);
                            if (food) pickFood(food);
                            return;
                          }
                          navigation.navigate('FoodDetail', { mealType, mealLogId: meal.id });
                        }}
                        style={({ pressed }) => [styles.recentMealRow, pressed && styles.pressed]}
                      >
                        <View style={styles.recentMealMain}>
                          <AppText variant="body14SemiBold" color={colors.text.primary} numberOfLines={1}>
                            {meal.title ?? meal.product_display_name}
                          </AppText>
                          <AppText variant="body12" color={colors.text.tertiary}>
                            {Math.round(meal.energy_kcal ?? 0)} kcal
                          </AppText>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
                      </Pressable>
                    ))
                  )}
                </>
              ) : null}

              {search.trim() || pickTab !== 'all' ? (
                <>
                  <AppText variant="caps11" color={colors.text.tertiary} style={styles.pickSectionLabel}>
                    {pickTab === 'favorites' ? t.nutrition.tab_favorites : pickTab === 'created' ? t.nutrition.tab_created : t.nutrition.tab_all}
                  </AppText>
                  {filteredFoods.length === 0 ? (
                    <View style={styles.pickEmpty}>
                      <AppText variant="body14" color={colors.text.secondary} align="center">
                        {t.nutrition.no_records}
                      </AppText>
                      <Button label={t.nutrition.create_new_food} onPress={goToManual} fullWidth style={styles.pickEmptyBtn} />
                    </View>
                  ) : (
                    filteredFoods.map((food) => (
                      <FoodSearchRow
                        key={food.id}
                        food={food}
                        onPress={() => pickFood(food)}
                        onToggleFavorite={() => void toggleFavoriteFood(food.id)}
                      />
                    ))
                  )}
                </>
              ) : null}
            </>
          )}
        </ScrollView>

        <View style={[styles.pickBottomBar, { paddingBottom: insets.bottom + spacing.sm }]}>
          <Pressable style={styles.pickBottomAction} onPress={() => navigation.navigate('BarcodeScanner', { mealType })}>
            <Ionicons name="barcode-outline" size={20} color={colors.text.primary} />
            <AppText variant="body12" color={colors.text.secondary}>
              {t.nutrition.scan}
            </AppText>
          </Pressable>
          <Pressable style={styles.pickBottomAction} onPress={() => navigation.navigate('VoiceLog', { mealType })}>
            <Ionicons name="mic-outline" size={20} color={colors.text.primary} />
            <AppText variant="body12" color={colors.text.secondary}>
              {t.nutrition.voice}
            </AppText>
          </Pressable>
          <Pressable style={styles.pickBottomAction} onPress={goToManual}>
            <Ionicons name="create-outline" size={20} color={colors.text.primary} />
            <AppText variant="body12" color={colors.text.secondary}>
              {t.nutrition.manual_entry}
            </AppText>
          </Pressable>
        </View>
      </View>
    );
  }

  const onSave = async () => {
    if (!userId) return;
    const title = name.trim();
    if (!title) {
      useUiStore.getState().showToast('error', 'Poné un nombre para la comida.');
      return;
    }
    setSaving(true);

    let linkedFoodId: string | null = selectedFood?.id ?? null;
    if (saveToFoods && !isEdit && !selectedFood) {
      const saved = await saveFood(userId, {
        name: title,
        source: offProduct ? 'openfoodfacts' : 'manual',
        brand: offProduct?.brands ?? null,
        barcode: offProduct?.code ?? barcode ?? null,
        openfoodfacts_code: offProduct?.code ?? null,
        kcal_100g: per100?.kcal ?? null,
        protein_g_100g: per100?.protein ?? null,
        carbs_g_100g: per100?.carbs ?? null,
        fat_g_100g: per100?.fat ?? null,
        default_serving_grams: portionNum > 0 ? portionNum : null,
      });
      if (saved) linkedFoodId = saved.id;
    }

    const ok = isEdit
      ? await updateMeal(mealLogId, {
          title,
          product_display_name: title,
          meal_type: MEAL_TYPES[mealTypeIdx],
          portion_grams: portionNum > 0 ? portionNum : null,
          energy_kcal: computed.kcal,
          protein_g: computed.protein,
          carbs_g: computed.carbs,
          fat_g: computed.fat,
        })
      : await addMeal(userId, {
          mealType: MEAL_TYPES[mealTypeIdx],
          title,
          foodId: linkedFoodId,
          openfoodfactsCode: offProduct?.code ?? null,
          macroSource,
          portionGrams: portionNum > 0 ? portionNum : null,
          kcal: computed.kcal,
          protein: computed.protein,
          carbs: computed.carbs,
          fat: computed.fat,
        });

    setSaving(false);
    if (ok) {
      hapticSuccess();
      useUiStore.getState().showToast('success', isEdit ? 'Cambios guardados' : 'Comida agregada');
      navigation.goBack();
    } else {
      useUiStore.getState().showToast('error', 'No pudimos guardar la comida.');
    }
  };

  const onDelete = () => {
    if (!mealLogId) return;
    Alert.alert('Eliminar registro', '¿Seguro que querés eliminar esta comida?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const ok = await deleteMeal(mealLogId);
            if (ok) {
              hapticSuccess();
              useUiStore.getState().showToast('success', 'Comida eliminada');
              navigation.goBack();
            } else {
              useUiStore.getState().showToast('error', 'No pudimos eliminar la comida.');
            }
          })();
        },
      },
    ]);
  };

  const offFailed = offStatus === 'error' || offStatus === 'notfound';

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.xxl,
          paddingHorizontal: layout.screenPadding,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <AppText variant="h2" color={colors.text.primary}>
            {isEdit ? 'Editar comida' : isManualNew ? t.nutrition.manual_entry : 'Agregar comida'}
          </AppText>
          <IconButton icon="close" onPress={() => navigation.goBack()} accessibilityLabel="Cerrar" />
        </View>

        {isManualNew ? (
          <Pressable
            accessibilityRole="button"
            onPress={goToPick}
            style={({ pressed }) => [styles.switchModeLink, pressed && styles.pressed]}
          >
            <Ionicons name="bookmark-outline" size={16} color={colors.primary.default} />
            <AppText variant="body13SemiBold" color={colors.primary.default}>
              {t.nutrition.add_from_saved_title}
            </AppText>
          </Pressable>
        ) : null}

        {offStatus === 'loading' ? (
          <>
            <Skeleton height={120} style={styles.offSkeleton} />
            <CardSkeleton />
          </>
        ) : (
          <>
            {offFailed ? (
              <View style={styles.offErrorBanner}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.states.warning} />
                <AppText variant="body13" color={colors.text.secondary} style={styles.offErrorText}>
                  No encontramos ese producto. Cargalo manualmente.
                </AppText>
                {offStatus === 'error' ? (
                  <Pressable
                    onPress={() => {
                      setOffStatus('loading');
                      void loadOff();
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                  >
                    <AppText variant="body13SemiBold" color={colors.primary.default}>
                      Reintentar
                    </AppText>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {/* Producto Open Food Facts */}
            {offProduct ? (
              <View style={styles.offCard}>
                {offProduct.imageUrl ? (
                  <Image source={{ uri: offProduct.imageUrl }} style={styles.offImage} contentFit="cover" />
                ) : null}
                <View style={styles.offInfo}>
                  <AppText variant="body14SemiBold" color={colors.text.primary} numberOfLines={2}>
                    {offProduct.productName}
                  </AppText>
                  {offProduct.brands ? (
                    <AppText variant="body12" color={colors.text.secondary} numberOfLines={1}>
                      {offProduct.brands}
                    </AppText>
                  ) : null}
                  <AppText variant="body12" color={colors.text.tertiary} style={styles.offAttribution}>
                    © Open Food Facts (ODbL)
                  </AppText>
                </View>
              </View>
            ) : null}

            <Input
              label="Nombre"
              value={name}
              onChangeText={setName}
              placeholder="Ej: Milanesa con puré"
              containerStyle={styles.field}
            />

            <AppText variant="caps12" color={colors.text.tertiary} style={styles.fieldLabel}>
              Comida
            </AppText>
            <SegmentedTabs tabs={[...MEAL_TYPES]} activeIndex={mealTypeIdx} onChange={setMealTypeIdx} />

            <Input
              label="Porción (g)"
              value={portion}
              onChangeText={setPortion}
              keyboardType="numeric"
              placeholder="100"
              containerStyle={styles.field}
            />
            <View style={styles.chipsRow}>
              {QUICK_PORTIONS.map((grams) => (
                <Chip
                  key={grams}
                  label={`${grams}g`}
                  active={portionNum === grams}
                  onPress={() => setPortion(String(grams))}
                />
              ))}
            </View>

            {(per100 || isEdit || Number(kcalText) > 0) ? (
              <View style={styles.macroCardsRow}>
                {(
                  [
                    { label: 'kcal', value: String(computed.kcal) },
                    { label: t.nutrition.proteins_label, value: `${computed.protein} g` },
                    { label: t.nutrition.carbs_label, value: `${computed.carbs} g` },
                    { label: t.nutrition.fats_label, value: `${computed.fat} g` },
                  ] as const
                ).map((stat) => (
                  <View key={stat.label} style={styles.macroCard}>
                    <AppText variant="body14SemiBold" color={colors.text.primary}>
                      {stat.value}
                    </AppText>
                    <AppText variant="body12" color={colors.text.tertiary} numberOfLines={1}>
                      {stat.label}
                    </AppText>
                  </View>
                ))}
              </View>
            ) : null}

            {!per100 ? (
              <>
                <View style={styles.manualRow}>
                  <Input
                    label="Kcal"
                    value={kcalText}
                    onChangeText={setKcalText}
                    keyboardType="numeric"
                    placeholder="0"
                    containerStyle={styles.manualField}
                  />
                  <Input
                    label="Proteínas (g)"
                    value={proteinText}
                    onChangeText={setProteinText}
                    keyboardType="numeric"
                    placeholder="0"
                    containerStyle={styles.manualField}
                  />
                </View>
                <View style={styles.manualRow}>
                  <Input
                    label="Carbos (g)"
                    value={carbsText}
                    onChangeText={setCarbsText}
                    keyboardType="numeric"
                    placeholder="0"
                    containerStyle={styles.manualField}
                  />
                  <Input
                    label="Grasas (g)"
                    value={fatText}
                    onChangeText={setFatText}
                    keyboardType="numeric"
                    placeholder="0"
                    containerStyle={styles.manualField}
                  />
                </View>
              </>
            ) : null}

            {!isEdit && !selectedFood ? (
              <Pressable
                onPress={() => setSaveToFoods((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: saveToFoods }}
                style={styles.checkRow}
              >
                <Ionicons
                  name={saveToFoods ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={saveToFoods ? colors.primary.default : colors.text.tertiary}
                />
                <AppText variant="body14" color={colors.text.secondary}>
                  Guardar en mis alimentos
                </AppText>
              </Pressable>
            ) : null}

            <Button
              label={
                isEdit
                  ? 'Guardar cambios'
                  : i18n(t.nutrition.add_to_meal, { meal: t.nutrition[mealLabelKey(MEAL_TYPES[mealTypeIdx])] })
              }
              onPress={() => void onSave()}
              loading={saving}
              fullWidth
              style={styles.cta}
            />

            {isEdit ? (
              <Pressable onPress={onDelete} accessibilityRole="button" style={styles.deleteButton}>
                <Ionicons name="trash-outline" size={18} color={colors.states.error} />
                <AppText variant="body16SemiBold" color={colors.states.error}>
                  Eliminar
                </AppText>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  offSkeleton: { marginBottom: spacing.md },
  offErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  offErrorText: { flex: 1 },
  offCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  offImage: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.surface.elevated,
  },
  offInfo: { flex: 1, justifyContent: 'center' },
  offAttribution: { marginTop: spacing.xxs },
  field: { marginTop: spacing.md },
  fieldLabel: { marginTop: spacing.md, marginBottom: spacing.xs },
  chipsRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  macroCardsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  macroCard: {
    flex: 1,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xxs,
    alignItems: 'center',
    gap: 2,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  statCell: { flex: 1, alignItems: 'center', gap: spacing.xxs },
  manualRow: { flexDirection: 'row', gap: spacing.sm },
  manualField: { flex: 1, marginTop: spacing.md },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    minHeight: layout.minHitTarget,
  },
  foodsEmpty: { paddingVertical: spacing.sm },
  pickEmpty: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  pickEmptyBtn: { alignSelf: 'stretch' },
  pickFooterBtn: { marginTop: spacing.lg },
  pickTop: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  pickSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pickSearchInput: { flex: 1, marginTop: 0 },
  pickMealHint: { marginTop: -spacing.xxs },
  pickSectionLabel: {
    letterSpacing: 0.6,
    marginTop: spacing.md,
    marginBottom: spacing.xxs,
  },
  pickSectionLabelSpaced: {
    letterSpacing: 0.6,
    marginTop: spacing.lg,
    marginBottom: spacing.xxs,
  },
  pickSectionEmpty: {
    paddingVertical: spacing.sm,
  },
  recentMealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  recentMealMain: { flex: 1, gap: 2 },
  pickBottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface.base,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  pickBottomAction: {
    alignItems: 'center',
    gap: 4,
    minWidth: 72,
    paddingVertical: spacing.xxs,
  },
  switchModeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    marginBottom: spacing.sm,
    minHeight: layout.minHitTarget,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
  },
  foodRowActive: { borderColor: colors.primary.default },
  foodInfo: { flex: 1 },
  starButton: { borderWidth: 0, width: 36, height: 36 },
  pressed: { opacity: 0.7 },
  cta: { marginTop: spacing.xl },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    minHeight: layout.minHitTarget,
  },
});
