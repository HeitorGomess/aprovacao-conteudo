import type { Content, ContentStatus } from '../features/content-approval/types';
import { getChannelLabel, getContentTypeLabel } from '../features/content-approval/contentLabels';
import AttachmentImage from './AttachmentImage';

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
  const isInteractive = content.status === 'revisao' && Boolean(onReview);

  return (
    <article
      className={`review-card${isInteractive ? ' review-card-interactive' : ''}`}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={isInteractive ? `Abrir revisão de ${content.title}` : undefined}
      onClick={isInteractive ? () => onReview?.(content) : undefined}
      onKeyDown={isInteractive ? (event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onReview?.(content);
        }
      } : undefined}
    >
      <div className="review-cover">
        {content.coverData ? (
          <AttachmentImage
            src={content.coverData}
            alt={`Capa de ${content.title}`}
            triggerClassName="review-cover-image-trigger"
          />
        ) : (
          <div className="cover-placeholder">{getChannelLabel(content.channel) || 'Sem capa'}</div>
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
        <h2>{getContentTypeLabel(content.channel, content.format)}</h2>
        <p className="review-caption">{content.caption || 'Sem legenda'}</p>
        <div className="card-footer">
          <span className={`status-pill status-${content.status}`}>{statusLabels[content.status]}</span>
          {content.link && (
            <a href={content.link} onClick={(event) => event.stopPropagation()} target="_blank" rel="noopener noreferrer">
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
          <button className="button button-primary review-action" onClick={(event) => {
            event.stopPropagation();
            onReview(content);
          }} type="button">
            Aprovar
          </button>
        )}
      </div>
    </article>
  );
}
