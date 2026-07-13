import { useEffect, useMemo, useState } from 'react';
import type { HydrationLogRow, MealLogRow, MealType } from '@reset-fitness/shared/types/database';
import { supabase } from '@/lib/supabase';
import { Ring, AreaChart } from '@/components/charts';
import { Lightbox } from '@/components/ui';
import { brand } from '@/theme/brand';

function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function fmtLong(iso: string): string {
  return parseIsoDateLocal(iso).toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' });
}
function todayIso(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

const MEAL_LABEL: Record<MealType, string> = { DES: 'Desayuno', ALM: 'Almuerzo', MER: 'Merienda', CEN: 'Cena', COL: 'Colación' };
const MEAL_ORDER: MealType[] = ['DES', 'ALM', 'MER', 'CEN', 'COL'];

export function NutritionPanel({ clientId }: { clientId: string }): React.JSX.Element {
  const [meals, setMeals] = useState<MealLogRow[]>([]);
  const [hydration, setHydration] = useState<HydrationLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<{ src: string; caption: string } | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const since = (() => { const d = new Date(); d.setDate(d.getDate() - 29); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
      const [{ data: mealRows }, { data: hydroRows }] = await Promise.all([
        supabase.from('meal_logs').select('*').eq('user_id', clientId).eq('is_included', true).order('date', { ascending: false }).limit(120),
        supabase.from('hydration_logs').select('*').eq('user_id', clientId).gte('date', since).order('date', { ascending: true }),
      ]);
      setMeals((mealRows as MealLogRow[] | null) ?? []);
      setHydration((hydroRows as HydrationLogRow[] | null) ?? []);
      setLoading(false);
    })();
  }, [clientId]);

  // Resuelve URLs firmadas para las fotos de comida (bucket privado meal-photos).
  useEffect(() => {
    const paths = meals.map((m) => m.photo_url).filter((p): p is string => !!p && photoUrls[p] === undefined);
    if (paths.length === 0) return;
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(paths.map(async (p) => {
        const { data } = await supabase.storage.from('meal-photos').createSignedUrl(p, 3600);
        return [p, data?.signedUrl ?? null] as const;
      }));
      if (cancelled) return;
      setPhotoUrls((prev) => {
        const next = { ...prev };
        for (const [p, url] of entries) if (url) next[p] = url;
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [meals, photoUrls]);

  const today = todayIso();
  const todayHydro = hydration.find((h) => h.date === today) ?? hydration[hydration.length - 1] ?? null;
  const hydroPct = todayHydro ? Math.min(100, Math.round((todayHydro.total_ml / Math.max(1, todayHydro.goal_ml)) * 100)) : 0;
  const hydroSeries = useMemo(() => hydration.map((h) => h.total_ml), [hydration]);

  const byDay = useMemo(() => {
    const map = new Map<string, MealLogRow[]>();
    for (const m of meals) {
      const list = map.get(m.date) ?? [];
      list.push(m);
      map.set(m.date, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [meals]);

  if (loading) return <div className="card"><p className="muted" style={{ margin: 0 }}>Cargando nutrición…</p></div>;

  return (
    <div className="nut-layout">
      <div className="nut-main">
        <div className="section-title" style={{ marginBottom: 12 }}>Comidas registradas</div>
        {byDay.length === 0 ? (
          <div className="card"><p className="muted" style={{ margin: 0 }}>Sin comidas registradas.</p></div>
        ) : (
          byDay.map(([date, items]) => {
            const totals = items.reduce((acc, m) => ({
              kcal: acc.kcal + (m.energy_kcal ?? 0),
              protein: acc.protein + (m.protein_g ?? 0),
              carbs: acc.carbs + (m.carbs_g ?? 0),
              fat: acc.fat + (m.fat_g ?? 0),
            }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
            const sorted = [...items].sort((a, b) => MEAL_ORDER.indexOf(a.meal_type) - MEAL_ORDER.indexOf(b.meal_type));
            return (
              <div key={date} className="card nut-day-card">
                <div className="nut-day-head">
                  <div style={{ textTransform: 'capitalize', fontWeight: 700, fontSize: 14.5 }}>{fmtLong(date)}</div>
                  <div className="nut-day-totals">
                    <span><b>{Math.round(totals.kcal)}</b> kcal</span>
                    <span className="muted">P {Math.round(totals.protein)}g · C {Math.round(totals.carbs)}g · G {Math.round(totals.fat)}g</span>
                  </div>
                </div>
                {sorted.map((m) => {
                  const photoUrl = m.photo_url ? photoUrls[m.photo_url] : undefined;
                  return (
                    <div key={m.id} className="nut-meal-row">
                      {photoUrl ? (
                        <img
                          src={photoUrl} alt="" className="nut-meal-thumb"
                          onClick={() => setLightbox({ src: photoUrl, caption: `${MEAL_LABEL[m.meal_type]} · ${m.title ?? m.product_display_name ?? 'Comida'}` })}
                        />
                      ) : (
                        <span className="nut-meal-thumb nut-meal-thumb--empty" aria-hidden />
                      )}
                      <span className="nut-meal-tag">{MEAL_LABEL[m.meal_type]}</span>
                      <span className="nut-meal-title">{m.title ?? m.product_display_name ?? 'Comida'}</span>
                      <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{m.energy_kcal != null ? `${Math.round(m.energy_kcal)} kcal` : '—'}</span>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      <div className="nut-side">
        <div className="card">
          <div className="section-title" style={{ marginBottom: 4 }}>Hidratación</div>
          <div className="sd-section-sub" style={{ marginBottom: 10 }}>Hoy</div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Ring pct={hydroPct} size={128} label={todayHydro ? `${(todayHydro.total_ml / 1000).toFixed(1)} / ${(todayHydro.goal_ml / 1000).toFixed(1)} L` : 'Sin registro'} />
          </div>
          {hydroSeries.length > 1 && (
            <div style={{ marginTop: 14 }}>
              <div className="muted" style={{ fontSize: 11.5, marginBottom: 4 }}>Últimos 30 días (ml)</div>
              <AreaChart values={hydroSeries} height={80} color={brand.color.accent} />
            </div>
          )}
        </div>
      </div>

      {lightbox && <Lightbox src={lightbox.src} caption={lightbox.caption} onClose={() => setLightbox(null)} />}

      <style>{`
        .nut-layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 20px; align-items: start; }
        @media (max-width: 980px) { .nut-layout { grid-template-columns: 1fr; } }
        .nut-day-card { margin-bottom: 14px; }
        .nut-day-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding-bottom: 10px; margin-bottom: 6px; border-bottom: 1px solid var(--border); }
        .nut-day-totals { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; font-size: 13px; }
        .nut-meal-row { display: flex; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--border); }
        .nut-meal-row:last-child { border-bottom: none; }
        .nut-meal-thumb { width: 34px; height: 34px; border-radius: 8px; object-fit: cover; flex-shrink: 0; cursor: zoom-in; background: var(--surface-elevated); }
        .nut-meal-thumb--empty { border: 1px dashed var(--border-strong); }
        .nut-meal-tag { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--accent-text); background: var(--accent-soft); border-radius: 6px; padding: 3px 7px; flex-shrink: 0; }
        .nut-meal-title { flex: 1; min-width: 0; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      `}</style>
    </div>
  );
}
