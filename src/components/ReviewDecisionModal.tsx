import { useState } from 'react';
import type { Content, ContentStatus } from '../features/content-approval/types';
import { getChannelLabel } from '../features/content-approval/contentLabels';

type ReviewDecision = Extract<ContentStatus, 'aprovado' | 'ajustes'>;

interface ReviewDecisionModalProps {
  content: Content;
  onClose: () => void;
  onSubmit: (status: ReviewDecision, comment: string) => Promise<void>;
}

function getErrorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'object' && reason !== null && 'message' in reason && typeof reason.message === 'string') {
    return reason.message;
  }
  return 'Não foi possível registrar a revisão. Tente novamente.';
}

export default function ReviewDecisionModal({ content, onClose, onSubmit }: ReviewDecisionModalProps) {
  const [comment, setComment] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(status: ReviewDecision) {
    const trimmedComment = comment.trim();
    if (status === 'ajustes' && !trimmedComment) {
      setError('Descreva o que precisa ser alterado antes de devolver a publicação.');
      return;
    }

    setPending(true);
    setError('');
    try {
      await onSubmit(status, trimmedComment);
    } catch (reason) {
      setError(getErrorMessage(reason));
      setPending(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !pending && onClose()}>
      <section className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">PARECER DA PUBLICAÇÃO</p>
            <h2 id="review-title">{content.title}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Fechar" disabled={pending} onClick={onClose}>×</button>
        </header>
        <form className="review-form" onSubmit={(event) => event.preventDefault()}>
          <div className="review-modal-body">
            <div className="review-detail">
              {content.coverData ? (
                <img className="review-detail-image" src={content.coverData} alt={`Imagem da publicação: ${content.title}`} />
              ) : (
                <div className="review-detail-placeholder">{getChannelLabel(content.channel) || 'Sem imagem'}</div>
              )}
              <div className="review-detail-meta">
                <span>{getChannelLabel(content.channel)}</span>
                <span>{content.format}</span>
                <span>{new Date(`${content.date}T12:00:00`).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}</span>
              </div>
              <h3>{content.title}</h3>
              <p className="review-detail-caption">{content.caption || 'Nenhum texto de publicação informado.'}</p>
              {content.note && (
                <div className="review-detail-note">
                  <strong>Observação</strong>
                  <p>{content.note}</p>
                </div>
              )}
              {content.link && (
                <a className="button review-detail-link" href={content.link} target="_blank" rel="noopener noreferrer">
                  Abrir link da publicação ↗
                </a>
              )}
            </div>
            <p className="muted">O comentário é opcional para aprovar e obrigatório para devolver para ajustes.</p>
            <label>
              Comentário
              <textarea
                autoFocus
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                maxLength={2000}
                rows={6}
                placeholder="Para ajustes, descreva o que precisa ser alterado…"
              />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
          </div>
          <footer className="review-modal-footer">
            <button
              className="button button-danger"
              disabled={pending}
              onClick={() => void submit('ajustes')}
              type="button"
            >
              {pending ? 'Enviando…' : 'Devolver para ajustes'}
            </button>
            <button
              className="button button-primary"
              disabled={pending}
              onClick={() => void submit('aprovado')}
              type="button"
            >
              {pending ? 'Enviando…' : 'Aprovar publicação'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
