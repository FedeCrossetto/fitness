import { useMemo, useRef, useState } from 'react';
import { SettingsIcon, BellIcon, BrushIcon, CreditCardIcon, UsersIcon, MessageIcon, BookOpenIcon, CheckIcon } from '@/components/icons';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/hooks/useToast';
import { Link } from 'react-router-dom';
import { LANGUAGES } from '@reset-fitness/shared';
import { supabase } from '@/lib/supabase';
import { resolveAvatarUrl } from '@/lib/avatarUrl';

type SettingsSection = {
  icon: React.ReactNode;
  title: string;
  desc: string;
  action: string;
  to?: string;
  highlight?: boolean;
};

function SectionRow({ s, isLast }: { s: SettingsSection; isLast: boolean }): React.JSX.Element {
  const inner = (
    <div
      className={s.to ? 'settings-row settings-row--link' : 'settings-row'}
      style={{
        borderBottom: !isLast ? '1px solid var(--border)' : 'none',
        background: s.highlight ? 'color-mix(in srgb, var(--primary) 5%, transparent)' : undefined,
      }}
    >
      <div className="settings-row-icon" style={{ color: s.highlight ? 'var(--primary)' : undefined }}>
        {s.icon}
      </div>
      <div className="settings-row-body">
        <div className="settings-row-title">{s.title}</div>
        <div className="settings-row-desc">{s.desc}</div>
      </div>
      <span className={`btn ${s.highlight ? 'primary' : 'secondary'} settings-row-btn`}>
        {s.action}
      </span>
    </div>
  );

  if (s.to) {
    return <Link to={s.to} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link>;
  }
  return inner;
}

function initials(name: string | null | undefined): string {
  if (!name) return 'E';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function SettingsPage(): React.JSX.Element {
  const { profile, session, refreshProfile } = useAuth();
  const { t, language, setLanguage } = useTranslation();
  const cs = t.web.coach_settings;
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const avatarSrc = resolveAvatarUrl(profile?.avatar_url);

  const SECTIONS = useMemo<SettingsSection[]>(() => [
    { icon: <UsersIcon size={20} />, title: cs.sec_profile.title, desc: cs.sec_profile.desc, action: cs.sec_profile.action },
    { icon: <BrushIcon size={20} />, title: cs.sec_branding.title, desc: cs.sec_branding.desc, action: cs.sec_branding.action, to: '/branding' },
    { icon: <MessageIcon size={20} />, title: cs.sec_auto_messages.title, desc: cs.sec_auto_messages.desc, action: cs.sec_auto_messages.action, to: '/settings/auto-messages', highlight: true },
    { icon: <BookOpenIcon size={20} />, title: cs.sec_consultation.title, desc: cs.sec_consultation.desc, action: cs.sec_consultation.action, to: '/settings/forms' },
    { icon: <CheckIcon size={20} />, title: cs.sec_waiver.title, desc: cs.sec_waiver.desc, action: cs.sec_waiver.action, to: '/settings/waiver' },
    { icon: <CreditCardIcon size={20} />, title: cs.sec_subscription.title, desc: cs.sec_subscription.desc, action: cs.sec_subscription.action },
    { icon: <BellIcon size={20} />, title: cs.sec_notifications.title, desc: cs.sec_notifications.desc, action: cs.sec_notifications.action, to: '/settings/notifications' },
    { icon: <SettingsIcon size={20} />, title: cs.sec_privacy.title, desc: cs.sec_privacy.desc, action: cs.sec_privacy.action },
  ], [cs]);

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const userId = session?.user.id;
    if (!file || !userId) return;

    if (!file.type.startsWith('image/')) {
      showToast('error', cs.photo_type_error);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('error', cs.photo_size_error);
      return;
    }

    setUploading(true);

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, {
      contentType: file.type,
      upsert: true,
    });

    if (uploadError) {
      setUploading(false);
      showToast('error', cs.photo_upload_error);
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId);

    setUploading(false);

    if (updateError) {
      showToast('error', cs.photo_save_error);
      return;
    }

    await refreshProfile();
    showToast('success', cs.photo_updated);
  };

  return (
    <div>
      <h1 className="page-title">{cs.title}</h1>
      <p className="page-sub">{cs.subtitle}</p>

      {/* Profile card */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <div
          className="avatar"
          style={{
            width: 56,
            height: 56,
            fontSize: 20,
            padding: avatarSrc ? 0 : undefined,
            overflow: avatarSrc ? 'hidden' : undefined,
          }}
        >
          {avatarSrc
            ? <img src={avatarSrc} alt={profile?.full_name ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initials(profile?.full_name)
          }
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 650, fontSize: 16 }}>{profile?.full_name ?? cs.trainer_fallback}</div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
            {t.web.role_trainer} · {profile?.role ?? 'trainer'}
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => void onPickPhoto(e)}
        />
        <button
          className="btn secondary"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? cs.uploading : cs.edit_photo}
        </button>
      </div>

      {/* Language */}
      <div className="card settings-lang-card">
        <div className="settings-lang-label">{cs.language}</div>
        <div className="lang-toggle" role="group" aria-label={cs.language}>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              className={`lang-btn${language === lang.code ? ' active' : ''}`}
              onClick={() => {
                setLanguage(lang.code);
                if (session?.user.id) void supabase.from('profiles').update({ locale: lang.code }).eq('id', session.user.id);
              }}
              title={lang.label}
            >
              {lang.flag} {lang.code.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Settings list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>
        {SECTIONS.map((s, i) => (
          <SectionRow key={s.title} s={s} isLast={i === SECTIONS.length - 1} />
        ))}
      </div>

      <style>{`
        .settings-lang-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 20px;
          margin-bottom: 0;
        }
        .settings-lang-label { font-weight: 600; font-size: 14px; color: var(--text-primary); }
        .settings-row {
          display: flex; align-items: center; gap: 14px;
          padding: 16px 20px; transition: background 120ms;
        }
        .settings-row--link:hover { background: var(--surface-elevated); cursor: pointer; }
        .settings-row-icon { flex-shrink: 0; width: 36px; height: 36px; border-radius: 8px;
          background: var(--surface-elevated); display: flex; align-items: center;
          justify-content: center; color: var(--text-secondary); }
        .settings-row-body { flex: 1; min-width: 0; }
        .settings-row-title { font-weight: 600; font-size: 14px; margin-bottom: 2px; color: var(--text-primary); }
        .settings-row-desc { font-size: 12.5px; color: var(--text-tertiary); }
        .settings-row-btn { font-size: 12.5px; padding: 7px 14px; flex-shrink: 0; pointer-events: none; }
      `}</style>
    </div>
  );
}
