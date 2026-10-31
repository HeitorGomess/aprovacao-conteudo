interface DeleteArchivedWorkspaceDialogProps {
  workspaceName: string;
  pending: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteArchivedWorkspaceDialog({
  workspaceName,
  pending,
  error,
  onClose,
  onConfirm,
}: DeleteArchivedWorkspaceDialogProps) {
  return (
    <div
      className="modal-backdrop workspace-modal-backdrop workspace-delete-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <section
        className="workspace-modal workspace-delete-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="workspace-delete-title"
        aria-describedby="workspace-delete-description"
      >
        <header className="modal-header">
          <div>
            <p className="eyebrow">EXCLUSÃO PERMANENTE</p>
            <h2 id="workspace-delete-title">Excluir empresa?</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Fechar"
            disabled={pending}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="workspace-delete-content">
          <p id="workspace-delete-description">
            Tem certeza de que deseja excluir permanentemente <strong>{workspaceName}</strong>?
          </p>
          <p className="workspace-delete-warning">
            Esta ação apagará todos os conteúdos e membros desta empresa. Não será possível recuperar esses dados.
          </p>
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
        <footer className="modal-footer">
          <button className="button" disabled={pending} onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="button button-danger" disabled={pending} onClick={onConfirm} type="button">
            {pending ? 'Excluindo…' : 'Excluir permanentemente'}
          </button>
        </footer>
      </section>
    </div>
  );
}
