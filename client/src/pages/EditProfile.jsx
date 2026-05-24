import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBean from '../components/NotificationBean';
import { updateProfile } from '../services/api';

export default function EditProfile() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  async function handleSubmit(event) {
    event.preventDefault();
    setNotification(null);

    if (!fullName.trim() || !email.trim()) {
      setNotification({ type: 'error', message: 'Full name and email are required.' });
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await updateProfile(user?.id || user?._id, {
        fullName: fullName.trim(),
        email: email.trim(),
      });

      // Update auth context so profile reflects changes immediately
      if (res?.user) {
        updateUser(res.user);
      }

      setNotification({ type: 'success', message: 'Profile updated successfully.' });
    } catch (error) {
      setNotification({ type: 'error', message: error.response?.data?.message || 'Failed to update profile.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="page-shell card-shell">
      <button
        type="button"
        style={{
          alignSelf: 'flex-start',
          marginBottom: '1.5rem',
          padding: '0.4rem 1rem',
          backgroundColor: '#000',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: '500',
        }}
        onClick={() => navigate(-1)}
      >
        Back
      </button>

      <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Edit Profile</h2>

      <NotificationBean type={notification?.type} message={notification?.message} />

      <form className="form-shell" onSubmit={handleSubmit}>
        <label htmlFor="edit-fullname">Full Name</label>
        <input
          id="edit-fullname"
          type="text"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Enter your full name"
          disabled={isSubmitting}
        />

        <label htmlFor="edit-email">Email</label>
        <input
          id="edit-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Enter your email"
          disabled={isSubmitting}
        />

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="primary-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Updating...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </section>
  );
}