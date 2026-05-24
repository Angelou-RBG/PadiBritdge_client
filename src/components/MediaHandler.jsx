import React, { useState, useEffect } from 'react';
import './MediaHandler.css';

export default function MediaHandler({ images = [], disableLightbox = false }) {
  const [selectedIndex, setSelectedIndex] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selectedIndex === null) return;
      if (e.key === 'Escape') setSelectedIndex(null);
      if (e.key === 'ArrowRight') setSelectedIndex((prev) => (prev + 1) % images.length);
      if (e.key === 'ArrowLeft') setSelectedIndex((prev) => (prev - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, images.length]);

  if (!images || images.length === 0) return null;

  const displayImages = images.slice(0, 5);

  const handleNext = (e) => {
    e.stopPropagation();
    setSelectedIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    setSelectedIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <>
      <div className={`media-collage media-collage--${displayImages.length}`}>
        {displayImages.map((img, idx) => {
          const isLast = idx === 4;
          const remainingCount = images.length - 5;
          return (
            <div key={img.id} className="media-item" onClick={(e) => {
              if (!disableLightbox) {
                e.preventDefault();
                e.stopPropagation();
                setSelectedIndex(idx);
              }
            }}>
              <img src={img.url} alt={img.alt || `Media ${idx + 1}`} loading="lazy" />
              {isLast && remainingCount > 0 && (
                <div className="media-overlay">
                  +{remainingCount}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedIndex !== null && (
        <div className="media-lightbox" onClick={() => setSelectedIndex(null)}>
          <div className="media-lightbox-content">
            <button className="media-lightbox-close" onClick={() => setSelectedIndex(null)} aria-label="Close">
              &times;
            </button>

            {images.length > 1 && (
              <button className="media-lightbox-prev" onClick={handlePrev} aria-label="Previous">
                &#10094;
              </button>
            )}

            <img
              src={images[selectedIndex].url}
              alt={images[selectedIndex].alt || 'Expanded media'}
              onClick={(e) => e.stopPropagation()}
            />

            {images.length > 1 && (
              <button className="media-lightbox-next" onClick={handleNext} aria-label="Next">
                &#10095;
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}