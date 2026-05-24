import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StockListing from '../components/StockListing';
import FloatingDropdown from '../components/FloatingDropdown';

export default function Profile() {
  const { userId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const isCurrentUser = String(user?.id || user?._id || '') === String(userId || '');
  const userName = user?.fullName || user?.name || 'Unknown user';

  const dropdownItems = [
    {
      id: 'edit-profile',
      label: 'Edit Profile',
      onClick: () => {
        navigate('/edit-profile');
      },
    },
  ];

  return (
    <section className="page-shell card-shell">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h2 style={{ marginTop: 0 }}>
          {user?.userType === 'miller'
            ? `Miller Profile : ${userName}`
            : `Welcome Back, ${userName}`}
        </h2>
        {isCurrentUser && (
          <FloatingDropdown
            trigger={<span aria-hidden="true" style={{ fontSize: '1.5rem', lineHeight: 1, padding: '0 0.5rem', cursor: 'pointer' }}>⋯</span>}
            triggerAriaLabel="Profile actions"
            items={dropdownItems}
          />
        )}
      </div>
      <p>Viewing user id: {userId}</p>
      <p>Name: {userName}</p>
      <p>Email: {user?.email || 'Not available'}</p>
      {isCurrentUser && <p className="helper-text">This is your profile.</p>}

      {user?.userType === 'miller' && (
        <div style={{ marginTop: '2rem' }}>
          <StockListing isProfileView userId={userId} />
        </div>
      )}
    </section>
  );
}
