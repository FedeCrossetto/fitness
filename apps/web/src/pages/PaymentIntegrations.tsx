import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/hooks/useToast';

// Isotipo de MercadoPago (óvalo celeste + handshake) + wordmark.
function MpLogo({ size = 20 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size * 3.6} height={size} viewBox="0 0 108 30" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <circle cx="15" cy="15" r="15" fill="#009EE3" />
      <path
        d="M8.5 16.2c1.6-3.2 5-5.2 8.7-4.6 2 .3 3.8 1.4 5 3l-2.1 1.5c-.8-1.1-2-1.8-3.4-1.9-2.1-.2-4 1-4.8 2.9L8.5 16.2z"
        fill="#fff"
      />
      <path
        d="M22.2 14.6c.5 1 .7 2.1.5 3.2-.4 2.4-2.4 4.2-4.8 4.4-1.5.1-3-.5-4-1.6l2.1-1.5c.5.5 1.2.8 2 .8 1.2-.1 2.2-1 2.5-2.2l2.1 1.5-.4-4.6z"
        fill="#FFE600"
      />
      <text x="35" y="20" fontFamily="system-ui, sans-serif" fontSize="11" fontWeight="700" fill="#009EE3" letterSpacing="-0.2">mercado</text>
      <text x="35" y="30" fontFamily="system-ui, sans-serif" fontSize="11" fontWeight="700" fill="#009EE3" letterSpacing="-0.2" opacity="0.75">pago</text>
    </svg>
  );
}

function StripeLogo({ size = 20 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size * 2.2} height={size} viewBox="0 0 60 25" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <rect width="60" height="25" rx="5" fill="#635BFF" />
      <text x="30" y="17" fontFamily="system-ui, sans-serif" fontSize="12" fontWeight="700" fill="#fff" textAnchor="middle" letterSpacing="0.3">stripe</text>
    </svg>
  );
}

export function PaymentIntegrationsPage(): React.JSX.Element {
  const { session } = useAuth();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const userId = session?.user.id;

  const [mpConnected, setMpConnected] = useState(false);
  const [mpBusy, setMpBusy] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      const { data } = await supabase.rpc('trainer_mp_connected');
      setMpConnected(data === true);
    })();
  }, [userId]);

  useEffect(() => {
    const mp = searchParams.get('mp');
    if (!mp) return;
    if (mp === 'connected') {
      setMpConnected(true);
      showToast('success', t.payments.mp_connected_toast);
    } else {
      showToast('error', t.payments.mp_error_toast);
    }
    searchParams.delete('mp');
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams, showToast, t.payments.mp_connected_toast, t.payments.mp_error_toast]);

  const connectMercadoPago = useCallback(async () => {
    setMpBusy(true);
    const { data, error: fnError } = await supabase.functions.invoke<{ authUrl: string }>('mp-oauth-start');
    setMpBusy(false);
    if (fnError || !data?.authUrl) {
      showToast('error', t.payments.mp_connect_error);
      return;
    }
    window.location.href = data.authUrl; // redirige a MercadoPago para autorizar
  }, [showToast, t.payments.mp_connect_error]);

  return (
    <div>
      <Link to="/payments" className="back-link">← {t.web.back_to_payments}</Link>
      <h1 className="page-title">{t.payments.integrations_title}</h1>
      <p className="page-sub">{t.payments.integrations_sub}</p>

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 20 }}>
        <div className="integ-row" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="integ-row-icon">
            <MpLogo size={22} />
          </div>
          <div className="integ-row-body">
            <div className="integ-row-title">{t.payments.integrations_mp_title}</div>
            <div className="integ-row-desc">
              {mpConnected ? t.payments.mp_connected : t.payments.integrations_mp_desc}
            </div>
          </div>
          {mpConnected ? (
            <span className="payments-mp-badge">
              <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden style={{ flexShrink: 0 }}>
                <circle cx="4" cy="4" r="4" fill="currentColor" />
              </svg>
              {t.payments.mp_connected}
            </span>
          ) : null}
          <button
            type="button"
            className={`btn ${mpConnected ? 'secondary' : ''} sm`}
            onClick={() => void connectMercadoPago()}
            disabled={mpBusy}
            style={{ marginLeft: 12 }}
          >
            {mpBusy ? '…' : mpConnected ? t.payments.integrations_reconnect : t.payments.mp_connect}
          </button>
        </div>

        <div className="integ-row">
          <div className="integ-row-icon">
            <StripeLogo size={22} />
          </div>
          <div className="integ-row-body">
            <div className="integ-row-title">{t.payments.integrations_stripe_title}</div>
            <div className="integ-row-desc">{t.payments.integrations_stripe_desc}</div>
          </div>
          <button type="button" className="btn secondary sm" disabled style={{ marginLeft: 12 }}>
            {t.payments.integrations_coming_soon}
          </button>
        </div>
      </div>

      <style>{`
        .integ-row { display: flex; align-items: center; gap: 14px; padding: 16px 20px; }
        .integ-row-icon { flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .integ-row-body { flex: 1; min-width: 0; }
        .integ-row-title { font-weight: 600; font-size: 14px; margin-bottom: 2px; color: var(--text-primary); }
        .integ-row-desc { font-size: 12.5px; color: var(--text-tertiary); }
      `}</style>
    </div>
  );
}
