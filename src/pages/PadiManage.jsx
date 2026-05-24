import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StockListing from '../components/StockListing';
import RFQSListing from '../components/RFQSListing';
import { useAuth } from '../context/AuthContext';

export default function PadiManage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <section style={{ paddingTop: '1.5rem' }}>
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
      
      <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>PadiManage System</h2>
      <p style={{ marginBottom: '2rem' }}>Manage your inventory records, update stock volumes, and generate reports.</p>

      <StockListing 
        isManagerView 
        userId={user?.id || user?._id} 
        onStockUpdate={() => setRefreshKey(prev => prev + 1)} 
        refreshKey={refreshKey} 
      />

      <RFQSListing userId={user?.id || user?._id} refreshKey={refreshKey} onRfqUpdate={() => setRefreshKey(prev => prev + 1)} />
    </section>
  );
}
