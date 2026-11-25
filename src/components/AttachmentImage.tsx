import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface AttachmentImageProps {
  src: string;
  images?: string[];
  alt: string;
  imageClassName?: string;
  triggerClassName?: string;
}

export default function AttachmentImage({
  src,
  images,
  alt,
  imageClassName,
  triggerClassName,
}: AttachmentImageProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sources = images?.length ? images : [src];
  const currentIndex = Math.min(activeIndex, sources.length - 1);
  const currentSource = sources[currentIndex] || src;

  useEffect(() => {
    setActiveIndex(0);
  }, [src]);

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
      if (event.key === 'ArrowLeft' && sources.length > 1) {
        setActiveIndex((index) => (index - 1 + sources.length) % sources.length);
      }
      if (event.key === 'ArrowRight' && sources.length > 1) {
        setActiveIndex((index) => (index + 1) % sources.length);
      }
    };

    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
      previousFocus?.focus();
    };
  }, [isOpen, sources.length]);

  return (
    <>
      <div className={`attachment-carousel${triggerClassName ? ` ${triggerClassName}` : ''}`}>
        <button
          className="attachment-image-trigger"
          type="button"
          aria-label={`Ampliar imagem ${currentIndex + 1} de ${sources.length}: ${alt}`}
          onClick={(event) => {
            event.stopPropagation();
            setIsOpen(true);
          }}
        >
          <img className={imageClassName} src={currentSource} alt={alt} loading="lazy" decoding="async" />
        </button>
        {sources.length > 1 && (
          <>
            <button
              className="attachment-carousel-arrow attachment-carousel-previous"
              type="button"
              aria-label="Imagem anterior"
              onClick={(event) => {
                event.stopPropagation();
                setActiveIndex((index) => (index - 1 + sources.length) % sources.length);
              }}
            >
              ‹
            </button>
            <span className="attachment-carousel-count" aria-live="polite">{currentIndex + 1}/{sources.length}</span>
            <button
              className="attachment-carousel-arrow attachment-carousel-next"
              type="button"
              aria-label="Próxima imagem"
              onClick={(event) => {
                event.stopPropagation();
                setActiveIndex((index) => (index + 1) % sources.length);
              }}
            >
              ›
            </button>
          </>
        )}
      </div>
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
            {sources.length > 1 && (
              <button
                className="attachment-carousel-arrow attachment-popup-previous"
                type="button"
                aria-label="Imagem anterior"
                onClick={() => setActiveIndex((index) => (index - 1 + sources.length) % sources.length)}
              >
                ‹
              </button>
            )}
            <img className="attachment-image-popup-content" src={currentSource} alt={`${alt} (${currentIndex + 1} de ${sources.length})`} />
            {sources.length > 1 && (
              <>
                <span className="attachment-popup-count" aria-live="polite">{currentIndex + 1}/{sources.length}</span>
                <button
                  className="attachment-carousel-arrow attachment-popup-next"
                  type="button"
                  aria-label="Próxima imagem"
                  onClick={() => setActiveIndex((index) => (index + 1) % sources.length)}
                >
                  ›
                </button>
              </>
            )}
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
