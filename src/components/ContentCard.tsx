import type { Content, ContentStatus } from '../features/content-approval/types';

interface ContentCardProps {
  content: Content;
  onEdit: (content: Content) => void;
  onApprove: (content: Content) => void;
}

const statusLabels: Record<ContentStatus, string> = {
  rascunho: 'Rascunho',
  revisao: 'Em revisão',
  ajustes: 'Ajustes',
  aprovado: 'Aprovado',
};

export default function ContentCard({ content, onEdit, onApprove }: ContentCardProps) {
  return (
    <article className="content-card" onClick={() => onEdit(content)}>
      <div className="cover">
        {content.coverData ? (
          <img src={content.coverData} alt={`Capa de ${content.title}`} loading="lazy" />
        ) : (
          <div className="cover-placeholder">{content.channel || 'Sem capa'}</div>
        )}
        <time className="date-chip" dateTime={content.date}>
          {new Date(`${content.date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
        </time>
      </div>
      <div className="card-body">
        <div className="card-meta">
          <span>{content.channel}</span>
          <span>{content.format}</span>
        </div>
        <h2>{content.title}</h2>
        <p className="caption-preview">{content.caption || 'Sem legenda'}</p>
        <div className="card-footer">
          <span className={`status-pill status-${content.status}`}>{statusLabels[content.status]}</span>
          {content.link && (
            <a href={content.link} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>
              Abrir link ↗
            </a>
          )}
        </div>
        {content.status !== 'aprovado' && (
          <button
            className="button button-subtle"
            onClick={(event) => {
              event.stopPropagation();
              onApprove(content);
            }}
            type="button"
          >
            Aprovar
          </button>
        )}
      </div>
    </article>
  );
}
