import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import FeedGet from '../components/FeedGet';
import NotificationBean from '../components/NotificationBean';
import { useFilters } from '../context/FilterContext';

export default function Feed() {
  const location = useLocation();
  const flash = location.state?.flash;
  const { filters } = useFilters();

  return (
    <div>
      <h1 className="feed-title">Your Feed</h1>

      <NotificationBean type={flash?.type} message={flash?.message} />

      <div className="create-post-container">
        <div className="avatar-circle">🌾</div>
        <Link to="/create" className="btn-create-post">Create Post</Link>
        <div className="text-card-input">Text Card</div>
      </div>

      <FeedGet filters={filters} />
    </div>
  );
}
