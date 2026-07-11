import type { ExerciseRow } from '@reset-fitness/shared/types/database';
import { DumbbellIcon } from '@/components/icons';
import { useTranslation } from '@/hooks/useTranslation';
import { localizedExercise } from '@/lib/exerciseI18n';

const L = {
  es: { detail: 'Detalle del ejercicio', equipment: 'Equipo:', muscle: 'Grupo muscular principal:', type: 'Tipo de ejercicio:', instructions: 'Instrucciones', noInstr: 'Este ejercicio no tiene instrucciones cargadas.', attachment: 'Adjunto', watch: 'Ver video', noAttachment: 'No hay adjunto', edit: 'Editar ejercicio', close: 'Cerrar' },
  en: { detail: 'Exercise Details', equipment: 'Equipment:', muscle: 'Primary Muscle Group:', type: 'Exercise Type:', instructions: 'Instructions', noInstr: 'This exercise has no instructions yet.', attachment: 'Attachment', watch: 'Watch video', noAttachment: 'No attachment', edit: 'Edit exercise', close: 'Close' },
};

/** Detalle de un ejercicio — mismo layout que app.hevycoach.com:
 * panel izquierdo (imagen + equipo/músculo/tipo) y panel derecho
 * (instrucciones numeradas + adjunto). Bilingüe: elige el idioma según la
 * configuración del coach. Reutilizado desde la Librería y el editor de rutina. */
export function ExerciseDetailModal({
  exercise,
  onClose,
  onEdit,
}: {
  exercise: ExerciseRow;
  onClose: () => void;
  onEdit?: () => void;
}): React.JSX.Element {
  const { language } = useTranslation();
  const t = L[language] ?? L.es;
  const loc = localizedExercise(exercise, language);
  const equipment = exercise.equipment?.join(', ') || '—';
  const primaryMuscle = loc.muscle;
  const exerciseType = exercise.exercise_type ?? '—';
  const steps = loc.instructions;

  return (
    <div className="invite-qr-backdrop" onClick={onClose}>
      <div className="exdetail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="exdetail-left">
          <h2 className="exdetail-title">{loc.name}</h2>
          <div className="exdetail-img">
            {exercise.image_url ? (
              <img src={exercise.image_url} alt={loc.name} />
            ) : (
              <DumbbellIcon size={48} />
            )}
          </div>
          <div className="exdetail-meta">
            <div><span className="k">{t.equipment} </span><span className="v">{equipment}</span></div>
            <div><span className="k">{t.muscle}</span></div>
            <div className="v" style={{ marginBottom: 8 }}>{primaryMuscle}</div>
            <div><span className="k">{t.type}</span></div>
            <div className="v">{exerciseType}</div>
          </div>
        </div>

        <div className="exdetail-right">
          <div className="exdetail-rhead">
            <h3>{t.detail}</h3>
            <button type="button" className="exdetail-close-x" onClick={onClose} aria-label={t.close}>✕</button>
          </div>
          <div className="exdetail-body">
            <div className="exdetail-section-title">{t.instructions}</div>
            {steps.length > 0 ? (
              steps.map((step, i) => (
                <div key={i} className="exdetail-step">
                  <span className="exdetail-step-n">{i + 1}</span>
                  <span className="exdetail-step-t">{step}</span>
                </div>
              ))
            ) : (
              <p className="muted" style={{ margin: '4px 0 20px' }}>{t.noInstr}</p>
            )}

            <div className="exdetail-section-title" style={{ marginTop: 22 }}>{t.attachment}</div>
            <div className="exdetail-attach">
              <span className="exdetail-attach-ico">▷</span>
              {exercise.video_url ? (
                <a href={exercise.video_url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)' }}>{t.watch}</a>
              ) : (
                <span>{t.noAttachment}</span>
              )}
            </div>
          </div>
        </div>

        <div className="exdetail-foot">
          {onEdit && (
            <button type="button" className="btn secondary" onClick={onEdit}>{t.edit}</button>
          )}
          <button type="button" className="btn primary" onClick={onClose}>{t.close}</button>
        </div>
      </div>
    </div>
  );
}
