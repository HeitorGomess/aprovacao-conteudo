import { useState, type FormEvent } from 'react';
import type { Content, ContentFormData, ContentStatus, ReviewComment } from '../features/content-approval/types';
import AttachmentImage from './AttachmentImage';
import DropdownSelect from './DropdownSelect';

interface ContentFormProps {
  initial?: Content | null;
  initialDate?: string;
  isAdmin: boolean;
  onClose: () => void;
  onDelete?: (content: Content) => Promise<void>;
  onResetReviewComments?: (content: Content) => Promise<void>;
  onSubmit: (data: ContentFormData) => Promise<void>;
}

const channels = [
  { value: 'Instagram', label: 'Instagram' },
  { value: 'TikTok', label: 'TikTok' },
  { value: 'LinkedIn', label: 'LinkedIn' },
  { value: 'YouTube', label: 'YouTube' },
  { value: 'Facebook', label: 'Facebook' },
  { value: 'Blog', label: 'Blog' },
  { value: 'E-mail', label: 'E-mail' },
  { value: 'Multicanal', label: 'Redes sociais' },
  { value: 'Outro', label: 'Outro' },
];
const formats = ['Feed', 'Carrossel', 'Reels', 'Stories', 'Vídeo', 'Artigo', 'Newsletter', 'Anúncio'];
const statuses: Array<{ value: ContentStatus; label: string }> = [
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'revisao', label: 'Em revisão' },
  { value: 'ajustes', label: 'Ajustes' },
  { value: 'aprovado', label: 'Aprovado' },
];

function getErrorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'object' && reason !== null && 'message' in reason && typeof reason.message === 'string') {
    const details = 'details' in reason && typeof reason.details === 'string' ? reason.details : '';
    const hint = 'hint' in reason && typeof reason.hint === 'string' ? reason.hint : '';
    return [reason.message, details, hint].filter(Boolean).join(' ');
  }
  return 'Não foi possível salvar. Tente novamente.';
}

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Escolha um arquivo de imagem.'));
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error('Não foi possível processar a imagem.'));
        return;
      }
      const canvasFill = getComputedStyle(document.documentElement).getPropertyValue('--image-canvas-fill').trim();
      if (!canvasFill) {
        URL.revokeObjectURL(url);
        reject(new Error('A cor de fundo para processar a imagem não está configurada.'));
        return;
      }
      context.fillStyle = canvasFill;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Não foi possível converter a imagem.'));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.82);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível abrir a imagem.'));
    };
    image.src = url;
  });
}

export default function ContentForm({
  initial,
  initialDate,
  isAdmin,
  onClose,
  onDelete,
  onResetReviewComments,
  onSubmit,
}: ContentFormProps) {
  const [form, setForm] = useState<ContentFormData>(() => ({
    title: initial?.title || '',
    date: initial?.date || initialDate || new Date().toISOString().slice(0, 10),
    channel: initial?.channel || channels[0].value,
    format: initial?.format || formats[0],
    link: initial?.link || '',
    caption: initial?.caption || '',
    note: initial?.note || '',
    status: initial?.status || 'rascunho',
    coverData: initial?.coverData || '',
  }));
  const [reviewComments, setReviewComments] = useState<ReviewComment[]>(initial?.reviewComments || []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  function update<K extends keyof ContentFormData>(key: K, value: ContentFormData[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      await onSubmit(form);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  async function handleFile(file?: File) {
    if (!file) return;
    setError('');
    try {
      update('coverData', await resizeImage(file));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a imagem.');
    }
  }

  async function handleDelete() {
    if (!initial || !onDelete || !window.confirm('Excluir este conteúdo?')) return;
    setPending(true);
    setError('');
    try {
      await onDelete(initial);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível excluir.');
      setPending(false);
    }
  }

  async function handleResetReviewComments() {
    if (!initial || !onResetReviewComments || !window.confirm(
      'Resetar todas as observações dos revisores desta publicação? O status, o histórico e as observações de produção serão mantidos.',
    )) return;

    setPending(true);
    setError('');
    try {
      await onResetReviewComments(initial);
      setReviewComments([]);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="content-modal" role="dialog" aria-modal="true" aria-labelledby="form-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">PLANEJAMENTO EDITORIAL</p>
            <h2 id="form-title">{initial ? 'Revisar conteúdo' : 'Novo conteúdo'}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Fechar" onClick={onClose}>×</button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <label>
              Título
              <input value={form.title} onChange={(event) => update('title', event.target.value)} maxLength={140} required />
            </label>
            <div className="form-grid">
              <label>
                Data de publicação
                <input type="date" value={form.date} onChange={(event) => update('date', event.target.value)} required />
              </label>
              <div className="content-form-field">
                <span>Canal</span>
                <DropdownSelect
                  ariaLabel="Canal"
                  className="content-form-dropdown"
                  variant="field"
                  value={form.channel}
                  onChange={(value) => update('channel', value)}
                  options={channels}
                />
              </div>
              <div className="content-form-field">
                <span>Formato</span>
                <DropdownSelect
                  ariaLabel="Formato"
                  className="content-form-dropdown"
                  variant="field"
                  value={form.format}
                  onChange={(value) => update('format', value)}
                  options={formats.map((format) => ({ value: format, label: format }))}
                />
              </div>
              <div className="content-form-field">
                <span>Status</span>
                <DropdownSelect
                  ariaLabel="Status"
                  className="content-form-dropdown"
                  variant="field"
                  value={form.status}
                  onChange={(value) => update('status', value as ContentStatus)}
                  options={statuses}
                />
              </div>
            </div>
            <label>
              Link
              <input
                type="url"
                placeholder="https://"
                value={form.link}
                onChange={(event) => update('link', event.target.value)}
              />
            </label>
            <label>
              Legenda / texto
              <textarea value={form.caption} onChange={(event) => update('caption', event.target.value)} maxLength={2000} rows={4} />
            </label>
            <label>
              Observações de produção
              <textarea value={form.note} onChange={(event) => update('note', event.target.value)} maxLength={1000} rows={3} />
            </label>
            {isAdmin && reviewComments.length > 0 && (
              <section className="review-comments-admin" aria-label="Observações dos revisores">
                <div className="review-comments-admin-heading">
                  <div>
                    <strong>Observações dos revisores ({reviewComments.length})</strong>
                    <p>Resetar remove os pareceres, sem alterar o status nem o histórico.</p>
                  </div>
                  <button
                    className="button button-danger"
                    disabled={pending}
                    onClick={() => void handleResetReviewComments()}
                    type="button"
                  >
                    Resetar observações
                  </button>
                </div>
                <ul>
                  {reviewComments.map((review, index) => (
                    <li key={`${review.at}-${index}`}>
                      <strong>{review.author}</strong>
                      <span>{review.comment}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <label>
              Capa
              <input type="file" accept="image/*" onChange={(event) => void handleFile(event.target.files?.[0])} />
            </label>
            {form.coverData && (
              <div className="cover-preview">
                <AttachmentImage
                  src={form.coverData}
                  alt="Prévia da capa"
                  triggerClassName="cover-preview-image-trigger"
                />
                <button className="button button-subtle" type="button" onClick={() => update('coverData', '')}>Remover capa</button>
              </div>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}
          </div>
          <footer className="modal-footer">
            {initial && onDelete && (
              <button className="button button-danger" disabled={pending} onClick={() => void handleDelete()} type="button">Excluir</button>
            )}
            <div className="footer-actions">
              <button className="button" disabled={pending} onClick={onClose} type="button">Cancelar</button>
              <button className="button button-primary" disabled={pending} type="submit">
                {pending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
