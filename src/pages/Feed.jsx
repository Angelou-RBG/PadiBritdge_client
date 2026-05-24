import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import FeedGet from '../components/FeedGet';
import NotificationBean from '../components/NotificationBean';
import { useFilters } from '../context/FilterContext';

const FILTER_LABELS = {
  title: 'Search',
  postType: 'Type',
  tags: 'Tag',
  startDate: 'From',
  endDate: 'To'
};

export default function Feed() {
  const location = useLocation();
  const flash = location.state?.flash;
  const { filters, setFilters, globalTags } = useFilters();

  const hasActiveFilters = Object.values(filters || {}).some(Boolean);

  const clearFilter = (key) => {
    setFilters(prev => ({ ...prev, [key]: '' }));
  };

  return (
    <div>
      <h1 className="feed-title">{hasActiveFilters ? 'Filtering' : 'Your Feed'}</h1>

      {hasActiveFilters && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          {Object.entries(filters || {}).map(([key, value]) => {
            if (!value) return null;
            return (
              <span key={key} style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: '#e2e8f0',
                color: '#334155',
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.85rem',
                fontWeight: '500'
              }}>
                {FILTER_LABELS[key] || key}: {key === 'tags' && globalTags?.length ? (globalTags.find(t => String(t.id) === String(value))?.name || value) : value}
                <button
                  type="button"
                  onClick={() => clearFilter(key)}
                  style={{ background: 'transparent', border: 'none', color: '#64748b', marginLeft: '0.5rem', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: 0 }}
                  aria-label={`Clear ${key} filter`}
                >
                  &times;
                </button>
              </span>
            );
          })}
        </div>
      )}

      <NotificationBean type={flash?.type} message={flash?.message} />

      {!hasActiveFilters && (
        <div className="create-post-container">
          <div className="avatar-circle">🌾</div>
          <Link to="/create" className="btn-create-post">Create Post</Link>
          <div className="text-card-input">Text Card</div>
        </div>
      )}

      <FeedGet filters={filters} />
    </div>
  );
}
