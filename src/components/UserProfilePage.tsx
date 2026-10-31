import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import BrandLockup from './BrandLockup';
import ProfileMenu from './ProfileMenu';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import type { WorkspaceSummary } from '../features/content-approval/contentService';

interface UserProfilePageProps {
  user: User | null;
  email: string;
  fullName: string;
  avatarUrl?: string;
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
  canManage: boolean;
  createWorkspaceRequest: number;
  demoMode: boolean;
  onChangeWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: (name: string) => Promise<void>;
  onManageTeam: () => void;
  onOpenPanel: () => void;
  onOpenSettings: () => void;
  onNewWorkspace: () => void;
  onSignOut: () => void;
  onSaveProfile: (name: string, avatarFile?: File) => Promise<string>;
}

function getSavedName(user: User | null, fullName: string): string {
  if (fullName.trim()) return fullName.trim();
  if (!user) return '';
  const metadataName = user.user_metadata?.full_name;
  return typeof metadataName === 'string' && metadataName.trim()
    ? metadataName.trim()
    : '';
}

function getAvatarUrl(user: User | null, avatarUrl: string): string {
  if (avatarUrl) return avatarUrl;
  if (!user) return '';
  const metadataAvatarUrl = user.user_metadata?.avatar_url;
  return typeof metadataAvatarUrl === 'string' ? metadataAvatarUrl : '';
}

export default function UserProfilePage({
  user,
  email,
  fullName,
  avatarUrl: initialAvatarUrl = '',
  workspaces,
  activeWorkspaceId,
  canManage,
  createWorkspaceRequest,
  demoMode,
  onChangeWorkspace,
  onCreateWorkspace,
  onManageTeam,
  onOpenPanel,
  onOpenSettings,
  onNewWorkspace,
  onSignOut,
  onSaveProfile,
}: UserProfilePageProps) {
  const [name, setName] = useState(getSavedName(user, fullName));
  const [avatarUrl, setAvatarUrl] = useState(getAvatarUrl(user, initialAvatarUrl));
  const [avatarFile, setAvatarFile] = useState<File>();
  const [previewUrl, setPreviewUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setNotice('');
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      setError('Escolha uma imagem JPG, PNG, GIF ou WebP.');
      event.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 5 MB.');
      event.target.value = '';
      return;
    }
    setAvatarFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const savedAvatarUrl = user ? await onSaveProfile(name.trim(), avatarFile) : '';
      setAvatarFile(undefined);
      if (savedAvatarUrl) {
        setAvatarUrl(savedAvatarUrl);
        setPreviewUrl('');
      }
      setNotice('Seu perfil foi atualizado.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar seu perfil.');
    } finally {
      setSaving(false);
    }
  }

  const preview = previewUrl || avatarUrl;
  const displayName = name.trim() || 'Meu perfil';

  return (
    <main className="page-shell">
      <header className="topbar">
        <div className="workspace-header-main">
          <BrandLockup />
          <WorkspaceSwitcher
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            canManage={canManage}
            openCreateRequest={createWorkspaceRequest}
            onChange={onChangeWorkspace}
            onCreateWorkspace={onCreateWorkspace}
            onManageTeam={canManage ? onManageTeam : undefined}
          />
        </div>
        <div className="user-menu">
          <ProfileMenu
            displayName={displayName}
            avatarUrl={preview || avatarUrl}
            onOpenPanel={onOpenPanel}
            onOpenSettings={onOpenSettings}
            onNewWorkspace={onNewWorkspace}
            onSignOut={onSignOut}
          />
        </div>
      </header>

      {demoMode && (
        <div className="notice demo-banner" role="status">
          Modo demonstração: alterações de perfil não são salvas.
        </div>
      )}

      <section className="profile-settings-page">
        <div className="profile-settings-heading">
          <p className="eyebrow">SUA CONTA</p>
          <h1>Configuração do perfil</h1>
          <p className="muted">Atualize como seu nome e sua foto aparecem para sua equipe.</p>
        </div>

        <form className="profile-settings-card" onSubmit={(event) => void submit(event)}>
          <div className="profile-avatar-editor">
            {preview ? (
              <img src={preview} alt="Prévia da foto de perfil" />
            ) : (
              <span aria-hidden="true">{displayName.slice(0, 1).toLocaleUpperCase('pt-BR')}</span>
            )}
            <label className="button">
              Escolher foto
              <input
                accept="image/*"
                aria-label="Enviar foto de perfil"
                disabled={saving}
                onChange={chooseAvatar}
                type="file"
              />
            </label>
            <small>JPG, PNG, GIF ou WebP. Até 5 MB.</small>
          </div>

          <div className="profile-fields">
            <label>
              Nome
              <input
                autoComplete="name"
                maxLength={80}
                minLength={2}
                onChange={(event) => setName(event.target.value)}
                placeholder="Como sua equipe deve chamar você"
                required
                value={name}
              />
            </label>
            <label>
              E-mail
              <input autoComplete="email" readOnly value={email} />
              <small>O e-mail da conta não pode ser alterado por aqui.</small>
            </label>
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}
          {notice && <p className="notice workspace-success" role="status">{notice}</p>}
          <footer className="profile-settings-footer">
            <button className="button" onClick={onOpenPanel} type="button">Voltar ao painel</button>
            <button className="button button-primary" disabled={saving || name.trim().length < 2} type="submit">
              {saving ? 'Salvando…' : 'Salvar perfil'}
            </button>
          </footer>
        </form>
      </section>
    </main>
  );
}
