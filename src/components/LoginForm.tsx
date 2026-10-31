import { useState, type FormEvent } from 'react';
import BrandLockup from './BrandLockup';

type AuthMode = 'login' | 'signup' | 'forgot-password' | 'update-password';

interface LoginFormProps {
  error: string;
  notice?: string;
  recovery?: boolean;
  onSubmit: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<string>;
  onRequestPasswordReset: (email: string) => Promise<string>;
  onUpdatePassword: (password: string) => Promise<void>;
}

function getErrorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'object' && reason !== null && 'message' in reason && typeof reason.message === 'string') {
    return reason.message;
  }
  return 'Ocorreu um erro inesperado. Tente novamente.';
}

export default function LoginForm({
  error,
  notice = '',
  recovery = false,
  onSubmit,
  onSignUp,
  onRequestPasswordReset,
  onUpdatePassword,
}: LoginFormProps) {
  const [mode, setMode] = useState<AuthMode>(recovery ? 'update-password' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [formError, setFormError] = useState('');

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setFeedback('');
    setFormError('');
    setPassword('');
    setConfirmPassword('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFeedback('');
    setFormError('');

    try {
      if (mode === 'login') {
        await onSubmit(email.trim(), password);
      } else if (mode === 'signup') {
        if (password !== confirmPassword) {
          setFormError('As senhas não coincidem.');
          return;
        }
        setFeedback(await onSignUp(email.trim(), password));
      } else if (mode === 'forgot-password') {
        setFeedback(await onRequestPasswordReset(email.trim()));
      } else {
        if (password !== confirmPassword) {
          setFormError('As senhas não coincidem.');
          return;
        }
        await onUpdatePassword(password);
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        setFeedback('Senha atualizada. Entre com sua nova senha para continuar.');
      }
    } catch (reason) {
      setFormError(getErrorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  const isRecovery = mode === 'update-password';
  const title = mode === 'login'
    ? 'Boas ideias merecem espaço.'
    : mode === 'signup'
      ? 'Crie sua conta.'
      : mode === 'forgot-password'
        ? 'Vamos recuperar seu acesso.'
        : 'Defina uma nova senha.';
  const description = mode === 'login'
    ? 'Entre para planejar, compartilhar e acompanhar cada conteúdo da sua equipe.'
    : mode === 'signup'
      ? 'Crie sua conta e confirme seu e-mail para acessar o painel como revisor.'
      : mode === 'forgot-password'
        ? 'Enviaremos um link seguro para o e-mail cadastrado.'
        : 'Escolha uma senha segura para continuar usando sua conta.';

  return (
    <main className="auth-page">
      <section className="auth-layout" aria-label="Acesso ao workspace de marketing">
        <div className="auth-story">
          <BrandLockup className="auth-brand" variant="light" />
          <div className="auth-story-copy">
            <p className="auth-kicker"><span /> PLANEJAMENTO DE MARKETING</p>
            <h1>Seu próximo grande conteúdo começa aqui.</h1>
            <p className="auth-story-description">
              Um espaço simples para organizar ideias, alinhar pessoas e transformar planejamento em conteúdo publicado.
            </p>
            <div className="auth-highlights">
              <div><span className="auth-highlight-icon">01</span><span>Planejamento visual em um só lugar</span></div>
              <div><span className="auth-highlight-icon">02</span><span>Revisões claras, sem perder o contexto</span></div>
              <div><span className="auth-highlight-icon">03</span><span>Uma equipe, do rascunho à aprovação</span></div>
            </div>
          </div>
          <p className="auth-copyright">APROVAÇÃO DE CONTEÚDO <span>·</span> FEITO PARA BOAS IDEIAS</p>
          <div className="auth-decoration auth-decoration-one" aria-hidden="true" />
        </div>

        <div className="auth-panel">
          <div className="auth-card">
            <div className="auth-card-heading">
              <p className="eyebrow">{isRecovery ? 'RECUPERAÇÃO DE CONTA' : 'ACESSO AO WORKSPACE'}</p>
              <h2>{title}</h2>
              <p className="muted">{description}</p>
            </div>

            <form className="login-form" onSubmit={(event) => void handleSubmit(event)}>
              {mode !== 'update-password' && (
                <label>
                  E-mail
                  <input
                    autoComplete="email"
                    autoFocus
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </label>
              )}
              {mode !== 'forgot-password' && (
                <label>
                  {isRecovery ? 'Nova senha' : 'Senha'}
                  <input
                    autoComplete={isRecovery ? 'new-password' : mode === 'signup' ? 'new-password' : 'current-password'}
                    minLength={8}
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </label>
              )}
              {(mode === 'signup' || isRecovery) && (
                <label>
                  Confirmar senha
                  <input
                    autoComplete="new-password"
                    minLength={8}
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />
                </label>
              )}

              {mode === 'login' && (
                <button className="auth-inline-link auth-forgot-link" onClick={() => changeMode('forgot-password')} type="button">
                  Esqueci minha senha
                </button>
              )}
              {(formError || error) && (
                <p className="form-error" role="alert">{formError || error}</p>
              )}
              {notice && <p className="form-success" role="status">{notice}</p>}
              {feedback && <p className="form-success" role="status">{feedback}</p>}

              <button className="button button-primary auth-submit" disabled={pending} type="submit">
                {pending
                  ? 'Aguarde…'
                  : mode === 'login'
                    ? 'Entrar no workspace'
                    : mode === 'signup'
                      ? 'Criar conta'
                      : mode === 'forgot-password'
                        ? 'Enviar link de recuperação'
                        : 'Salvar nova senha'}
              </button>
            </form>

            <div className="auth-switch">
              {mode === 'login' && (
                <p>Ainda não tem uma conta? <button className="auth-inline-link" onClick={() => changeMode('signup')} type="button">Criar conta</button></p>
              )}
              {mode === 'signup' && (
                <p>Já tem uma conta? <button className="auth-inline-link" onClick={() => changeMode('login')} type="button">Fazer login</button></p>
              )}
              {mode === 'forgot-password' && (
                <p>Lembrou sua senha? <button className="auth-inline-link" onClick={() => changeMode('login')} type="button">Voltar ao login</button></p>
              )}
              {isRecovery && !recovery && (
                <p><button className="auth-inline-link" onClick={() => changeMode('login')} type="button">Voltar ao login</button></p>
              )}
            </div>
            {mode === 'signup' && (
              <p className="auth-footnote">Após confirmar seu e-mail, o administrador precisa liberar seu perfil de acesso.</p>
            )}
          </div>
          <p className="auth-panel-footnote">Acesso protegido para sua equipe de marketing.</p>
        </div>
      </section>
    </main>
  );
}
