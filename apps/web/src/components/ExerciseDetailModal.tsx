import type { ExerciseRow } from '@reset-fitness/shared/types/database';
import { DumbbellIcon } from '@/components/icons';

/** Detalle de un ejercicio — mismo layout que app.hevycoach.com:
 * panel izquierdo (imagen + equipo/músculo/tipo) y panel derecho
 * (instrucciones numeradas + adjunto). Reutilizado desde la Librería de
 * ejercicios y desde el editor de rutina. */
export function ExerciseDetailModal({
  exercise,
  onClose,
  onEdit,
}: {
  exercise: ExerciseRow;
  onClose: () => void;
  onEdit?: () => void;
}): React.JSX.Element {
  const equipment = exercise.equipment?.join(', ') || '—';
  const primaryMuscle = exercise.target_muscles?.[0] ?? exercise.body_part ?? '—';
  const exerciseType = exercise.exercise_type ?? '—';
  const steps = exercise.instructions ?? [];

  return (
    <div className="invite-qr-backdrop" onClick={onClose}>
      <div className="exdetail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="exdetail-left">
          <h2 className="exdetail-title">{exercise.name}</h2>
          <div className="exdetail-img">
            {exercise.image_url ? (
              <img src={exercise.image_url} alt={exercise.name} />
            ) : (
              <DumbbellIcon size={48} />
            )}
          </div>
          <div className="exdetail-meta">
            <div><span className="k">Equipo: </span><span className="v">{equipment}</span></div>
            <div><span className="k">Grupo muscular principal:</span></div>
            <div className="v" style={{ marginBottom: 8 }}>{primaryMuscle}</div>
            <div><span className="k">Tipo de ejercicio:</span></div>
            <div className="v">{exerciseType}</div>
          </div>
        </div>

        <div className="exdetail-right">
          <div className="exdetail-rhead">
            <h3>Detalle del ejercicio</h3>
            <button type="button" className="exdetail-close-x" onClick={onClose} aria-label="Cerrar">✕</button>
          </div>
          <div className="exdetail-body">
            <div className="exdetail-section-title">Instrucciones</div>
            {steps.length > 0 ? (
              steps.map((step, i) => (
                <div key={i} className="exdetail-step">
                  <span className="exdetail-step-n">{i + 1}</span>
                  <span className="exdetail-step-t">{step}</span>
                </div>
              ))
            ) : (
              <p className="muted" style={{ margin: '4px 0 20px' }}>Este ejercicio no tiene instrucciones cargadas.</p>
            )}

            <div className="exdetail-section-title" style={{ marginTop: 22 }}>Adjunto</div>
            <div className="exdetail-attach">
              <span className="exdetail-attach-ico">▷</span>
              {exercise.video_url ? (
                <a href={exercise.video_url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)' }}>Ver video</a>
              ) : (
                <span>No hay adjunto</span>
              )}
            </div>
          </div>
        </div>

        <div className="exdetail-foot">
          {onEdit && (
            <button type="button" className="btn secondary" onClick={onEdit}>Editar ejercicio</button>
          )}
          <button type="button" className="btn primary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
