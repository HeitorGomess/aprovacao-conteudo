import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import ContentCard from './components/ContentCard';
import ContentForm from './components/ContentForm';
import LoginForm from './components/LoginForm';
import ReviewCard from './components/ReviewCard';
import ReviewDecisionModal from './components/ReviewDecisionModal';
import {
  deleteContent,
  fetchContents,
  saveContent,
  saveContents,
  submitReviewDecision,
  subscribeToContents,
  supabase,
  verifyEditor,
  type EditorRole,
} from './features/content-approval/contentService';
import { createMockContents } from './features/content-approval/mockData';
import { importContentCsv } from './features/content-approval/csvImport';
import type { Content, ContentFormData, ContentStatus, ReviewComment } from './features/content-approval/types';

type ViewMode = 'cards' | 'calendar' | 'table';

const statusLabels: Record<ContentStatus, string> = {
  rascunho: 'Rascunho',
  revisao: 'Em revisão',
  ajustes: 'Ajustes',
  aprovado: 'Aprovado',
};

const statuses = Object.keys(statusLabels) as ContentStatus[];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    const details = 'details' in error && typeof error.details === 'string' ? error.details : '';
    const hint = 'hint' in error && typeof error.hint === 'string' ? error.hint : '';
    return [error.message, details, hint].filter(Boolean).join(' ');
  }
  return 'Ocorreu um erro inesperado.';
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
  const demoMode = new URLSearchParams(window.location.search).get('demo') === '1';
  const demoRole: EditorRole = new URLSearchParams(window.location.search).get('role') === 'revisor'
    ? 'revisor'
    : 'programador';
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<EditorRole | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [contents, setContents] = useState<Content[]>(() => demoMode ? createMockContents() : []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [view, setView] = useState<ViewMode>('cards');
  const [statusFilter, setStatusFilter] = useState<ContentStatus | ''>('');
  const [channelFilter, setChannelFilter] = useState('');
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Content | null>(null);
  const [importing, setImporting] = useState(false);
  const [reviewing, setReviewing] = useState<Content | null>(null);

  useEffect(() => {
    if (demoMode) {
      setAuthLoading(false);
      return;
    }

    let active = true;
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setRole(null);
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
  }, [demoMode]);

  useEffect(() => {
    if (demoMode) {
      setLoading(false);
      return;
    }

    if (!session) {
      setContents([]);
      setLoading(false);
      return;
    }
    const userId = session.user.id;

    let active = true;
    let unsubscribe: (() => void) | undefined;
    setLoading(true);
    setError('');
    async function loadWorkspace() {
      try {
        const editorRole = await verifyEditor(userId);
        if (!active) return;
        setRole(editorRole);
        if (!editorRole) {
          setContents([]);
          setError('Esta conta ainda não recebeu um perfil no painel. Peça ao administrador para autorizar seu acesso.');
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
  }, [demoMode, session?.user.id]);

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

    if (!demoMode) await saveContent(content);
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
    if (!demoMode) await deleteContent(content.id);
    setContents((current) => current.filter((item) => item.id !== content.id));
    setFormOpen(false);
    setEditing(null);
  }

  async function handleReviewDecision(
    content: Content,
    status: Extract<ContentStatus, 'aprovado' | 'ajustes'>,
    comment: string,
  ) {
    const now = new Date().toISOString();
    const reviewComment: ReviewComment = {
      at: now,
      author: demoMode ? 'Revisor de demonstração' : session?.user.email || 'Revisor',
      comment,
      decision: status,
    };
    const updated: Content = {
      ...content,
      status,
      updatedAt: now,
      history: [...content.history.slice(-19), { status, at: now }],
      reviewComments: [...(content.reviewComments || []), reviewComment],
    };
    try {
      if (!demoMode) await submitReviewDecision(content.id, status, comment);
      setContents((current) => current.map((item) => item.id === updated.id ? updated : item));
      setReviewing(null);
      setError('');
    } catch (reason) {
      throw new Error(`Não foi possível registrar o parecer: ${getErrorMessage(reason)}`);
    }
  }

  async function handleImportCsv(file?: File) {
    if (!file) return;
    setImporting(true);
    setError('');
    try {
      const imported = importContentCsv(await file.text());
      if (!demoMode) {
        await saveContents(imported);
      }
      setContents((current) => [...current, ...imported]);
      const earliestDate = imported.map((content) => content.date).sort()[0];
      const [year, selectedMonth] = earliestDate.split('-').map(Number);
      setMonth(new Date(year, selectedMonth - 1, 1));
      setError('');
    } catch (reason) {
      setError(`Não foi possível importar a planilha: ${getErrorMessage(reason)}`);
    } finally {
      setImporting(false);
    }
  }

  function shiftMonth(amount: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  }

  function exitDemoMode() {
    const url = new URL(window.location.href);
    url.searchParams.delete('demo');
    window.location.assign(url);
  }

  if (authLoading) {
    return <main className="auth-page"><p className="muted">Verificando acesso…</p></main>;
  }
  if (!session && !demoMode) {
    return <LoginForm error={authError} onSubmit={handleLogin} />;
  }
  const activeRole = demoMode ? demoRole : role;
  if (!activeRole && loading) {
    return <main className="auth-page"><p className="muted">Verificando perfil de acesso…</p></main>;
  }
  if (!activeRole) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand-mark" aria-hidden="true">A</div>
          <p className="eyebrow">ACESSO AO WORKSPACE</p>
          <h1>Perfil não configurado</h1>
          <p className="muted">{error || 'Peça ao administrador para atribuir o perfil de programador ou revisor.'}</p>
          <button className="button" onClick={() => void handleLogout()} type="button">Sair</button>
        </section>
      </main>
    );
  }
  const isReviewer = activeRole === 'revisor';

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
          <span title={demoMode ? 'Dados fictícios desta demonstração' : session?.user.email}>
            {demoMode ? 'Modo demonstração' : session?.user.email}
          </span>
          <button className="button" onClick={() => demoMode ? exitDemoMode() : void handleLogout()} type="button">
            {demoMode ? 'Sair do demo' : 'Sair'}
          </button>
        </div>
      </header>

      {demoMode && (
        <div className="notice demo-banner" role="status">
          Dados fictícios para demonstração. Alterações ficam apenas nesta sessão e não são salvas no Supabase.
        </div>
      )}

      <section className="toolbar">
        <div>
          <p className="eyebrow">PLANEJAMENTO EDITORIAL</p>
          <h2>{isReviewer ? 'Revisão de conteúdo' : 'Calendário de conteúdo'}</h2>
        </div>
        <div className="toolbar-actions">
          <div className="month-nav" aria-label="Navegar entre meses">
            <button className="icon-button" onClick={() => shiftMonth(-1)} type="button" aria-label="Mês anterior">‹</button>
            <span>{monthName}</span>
            <button className="icon-button" onClick={() => shiftMonth(1)} type="button" aria-label="Próximo mês">›</button>
          </div>
          {!isReviewer && (
            <>
              <div className="view-switch" aria-label="Visualização">
                <button aria-pressed={view === 'cards'} onClick={() => setView('cards')} type="button">Cards</button>
                <button aria-pressed={view === 'calendar'} onClick={() => setView('calendar')} type="button">Calendário</button>
                <button aria-pressed={view === 'table'} onClick={() => setView('table')} type="button">Tabela</button>
              </div>
              <div className="toolbar-actions">
                <label className="button import-button">
                  {importing ? 'Importando…' : 'Importar CSV'}
                  <input
                    accept=".csv,text/csv"
                    aria-label="Importar arquivo CSV"
                    disabled={importing}
                    onChange={(event) => {
                      void handleImportCsv(event.target.files?.[0]);
                      event.target.value = '';
                    }}
                    type="file"
                  />
                </label>
                <button className="button button-primary" onClick={openNewContent} type="button">+ Novo conteúdo</button>
              </div>
            </>
          )}
        </div>
      </section>

      {!isReviewer ? (
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
      ) : (
        <section className="review-queue-banner" aria-label="Fila de revisão">
          <strong>{monthContents.filter((content) => content.status === 'revisao').length}</strong>
          <span>publicações aguardando seu parecer em {monthName}</span>
        </section>
      )}

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
      ) : isReviewer && visibleContents.filter((content) => content.status === 'revisao').length === 0 ? (
        <div className="empty-state">
          <span className="empty-mark">✓</span>
          <h2>Nenhuma publicação aguardando revisão</h2>
          <p>Quando o programador enviar conteúdos para revisão, eles aparecerão aqui.</p>
        </div>
      ) : !isReviewer && monthContents.length === 0 ? (
        <div className="empty-state">
          <span className="empty-mark">✳</span>
          <h2>Nada agendado em {monthName}</h2>
          <p>Adicione conteúdos para organizar as publicações e acompanhar as aprovações.</p>
          <button className="button button-primary" onClick={openNewContent} type="button">+ Novo conteúdo</button>
        </div>
      ) : visibleContents.length === 0 ? (
        <div className="empty-state"><h2>Nenhum resultado</h2><p>Ajuste os filtros para ver os conteúdos deste mês.</p></div>
      ) : isReviewer ? (
        <section className="content-grid review-grid" aria-label="Publicações aguardando revisão">
          {visibleContents.filter((content) => content.status === 'revisao').map((content) => (
            <ReviewCard content={content} key={content.id} onReview={setReviewing} />
          ))}
        </section>
      ) : view === 'cards' ? (
        <section className="content-grid" aria-label="Conteúdos do mês">
          {visibleContents.map((content) => (
            <ContentCard content={content} key={content.id} onEdit={openEditContent} />
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
      {reviewing && (
        <ReviewDecisionModal
          content={reviewing}
          onClose={() => setReviewing(null)}
          onSubmit={(status, comment) => handleReviewDecision(reviewing, status, comment)}
        />
      )}
    </main>
  );
}

export default App;
