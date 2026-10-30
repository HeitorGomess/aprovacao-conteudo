import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import ContentCard from './ContentCard';
import ContentForm from './ContentForm';
import LoginForm from './LoginForm';
import {
  deleteContent,
  fetchContents,
  saveContent,
  subscribeToContents,
  supabase,
  verifyEditor,
} from './contentService';
import type { Content, ContentFormData, ContentStatus } from './types';

type ViewMode = 'cards' | 'calendar' | 'table';

const statusLabels: Record<ContentStatus, string> = {
  rascunho: 'Rascunho',
  revisao: 'Em revisão',
  ajustes: 'Ajustes',
  aprovado: 'Aprovado',
};

const statuses = Object.keys(statusLabels) as ContentStatus[];

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';
}

function localMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function dateLabel(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [view, setView] = useState<ViewMode>('cards');
  const [statusFilter, setStatusFilter] = useState<ContentStatus | ''>('');
  const [channelFilter, setChannelFilter] = useState('');
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Content | null>(null);

  useEffect(() => {
    let active = true;
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setAuthError('');
        setAuthLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setAuthError(sessionError.message);
      setSession(data.session);
      setAuthLoading(false);
    }).catch((reason: unknown) => {
      if (active) {
        setAuthError(getErrorMessage(reason));
        setAuthLoading(false);
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setContents([]);
      setLoading(false);
      return;
    }

    let active = true;
    let unsubscribe: (() => void) | undefined;
    setLoading(true);
    setError('');
    async function loadWorkspace() {
      try {
        const authorized = await verifyEditor(session.user.id);
        if (!active) return;
        if (!authorized) {
          setContents([]);
          setError('Esta conta ainda não foi autorizada pelo administrador do painel.');
          return;
        }
        setContents(await fetchContents());
        unsubscribe = subscribeToContents(
          setContents,
          (reason) => setError(`Problema na sincronização: ${getErrorMessage(reason)}`),
        );
      } catch (reason) {
        if (active) setError(`Não foi possível carregar os conteúdos: ${getErrorMessage(reason)}`);
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadWorkspace();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [session?.user.id]);

  const monthContents = useMemo(
    () => contents.filter((content) => content.date.startsWith(localMonthKey(month))),
    [contents, month],
  );
  const channels = useMemo(
    () => Array.from(new Set(contents.map((content) => content.channel).filter(Boolean))).sort(),
    [contents],
  );
  const visibleContents = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
    return monthContents.filter((content) => {
      if (statusFilter && content.status !== statusFilter) return false;
      if (channelFilter && content.channel !== channelFilter) return false;
      return !normalizedQuery || `${content.title} ${content.caption}`.toLocaleLowerCase('pt-BR').includes(normalizedQuery);
    }).sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'pt-BR'));
  }, [monthContents, statusFilter, channelFilter, query]);

  async function handleLogin(email: string, password: string) {
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) {
      setAuthError(`Não foi possível entrar: ${loginError.message}`);
      return;
    }
    setAuthError('');
  }

  async function handleLogout() {
    const { error: logoutError } = await supabase.auth.signOut();
    if (logoutError) setError(`Não foi possível sair: ${logoutError.message}`);
  }

  function openNewContent() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEditContent(content: Content) {
    setEditing(content);
    setFormOpen(true);
  }

  async function handleSave(data: ContentFormData) {
    const now = new Date().toISOString();
    const statusChanged = editing && editing.status !== data.status;
    const content: Content = editing
      ? {
          ...editing,
          ...data,
          updatedAt: now,
          history: statusChanged
            ? [...editing.history.slice(-19), { status: data.status, at: now }]
            : editing.history,
        }
      : {
          ...data,
          id: crypto.randomUUID(),
          updatedAt: now,
          history: [{ status: data.status, at: now }],
        };

    await saveContent(content);
    setContents((current) => {
      const index = current.findIndex((item) => item.id === content.id);
      if (index < 0) return [...current, content];
      return current.map((item) => item.id === content.id ? content : item);
    });
    const [year, selectedMonth] = data.date.split('-').map(Number);
    setMonth(new Date(year, selectedMonth - 1, 1));
    setFormOpen(false);
    setEditing(null);
    setError('');
  }

  async function handleDelete(content: Content) {
    await deleteContent(content.id);
    setContents((current) => current.filter((item) => item.id !== content.id));
    setFormOpen(false);
    setEditing(null);
  }

  async function handleApprove(content: Content) {
    const now = new Date().toISOString();
    const approved: Content = {
      ...content,
      status: 'aprovado',
      updatedAt: now,
      history: [...content.history.slice(-19), { status: 'aprovado', at: now }],
    };
    try {
      await saveContent(approved);
      setContents((current) => current.map((item) => item.id === approved.id ? approved : item));
      setError('');
    } catch (reason) {
      setError(`Não foi possível aprovar o conteúdo: ${getErrorMessage(reason)}`);
    }
  }

  function shiftMonth(amount: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  }

  if (authLoading) {
    return <main className="auth-page"><p className="muted">Verificando acesso…</p></main>;
  }
  if (!session) {
    return <LoginForm error={authError} onSubmit={handleLogin} />;
  }

  const monthName = month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const approvedCount = monthContents.filter((content) => content.status === 'aprovado').length;
  const completion = monthContents.length ? Math.round((approvedCount / monthContents.length) * 100) : 0;
  const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const numberOfDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const calendarLength = Math.ceil((firstWeekday + numberOfDays) / 7) * 7;

  return (
    <main className="page-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">A</div>
          <div>
            <p className="eyebrow">MARKETING · WORKSPACE</p>
            <h1>Aprovação de Conteúdo</h1>
          </div>
        </div>
        <div className="user-menu">
          <span title={session.user.email}>{session.user.email}</span>
          <button className="button" onClick={() => void handleLogout()} type="button">Sair</button>
        </div>
      </header>

      <section className="toolbar">
        <div>
          <p className="eyebrow">PLANEJAMENTO EDITORIAL</p>
          <h2>Calendário de conteúdo</h2>
        </div>
        <div className="toolbar-actions">
          <div className="month-nav" aria-label="Navegar entre meses">
            <button className="icon-button" onClick={() => shiftMonth(-1)} type="button" aria-label="Mês anterior">‹</button>
            <span>{monthName}</span>
            <button className="icon-button" onClick={() => shiftMonth(1)} type="button" aria-label="Próximo mês">›</button>
          </div>
          <div className="view-switch" aria-label="Visualização">
            <button aria-pressed={view === 'cards'} onClick={() => setView('cards')} type="button">Cards</button>
            <button aria-pressed={view === 'calendar'} onClick={() => setView('calendar')} type="button">Calendário</button>
            <button aria-pressed={view === 'table'} onClick={() => setView('table')} type="button">Tabela</button>
          </div>
          <button className="button button-primary" onClick={openNewContent} type="button">+ Novo conteúdo</button>
        </div>
      </section>

      <section className="summary-panel" aria-label="Resumo do mês">
        <div className="status-summary">
          {statuses.map((status) => {
            const count = monthContents.filter((content) => content.status === status).length;
            return (
              <button
                className={`summary-stat ${statusFilter === status ? 'selected' : ''}`}
                key={status}
                onClick={() => setStatusFilter((current) => current === status ? '' : status)}
                type="button"
                aria-pressed={statusFilter === status}
              >
                <strong>{count}</strong>
                <span><i className={`status-dot status-${status}`} />{statusLabels[status]}</span>
              </button>
            );
          })}
        </div>
        <div className="progress-line">
          <span>{approvedCount} de {monthContents.length} aprovados</span>
          <div className="progress-track"><span style={{ width: `${completion}%` }} /></div>
          <strong>{completion}%</strong>
        </div>
      </section>

      <section className="filters" aria-label="Filtros">
        <input
          aria-label="Buscar conteúdo"
          placeholder="Buscar por título ou legenda"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select aria-label="Filtrar por canal" value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)}>
          <option value="">Todos os canais</option>
          {channels.map((channel) => <option key={channel}>{channel}</option>)}
        </select>
      </section>

      {error && <div className="notice" role="alert">{error}<button className="icon-button" onClick={() => setError('')} type="button" aria-label="Fechar aviso">×</button></div>}

      {loading ? (
        <div className="empty-state"><p>Carregando conteúdos…</p></div>
      ) : monthContents.length === 0 ? (
        <div className="empty-state">
          <span className="empty-mark">✳</span>
          <h2>Nada agendado em {monthName}</h2>
          <p>Adicione conteúdos para organizar as publicações e acompanhar as aprovações.</p>
          <button className="button button-primary" onClick={openNewContent} type="button">+ Novo conteúdo</button>
        </div>
      ) : visibleContents.length === 0 ? (
        <div className="empty-state"><h2>Nenhum resultado</h2><p>Ajuste os filtros para ver os conteúdos deste mês.</p></div>
      ) : view === 'cards' ? (
        <section className="content-grid" aria-label="Conteúdos do mês">
          {visibleContents.map((content) => (
            <ContentCard content={content} key={content.id} onApprove={handleApprove} onEdit={openEditContent} />
          ))}
        </section>
      ) : view === 'table' ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Conteúdo</th><th>Canal</th><th>Formato</th><th>Status</th><th>Link</th></tr></thead>
            <tbody>
              {visibleContents.map((content) => (
                <tr key={content.id} onClick={() => openEditContent(content)}>
                  <td>{dateLabel(content.date)}</td>
                  <td className="table-title">{content.title}</td>
                  <td>{content.channel}</td>
                  <td>{content.format}</td>
                  <td><span className={`status-pill status-${content.status}`}>{statusLabels[content.status]}</span></td>
                  <td>{content.link ? <a href={content.link} onClick={(event) => event.stopPropagation()} target="_blank" rel="noopener noreferrer">Abrir ↗</a> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <section className="calendar-wrap" aria-label={`Calendário de ${monthName}`}>
          <div className="calendar-grid">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}
            {Array.from({ length: calendarLength }, (_, index) => {
              const day = index - firstWeekday + 1;
              if (day < 1 || day > numberOfDays) return <div className="calendar-day outside" key={`empty-${index}`} />;
              const date = `${localMonthKey(month)}-${String(day).padStart(2, '0')}`;
              const dayContents = visibleContents.filter((content) => content.date === date);
              return (
                <div className="calendar-day" key={date}>
                  <span className="day-number">{day}</span>
                  {dayContents.map((content) => (
                    <button className={`calendar-item status-${content.status}`} key={content.id} onClick={() => openEditContent(content)} type="button">
                      {content.title}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {formOpen && (
        <ContentForm
          key={editing?.id || 'new-content'}
          initial={editing}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onDelete={handleDelete}
          onSubmit={handleSave}
        />
      )}
    </main>
  );
}

export default App;
