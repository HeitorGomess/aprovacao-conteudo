import type { Content, ContentStatus } from '../features/content-approval/types';
import { getChannelLabel, getContentTypeLabel } from '../features/content-approval/contentLabels';

interface ContentCardProps {
  content: Content;
  onEdit: (content: Content) => void;
}

const statusLabels: Record<ContentStatus, string> = {
  rascunho: 'Rascunho',
  revisao: 'Em revisão',
  ajustes: 'Ajustes',
  aprovado: 'Aprovado',
};

export default function ContentCard({ content, onEdit }: ContentCardProps) {
  return (
    <article className="content-card" onClick={() => onEdit(content)}>
      <div className="cover">
        {content.coverData ? (
          <img src={content.coverData} alt={`Capa de ${content.title}`} loading="lazy" />
        ) : (
          <div className="cover-placeholder">{getChannelLabel(content.channel) || 'Sem capa'}</div>
        )}
        <time className="date-chip" dateTime={content.date}>
          {new Date(`${content.date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
        </time>
      </div>
      <div className="card-body">
        <h2>{getContentTypeLabel(content.channel, content.format)}</h2>
        <p className="caption-preview">{content.caption || 'Sem legenda'}</p>
        <div className="card-footer">
          <span className={`status-pill status-${content.status}`}>{statusLabels[content.status]}</span>
          {content.link && (
            <a href={content.link} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>
              Abrir link ↗
            </a>
          )}
        </div>
        {content.reviewComments && content.reviewComments.length > 0 && (
          <section className="programmer-feedback" aria-label="Pareceres da revisão">
            <strong>Último parecer · {content.reviewComments[content.reviewComments.length - 1].author}</strong>
            <p>{content.reviewComments[content.reviewComments.length - 1].comment}</p>
          </section>
        )}
      </div>
    </article>
  );
}
