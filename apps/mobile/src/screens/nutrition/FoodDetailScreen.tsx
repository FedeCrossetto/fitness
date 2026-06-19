import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import {
  AppText,
  Button,
  Card,
  CardSkeleton,
  Chip,
  IconButton,
  Input,
  SegmentedTabs,
  Skeleton,
} from '../../components/common';
import { FoodIconPicker, DEFAULT_FOOD_ICON_KEY } from '../../components/nutrition/FoodIconPicker';
import { FoodIconThumb } from '../../components/nutrition/FoodIconThumb';
import { isFoodIconKey, type FoodIconKey } from '../../components/nutrition/foodIconCatalog';
import {
  DEFAULT_SERVING_UNIT,
  defaultPortionAmount,
  formatMacroAmount,
  formatMacroDisplay,
  formatPortionAmount,
  isServingUnit,
  hasStoredMacros,
  macrosForServing,
  macrosToStored,
  parseMacroAmount,
  parsePortionAmount,
  QUICK_PORTIONS_BY_UNIT,
  quickPortionLabel,
  resolveMacroBasisUnit,
  sanitizeMacroInput,
  sanitizePortionInput,
  SERVING_UNITS,
  type ServingUnit,
  type StoredMacros,
} from '@reset-fitness/shared';
import { hapticSuccess, hapticWarning } from '../../lib/haptics';
import { storedMacrosFromPer100, validateFoodForm } from '../../lib/foodFormValidation';
import { fetchProductByBarcode, type OffProduct } from '../../services/openFoodFacts';
import { useAuthStore } from '../../stores/authStore';
import { useNutritionStore } from '../../stores/nutritionStore';
import { useTranslation } from '../../stores/i18nStore';
import { useUiStore } from '../../stores/uiStore';
import type { FoodRow, MacroSource, MealType, TrainerFoodRow } from '../../types/database';
import type { NutritionStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<NutritionStackParamList, 'FoodDetail'>;

const MEAL_TYPES: MealType[] = ['DES', 'ALM', 'MER', 'CEN'];

interface Per100 {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

type OffStatus = 'idle' | 'loading' | 'error' | 'notfound' | 'done';

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

type FoodMacroFields = Pick<
  FoodRow,
  'kcal_100g' | 'protein_g_100g' | 'carbs_g_100g' | 'fat_g_100g' | 'default_serving_grams' | 'serving_unit'
>;

function applyStoredFoodMacros(
  food: FoodMacroFields,
  setters: {
    setPer100: (value: Per100 | null) => void;
    setPortion: (value: string) => void;
    setPortionUnit: (value: ServingUnit) => void;
  },
): void {
  const stored: StoredMacros = {
    kcal: food.kcal_100g,
    protein: food.protein_g_100g,
    carbs: food.carbs_g_100g,
    fat: food.fat_g_100g,
  };
  if (!hasStoredMacros(stored)) {
    setters.setPer100(null);
    return;
  }
  const unit = isServingUnit(food.serving_unit) ? food.serving_unit : DEFAULT_SERVING_UNIT;
  const amount = food.default_serving_grams ?? defaultPortionAmount(unit);
  setters.setPer100(stored);
  setters.setPortion(formatPortionAmount(amount, unit));
  setters.setPortionUnit(unit);
}

export function FoodDetailScreen({ navigation, route }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t, i18n } = useTranslation();

  const insets = useSafeAreaInsets();
  const { mealType, foodId, trainerFoodId, barcode, mealLogId, entryMode, initialName, voiceTranscript } =
    route.params;

  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;

  const dayMeals = useNutritionStore((s) => s.meals);
  const loadMyFoods = useNutritionStore((s) => s.loadMyFoods);
  const loadTrainerCatalog = useNutritionStore((s) => s.loadTrainerCatalog);
  const saveFood = useNutritionStore((s) => s.saveFood);
  const updateFood = useNutritionStore((s) => s.updateFood);
  const deleteFood = useNutritionStore((s) => s.deleteFood);
  const submitFoodForApproval = useNutritionStore((s) => s.submitFoodForApproval);
  const addMeal = useNutritionStore((s) => s.addMeal);
  const updateMeal = useNutritionStore((s) => s.updateMeal);
  const deleteMeal = useNutritionStore((s) => s.deleteMeal);

  const isEdit = mealLogId !== undefined;
  /** Crear alimento propio (solapa Creados) → solicitud al entrenador. */
  const isCatalogCreate =
    !isEdit && entryMode === 'create' && foodId === undefined && trainerFoodId === undefined;
  /** Editar alimento creado por el usuario. */
  const isCatalogEdit = !isEdit && entryMode === 'edit' && foodId !== undefined;
  /** Registrar porción en el día (desayuno, almuerzo, etc.). */
  const isAddToMeal = !isCatalogCreate && !isCatalogEdit;

  // Modo edición: semilla inicial desde el registro existente (sin efecto, sin flash).
  const editMeal = mealLogId ? dayMeals.find((m) => m.id === mealLogId) ?? null : null;

  const [name, setName] = useState(
    editMeal?.title ?? editMeal?.product_display_name ?? initialName ?? '',
  );
  const [portion, setPortion] = useState(
    editMeal?.portion_grams != null ? String(editMeal.portion_grams) : '100'
  );
  const [portionUnit, setPortionUnit] = useState<ServingUnit>(() => {
    if (editMeal?.portion_unit && isServingUnit(editMeal.portion_unit)) return editMeal.portion_unit;
    return DEFAULT_SERVING_UNIT;
  });
  const [per100, setPer100] = useState<Per100 | null>(null);
  const [kcalText, setKcalText] = useState(
    editMeal?.energy_kcal != null ? formatMacroAmount(editMeal.energy_kcal) : '',
  );
  const [proteinText, setProteinText] = useState(
    editMeal?.protein_g != null ? formatMacroAmount(editMeal.protein_g) : '',
  );
  const [carbsText, setCarbsText] = useState(
    editMeal?.carbs_g != null ? formatMacroAmount(editMeal.carbs_g) : '',
  );
  const [fatText, setFatText] = useState(
    editMeal?.fat_g != null ? formatMacroAmount(editMeal.fat_g) : '',
  );
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
  const [selectedTrainerFood, setSelectedTrainerFood] = useState<TrainerFoodRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [catalogEditLoaded, setCatalogEditLoaded] = useState(false);
  const offAlertShown = useRef<'notfound' | 'error' | null>(null);
  const [iconKey, setIconKey] = useState<FoodIconKey>(() => {
    if (editMeal?.icon_key && isFoodIconKey(editMeal.icon_key)) return editMeal.icon_key;
    return DEFAULT_FOOD_ICON_KEY;
  });

  const remotePhoto = offProduct?.imageUrl ?? null;
  const showIconPicker = true;

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

  useEffect(() => {
    if (barcode === undefined) return;
    if (offStatus === 'notfound' && offAlertShown.current !== 'notfound') {
      offAlertShown.current = 'notfound';
      Alert.alert(t.nutrition.scan_not_found_title, t.nutrition.scan_not_found_message, [
        { text: t.ui.confirm },
      ]);
    } else if (offStatus === 'error' && offAlertShown.current !== 'error') {
      offAlertShown.current = 'error';
      Alert.alert(t.nutrition.scan_error_title, t.nutrition.scan_error_message, [
        { text: t.ui.retry, onPress: () => {
          setOffStatus('loading');
          void loadOff();
        } },
        { text: t.ui.cancel, style: 'cancel' },
      ]);
    } else if (offStatus === 'done') {
      offAlertShown.current = null;
    }
  }, [barcode, offStatus, t]);

  // Cargar alimentos personales al editar catálogo
  useEffect(() => {
    if (!userId || foodId === undefined) return;
    void loadMyFoods(userId);
  }, [userId, foodId, loadMyFoods]);

  // Modo foodId: precargar alimento personal (agregar al día o editar catálogo).
  useEffect(() => {
    if (foodId === undefined || !userId) return;

    if (isCatalogEdit) {
      if (catalogEditLoaded) return;
      let cancelled = false;
      void (async () => {
        await loadMyFoods(userId);
        if (cancelled) return;
        const food = useNutritionStore.getState().myFoods.find((f) => f.id === foodId);
        if (!food) return;
        setName(food.name);
        if (food.icon_key && isFoodIconKey(food.icon_key)) {
          setIconKey(food.icon_key);
        }
        applyStoredFoodMacros(food, { setPer100, setPortion, setPortionUnit });
        setCatalogEditLoaded(true);
      })();
      return () => {
        cancelled = true;
      };
    }

    if (selectedFood !== null) return;
    let cancelled = false;
    void (async () => {
      await loadMyFoods(userId);
      if (cancelled) return;
      const food = useNutritionStore.getState().myFoods.find((f) => f.id === foodId);
      if (!food) return;
      setSelectedFood(food);
      setName(food.name);
      if (food.icon_key && isFoodIconKey(food.icon_key)) {
        setIconKey(food.icon_key);
      }
      applyStoredFoodMacros(food, { setPer100, setPortion, setPortionUnit });
    })();
    return () => {
      cancelled = true;
    };
  }, [foodId, userId, isCatalogEdit, catalogEditLoaded, selectedFood, loadMyFoods]);

  // Modo trainerFoodId: precargar alimento del catálogo del entrenador.
  useEffect(() => {
    if (trainerFoodId === undefined || !userId || selectedTrainerFood !== null) return;
    let cancelled = false;
    void (async () => {
      await loadTrainerCatalog(userId);
      if (cancelled) return;
      const food = useNutritionStore.getState().trainerFoods.find((f) => f.id === trainerFoodId);
      if (!food) return;
      setSelectedTrainerFood(food);
      setName(food.name);
      if (food.icon_key && isFoodIconKey(food.icon_key)) {
        setIconKey(food.icon_key);
      }
      applyStoredFoodMacros(food, { setPer100, setPortion, setPortionUnit });
    })();
    return () => {
      cancelled = true;
    };
  }, [trainerFoodId, userId, selectedTrainerFood, loadTrainerCatalog]);

  const portionNum = parsePortionAmount(portion, portionUnit);
  const macroBasisUnit = resolveMacroBasisUnit({
    offProduct: !!offProduct,
    foodServingUnit: selectedTrainerFood?.serving_unit ?? selectedFood?.serving_unit,
    portionUnit,
  });
  const computed = per100
    ? macrosForServing(per100, portionNum, macroBasisUnit)
    : {
        kcal: parseMacroAmount(kcalText) ?? 0,
        protein: parseMacroAmount(proteinText) ?? 0,
        carbs: parseMacroAmount(carbsText) ?? 0,
        fat: parseMacroAmount(fatText) ?? 0,
      };

  const macroSource: MacroSource = offProduct
    ? 'openfoodfacts'
    : selectedTrainerFood
      ? 'catalog'
      : selectedFood
        ? 'user_food'
        : voiceTranscript
          ? 'voice'
          : 'manual';

  const mealTabs = useMemo(
    () => MEAL_TYPES.map((type) => t.nutrition[mealLabelKey(type)]),
    [t],
  );

  const requiresMacroInput = isCatalogCreate || isCatalogEdit || (!selectedFood && !selectedTrainerFood && !offProduct);
  const hasCatalogMacros = selectedFood != null || selectedTrainerFood != null || offProduct != null;

  const showFormError = (messageKey: keyof typeof t.nutrition) => {
    hapticWarning();
    Alert.alert(t.nutrition.validation_title, t.nutrition[messageKey] as string, [{ text: t.ui.confirm }]);
  };

  const validateBeforeSave = (): boolean => {
    const errorKey = validateFoodForm({
      name,
      portionAmount: portionNum,
      offStatus,
      hasCatalogMacros,
      storedMacros: storedMacrosFromPer100(per100),
      computedKcal: computed.kcal,
      computedProtein: computed.protein,
      computedCarbs: computed.carbs,
      computedFat: computed.fat,
      requiresMacroInput,
    });
    if (errorKey) {
      showFormError(errorKey);
      return false;
    }
    return true;
  };

  const onSaveCatalogEdit = async () => {
    if (!userId || foodId === undefined) return;
    if (!validateBeforeSave()) return;
    const title = name.trim();
    setSaving(true);

    const servingAmount = portionNum > 0 ? portionNum : defaultPortionAmount(portionUnit);
    const per100Macros = per100 ?? macrosToStored(computed, servingAmount, portionUnit);

    const updated = await updateFood(foodId, {
      name: title,
      kcal_100g: per100Macros.kcal,
      protein_g_100g: per100Macros.protein,
      carbs_g_100g: per100Macros.carbs,
      fat_g_100g: per100Macros.fat,
      default_serving_grams: servingAmount,
      serving_unit: portionUnit,
      icon_key: iconKey,
    });

    setSaving(false);
    if (updated) {
      hapticSuccess();
      useUiStore.getState().showToast('success', t.nutrition.food_updated);
      navigation.goBack();
    } else {
      Alert.alert(t.nutrition.validation_title, t.nutrition.save_food_error, [{ text: t.ui.confirm }]);
    }
  };

  const onSaveCatalog = async () => {
    if (!userId) return;
    if (!validateBeforeSave()) return;
    const title = name.trim();
    setSaving(true);

    const servingAmount = portionNum > 0 ? portionNum : defaultPortionAmount(portionUnit);
    const per100Macros = per100 ?? macrosToStored(computed, servingAmount, portionUnit);

    const saved = await saveFood(userId, {
      name: title,
      source: offProduct ? 'openfoodfacts' : voiceTranscript ? 'voice' : barcode ? 'barcode' : 'manual',
      brand: offProduct?.brands ?? null,
      barcode: offProduct?.code ?? barcode ?? null,
      openfoodfacts_code: offProduct?.code ?? null,
      voice_transcript: voiceTranscript ?? null,
      kcal_100g: per100Macros.kcal,
      protein_g_100g: per100Macros.protein,
      carbs_g_100g: per100Macros.carbs,
      fat_g_100g: per100Macros.fat,
      default_serving_grams: servingAmount,
      serving_unit: portionUnit,
      icon_key: iconKey,
    });

    setSaving(false);
    if (saved) {
      await submitFoodForApproval(userId, saved);
      hapticSuccess();
      useUiStore.getState().showToast('success', t.nutrition.food_saved_pending);
      navigation.goBack();
    } else {
      Alert.alert(t.nutrition.validation_title, t.nutrition.save_food_error, [{ text: t.ui.confirm }]);
    }
  };

  const onSave = async () => {
    if (isCatalogCreate) {
      await onSaveCatalog();
      return;
    }
    if (isCatalogEdit) {
      await onSaveCatalogEdit();
      return;
    }
    if (!userId) return;
    if (!validateBeforeSave()) return;
    const title = name.trim();
    setSaving(true);

    const resolvedIconKey = iconKey;

    const ok = isEdit
      ? await updateMeal(mealLogId, {
          title,
          product_display_name: title,
          meal_type: MEAL_TYPES[mealTypeIdx],
          portion_grams: portionNum > 0 ? portionNum : null,
          portion_unit: macroBasisUnit,
          energy_kcal: computed.kcal,
          protein_g: computed.protein,
          carbs_g: computed.carbs,
          fat_g: computed.fat,
          icon_key: resolvedIconKey,
          photo_url: null,
        })
      : await addMeal(userId, {
          mealType: MEAL_TYPES[mealTypeIdx],
          title,
          foodId: selectedFood?.id ?? null,
          trainerFoodId: selectedTrainerFood?.id ?? null,
          openfoodfactsCode: offProduct?.code ?? null,
          macroSource,
          portionGrams: portionNum > 0 ? portionNum : null,
          portionUnit: macroBasisUnit,
          kcal: computed.kcal,
          protein: computed.protein,
          carbs: computed.carbs,
          fat: computed.fat,
          iconKey: resolvedIconKey ?? selectedFood?.icon_key ?? selectedTrainerFood?.icon_key ?? null,
          photoUrl: null,
        });

    setSaving(false);
    if (ok) {
      hapticSuccess();
      useUiStore.getState().showToast('success', isEdit ? 'Cambios guardados' : 'Comida agregada');
      navigation.goBack();
    } else {
      Alert.alert(t.nutrition.validation_title, t.nutrition.save_meal_error, [{ text: t.ui.confirm }]);
    }
  };

  const onDeleteMeal = () => {
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

  const onDeleteCatalogFood = () => {
    if (foodId === undefined) return;
    Alert.alert(t.nutrition.delete_food_title, i18n(t.nutrition.delete_food_confirm, { name: name.trim() || 'este alimento' }), [
      { text: t.ui.cancel, style: 'cancel' },
      {
        text: t.ui.delete,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const ok = await deleteFood(foodId);
            if (ok) {
              hapticSuccess();
              useUiStore.getState().showToast('success', t.nutrition.food_deleted);
              navigation.goBack();
            } else {
              useUiStore.getState().showToast('error', 'No pudimos eliminar el alimento.');
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
            {isEdit
              ? 'Editar comida'
              : isCatalogEdit
                ? t.nutrition.edit_food_title
                : isCatalogCreate
                  ? t.nutrition.create_food_title
                  : 'Agregar comida'}
          </AppText>
          <IconButton icon="close" onPress={() => navigation.goBack()} accessibilityLabel="Cerrar" />
        </View>

        {isCatalogCreate || isCatalogEdit ? (
          <AppText variant="body13" color={colors.text.tertiary} style={styles.catalogHint}>
            {t.nutrition.create_food_hint}
          </AppText>
        ) : null}

        {isAddToMeal && name.trim() ? (
          <View style={styles.heroRow}>
            <FoodIconThumb iconKey={iconKey} size={52} />
            <View style={styles.heroText}>
              <AppText variant="body16SemiBold" color={colors.text.primary} numberOfLines={2}>
                {name.trim()}
              </AppText>
              <AppText variant="body12" color={colors.text.tertiary}>
                {selectedTrainerFood
                  ? t.nutrition.catalog_foods
                  : selectedFood
                    ? t.nutrition.my_foods_title
                    : offProduct
                      ? 'Open Food Facts'
                      : t.nutrition.portion_label}
              </AppText>
            </View>
          </View>
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
                  {offStatus === 'notfound'
                    ? t.nutrition.scan_not_found_message
                    : t.nutrition.scan_error_message}
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

            {offProduct && remotePhoto ? (
              <View style={styles.offCardCompact}>
                <Image source={{ uri: remotePhoto }} style={styles.offImageSmall} contentFit="cover" />
                <View style={styles.offInfo}>
                  <AppText variant="body12" color={colors.text.tertiary}>
                    Referencia del producto
                  </AppText>
                  <AppText variant="body13" color={colors.text.secondary} numberOfLines={1}>
                    {offProduct.brands ?? offProduct.productName}
                  </AppText>
                </View>
              </View>
            ) : null}

            {isCatalogCreate || isCatalogEdit || isEdit || !name.trim() ? (
              <Input
                label="Nombre"
                value={name}
                onChangeText={setName}
                placeholder="Ej: Milanesa con puré"
                containerStyle={styles.field}
              />
            ) : null}

            {showIconPicker ? (
              <Card style={styles.sectionCard}>
                <AppText variant="caps12" color={colors.text.tertiary} style={styles.sectionTitle}>
                  {t.nutrition.food_icon_label}
                </AppText>
                <FoodIconPicker value={iconKey} onChange={setIconKey} />
              </Card>
            ) : null}

            {isAddToMeal ? (
              <Card style={styles.sectionCard}>
                <AppText variant="caps12" color={colors.text.tertiary} style={styles.sectionTitle}>
                  Comida
                </AppText>
                <SegmentedTabs tabs={mealTabs} activeIndex={mealTypeIdx} onChange={setMealTypeIdx} />
              </Card>
            ) : null}

            <Card style={styles.sectionCard}>
              <AppText variant="caps12" color={colors.text.tertiary} style={styles.sectionTitle}>
                {isCatalogCreate || isCatalogEdit ? t.nutrition.default_serving_label : t.nutrition.portion_label}
              </AppText>
              <View style={styles.chipsRow}>
                {SERVING_UNITS.map((unit) => (
                  <Chip
                    key={unit.value}
                    label={unit.short}
                    active={portionUnit === unit.value}
                    onPress={() => {
                      const nextUnit = unit.value;
                      setPortionUnit(nextUnit);
                      const parsed = parsePortionAmount(portion, nextUnit);
                      setPortion(formatPortionAmount(parsed || defaultPortionAmount(nextUnit), nextUnit));
                    }}
                  />
                ))}
              </View>
              <Input
                value={portion}
                onChangeText={(text) => setPortion(sanitizePortionInput(text, portionUnit))}
                keyboardType={portionUnit === 'unit' ? 'number-pad' : 'decimal-pad'}
                placeholder={portionUnit === 'unit' ? '1' : '100'}
                containerStyle={styles.fieldCompact}
              />
              <View style={styles.chipsRow}>
                {QUICK_PORTIONS_BY_UNIT[portionUnit].map((amount) => (
                  <Chip
                    key={amount}
                    label={quickPortionLabel(amount, portionUnit)}
                    active={portionNum === amount}
                    onPress={() => setPortion(formatPortionAmount(amount, portionUnit))}
                  />
                ))}
              </View>
            </Card>

            {(per100 || isEdit || Number(kcalText) > 0) ? (
              <View style={styles.macroCardsRow}>
                {(
                  [
                    { label: 'kcal', value: String(computed.kcal) },
                    { label: t.nutrition.proteins_label, value: `${formatMacroDisplay(computed.protein)} g` },
                    { label: t.nutrition.carbs_label, value: `${formatMacroDisplay(computed.carbs)} g` },
                    { label: t.nutrition.fats_label, value: `${formatMacroDisplay(computed.fat)} g` },
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
                    onChangeText={(text) => setKcalText(sanitizeMacroInput(text))}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    containerStyle={styles.manualField}
                  />
                  <Input
                    label="Proteínas (g)"
                    value={proteinText}
                    onChangeText={(text) => setProteinText(sanitizeMacroInput(text))}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    containerStyle={styles.manualField}
                  />
                </View>
                <View style={styles.manualRow}>
                  <Input
                    label="Carbos (g)"
                    value={carbsText}
                    onChangeText={(text) => setCarbsText(sanitizeMacroInput(text))}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    containerStyle={styles.manualField}
                  />
                  <Input
                    label="Grasas (g)"
                    value={fatText}
                    onChangeText={(text) => setFatText(sanitizeMacroInput(text))}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    containerStyle={styles.manualField}
                  />
                </View>
              </>
            ) : null}

            <Button
              label={
                isCatalogCreate || isCatalogEdit
                  ? t.nutrition.save_food
                  : isEdit
                    ? 'Guardar cambios'
                    : i18n(t.nutrition.add_to_meal, { meal: t.nutrition[mealLabelKey(MEAL_TYPES[mealTypeIdx])] })
              }
              onPress={() => void onSave()}
              loading={saving}
              fullWidth
              style={styles.cta}
            />

            {isEdit ? (
              <Pressable onPress={onDeleteMeal} accessibilityRole="button" style={styles.deleteButton}>
                <Ionicons name="trash-outline" size={18} color={colors.states.error} />
                <AppText variant="body16SemiBold" color={colors.states.error}>
                  Eliminar
                </AppText>
              </Pressable>
            ) : null}

            {isCatalogEdit ? (
              <Pressable onPress={onDeleteCatalogFood} accessibilityRole="button" style={styles.deleteButton}>
                <Ionicons name="trash-outline" size={18} color={colors.states.error} />
                <AppText variant="body16SemiBold" color={colors.states.error}>
                  {t.nutrition.delete_food}
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
  offCardCompact: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  offImageSmall: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surface.elevated,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  heroText: {
    flex: 1,
    gap: 2,
  },
  sectionCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    marginBottom: spacing.xxs,
  },
  fieldCompact: {
    marginTop: spacing.xs,
  },
  catalogHint: {
    marginBottom: spacing.md,
  },
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
