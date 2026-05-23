import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StockListing from '../components/StockListing';
import RFQSListing from '../components/RFQSListing';
import FloatingCard from '../components/FloatingCard';
import NotificationBean from '../components/NotificationBean';
import { useAuth } from '../context/AuthContext';
import { getRiceVarieties, createOrderRfq, createExternalRfq, getStockListings, updateStockListing } from '../services/api';

export default function StockManager() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [varieties, setVarieties] = useState([]);
  const [notification, setNotification] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [isModifyModalOpen, setIsModifyModalOpen] = useState(false);
  const [stockListings, setStockListings] = useState([]);
  const [selectedStockId, setSelectedStockId] = useState('');
  const [modifyPhysical, setModifyPhysical] = useState('');
  const [modifyAllocated, setModifyAllocated] = useState('');
  const [modifyPrice, setModifyPrice] = useState('');

  const [selectedVariety, setSelectedVariety] = useState('');
  const [requestType, setRequestType] = useState('internal');
  const [quantity, setQuantity] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [fulfillmentDeadline, setFulfillmentDeadline] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAddModalOpen && varieties.length === 0) {
      getRiceVarieties().then(data => setVarieties(data.riceVarieties || [])).catch(console.error);
    }
  }, [isAddModalOpen, varieties.length]);

  useEffect(() => {
    if (isModifyModalOpen) {
      getStockListings({ userId: user?.id || user?._id }).then(data => setStockListings(data.stockListings || [])).catch(console.error);
    }
  }, [isModifyModalOpen, refreshKey, user]);

  async function handleAddRecordSubmit(event) {
    event.preventDefault();
    setNotification(null);

    try {
      setIsSubmitting(true);
      
      if (requestType === 'internal') {
        await createOrderRfq({
          buyerId: buyerId ? Number(buyerId) : (user?.id || user?._id),
          millerId: user?.id || user?._id,
          varietyId: selectedVariety,
          requestedSacks: Number(quantity),
          fulfillmentDeadline: fulfillmentDeadline || null,
        });
      } else {
        await createExternalRfq({
          buyerName: buyerName.trim(),
          millerId: user?.id || user?._id,
          varietyId: selectedVariety,
          requestedSacks: Number(quantity),
          fulfillmentDeadline: fulfillmentDeadline || null,
        });
      }

      setIsAddModalOpen(false);
      setRefreshKey(prev => prev + 1);
      setSelectedVariety('');
      setQuantity('');
      setBuyerId('');
      setBuyerName('');
      setFulfillmentDeadline('');
    } catch (error) {
      setNotification({ type: 'error', message: error.response?.data?.message || 'Failed to add allocation request.' });
    } finally {
      setIsSubmitting(false);
    }
  }

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
      setIsSubmitting(true);
      await updateStockListing(selectedStockId, {
        userId: user?.id || user?._id,
        physicalSacks: Number(modifyPhysical),
        allocatedSacks: Number(modifyAllocated),
        wholesalePrice: Number(modifyPrice),
        referenceId: referenceId.trim() || 'MODIFICATION',
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
      
      <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>PadiManage System</h2>
      <p style={{ marginBottom: '2rem' }}>Manage your inventory records, update stock volumes, and generate reports.</p>

      <StockListing isManagerView onModifyRecord={() => setIsModifyModalOpen(true)} refreshKey={refreshKey} />

      <RFQSListing onAddRecord={() => setIsAddModalOpen(true)} refreshKey={refreshKey} onRfqUpdate={() => setRefreshKey(prev => prev + 1)} />

      <FloatingCard
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Allocation Request"
      >
        <NotificationBean type={notification?.type} message={notification?.message} />
        <form className="form-shell" onSubmit={handleAddRecordSubmit}>
          <label htmlFor="variety-select">Rice Variety</label>
          <select id="variety-select" value={selectedVariety} onChange={e => setSelectedVariety(e.target.value)} required disabled={isSubmitting}>
            <option value="">-- Select Variety --</option>
            {varieties.map(v => (
              <option key={v.variety_id} value={v.variety_id}>{v.name} ({v.quality_grade})</option>
            ))}
          </select>

          <label htmlFor="request-type">Request Type</label>
          <select id="request-type" value={requestType} onChange={e => setRequestType(e.target.value)} disabled={isSubmitting}>
            <option value="internal">Internal System User (Buyer ID)</option>
            <option value="external">External Walk-in (Buyer Name)</option>
          </select>

          {requestType === 'internal' ? (
            <>
              <label htmlFor="buyer-id">Buyer ID</label>
              <input id="buyer-id" type="number" step="1" min="1" placeholder="Leave blank to use your own ID" value={buyerId} onChange={e => setBuyerId(e.target.value)} disabled={isSubmitting} />
            </>
          ) : (
            <>
              <label htmlFor="buyer-name">Buyer Name</label>
              <input id="buyer-name" type="text" placeholder="e.g. John Doe" value={buyerName} onChange={e => setBuyerName(e.target.value)} required disabled={isSubmitting} />
            </>
          )}

          <label htmlFor="quantity">Requested Volume (Sacks)</label>
          <input id="quantity" type="number" step="1" placeholder="e.g. 50" value={quantity} onChange={e => setQuantity(e.target.value)} required disabled={isSubmitting} />

          <label htmlFor="fulfillment-deadline">Fulfillment Deadline</label>
          <input id="fulfillment-deadline" type="date" value={fulfillmentDeadline} onChange={e => setFulfillmentDeadline(e.target.value)} required disabled={isSubmitting} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button type="submit" className="primary-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </FloatingCard>

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

          <label htmlFor="modify-reference">Reference ID / Notes (Optional)</label>
          <input id="modify-reference" type="text" placeholder="e.g., Audit or correction" value={referenceId} onChange={e => setReferenceId(e.target.value)} disabled={isSubmitting || !selectedStockId} />

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