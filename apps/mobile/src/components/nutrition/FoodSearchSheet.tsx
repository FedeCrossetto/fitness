import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, layout, radius, spacing, useThemedStyles, useTheme } from '../../theme';
import { AppText, CardSkeleton, Input } from '../common';
import { CatalogFoodRow } from './CatalogFoodRow';
import { FoodCreateActions } from './FoodCreateActions';
import { FoodSearchRow } from './FoodSearchRow';
import { hapticSuccess } from '../../lib/haptics';
import { useAuthStore } from '../../stores/authStore';
import { useNutritionStore } from '../../stores/nutritionStore';
import { useTranslation } from '../../stores/i18nStore';
import { useUiStore } from '../../stores/uiStore';
import type { FoodRow, MealType } from '../../types/database';
import type { NutritionStackParamList } from '../../types/navigation';

type Tab = 'catalog' | 'favorites' | 'created';

interface FoodSearchSheetProps {
  visible: boolean;
  mealType: MealType;
  onClose: () => void;
  navigation: NativeStackNavigationProp<NutritionStackParamList, 'MealsDay'>;
}

const SHEET_MAX_HEIGHT = Dimensions.get('window').height * 0.72;

export function FoodSearchSheet({
  visible,
  mealType,
  onClose,
  navigation,
}: FoodSearchSheetProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();

  const userId = useAuthStore((s) => s.session?.user.id);
  const myFoods = useNutritionStore((s) => s.myFoods);
  const trainerFoods = useNutritionStore((s) => s.trainerFoods);
  const mySubmissions = useNutritionStore((s) => s.mySubmissions);
  const foodsLoading = useNutritionStore((s) => s.foodsLoading);
  const loadMyFoods = useNutritionStore((s) => s.loadMyFoods);
  const loadTrainerCatalog = useNutritionStore((s) => s.loadTrainerCatalog);
  const toggleFavoriteFood = useNutritionStore((s) => s.toggleFavoriteFood);
  const toggleFavoriteTrainerFood = useNutritionStore((s) => s.toggleFavoriteTrainerFood);
  const deleteFood = useNutritionStore((s) => s.deleteFood);

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('catalog');

  useEffect(() => {
    if (!visible || !userId) return;
    void loadMyFoods(userId);
    void loadTrainerCatalog(userId);
  }, [visible, userId, loadMyFoods, loadTrainerCatalog]);

  useEffect(() => {
    if (!visible) {
      setSearch('');
      setTab('catalog');
    }
  }, [visible]);

  const favoriteTrainerIds = useMemo(
    () =>
      new Set(
        myFoods.filter((f) => f.is_favorite && f.trainer_food_id).map((f) => f.trainer_food_id as string),
      ),
    [myFoods],
  );

  const pendingFoodIds = useMemo(
    () =>
      new Set(
        mySubmissions
          .filter((s) => s.status === 'pending' && s.personal_food_id)
          .map((s) => s.personal_food_id as string),
      ),
    [mySubmissions],
  );

  const isUserCreated = (food: FoodRow) =>
    food.trainer_food_id === null &&
    (food.source === 'manual' ||
      food.source === 'voice' ||
      food.source === 'barcode' ||
      food.source === 'openfoodfacts');

  const filteredCatalog = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = trainerFoods;
    if (query) {
      list = list.filter(
        (f) => f.name.toLowerCase().includes(query) || (f.brand ?? '').toLowerCase().includes(query),
      );
    }
    return list;
  }, [trainerFoods, search]);

  const filteredFoods = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = myFoods;
    if (tab === 'favorites') list = list.filter((f) => f.is_favorite);
    if (tab === 'created') list = list.filter(isUserCreated);
    if (query) {
      list = list.filter(
        (f) => f.name.toLowerCase().includes(query) || (f.brand ?? '').toLowerCase().includes(query),
      );
    }
    return [...list].sort((a, b) => {
      if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [myFoods, search, tab]);

  const mealLabel = useMemo(() => {
    switch (mealType) {
      case 'DES':
        return t.nutrition.breakfast;
      case 'ALM':
        return t.nutrition.lunch;
      case 'MER':
        return t.nutrition.snack;
      case 'CEN':
        return t.nutrition.dinner;
      default:
        return t.nutrition.intermediate;
    }
  }, [mealType, t]);

  const closeAndNavigate = (params: NutritionStackParamList['FoodDetail']) => {
    onClose();
    navigation.navigate('FoodDetail', params);
  };

  const pickTrainerFood = (id: string) => {
    closeAndNavigate({ mealType, trainerFoodId: id });
  };

  const pickFood = (food: FoodRow) => {
    if (food.trainer_food_id) {
      closeAndNavigate({ mealType, trainerFoodId: food.trainer_food_id });
      return;
    }
    closeAndNavigate({ mealType, foodId: food.id });
  };

  const editCreatedFood = (food: FoodRow) => {
    closeAndNavigate({ mealType, foodId: food.id, entryMode: 'edit' });
  };

  const startCreateManual = () => {
    closeAndNavigate({ mealType, entryMode: 'create' });
  };

  const startCreateScan = () => {
    onClose();
    navigation.navigate('BarcodeScanner', { mealType, purpose: 'create' });
  };

  const startCreateVoice = () => {
    onClose();
    navigation.navigate('VoiceLog', { mealType, purpose: 'create' });
  };

  const confirmDeleteFood = (food: FoodRow) => {
    Alert.alert(t.nutrition.delete_food_title, i18n(t.nutrition.delete_food_confirm, { name: food.name }), [
      { text: t.ui.cancel, style: 'cancel' },
      {
        text: t.ui.delete,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const ok = await deleteFood(food.id);
            if (ok) {
              hapticSuccess();
              useUiStore.getState().showToast('success', t.nutrition.food_deleted);
            } else {
              useUiStore.getState().showToast('error', t.nutrition.food_delete_error);
            }
          })();
        },
      },
    ]);
  };

  const tabs: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'catalog', label: t.nutrition.tab_database, icon: 'library-outline' },
    { key: 'favorites', label: t.nutrition.tab_favorites, icon: 'heart-outline' },
    { key: 'created', label: t.nutrition.tab_created, icon: 'create-outline' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdropContainer}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t.ui.cancel} />
        <View style={[styles.sheet, { height: SHEET_MAX_HEIGHT, paddingBottom: insets.bottom + spacing.sm }]}>
          <View style={styles.handle} />

          <View style={styles.searchBlock}>
            <Input
              icon="search-outline"
              value={search}
              onChangeText={setSearch}
              placeholder={t.nutrition.search_foods}
            />
          </View>

          <View style={styles.tabsRow}>
            {tabs.map((item) => {
              const active = tab === item.key;
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setTab(item.key)}
                  style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
                >
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={active ? colors.text.primary : colors.text.tertiary}
                  />
                  <AppText
                    variant={active ? 'body13SemiBold' : 'body13'}
                    color={active ? colors.text.primary : colors.text.tertiary}
                  >
                    {item.label}
                  </AppText>
                  {active ? <View style={styles.tabIndicator} /> : null}
                </Pressable>
              );
            })}
          </View>

          <AppText variant="body12" color={colors.text.tertiary} style={styles.mealHint}>
            {tab === 'created'
              ? t.nutrition.created_tab_hint
              : i18n(t.nutrition.add_to_meal, { meal: mealLabel })}
          </AppText>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {foodsLoading && myFoods.length === 0 && trainerFoods.length === 0 ? (
              <CardSkeleton />
            ) : tab === 'catalog' ? (
              filteredCatalog.length === 0 ? (
                <AppText variant="body14" color={colors.text.disabled} align="center" style={styles.empty}>
                  {t.nutrition.catalog_empty}
                </AppText>
              ) : (
                filteredCatalog.map((food) => (
                  <CatalogFoodRow
                    key={food.id}
                    food={food}
                    isFavorite={favoriteTrainerIds.has(food.id)}
                    onPress={() => pickTrainerFood(food.id)}
                    onToggleFavorite={
                      userId ? () => void toggleFavoriteTrainerFood(userId, food.id) : undefined
                    }
                  />
                ))
              )
            ) : tab === 'created' ? (
              filteredFoods.length === 0 ? (
                <AppText variant="body14" color={colors.text.secondary} align="center" style={styles.empty}>
                  {t.nutrition.pick_empty}
                </AppText>
              ) : (
                filteredFoods.map((food) => (
                  <FoodSearchRow
                    key={food.id}
                    food={food}
                    onPress={() => pickFood(food)}
                    onEdit={() => editCreatedFood(food)}
                    pendingApproval={pendingFoodIds.has(food.id)}
                    onToggleFavorite={() => void toggleFavoriteFood(food.id)}
                    onDelete={() => confirmDeleteFood(food)}
                  />
                ))
              )
            ) : filteredFoods.length === 0 ? (
              <AppText variant="body14" color={colors.text.secondary} align="center" style={styles.empty}>
                {t.nutrition.no_records}
              </AppText>
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
          </ScrollView>

          {/* Footer fijo: crear alimento nuevo (siempre visible, separado de buscar) */}
          <View style={styles.createFooter}>
            <AppText variant="caps12" color={colors.text.tertiary} style={styles.createFooterLabel}>
              {t.nutrition.create_new_food}
            </AppText>
            <FoodCreateActions
              onManual={startCreateManual}
              onScan={startCreateScan}
              onVoice={startCreateVoice}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    backdropContainer: { flex: 1, justifyContent: 'flex-end' },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.surface.overlay,
    },
    sheet: {
      backgroundColor: colors.surface.base,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      paddingHorizontal: layout.screenPadding,
      paddingTop: spacing.sm,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.border.strong,
      marginBottom: spacing.md,
    },
    searchBlock: {
      marginBottom: spacing.md,
    },
    pressed: { opacity: 0.8 },
    tabsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      paddingVertical: spacing.xs,
      position: 'relative',
    },
    tabIndicator: {
      position: 'absolute',
      bottom: 0,
      left: '15%',
      right: '15%',
      height: 2,
      borderRadius: radius.pill,
      backgroundColor: colors.text.primary,
    },
    mealHint: {
      marginBottom: spacing.sm,
    },
    list: { flex: 1 },
    listContent: {
      paddingBottom: spacing.lg,
    },
    empty: {
      marginTop: spacing.xl,
    },
    createFooter: {
      borderTopWidth: 1,
      borderTopColor: colors.border.subtle,
      paddingTop: spacing.md,
      marginTop: spacing.xs,
    },
    createFooterLabel: {
      marginBottom: spacing.sm,
    },
  });
