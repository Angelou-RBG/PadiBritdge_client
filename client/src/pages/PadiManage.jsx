import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StockListing from '../components/StockListing';
import RFQSListing from '../components/RFQSListing';
import FloatingCard from '../components/FloatingCard';
import NotificationBean from '../components/NotificationBean';
import { useAuth } from '../context/AuthContext';
import { getStockListings, updateStockListing } from '../services/api';

export default function PadiManage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const getLocalDateTimeValue = () => {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
  };

  const [notification, setNotification] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [isModifyModalOpen, setIsModifyModalOpen] = useState(false);
  const [stockListings, setStockListings] = useState([]);
  const [selectedStockId, setSelectedStockId] = useState('');
  const [modifyPhysical, setModifyPhysical] = useState('');
  const [modifyAllocated, setModifyAllocated] = useState('');
  const [modifyPrice, setModifyPrice] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isModifyModalOpen) {
      getStockListings({ userId: user?.id || user?._id }).then(data => setStockListings(data.stockListings || [])).catch(console.error);
    }
  }, [isModifyModalOpen, refreshKey, user]);

  const handleStockSelect = (e) => {
    const stockId = e.target.value;
    setSelectedStockId(stockId);
    if (stockId) {
      const stock = stockListings.find(s => String(s.stock_id) === String(stockId));
      if (stock) {
        setModifyPhysical(stock.physical_sacks);
        setModifyAllocated(stock.allocated_sacks);
        setModifyPrice(stock.wholesale_price);
      }
    } else {
      setModifyPhysical('');
      setModifyAllocated('');
      setModifyPrice('');
    }
  };

  async function handleModifyRecordSubmit(event) {
    event.preventDefault();
    setNotification(null);
    try {
      const currentStock = stockListings.find(s => String(s.stock_id) === String(selectedStockId));
      if (!currentStock) {
        setNotification({ type: 'error', message: 'Selected stock listing could not be found.' });
        return;
      }

      const nextPhysical = Number(modifyPhysical);
      const nextAllocated = Number(modifyAllocated);
      const nextPrice = Number(modifyPrice);
      const changedFields = [];

      if (nextAllocated > nextPhysical) {
        setNotification({ type: 'error', message: 'Allocated volume cannot exceed total physical volume.' });
        return;
      }

      if (Number(currentStock.physical_sacks) !== nextPhysical) {
        changedFields.push('physical_sacks');
      }

      if (Number(currentStock.allocated_sacks) !== nextAllocated) {
        changedFields.push('allocated_sacks');
      }

      if (Number(currentStock.wholesale_price) !== nextPrice) {
        changedFields.push('wholesale_price');
      }

      if (changedFields.length === 0) {
        setNotification({ type: 'error', message: 'No changes detected.' });
        return;
      }

      setIsSubmitting(true);
      await updateStockListing(selectedStockId, {
        userId: user?.id || user?._id,
        physicalSacks: nextPhysical,
        allocatedSacks: nextAllocated,
        wholesalePrice: nextPrice,
        referenceId: referenceId.trim() || 'MODIFICATION',
        timestamp: getLocalDateTimeValue(),
      });
      setIsModifyModalOpen(false);
      setRefreshKey(prev => prev + 1);
      setSelectedStockId('');
      setReferenceId('');
    } catch (error) {
      setNotification({ type: 'error', message: error.response?.data?.message || 'Failed to modify record.' });
    } finally {
      setIsSubmitting(false);
    }
  }

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
        onModifyRecord={() => setIsModifyModalOpen(true)} 
        refreshKey={refreshKey} 
      />

      <RFQSListing userId={user?.id || user?._id} refreshKey={refreshKey} onRfqUpdate={() => setRefreshKey(prev => prev + 1)} />

      <FloatingCard
        open={isModifyModalOpen}
        onClose={() => setIsModifyModalOpen(false)}
        title="Modify Existing Record"
      >
        <NotificationBean type={notification?.type} message={notification?.message} />
        <form className="form-shell" onSubmit={handleModifyRecordSubmit}>
          <label htmlFor="modify-stock">Select Stock Listing</label>
          <select id="modify-stock" value={selectedStockId} onChange={handleStockSelect} required disabled={isSubmitting}>
            <option value="">-- Select Stock --</option>
            {stockListings.map(s => (
              <option key={s.stock_id} value={s.stock_id}>{s.name} ({s.quality_grade})</option>
            ))}
          </select>

          <label htmlFor="modify-physical">Total Physical Volume (Sacks)</label>
          <input id="modify-physical" type="number" step="1" min="0" value={modifyPhysical} onChange={e => setModifyPhysical(e.target.value)} required disabled={isSubmitting || !selectedStockId} />

          <label htmlFor="modify-allocated">Allocated Volume (Sacks)</label>
          <input id="modify-allocated" type="number" step="1" min="0" value={modifyAllocated} onChange={e => setModifyAllocated(e.target.value)} required disabled={isSubmitting || !selectedStockId} />

          <label htmlFor="modify-price">Est. Wholesale Price (₱)</label>
          <input id="modify-price" type="number" step="0.01" min="0" value={modifyPrice} onChange={e => setModifyPrice(e.target.value)} required disabled={isSubmitting || !selectedStockId} />

          <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.9rem', lineHeight: '1.4' }}>
            Only changed fields are logged, so updating both allocated volume and price creates two inventory log entries.
          </p>

          <label htmlFor="modify-reference">Reference ID / Notes (Optional)</label>
          <input id="modify-reference" type="text" placeholder="e.g., Audit or correction" value={referenceId} onChange={e => setReferenceId(e.target.value)} disabled={isSubmitting || !selectedStockId} />

          <p style={{ margin: '0.5rem 0 0', color: '#64748b', fontSize: '0.9rem', lineHeight: '1.4' }}>
            The correction time is recorded automatically when you save the changes.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button type="submit" className="primary-btn" disabled={isSubmitting || !selectedStockId}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </FloatingCard>
    </section>
  );
}
