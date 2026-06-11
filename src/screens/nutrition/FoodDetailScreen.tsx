import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, layout, radius, spacing } from '../../theme';
import {
  AppText,
  Button,
  CardSkeleton,
  Chip,
  IconButton,
  Input,
  SectionHeader,
  SegmentedTabs,
  Skeleton,
} from '../../components/common';
import { hapticSuccess } from '../../lib/haptics';
import { fetchProductByBarcode, macrosForPortion, type OffProduct } from '../../services/openFoodFacts';
import { useAuthStore } from '../../stores/authStore';
import { useNutritionStore } from '../../stores/nutritionStore';
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

export function FoodDetailScreen({ navigation, route }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { mealType, foodId, barcode, mealLogId } = route.params;

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
  const isPicker = !isEdit && barcode === undefined && foodId === undefined;

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

  // Cargar mis alimentos para el selector
  useEffect(() => {
    if (!userId || !isPicker) return;
    void loadMyFoods(userId);
  }, [userId, isPicker, loadMyFoods]);

  const applyFood = (food: FoodRow) => {
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
  };

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

  const filteredFoods = myFoods.filter((f) => f.name.toLowerCase().includes(search.trim().toLowerCase()));

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
            {isEdit ? 'Editar comida' : 'Agregar comida'}
          </AppText>
          <IconButton icon="close" onPress={() => navigation.goBack()} accessibilityLabel="Cerrar" />
        </View>

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

            {per100 ? (
              <View style={styles.statsRow}>
                {(
                  [
                    { label: 'Kcal', value: String(computed.kcal) },
                    { label: 'Prot', value: `${computed.protein}g` },
                    { label: 'Carbs', value: `${computed.carbs}g` },
                    { label: 'Grasas', value: `${computed.fat}g` },
                  ] as const
                ).map((stat) => (
                  <View key={stat.label} style={styles.statCell}>
                    <AppText variant="metricSmall" color={colors.text.primary}>
                      {stat.value}
                    </AppText>
                    <AppText variant="caps11" color={colors.text.tertiary}>
                      {stat.label}
                    </AppText>
                  </View>
                ))}
              </View>
            ) : (
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
            )}

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

            {/* Catálogo personal (modo búsqueda/manual) */}
            {isPicker ? (
              <>
                <SectionHeader title="Mis alimentos" />
                <Input
                  icon="search-outline"
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Buscar en mis alimentos"
                  containerStyle={styles.field}
                />
                {foodsLoading && myFoods.length === 0 ? (
                  <CardSkeleton />
                ) : filteredFoods.length === 0 ? (
                  <AppText variant="body13" color={colors.text.disabled} style={styles.foodsEmpty}>
                    {myFoods.length === 0 ? 'Todavía no guardaste alimentos.' : 'Sin resultados para tu búsqueda.'}
                  </AppText>
                ) : (
                  filteredFoods.map((food) => (
                    <Pressable
                      key={food.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Elegir ${food.name}`}
                      onPress={() => applyFood(food)}
                      style={({ pressed }) => [
                        styles.foodRow,
                        selectedFood?.id === food.id && styles.foodRowActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.foodInfo}>
                        <AppText variant="body14Medium" color={colors.text.primary} numberOfLines={1}>
                          {food.name}
                        </AppText>
                        <AppText variant="body12" color={colors.text.tertiary} numberOfLines={1}>
                          {food.brand ? `${food.brand} · ` : ''}
                          {food.kcal_100g !== null ? `${Math.round(food.kcal_100g)} kcal / 100g` : 'Sin datos por 100g'}
                        </AppText>
                      </View>
                      <IconButton
                        icon={food.is_favorite ? 'star' : 'star-outline'}
                        onPress={() => void toggleFavoriteFood(food.id)}
                        accessibilityLabel={food.is_favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
                        size={18}
                        color={food.is_favorite ? colors.primary.default : colors.text.tertiary}
                        backgroundColor="transparent"
                        style={styles.starButton}
                      />
                    </Pressable>
                  ))
                )}
              </>
            ) : null}

            <Button
              label={isEdit ? 'Guardar cambios' : 'Agregar'}
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

const styles = StyleSheet.create({
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
