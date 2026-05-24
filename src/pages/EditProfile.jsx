import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBean from '../components/NotificationBean';
import { updateProfile } from '../services/api';

export default function EditProfile() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [profilePicture, setProfilePicture] = useState(null);
  const [removeProfilePicture, setRemoveProfilePicture] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || user.name || '');
      setUsername(user.username || '');
      setEmail(user.email || '');
    }
  }, [user]);

  async function handleSubmit(event) {
    event.preventDefault();
    setNotification(null);

    if (!fullName.trim() || !username.trim() || !email.trim()) {
      setNotification({ type: 'error', message: 'Full name, username, and email are required.' });
      return;
    }

    try {
      setIsSubmitting(true);

      let payload;
      if (profilePicture || removeProfilePicture) {
        payload = new FormData();
        payload.append('fullName', fullName.trim());
        payload.append('username', username.trim());
        payload.append('email', email.trim());
        if (profilePicture) payload.append('profilePicture', profilePicture);
        if (removeProfilePicture) payload.append('removeProfilePicture', 'true');
      } else {
        payload = {
          fullName: fullName.trim(),
          username: username.trim(),
          email: email.trim(),
        };
      }

      const res = await updateProfile(user?.id || user?._id, payload);

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
        <label htmlFor="edit-profile-picture">Profile Picture</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          {(user?.profilePicture && !removeProfilePicture) || profilePicture ? (
            <img 
              src={profilePicture ? URL.createObjectURL(profilePicture) : `/uploads/${user.profilePicture}`} 
              alt="Profile Preview" 
              style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} 
            />
          ) : (
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              No Pic
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input
              id="edit-profile-picture"
              type="file"
              accept="image/*"
              onChange={(event) => {
                setProfilePicture(event.target.files[0] || null);
                setRemoveProfilePicture(false);
              }}
              disabled={isSubmitting}
            />
            {(user?.profilePicture && !removeProfilePicture) || profilePicture ? (
              <button 
                type="button" 
                className="ghost-btn" 
                style={{ alignSelf: 'flex-start', padding: '0.2rem 0.5rem', fontSize: '0.8rem', color: '#ef4444' }} 
                onClick={() => {
                  setProfilePicture(null);
                  setRemoveProfilePicture(true);
                  document.getElementById('edit-profile-picture').value = '';
                }}
              >
                Remove Picture
              </button>
            ) : null}
          </div>
        </div>

        <label htmlFor="edit-fullname">Full Name</label>
        <input
          id="edit-fullname"
          type="text"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Enter your full name"
          disabled={isSubmitting}
        />

        <label htmlFor="edit-username">Username</label>
        <input
          id="edit-username"
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
          placeholder="Enter your username"
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