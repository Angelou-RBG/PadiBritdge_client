import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StockListing from '../components/StockListing';
import FloatingDropdown from '../components/FloatingDropdown';
import FloatingCard from '../components/FloatingCard';
import { getAddresses, createAddress, deleteAddress, setDefaultAddress } from '../services/api';

export default function Profile() {
  const { userId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [addressToRemove, setAddressToRemove] = useState(null);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);

  const isCurrentUser = String(user?.id || user?._id || '') === String(userId || '');
  const userName = user?.fullName || user?.name || 'Unknown user';

  useEffect(() => {
    const profileUserId = userId || user?.id || user?._id;
    if (profileUserId) {
      getAddresses(profileUserId)
        .then(data => setAddresses(data || []))
        .catch(console.error);
    }
  }, [userId, user]);

  const dropdownItems = [
    {
      id: 'edit-profile',
      label: 'Edit Profile',
      onClick: () => {
        navigate('/edit-profile');
      },
    },
    {
      id: 'address-book',
      label: 'Address Book',
      onClick: () => {
        setIsAddressModalOpen(true);
      },
    },
  ];

  const handleAddAddress = async (e) => {
    e.preventDefault();
    try {
      await createAddress({
        userId: user?.id || user?._id,
        street,
        city,
        province,
        zipCode,
        isDefault: isDefault || addresses.length === 0,
      });
      
      const updatedAddresses = await getAddresses(user?.id || user?._id);
      setAddresses(updatedAddresses || []);
      
      setStreet('');
      setCity('');
      setProvince('');
      setZipCode('');
      setIsDefault(false);
    } catch (err) {
      console.error('Failed to create address:', err);
    }
  };

  const handleToggleDefault = async (id) => {
    try {
      await setDefaultAddress(id, user?.id || user?._id);
      const updatedAddresses = await getAddresses(user?.id || user?._id);
      setAddresses(updatedAddresses || []);
    } catch (err) {
      console.error('Failed to set default address:', err);
    }
  };

  const handleRemoveAddressClick = (id) => {
    setAddressToRemove(id);
    setIsRemoveConfirmOpen(true);
  };

  const handleConfirmRemoveAddress = async () => {
    try {
      await deleteAddress(addressToRemove);
      setAddresses(addresses.filter(a => a.id !== addressToRemove));
      setIsRemoveConfirmOpen(false);
      setAddressToRemove(null);
    } catch (err) {
      console.error('Failed to delete address:', err);
    }
  };

  const handleCancelRemoveAddress = () => {
    setIsRemoveConfirmOpen(false);
    setAddressToRemove(null);
  };

  const defaultAddress = addresses.find(a => a.isDefault);

  return (
    <section className="page-shell card-shell">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {user?.profilePicture ? (
            <img src={`/uploads/${user.profilePicture}`} alt="Profile" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0' }} />
          ) : (
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
              👤
            </div>
          )}
          <h2 style={{ marginTop: 0, marginBottom: 0 }}>
            {user?.userType === 'miller' ? `Miller Profile : ${userName}` : `Welcome Back, ${userName}`}
          </h2>
        </div>
        {isCurrentUser && (
          <FloatingDropdown
            trigger={<span aria-hidden="true" style={{ fontSize: '1.5rem', lineHeight: 1, padding: '0 0.5rem', cursor: 'pointer' }}>⋯</span>}
            triggerAriaLabel="Profile actions"
            items={dropdownItems}
          />
        )}
      </div>

      <FloatingCard
        open={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        title="Address Book"
      >
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ marginTop: 0, marginBottom: '0.75rem' }}>Saved Addresses</h4>
          {addresses.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {addresses.map((addr) => (
                <li key={addr.id} style={{ padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: '0 0 0.25rem 0', fontWeight: '500' }}>
                      {addr.street}, {addr.city}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                      {addr.province}, {addr.zipCode}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', margin: 0 }}>
                      <input type="checkbox" checked={addr.isDefault} onChange={() => handleToggleDefault(addr.id)} style={{ margin: 0 }} />
                      Default
                    </label>
                    <button type="button" className="ghost-btn" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', color: '#ef4444' }} onClick={() => handleRemoveAddressClick(addr.id)}>Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No addresses saved yet.</p>
          )}
        </div>

        <form className="form-shell" onSubmit={handleAddAddress}>
          <h4 style={{ margin: '0 0 0.75rem 0' }}>Add New Address</h4>
          
          <label>Street</label>
          <input type="text" value={street} onChange={e => setStreet(e.target.value)} required />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label>City</label>
              <input type="text" value={city} onChange={e => setCity(e.target.value)} required />
            </div>
            <div>
              <label>Province</label>
              <input type="text" value={province} onChange={e => setProvince(e.target.value)} required />
            </div>
          </div>

          <label>Zip Code</label>
          <input type="text" value={zipCode} onChange={e => setZipCode(e.target.value)} required />

          <label className="checkbox-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} />
            Set as default address
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="submit" className="primary-btn">Save Address</button>
          </div>
        </form>
      </FloatingCard>

      <FloatingCard
        open={isRemoveConfirmOpen}
        onClose={handleCancelRemoveAddress}
        title="Remove Address?"
      >
        <div className="form-shell">
          <p style={{ marginTop: 0, color: '#475569', lineHeight: '1.6' }}>
            Are you sure you want to remove this address? This action cannot be undone.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" className="ghost-btn" onClick={handleCancelRemoveAddress}>
              Cancel
            </button>
            <button type="button" className="primary-btn" onClick={handleConfirmRemoveAddress} style={{ backgroundColor: '#ef4444' }}>
              Yes, Remove
            </button>
          </div>
        </div>
      </FloatingCard>
    

    {/* Visible Page */}
    <p style={{ marginTop: 20, fontWeight: '500', color: '#475569' }}>
            📍 {defaultAddress ? `${defaultAddress.street}, ${defaultAddress.city}, ${defaultAddress.province}` : 'No default location set'}
    </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginTop: '2rem' }}>
        <div className="card-shell" style={{ flex: 1, minWidth: '300px' }}>
          <p>Viewing user id: {userId}</p>
          <p>Name: {userName}</p>
          <p>Email: {user?.email || 'Not available'}</p>
          {isCurrentUser && <p className="helper-text">This is your profile.</p>}
        </div>

        <div className="card-shell" style={{ flex: 1, minWidth: '300px' }}>
          <h3 style={{ margin: '0 0 1rem 0' }}>Statistics</h3>
        </div>
      </div>

      {user?.userType === 'miller' && (
        <div style={{ marginTop: '2rem' }}>
          <StockListing isProfileView userId={userId} />
        </div>
      )}
    </section>
  );
}
