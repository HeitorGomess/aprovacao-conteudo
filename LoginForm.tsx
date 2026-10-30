import { useState, type FormEvent } from 'react';

interface LoginFormProps {
  error: string;
  onSubmit: (email: string, password: string) => Promise<void>;
}

export default function LoginForm({ error, onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      await onSubmit(email.trim(), password);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true">A</div>
        <p className="eyebrow">MARKETING · WORKSPACE</p>
        <h1 id="login-title">Aprovação de Conteúdo</h1>
        <p className="muted">Entre com uma conta autorizada para acessar o calendário compartilhado.</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            E-mail
            <input
              autoComplete="username"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Senha
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary" disabled={pending} type="submit">
            {pending ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p className="auth-footnote">Acesso somente para pessoas convidadas pelo administrador.</p>
      </section>
    </main>
  );
}
