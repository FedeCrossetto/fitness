import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DEFAULT_FOOD_ICON_KEY,
  DEFAULT_SERVING_UNIT,
  defaultPortionAmount,
  FOOD_ICON_ITEMS,
  formatServingLabel,
  foodIconLabel,
  formatMacroAmount,
  formatMacroDisplay,
  isFoodIconKey,
  isServingUnit,
  macroReferenceLabel,
  macrosForServing,
  parseMacroAmount,
  parsePortionAmount,
  sanitizeMacroInput,
  sanitizePortionInput,
  SERVING_UNITS,
  type FoodIconKey,
  type FoodSubmissionRow,
  type ServingUnit,
  type TrainerFoodRow,
} from '@reset-fitness/shared';
import { getFoodIconUrl } from '@reset-fitness/shared/nutrition/foodIconAssets';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { refreshPendingFoodCount, usePendingFoodCount, usePendingFoodRefresh } from '@/hooks/usePendingFoodCount';
import { PlusIcon, NutritionIcon, CheckIcon, SearchIcon } from '@/components/icons';
import { LoadingRows, EmptyState } from '@/components/ui';

type Tab = 'catalog' | 'pending';
type CatalogSort = 'name-asc' | 'name-desc' | 'kcal-desc' | 'kcal-asc';
type PendingSort = 'date-desc' | 'date-asc' | 'name-asc';
type MacroFilter = 'all' | 'complete' | 'incomplete';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function ilikePattern(value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  return `%${escaped}%`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyCatalogFilters<T extends { or: (filters: string) => T; eq: (col: string, val: string) => T; not: (col: string, op: string, val: null) => T; order: (col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) => T }>(
  builder: T,
  options: {
    query: string;
    iconFilter: FoodIconKey | 'all';
    macroFilter: MacroFilter;
    catalogSort: CatalogSort;
  },
): T {
  let q = builder;
  const search = normalizeSearch(options.query);
  if (search) {
    const pattern = ilikePattern(search);
    q = q.or(`name.ilike.${pattern},brand.ilike.${pattern}`);
  }
  if (options.iconFilter !== 'all') q = q.eq('icon_key', options.iconFilter);
  if (options.macroFilter === 'complete') {
    q = q
      .not('kcal_100g', 'is', null)
      .not('protein_g_100g', 'is', null)
      .not('carbs_g_100g', 'is', null)
      .not('fat_g_100g', 'is', null);
  } else if (options.macroFilter === 'incomplete') {
    q = q.or('kcal_100g.is.null,protein_g_100g.is.null,carbs_g_100g.is.null,fat_g_100g.is.null');
  }
  switch (options.catalogSort) {
    case 'name-desc':
      return q.order('name', { ascending: false });
    case 'kcal-desc':
      return q.order('kcal_100g', { ascending: false, nullsFirst: false });
    case 'kcal-asc':
      return q.order('kcal_100g', { ascending: true, nullsFirst: false });
    case 'name-asc':
    default:
      return q.order('name', { ascending: true });
  }
}

function applyPendingSort<T extends { order: (col: string, opts?: { ascending?: boolean }) => T }>(
  builder: T,
  pendingSort: PendingSort,
): T {
  switch (pendingSort) {
    case 'date-asc':
      return builder.order('created_at', { ascending: true });
    case 'name-asc':
      return builder.order('name', { ascending: true });
    case 'date-desc':
    default:
      return builder.order('created_at', { ascending: false });
  }
}

function pageRange(page: number): { from: number; to: number } {
  const from = (page - 1) * PAGE_SIZE;
  return { from, to: from + PAGE_SIZE - 1 };
}

function totalPages(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

function TablePagination({
  page,
  total,
  onPageChange,
}: {
  page: number;
  total: number;
  onPageChange: (page: number) => void;
}): React.JSX.Element | null {
  const pages = totalPages(total);
  if (total <= PAGE_SIZE) return null;

  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="table-pagination">
      <span className="table-pagination-info">
        {from}–{to} de {total}
      </span>
      <div className="table-pagination-actions">
        <button
          type="button"
          className="btn secondary sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </button>
        <span className="table-pagination-page">Página {page} de {pages}</span>
        <button
          type="button"
          className="btn secondary sm"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

type FoodForm = {
  name: string;
  brand: string;
  icon_key: FoodIconKey;
  default_serving_grams: string;
  serving_unit: ServingUnit;
  kcal_100g: string;
  protein_g_100g: string;
  carbs_g_100g: string;
  fat_g_100g: string;
};

const EMPTY_FORM: FoodForm = {
  name: '',
  brand: '',
  icon_key: DEFAULT_FOOD_ICON_KEY,
  default_serving_grams: '100',
  serving_unit: DEFAULT_SERVING_UNIT,
  kcal_100g: '',
  protein_g_100g: '',
  carbs_g_100g: '',
  fat_g_100g: '',
};

function macrosLine(
  f: Pick<
    TrainerFoodRow,
    'kcal_100g' | 'protein_g_100g' | 'carbs_g_100g' | 'fat_g_100g' | 'default_serving_grams' | 'serving_unit'
  >,
): string {
  const unit = isServingUnit(f.serving_unit) ? f.serving_unit : DEFAULT_SERVING_UNIT;
  const amount = f.default_serving_grams ?? defaultPortionAmount(unit);
  const totals = macrosForServing(
    { kcal: f.kcal_100g, protein: f.protein_g_100g, carbs: f.carbs_g_100g, fat: f.fat_g_100g },
    amount,
    unit,
  );
  const kcal = f.kcal_100g != null ? Math.round(totals.kcal) : '—';
  const p = f.protein_g_100g != null ? formatMacroDisplay(totals.protein) : '—';
  const c = f.carbs_g_100g != null ? formatMacroDisplay(totals.carbs) : '—';
  const g = f.fat_g_100g != null ? formatMacroDisplay(totals.fat) : '—';
  return `${kcal} kcal · P ${p} · C ${c} · G ${g}`;
}

function FoodIcon({ iconKey, size = 40 }: { iconKey: string | null; size?: number }): React.JSX.Element {
  return (
    <img
      src={getFoodIconUrl(iconKey)}
      alt=""
      width={size}
      height={size}
      style={{ borderRadius: size >= 48 ? 12 : 8, objectFit: 'cover', background: 'var(--surface-elevated)', display: 'block' }}
    />
  );
}

function FoodIconPicker({
  value,
  onChange,
}: {
  value: FoodIconKey;
  onChange: (key: FoodIconKey) => void;
}): React.JSX.Element {
  return (
    <div className="food-icon-picker">
      <div className="food-icon-preview" aria-live="polite">
        <FoodIcon iconKey={value} size={64} />
        <span className="food-icon-preview-label">{foodIconLabel(value)}</span>
      </div>
      <div className="food-icon-grid" role="listbox" aria-label="Elegir icono">
        {FOOD_ICON_ITEMS.map((item) => {
          const selected = value === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="option"
              aria-selected={selected}
              aria-label={item.label}
              className={`food-icon-cell${selected ? ' is-selected' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange(item.key);
              }}
            >
              <FoodIcon iconKey={item.key} size={32} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FoodsPage(): React.JSX.Element {
  const { session } = useAuth();
  const { showToast } = useToast();
  const trainerId = session?.user.id;

  const [tab, setTab] = useState<Tab>('catalog');
  const [catalog, setCatalog] = useState<TrainerFoodRow[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogFilteredTotal, setCatalogFilteredTotal] = useState(0);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [pending, setPending] = useState<(FoodSubmissionRow & { submitter_name?: string })[]>([]);
  const [pendingFilteredTotal, setPendingFilteredTotal] = useState(0);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingLoaded, setPendingLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TrainerFoodRow | null>(null);
  const [form, setForm] = useState<FoodForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [iconFilter, setIconFilter] = useState<FoodIconKey | 'all'>('all');
  const [macroFilter, setMacroFilter] = useState<MacroFilter>('all');
  const [catalogSort, setCatalogSort] = useState<CatalogSort>('name-asc');
  const [pendingSort, setPendingSort] = useState<PendingSort>('date-desc');

  const pendingFoodCount = usePendingFoodCount();

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchInput), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const fetchCatalogTotal = useCallback(async () => {
    if (!trainerId) return;
    const { count } = await supabase
      .from('trainer_foods')
      .select('id', { count: 'exact', head: true })
      .eq('trainer_id', trainerId)
      .eq('active', true);
    setCatalogTotal(count ?? 0);
  }, [trainerId]);

  const fetchCatalogPage = useCallback(async (options?: { silent?: boolean; page?: number }) => {
    if (!trainerId) return;
    const page = options?.page ?? catalogPage;
    if (!options?.silent) setCatalogLoading(true);

    let builder = supabase
      .from('trainer_foods')
      .select('*', { count: 'exact' })
      .eq('trainer_id', trainerId)
      .eq('active', true);

    builder = applyCatalogFilters(builder, { query, iconFilter, macroFilter, catalogSort });

    const { from, to } = pageRange(page);
    const { data, count, error } = await builder.range(from, to);

    if (error) {
      console.error('trainer_foods fetch error:', error);
      if (!options?.silent) setCatalogLoading(false);
      return;
    }

    const total = count ?? 0;
    const pages = totalPages(total);
    const nextPage = Math.min(page, pages);
    if (nextPage !== page) {
      setCatalogPage(nextPage);
      if (!options?.silent) setCatalogLoading(false);
      return;
    }

    setCatalog((data ?? []) as TrainerFoodRow[]);
    setCatalogFilteredTotal(total);
    if (!options?.silent) setCatalogLoading(false);
  }, [trainerId, catalogPage, query, iconFilter, macroFilter, catalogSort]);

  const fetchPendingPage = useCallback(async (options?: { silent?: boolean; page?: number }) => {
    if (!trainerId) return;
    const page = options?.page ?? pendingPage;
    if (!options?.silent) setPendingLoading(true);

    const search = normalizeSearch(query);
    let submitterIds: string[] = [];
    if (search) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('trainer_id', trainerId)
        .ilike('full_name', ilikePattern(search));
      submitterIds = (profiles ?? []).map((p) => p.id);
    }

    let builder = supabase
      .from('food_submissions')
      .select('*', { count: 'exact' })
      .eq('trainer_id', trainerId)
      .eq('status', 'pending');

    if (search) {
      const pattern = ilikePattern(search);
      const orParts = [`name.ilike.${pattern}`, `brand.ilike.${pattern}`];
      if (submitterIds.length > 0) {
        orParts.push(`submitted_by.in.(${submitterIds.join(',')})`);
      }
      builder = builder.or(orParts.join(','));
    }

    if (iconFilter !== 'all') builder = builder.eq('icon_key', iconFilter);
    builder = applyPendingSort(builder, pendingSort);

    const { from, to } = pageRange(page);
    const { data, count, error } = await builder.range(from, to);

    if (error) {
      console.error('food_submissions fetch error:', error);
      if (!options?.silent) setPendingLoading(false);
      return;
    }

    const total = count ?? 0;
    const pages = totalPages(total);
    const nextPage = Math.min(page, pages);
    if (nextPage !== page) {
      setPendingPage(nextPage);
      if (!options?.silent) setPendingLoading(false);
      return;
    }

    let pendingRows = (data ?? []) as FoodSubmissionRow[];
    if (pendingRows.length > 0) {
      const ids = [...new Set(pendingRows.map((r) => r.submitted_by))];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      pendingRows = pendingRows.map((r) => ({ ...r, submitter_name: nameById.get(r.submitted_by) ?? 'Alumno' }));
    }

    setPending(pendingRows);
    setPendingFilteredTotal(total);
    setPendingLoaded(true);
    if (!options?.silent) setPendingLoading(false);
  }, [trainerId, pendingPage, query, iconFilter, pendingSort]);

  const refreshViews = useCallback(async (options?: { silent?: boolean }) => {
    await fetchCatalogTotal();
    if (tab === 'catalog') await fetchCatalogPage(options);
    else await fetchPendingPage(options);
  }, [tab, fetchCatalogTotal, fetchCatalogPage, fetchPendingPage]);

  useEffect(() => {
    if (!trainerId) return;
    void fetchCatalogTotal();
  }, [trainerId, fetchCatalogTotal]);

  useEffect(() => {
    if (!trainerId || tab !== 'catalog') return;
    void fetchCatalogPage();
  }, [trainerId, tab, catalogPage, query, iconFilter, macroFilter, catalogSort, fetchCatalogPage]);

  useEffect(() => {
    if (!trainerId || tab !== 'pending') return;
    void fetchPendingPage();
  }, [trainerId, tab, pendingPage, query, iconFilter, pendingSort, fetchPendingPage]);

  useEffect(() => {
    setCatalogPage(1);
  }, [query, iconFilter, macroFilter, catalogSort]);

  useEffect(() => {
    setPendingPage(1);
  }, [query, iconFilter, pendingSort]);

  usePendingFoodRefresh(useCallback(() => refreshViews({ silent: true }), [refreshViews]));

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (food: TrainerFoodRow) => {
    setEditing(food);
    setForm({
      name: food.name,
      brand: food.brand ?? '',
      icon_key: isFoodIconKey(food.icon_key) ? food.icon_key : DEFAULT_FOOD_ICON_KEY,
      default_serving_grams: String(food.default_serving_grams ?? 100),
      serving_unit: isServingUnit(food.serving_unit) ? food.serving_unit : DEFAULT_SERVING_UNIT,
      kcal_100g: food.kcal_100g != null ? formatMacroAmount(food.kcal_100g) : '',
      protein_g_100g: food.protein_g_100g != null ? formatMacroAmount(food.protein_g_100g) : '',
      carbs_g_100g: food.carbs_g_100g != null ? formatMacroAmount(food.carbs_g_100g) : '',
      fat_g_100g: food.fat_g_100g != null ? formatMacroAmount(food.fat_g_100g) : '',
    });
    setModalOpen(true);
  };

  const saveCatalog = async () => {
    if (!trainerId || !form.name.trim()) {
      showToast('error', 'El nombre es obligatorio.');
      return;
    }
    setSaving(true);
    const payload = {
      trainer_id: trainerId,
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      icon_key: form.icon_key,
      default_serving_grams: parsePortionAmount(form.default_serving_grams, form.serving_unit) || defaultPortionAmount(form.serving_unit),
      serving_unit: form.serving_unit,
      kcal_100g: parseMacroAmount(form.kcal_100g),
      protein_g_100g: parseMacroAmount(form.protein_g_100g),
      carbs_g_100g: parseMacroAmount(form.carbs_g_100g),
      fat_g_100g: parseMacroAmount(form.fat_g_100g),
      active: true,
    };

    const { error } = editing
      ? await supabase.from('trainer_foods').update(payload).eq('id', editing.id)
      : await supabase.from('trainer_foods').insert(payload);

    setSaving(false);
    if (error) {
      console.error('trainer_foods save error:', error);
      showToast('error', error.message || 'No pudimos guardar el alimento.');
      return;
    }
    showToast('success', editing ? 'Alimento actualizado' : 'Alimento agregado al catálogo');
    setModalOpen(false);
    void refreshViews();
  };

  const deactivate = async (id: string) => {
    if (!confirm('¿Eliminar este alimento del catálogo?')) return;
    const { error } = await supabase.from('trainer_foods').update({ active: false }).eq('id', id);
    if (error) showToast('error', 'No pudimos eliminar el alimento.');
    else {
      showToast('success', 'Alimento eliminado');
      void refreshViews();
    }
  };

  const approveSubmission = async (sub: FoodSubmissionRow) => {
    if (!trainerId) return;
    const { data: created, error: insertErr } = await supabase
      .from('trainer_foods')
      .insert({
        trainer_id: trainerId,
        name: sub.name,
        brand: sub.brand,
        barcode: sub.barcode,
        kcal_100g: sub.kcal_100g,
        protein_g_100g: sub.protein_g_100g,
        carbs_g_100g: sub.carbs_g_100g,
        fat_g_100g: sub.fat_g_100g,
        default_serving_grams: sub.default_serving_grams ?? 100,
        serving_unit: isServingUnit(sub.serving_unit) ? sub.serving_unit : DEFAULT_SERVING_UNIT,
        icon_key: sub.icon_key,
        active: true,
      })
      .select()
      .single();

    if (insertErr || !created) {
      showToast('error', 'No pudimos aprobar el alimento.');
      return;
    }

    const { error: updateErr } = await supabase
      .from('food_submissions')
      .update({
        status: 'approved',
        trainer_food_id: created.id,
        reviewed_by: trainerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', sub.id);

    if (sub.personal_food_id) {
      await supabase.from('foods').update({ trainer_food_id: created.id }).eq('id', sub.personal_food_id);
    }

    if (updateErr) showToast('error', 'Alimento creado pero falló actualizar la solicitud.');
    else showToast('success', `"${sub.name}" aprobado y publicado`);
    void refreshPendingFoodCount();
  };

  const rejectSubmission = async (sub: FoodSubmissionRow) => {
    if (!trainerId) return;
    const { error } = await supabase
      .from('food_submissions')
      .update({
        status: 'rejected',
        reviewed_by: trainerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', sub.id);
    if (error) showToast('error', 'No pudimos rechazar la solicitud.');
    else {
      showToast('success', 'Solicitud rechazada');
      void refreshPendingFoodCount();
    }
  };

  const catalogFiltersActive =
    normalizeSearch(query).length > 0 || iconFilter !== 'all' || macroFilter !== 'all' || catalogSort !== 'name-asc';
  const pendingFiltersActive =
    normalizeSearch(query).length > 0 || iconFilter !== 'all' || pendingSort !== 'date-desc';

  const catalogHasFilters = catalogFilteredTotal !== catalogTotal;

  const clearFilters = () => {
    setSearchInput('');
    setQuery('');
    setIconFilter('all');
    setMacroFilter('all');
    setCatalogSort('name-asc');
    setPendingSort('date-desc');
    setCatalogPage(1);
    setPendingPage(1);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Alimentos</h1>
        <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={openCreate}>
          <PlusIcon size={15} /> Nuevo alimento
        </button>
      </div>
      <p className="page-sub">
        Catálogo compartido con tus alumnos. Los alimentos que carguen quedan pendientes hasta que los apruebes.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          className={`btn${tab === 'catalog' ? '' : ' secondary'}`}
          onClick={() => setTab('catalog')}
        >
          Catálogo ({catalogTotal})
        </button>
        <button
          className={`btn${tab === 'pending' ? '' : ' secondary'}`}
          onClick={() => setTab('pending')}
        >
          Pendientes{pendingFoodCount > 0 ? ` (${pendingFoodCount})` : ''}
        </button>
      </div>

      {tab === 'catalog' ? (
        catalogTotal === 0 && !catalogLoading ? (
          <div className="card">
            <EmptyState
              icon={<NutritionIcon size={22} />}
              title="Sin alimentos en el catálogo"
              sub="Cargá alimentos base para que tus alumnos los usen al registrar comidas."
              action={{ label: 'Cargar el primero', onClick: openCreate }}
            />
          </div>
        ) : (
          <div className="card foods-catalog-card">
            <div className="table-toolbar foods-table-toolbar">
              <div className="search-field">
                <SearchIcon size={16} />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Buscar por nombre o marca…"
                />
              </div>
              <span className="row-count">
                {catalogLoading
                  ? '…'
                  : catalogHasFilters
                    ? `${catalogFilteredTotal} de ${catalogTotal} alimento${catalogTotal === 1 ? '' : 's'}`
                    : `${catalogTotal} alimento${catalogTotal === 1 ? '' : 's'}`}
              </span>
            </div>
            <div className="foods-filters">
              <label className="foods-filter">
                <span className="foods-filter-label">Icono</span>
                <select
                  className="inline-select"
                  value={iconFilter}
                  onChange={(e) => setIconFilter(e.target.value as FoodIconKey | 'all')}
                >
                  <option value="all">Todos</option>
                  {FOOD_ICON_ITEMS.map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label className="foods-filter">
                <span className="foods-filter-label">Macros</span>
                <select
                  className="inline-select"
                  value={macroFilter}
                  onChange={(e) => setMacroFilter(e.target.value as MacroFilter)}
                >
                  <option value="all">Todos</option>
                  <option value="complete">Completos</option>
                  <option value="incomplete">Incompletos</option>
                </select>
              </label>
              <label className="foods-filter">
                <span className="foods-filter-label">Orden</span>
                <select
                  className="inline-select"
                  value={catalogSort}
                  onChange={(e) => setCatalogSort(e.target.value as CatalogSort)}
                >
                  <option value="name-asc">Nombre A–Z</option>
                  <option value="name-desc">Nombre Z–A</option>
                  <option value="kcal-desc">Más kcal</option>
                  <option value="kcal-asc">Menos kcal</option>
                </select>
              </label>
              {catalogFiltersActive ? (
                <button type="button" className="btn secondary sm foods-filter-clear" onClick={clearFilters}>
                  Limpiar
                </button>
              ) : null}
            </div>
            {catalogLoading ? (
              <div style={{ padding: 16 }}><LoadingRows rows={5} /></div>
            ) : catalogFilteredTotal === 0 ? (
              <div className="foods-filter-empty">
                <div className="t">Sin resultados</div>
                <p className="muted">Probá con otro término o ajustá los filtros.</p>
                <button type="button" className="btn secondary sm" onClick={clearFilters}>Limpiar filtros</button>
              </div>
            ) : (
              <>
                <table className="foods-table">
                  <thead>
                    <tr>
                      <th>Alimento</th>
                      <th>Porción y macros</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {catalog.map((food) => (
                      <tr key={food.id}>
                        <td>
                          <div className="foods-table-food">
                            <FoodIcon iconKey={food.icon_key} size={32} />
                            <div>
                              <div className="cell-name">{food.name}</div>
                              {food.brand ? <div className="cell-sub">{food.brand}</div> : null}
                            </div>
                          </div>
                        </td>
                        <td className="muted">
                          {formatServingLabel(food.default_serving_grams, food.serving_unit)} · {macrosLine(food)}
                        </td>
                        <td>
                          <div className="foods-table-actions">
                            <button type="button" className="btn secondary sm" onClick={() => openEdit(food)}>Editar</button>
                            <button type="button" className="btn secondary sm foods-table-delete" onClick={() => void deactivate(food.id)}>Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <TablePagination
                  page={catalogPage}
                  total={catalogFilteredTotal}
                  onPageChange={setCatalogPage}
                />
              </>
            )}
          </div>
        )
      ) : pendingFoodCount === 0 && pendingLoaded && !pendingLoading ? (
        <div className="card">
          <EmptyState
            icon={<CheckIcon size={22} />}
            title="Sin solicitudes pendientes"
            sub="Cuando un alumno cree un alimento nuevo, aparecerá acá para que lo revises."
          />
        </div>
      ) : (
        <div className="card foods-catalog-card">
          <div className="table-toolbar foods-table-toolbar">
            <div className="search-field">
              <SearchIcon size={16} />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por alimento o alumno…"
              />
            </div>
            <span className="row-count">
              {pendingLoading
                ? '…'
                : `${pendingFilteredTotal} solicitud${pendingFilteredTotal === 1 ? '' : 'es'}`}
            </span>
          </div>
          <div className="foods-filters">
            <label className="foods-filter">
              <span className="foods-filter-label">Icono</span>
              <select
                className="inline-select"
                value={iconFilter}
                onChange={(e) => setIconFilter(e.target.value as FoodIconKey | 'all')}
              >
                <option value="all">Todos</option>
                {FOOD_ICON_ITEMS.map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="foods-filter">
              <span className="foods-filter-label">Orden</span>
              <select
                className="inline-select"
                value={pendingSort}
                onChange={(e) => setPendingSort(e.target.value as PendingSort)}
              >
                <option value="date-desc">Más recientes</option>
                <option value="date-asc">Más antiguas</option>
                <option value="name-asc">Nombre A–Z</option>
              </select>
            </label>
            {pendingFiltersActive ? (
              <button type="button" className="btn secondary sm foods-filter-clear" onClick={clearFilters}>
                Limpiar
              </button>
            ) : null}
          </div>
          {pendingLoading ? (
            <div style={{ padding: 16 }}><LoadingRows rows={5} /></div>
          ) : pendingFilteredTotal === 0 ? (
            <div className="foods-filter-empty">
              <div className="t">Sin resultados</div>
              <p className="muted">Probá con otro término o ajustá los filtros.</p>
              <button type="button" className="btn secondary sm" onClick={clearFilters}>Limpiar filtros</button>
            </div>
          ) : (
            <>
              <table className="foods-table">
                <thead>
                  <tr>
                    <th>Alimento</th>
                    <th>Detalle</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pending.map((sub) => (
                    <tr key={sub.id}>
                      <td>
                        <div className="foods-table-food">
                          <FoodIcon iconKey={sub.icon_key} size={32} />
                          <div>
                            <div className="cell-name">{sub.name}</div>
                            <div className="cell-sub">Propuesto por {sub.submitter_name ?? 'alumno'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="muted">
                        {formatServingLabel(sub.default_serving_grams, sub.serving_unit)} · {macrosLine(sub)}
                      </td>
                      <td>
                        <div className="foods-table-actions">
                          <button type="button" className="btn sm" onClick={() => void approveSubmission(sub)}>Aprobar</button>
                          <button type="button" className="btn secondary sm" onClick={() => void rejectSubmission(sub)}>Rechazar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <TablePagination
                page={pendingPage}
                total={pendingFilteredTotal}
                onPageChange={setPendingPage}
              />
            </>
          )}
        </div>
      )}

      {modalOpen && createPortal(
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal food-form-modal card" onClick={(e) => e.stopPropagation()}>
            <div className="food-form-header">
              <h2>{editing ? 'Editar alimento' : 'Nuevo alimento'}</h2>
            </div>

            <div className="food-form-body">
              <div className="food-form-row-2">
                <div className="food-form-field">
                  <label htmlFor="food-name">Nombre</label>
                  <input
                    id="food-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Ej: Pechuga de pollo"
                    autoFocus
                  />
                </div>
                <div className="food-form-field">
                  <label htmlFor="food-brand">Marca</label>
                  <input
                    id="food-brand"
                    value={form.brand}
                    onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div>
                <div className="food-form-section-label">Icono</div>
                <FoodIconPicker
                  value={form.icon_key}
                  onChange={(icon_key) => setForm((f) => ({ ...f, icon_key }))}
                />
              </div>

              <div className="food-form-macros">
                <div className="food-form-macros-head">{macroReferenceLabel(form.serving_unit)}</div>
                <div className="food-form-macros-grid">
                  <div className="food-form-field food-form-portion">
                    <label htmlFor="food-portion">Porción</label>
                    <div className="food-form-portion-row">
                      <div className="serving-unit-toggle" role="group" aria-label="Unidad de porción">
                        {SERVING_UNITS.map((unit) => (
                          <button
                            key={unit.value}
                            type="button"
                            className={form.serving_unit === unit.value ? 'active' : ''}
                            aria-pressed={form.serving_unit === unit.value}
                            onClick={() =>
                              setForm((f) => {
                                const nextUnit = unit.value;
                                const parsed = parsePortionAmount(f.default_serving_grams, nextUnit);
                                return {
                                  ...f,
                                  serving_unit: nextUnit,
                                  default_serving_grams: String(parsed || defaultPortionAmount(nextUnit)),
                                };
                              })
                            }
                          >
                            {unit.short}
                          </button>
                        ))}
                      </div>
                      <input
                        id="food-portion"
                        value={form.default_serving_grams}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            default_serving_grams: sanitizePortionInput(e.target.value, f.serving_unit),
                          }))
                        }
                        inputMode={form.serving_unit === 'unit' ? 'numeric' : 'decimal'}
                        placeholder={form.serving_unit === 'unit' ? '1' : '100'}
                      />
                    </div>
                  </div>
                  <div className="food-form-field">
                    <label htmlFor="food-kcal">Kcal</label>
                    <input
                      id="food-kcal"
                      value={form.kcal_100g}
                      onChange={(e) => setForm((f) => ({ ...f, kcal_100g: sanitizeMacroInput(e.target.value) }))}
                      inputMode="decimal"
                      placeholder="0"
                    />
                  </div>
                  <div className="food-form-field">
                    <label htmlFor="food-protein">Prot.</label>
                    <input
                      id="food-protein"
                      value={form.protein_g_100g}
                      onChange={(e) => setForm((f) => ({ ...f, protein_g_100g: sanitizeMacroInput(e.target.value) }))}
                      inputMode="decimal"
                      placeholder="0"
                    />
                  </div>
                  <div className="food-form-field">
                    <label htmlFor="food-carbs">Carb.</label>
                    <input
                      id="food-carbs"
                      value={form.carbs_g_100g}
                      onChange={(e) => setForm((f) => ({ ...f, carbs_g_100g: sanitizeMacroInput(e.target.value) }))}
                      inputMode="decimal"
                      placeholder="0"
                    />
                  </div>
                  <div className="food-form-field">
                    <label htmlFor="food-fat">Grasa</label>
                    <input
                      id="food-fat"
                      value={form.fat_g_100g}
                      onChange={(e) => setForm((f) => ({ ...f, fat_g_100g: sanitizeMacroInput(e.target.value) }))}
                      inputMode="decimal"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="food-form-footer">
              <button type="button" className="btn secondary" onClick={() => setModalOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="btn" disabled={saving} onClick={() => void saveCatalog()}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
