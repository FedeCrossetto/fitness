import { CreditCardIcon } from '@/components/icons';

const MOCK_PAYMENTS = [
  { id: '1', student: 'Ezequiel Amado', plan: 'Plan Premium', amount: 12000, date: '2026-06-10', status: 'paid' as const },
  { id: '2', student: 'Laura Martínez', plan: 'Plan Básico', amount: 7500, date: '2026-06-08', status: 'paid' as const },
  { id: '3', student: 'Marcos Pérez', plan: 'Plan Premium', amount: 12000, date: '2026-06-05', status: 'pending' as const },
  { id: '4', student: 'Sol Fernández', plan: 'Plan Básico', amount: 7500, date: '2026-05-30', status: 'paid' as const },
];

const STATUS_LABEL = { paid: 'Pagado', pending: 'Pendiente', overdue: 'Vencido' };
const STATUS_CLASS = { paid: 'badge solid green', pending: 'badge solid amber', overdue: 'badge solid gray' };

export function PaymentsPage(): React.JSX.Element {
  const total = MOCK_PAYMENTS.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const pending = MOCK_PAYMENTS.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Payments</h1>
        <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CreditCardIcon size={15} /> Nuevo cobro
        </button>
      </div>
      <p className="page-sub">Gestioná los pagos y suscripciones de tus alumnos.</p>

      <div className="grid" style={{ marginBottom: 24 }}>
        <div className="stat">
          <div className="stat-head"><span className="stat-ico"><CreditCardIcon /></span></div>
          <div>
            <div className="n">${total.toLocaleString('es-AR')}</div>
            <div className="l">Cobrado este mes</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-head"><span className="stat-ico"><CreditCardIcon /></span></div>
          <div>
            <div className="n">${pending.toLocaleString('es-AR')}</div>
            <div className="l">Pendiente de cobro</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-head"><span className="stat-ico"><CreditCardIcon /></span></div>
          <div>
            <div className="n">{MOCK_PAYMENTS.length}</div>
            <div className="l">Transacciones</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-toolbar">
          <span style={{ fontWeight: 600, fontSize: 15 }}>Historial de pagos</span>
          <span className="row-count">{MOCK_PAYMENTS.length} transacciones</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Plan</th>
              <th>Monto</th>
              <th>Fecha</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_PAYMENTS.map((p) => (
              <tr key={p.id}>
                <td><span className="cell-name">{p.student}</span></td>
                <td className="muted">{p.plan}</td>
                <td>${p.amount.toLocaleString('es-AR')}</td>
                <td className="muted">{new Date(p.date).toLocaleDateString('es-AR')}</td>
                <td><span className={STATUS_CLASS[p.status]}>{STATUS_LABEL[p.status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
