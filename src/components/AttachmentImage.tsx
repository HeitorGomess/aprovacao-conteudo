import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface AttachmentImageProps {
  src: string;
  alt: string;
  imageClassName?: string;
  triggerClassName?: string;
}

export default function AttachmentImage({
  src,
  alt,
  imageClassName,
  triggerClassName,
}: AttachmentImageProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
      previousFocus?.focus();
    };
  }, [isOpen]);

  return (
    <>
      <button
        className={`attachment-image-trigger${triggerClassName ? ` ${triggerClassName}` : ''}`}
        type="button"
        aria-label={`Ampliar imagem: ${alt}`}
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen(true);
        }}
      >
        <img className={imageClassName} src={src} alt={alt} loading="lazy" />
      </button>
      {isOpen && createPortal(
        <div
          className="attachment-image-backdrop"
          onClick={(event) => {
            event.stopPropagation();
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <section className="attachment-image-popup" role="dialog" aria-modal="true" aria-label={`Imagem ampliada: ${alt}`}>
            <button
              ref={closeButtonRef}
              className="attachment-image-close"
              type="button"
              aria-label="Fechar imagem ampliada"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
            <img className="attachment-image-popup-content" src={src} alt={alt} />
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
