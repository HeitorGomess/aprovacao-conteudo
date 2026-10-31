import { useState } from 'react';
import type { Content, ContentStatus } from '../features/content-approval/types';

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
    if (!comment.trim()) {
      setError(status === 'ajustes'
        ? 'Descreva o que precisa ser alterado antes de devolver a publicação.'
        : 'Escreva um comentário para registrar seu parecer.');
      return;
    }

    setPending(true);
    setError('');
    try {
      await onSubmit(status, comment.trim());
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
            <p className="muted">Deixe seu comentário. Para solicitar alterações, explique o que precisa ser ajustado.</p>
            <label>
              Comentário
              <textarea
                autoFocus
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                maxLength={2000}
                rows={6}
                placeholder="Escreva seu parecer sobre a publicação…"
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
