import { useState, type FormEvent } from 'react';
import type { Content, ContentFormData, ContentStatus } from './types';

interface ContentFormProps {
  initial?: Content | null;
  onClose: () => void;
  onDelete?: (content: Content) => Promise<void>;
  onSubmit: (data: ContentFormData) => Promise<void>;
}

const channels = ['Instagram', 'TikTok', 'LinkedIn', 'YouTube', 'Facebook', 'Blog', 'E-mail', 'Outro'];
const formats = ['Feed', 'Carrossel', 'Reels', 'Stories', 'Vídeo', 'Artigo', 'Newsletter', 'Anúncio'];
const statuses: Array<{ value: ContentStatus; label: string }> = [
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'revisao', label: 'Em revisão' },
  { value: 'ajustes', label: 'Ajustes' },
  { value: 'aprovado', label: 'Aprovado' },
];

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
      context.fillStyle = '#fff';
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

export default function ContentForm({ initial, onClose, onDelete, onSubmit }: ContentFormProps) {
  const [form, setForm] = useState<ContentFormData>(() => ({
    title: initial?.title || '',
    date: initial?.date || new Date().toISOString().slice(0, 10),
    channel: initial?.channel || channels[0],
    format: initial?.format || formats[0],
    link: initial?.link || '',
    caption: initial?.caption || '',
    note: initial?.note || '',
    status: initial?.status || 'rascunho',
    coverData: initial?.coverData || '',
  }));
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
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar.');
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
              <label>
                Canal
                <select value={form.channel} onChange={(event) => update('channel', event.target.value)}>
                  {channels.map((channel) => <option key={channel}>{channel}</option>)}
                </select>
              </label>
              <label>
                Formato
                <select value={form.format} onChange={(event) => update('format', event.target.value)}>
                  {formats.map((format) => <option key={format}>{format}</option>)}
                </select>
              </label>
              <label>
                Status
                <select value={form.status} onChange={(event) => update('status', event.target.value as ContentStatus)}>
                  {statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
              </label>
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
              Comentário do revisor
              <textarea value={form.note} onChange={(event) => update('note', event.target.value)} maxLength={1000} rows={3} />
            </label>
            <label>
              Capa
              <input type="file" accept="image/*" onChange={(event) => void handleFile(event.target.files?.[0])} />
            </label>
            {form.coverData && (
              <div className="cover-preview">
                <img src={form.coverData} alt="Prévia da capa" />
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
