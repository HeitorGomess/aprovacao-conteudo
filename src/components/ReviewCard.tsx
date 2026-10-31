import type { Content, ContentStatus } from '../features/content-approval/types';

interface ReviewCardProps {
  content: Content;
  onReview?: (content: Content) => void;
}

const statusLabels: Record<ContentStatus, string> = {
  rascunho: 'Rascunho',
  revisao: 'Em revisão',
  ajustes: 'Ajustes',
  aprovado: 'Aprovado',
};

export default function ReviewCard({ content, onReview }: ReviewCardProps) {
  const recentComments = [...(content.reviewComments || [])].reverse().slice(0, 2);

  return (
    <article className="review-card">
      <div className="review-cover">
        {content.coverData ? (
          <img src={content.coverData} alt={`Capa de ${content.title}`} loading="lazy" />
        ) : (
          <div className="cover-placeholder">{content.channel || 'Sem capa'}</div>
        )}
        <time className="date-chip" dateTime={content.date}>
          {new Date(`${content.date}T12:00:00`).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </time>
      </div>
      <div className="review-card-body">
        <div className="card-meta">
          <span>{content.channel}</span>
          <span>{content.format}</span>
        </div>
        <h2>{content.title}</h2>
        <p className="review-caption">{content.caption || 'Sem legenda'}</p>
        <div className="card-footer">
          <span className={`status-pill status-${content.status}`}>{statusLabels[content.status]}</span>
          {content.link && (
            <a href={content.link} target="_blank" rel="noopener noreferrer">
              Abrir material ↗
            </a>
          )}
        </div>
        {recentComments.length > 0 && (
          <section className="review-feedback" aria-label="Comentários anteriores">
            <strong>Comentários anteriores</strong>
            {recentComments.map((item) => (
              <p key={`${item.at}-${item.author}`}>
                <span>{item.decision === 'aprovado' ? 'Aprovado' : 'Alterações solicitadas'} · {item.author}</span>
                {item.comment}
              </p>
            ))}
          </section>
        )}
        {content.status === 'revisao' && onReview && (
          <button className="button button-primary review-action" onClick={() => onReview(content)} type="button">
            Aprovar
          </button>
        )}
      </div>
    </article>
  );
}
