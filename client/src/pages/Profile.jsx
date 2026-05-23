import React from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { userId } = useParams();
  const { user } = useAuth();

  const isCurrentUser = String(user?.id || user?._id || '') === String(userId || '');

  return (
    <section className="page-shell card-shell">
      <h2>Profile</h2>
      <p>Viewing user id: {userId}</p>
      <p>Name: {user?.fullName || user?.name || 'Unknown user'}</p>
      <p>Email: {user?.email || 'Not available'}</p>
      {isCurrentUser && <p className="helper-text">This is your profile.</p>}
    </section>
  );
}
