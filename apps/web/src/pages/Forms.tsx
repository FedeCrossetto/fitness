import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { BookOpenIcon } from '@/components/icons';

/** Hub de formularios de consulta: uno por Plan (Base / Mentoría 1-1) —
 * mismo mecanismo de siempre (DSL en ConsultationForm.tsx), ahora separado
 * por plan_type en vez de un único formulario por entrenador. */
export function FormsPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const cards = [
    { planType: 'mentoria', title: t.web.forms_card_mentoria, desc: t.web.forms_card_mentoria_desc },
    { planType: 'base', title: t.web.forms_card_base, desc: t.web.forms_card_base_desc },
  ] as const;

  return (
    <div>
      <h1 className="page-title">{t.web.forms_title}</h1>
      <p className="page-sub">{t.web.forms_sub}</p>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', marginTop: 16 }}>
        {cards.map((c) => (
          <div
            key={c.planType}
            className="card"
            style={{ cursor: 'pointer', marginBottom: 0 }}
            onClick={() => navigate(`/settings/forms/${c.planType}`)}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 14 }}>
              <div className="stat-ico" style={{ background: 'var(--surface-elevated)' }}>
                <BookOpenIcon size={18} />
              </div>
            </div>
            <div style={{ fontWeight: 650, fontSize: 16, marginBottom: 6 }}>{c.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{c.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
