import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import BrandLockup from './BrandLockup';
import ProfileMenu from './ProfileMenu';
import ThemeToggle from './ThemeToggle';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import type { WorkspaceSummary } from '../features/content-approval/contentService';

interface UserProfilePageProps {
  user: User | null;
  email: string;
  fullName: string;
  avatarUrl?: string;
  personalSpaceName?: string;
  allowPersonalSpaceRename?: boolean;
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
  canManage: boolean;
  demoMode: boolean;
  onChangeWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: (name: string) => Promise<void>;
  onManageTeam: () => void;
  onOpenPanel: () => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
  onSaveProfile: (name: string, avatarFile?: File, personalSpaceName?: string) => Promise<string>;
  onDeleteAccount: () => Promise<void>;
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
  personalSpaceName: initialPersonalSpaceName = 'Space Social',
  allowPersonalSpaceRename = false,
  workspaces,
  activeWorkspaceId,
  canManage,
  demoMode,
  onChangeWorkspace,
  onCreateWorkspace,
  onManageTeam,
  onOpenPanel,
  onOpenSettings,
  onSignOut,
  onSaveProfile,
  onDeleteAccount,
}: UserProfilePageProps) {
  const [name, setName] = useState(getSavedName(user, fullName));
  const [personalSpaceName, setPersonalSpaceName] = useState(initialPersonalSpaceName);
  const [avatarUrl, setAvatarUrl] = useState(getAvatarUrl(user, initialAvatarUrl));
  const [avatarFile, setAvatarFile] = useState<File>();
  const [previewUrl, setPreviewUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState('');

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
      const savedAvatarUrl = user
        ? await onSaveProfile(name.trim(), avatarFile, allowPersonalSpaceRename ? personalSpaceName.trim() : undefined)
        : '';
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

  async function confirmDeleteAccount() {
    setDeletingAccount(true);
    setDeleteAccountError('');
    try {
      await onDeleteAccount();
    } catch (reason) {
      setDeleteAccountError(reason instanceof Error ? reason.message : 'Não foi possível excluir sua conta.');
      setDeletingAccount(false);
    }
  }

  const preview = previewUrl || avatarUrl;
  const displayName = name.trim() || 'Meu perfil';

  return (
    <main className="page-shell">
      <header className="topbar">
        <div className="workspace-header-main">
          <BrandLockup />
          {workspaces.length > 0 && activeWorkspaceId && (
            <WorkspaceSwitcher
              workspaces={workspaces}
              activeWorkspaceId={activeWorkspaceId}
              canManage={false}
              onChange={onChangeWorkspace}
              onCreateWorkspace={onCreateWorkspace}
            />
          )}
        </div>
        <div className="user-menu">
          <ThemeToggle />
          <ProfileMenu
            displayName={displayName}
            avatarUrl={preview || avatarUrl}
            onOpenSettings={onOpenSettings}
            onManageCompany={canManage ? onManageTeam : undefined}
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
          <p className="muted">
            {allowPersonalSpaceRename
              ? 'Atualize seu perfil e escolha um nome para seu espaço pessoal.'
              : 'Atualize como seu nome e sua foto aparecem para sua equipe.'}
          </p>
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
            {allowPersonalSpaceRename && (
              <label>
                Nome do seu espaço
                <input
                  maxLength={80}
                  minLength={2}
                  onChange={(event) => setPersonalSpaceName(event.target.value)}
                  required
                  value={personalSpaceName}
                />
                <small>Este é seu espaço de trabalho pessoal, separado das empresas de que você participa.</small>
              </label>
            )}
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

        {!demoMode && (
          <section className="account-delete-section" aria-labelledby="account-delete-title">
            <div>
              <h2 id="account-delete-title">Excluir conta</h2>
              <p>
                Exclui permanentemente sua conta e apenas o SEU espaço pessoal.
              </p>
            </div>
            <button
              className="button button-danger account-delete-trigger"
              onClick={() => {
                setDeleteAccountError('');
                setDeleteAccountOpen(true);
              }}
              type="button"
            >
              Deletar conta
            </button>
          </section>
        )}
      </section>

      {deleteAccountOpen && (
        <div
          className="modal-backdrop account-delete-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deletingAccount) setDeleteAccountOpen(false);
          }}
        >
          <section className="workspace-modal account-delete-modal" role="dialog" aria-modal="true" aria-labelledby="account-delete-confirm-title">
            <header className="modal-header">
              <div>
                <p className="eyebrow">AÇÃO PERMANENTE</p>
                <h2 id="account-delete-confirm-title">Tem certeza que deseja deletar sua conta?</h2>
              </div>
              <button
                className="icon-button"
                disabled={deletingAccount}
                onClick={() => setDeleteAccountOpen(false)}
                type="button"
                aria-label="Fechar confirmação"
              >
                ×
              </button>
            </header>
            <div className="account-delete-content">
              <p>
                A conta{email ? ` ${email}` : ''} e o espaço pessoal serão excluídos permanentemente, incluindo os conteúdos pessoais. Você será removido das outras empresas, mas elas e seus conteúdos continuarão disponíveis para os demais membros.
              </p>
              <p className="account-delete-warning">
                Se você for proprietário de outra empresa, a propriedade será transferida para outro administrador. Se não houver outro administrador, será necessário promover alguém antes de excluir a conta.
              </p>
              {deleteAccountError && <p className="form-error" role="alert">{deleteAccountError}</p>}
              <footer className="modal-footer">
                <button
                  className="button"
                  disabled={deletingAccount}
                  onClick={() => setDeleteAccountOpen(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="button button-danger"
                  disabled={deletingAccount}
                  onClick={() => void confirmDeleteAccount()}
                  type="button"
                >
                  {deletingAccount ? 'Excluindo conta…' : 'Sim, deletar conta'}
                </button>
              </footer>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
