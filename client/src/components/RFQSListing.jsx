import React, { useEffect, useState } from 'react';
import { getOrderRfqs, updateOrderRfq, getExternalRfqs, updateExternalRfq } from '../services/api';
import { useAuth } from '../context/AuthContext';
import FloatingCard from './FloatingCard';

export default function RFQSListing({ onAddRecord, refreshKey = 0, onRfqUpdate }) {
  const [rfqs, setRfqs] = useState([]);
  const [extRfqs, setExtRfqs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const [localRefresh, setLocalRefresh] = useState(0);
  const [fulfillModalOpen, setFulfillModalOpen] = useState(false);
  const [selectedFulfill, setSelectedFulfill] = useState(null);
  const [fulfillReference, setFulfillReference] = useState('');
  const [fulfillTimestamp, setFulfillTimestamp] = useState('');
  const [isSubmittingFulfill, setIsSubmittingFulfill] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function fetchRfqs() {
      if (!user) return;
      try {
        setIsLoading(true);
        const [internalData, externalData] = await Promise.all([
          getOrderRfqs({ millerId: user.id || user._id }),
          getExternalRfqs({ millerId: user.id || user._id })
        ]);
        if (isActive) {
          setRfqs(internalData?.orderRfqs || []);
          setExtRfqs(externalData?.externalRfqs || []);
        }
      } catch (err) {
        if (isActive) {
          setError(err.response?.data?.message || 'Failed to load allocation requests.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    fetchRfqs();

    return () => {
      isActive = false;
    };
  }, [refreshKey, localRefresh, user]);

  const handleUpdateStatus = async (rfq, newStatus, isExternal = false) => {
    try {
      if (isExternal) {
        await updateExternalRfq(rfq.order_id, { status: newStatus });
      } else {
        await updateOrderRfq(rfq.order_id, { status: newStatus });
      }
      setLocalRefresh(prev => prev + 1);
      if (onRfqUpdate) onRfqUpdate();
    } catch (err) {
      alert(err.response?.data?.message || `Failed to ${newStatus.toLowerCase()} request.`);
    }
  };

  const openFulfillModal = (rfq, isExternal = false) => {
    setSelectedFulfill({ ...rfq, isExternal });
    setFulfillReference(isExternal ? `EXT-RFQ-${rfq.order_id}` : `RFQ-${rfq.order_id}`);
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setFulfillTimestamp(now.toISOString().slice(0, 16));
    setFulfillModalOpen(true);
  };

  const handleFulfillSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFulfill) return;
    setIsSubmittingFulfill(true);
    try {
      const payload = {
        status: 'Fulfilled',
        referenceId: fulfillReference,
        timestamp: fulfillTimestamp || null
      };
      if (selectedFulfill.isExternal) {
        await updateExternalRfq(selectedFulfill.order_id, payload);
      } else {
        await updateOrderRfq(selectedFulfill.order_id, payload);
      }
      setFulfillModalOpen(false);
      setLocalRefresh(prev => prev + 1);
      if (onRfqUpdate) onRfqUpdate();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to fulfill request.');
    } finally {
      setIsSubmittingFulfill(false);
    }
  };

  if (isLoading) return <div style={{ marginTop: '3rem' }}>Loading allocation requests...</div>;
  if (error) return <div className="error-text" style={{ marginTop: '3rem' }}>{error}</div>;

  const pendingRfqs = rfqs.filter(r => ['Pending', 'Expired', 'Rejected'].includes(r.status));
  const approvedRfqs = rfqs.filter(r => ['Approved', 'Late', 'Fulfilled'].includes(r.status));

  const pendingExtRfqs = extRfqs.filter(r => ['Pending', 'Expired', 'Rejected'].includes(r.status));
  const approvedExtRfqs = extRfqs.filter(r => ['Approved', 'Late', 'Fulfilled'].includes(r.status));

  const renderTable = (tableData, emptyMessage, isExternal = false) => (
    <div style={{ overflowX: 'auto', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', marginBottom: '2rem' }}>
      <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '600px' }}>
        <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <tr>
            <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order ID</th>
            <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date Recorded</th>
            <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{isExternal ? 'Buyer Name' : 'Buyer ID'}</th>
            <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Variety</th>
            <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Requested Sacks</th>
            <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deadline</th>
            <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
            <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tableData.length > 0 ? (
            tableData.map((rfq) => (
              <tr key={rfq.order_id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }}>
                <td style={{ padding: '16px 20px', fontWeight: '600', color: '#0f172a' }}>#{rfq.order_id}</td>
                <td style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.9rem' }}>{rfq.date_recorded ? new Date(rfq.date_recorded).toLocaleDateString() : 'N/A'}</td>
                <td style={{ padding: '16px 20px', color: '#334155' }}>{isExternal ? rfq.buyer_name : rfq.buyer_id}</td>
                <td style={{ padding: '16px 20px', color: '#334155' }}>{rfq.variety_name} <span style={{ fontSize: '0.8rem', color: '#64748b' }}>({rfq.quality_grade})</span></td>
                <td style={{ padding: '16px 20px', color: '#059669', fontWeight: '600' }}>{rfq.requested_sacks} sacks</td>
                <td style={{ padding: '16px 20px', color: '#b91c1c', fontWeight: '500', fontSize: '0.9rem' }}>{rfq.fulfillment_deadline ? new Date(rfq.fulfillment_deadline).toLocaleDateString() : 'Not Set'}</td>
                <td style={{ padding: '16px 20px' }}>
                  <span style={{ 
                    fontWeight: '600', 
                    color: rfq.status === 'Approved' ? '#059669' : (rfq.status === 'Fulfilled' ? '#2563eb' : (rfq.status === 'Late' ? '#ea580c' : (rfq.status === 'Expired' ? '#475569' : (rfq.status === 'Pending' ? '#334155' : '#dc2626')))),
                    backgroundColor: rfq.status === 'Approved' ? '#d1fae5' : (rfq.status === 'Fulfilled' ? '#dbeafe' : (rfq.status === 'Late' ? '#ffedd5' : (rfq.status === 'Expired' ? '#e2e8f0' : (rfq.status === 'Pending' ? '#f1f5f9' : '#fee2e2')))),
                    padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem'
                  }}>
                    {rfq.status}
                  </span>
                </td>
                <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                  {rfq.status === 'Pending' ? (
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button type="button" onClick={() => handleUpdateStatus(rfq, 'Approved', isExternal)} style={{ backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontWeight: 'bold' }} title="Approve">✓</button>
                      <button type="button" onClick={() => handleUpdateStatus(rfq, 'Rejected', isExternal)} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontWeight: 'bold' }} title="Reject">✕</button>
                    </div>
                  ) : (rfq.status === 'Approved' || rfq.status === 'Late') ? (
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button type="button" onClick={() => openFulfillModal(rfq, isExternal)} style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }} title="Fulfill">Fulfill</button>
                    </div>
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>-</span>
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr><td colSpan="8" style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b' }}>{emptyMessage}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ marginTop: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h4 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem' }}>Internal Allocation Requests</h4>
        {onAddRecord && (
          <button type="button" className="primary-btn" onClick={onAddRecord}>
            Add Allocation Request
          </button>
        )}
      </div>

      <h5 style={{ color: '#475569', marginBottom: '0.75rem', fontSize: '1.05rem' }}>Pending & Past Requests</h5>
      {renderTable(pendingRfqs, "No pending or past requests found.", false)}

      <h5 style={{ color: '#475569', marginBottom: '0.75rem', fontSize: '1.05rem' }}>Approved Allocations</h5>
      {renderTable(approvedRfqs, "No approved allocations found.", false)}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', marginTop: '3rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h4 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem' }}>External Allocation Requests</h4>
      </div>

      <h5 style={{ color: '#475569', marginBottom: '0.75rem', fontSize: '1.05rem' }}>Pending & Past Requests</h5>
      {renderTable(pendingExtRfqs, "No pending or past external requests found.", true)}

      <h5 style={{ color: '#475569', marginBottom: '0.75rem', fontSize: '1.05rem' }}>Approved Allocations</h5>
      {renderTable(approvedExtRfqs, "No approved external allocations found.", true)}

      <FloatingCard
        open={fulfillModalOpen}
        onClose={() => setFulfillModalOpen(false)}
        title="Fulfill Allocation"
      >
        <form className="form-shell" onSubmit={handleFulfillSubmit}>
          {selectedFulfill && (
            <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
              <h5 style={{ margin: '0 0 0.5rem 0', color: '#1e293b', fontSize: '0.95rem' }}>Transaction Summary</h5>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#475569', fontSize: '0.85rem', lineHeight: '1.5' }}>
                <li><strong>Order:</strong> #{selectedFulfill.order_id}</li>
                <li><strong>Buyer:</strong> {selectedFulfill.buyer_id || selectedFulfill.buyer_name || 'N/A'}</li>
                <li><strong>Items:</strong>
                  <ul style={{ marginTop: '0.25rem', marginBottom: '0.25rem', paddingLeft: '1.25rem' }}>
                    {selectedFulfill.items && selectedFulfill.items.map((item, idx) => (
                      <li key={idx}>
                        {item.variety_name} - {item.requested_sacks} sacks @ ₱{Number(item.wholesale_price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })} = ₱{(item.requested_sacks * Number(item.wholesale_price || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </li>
                    ))}
                  </ul>
                </li>
                <li><strong>Total Volume:</strong> {selectedFulfill.items && selectedFulfill.items.reduce((sum, item) => sum + item.requested_sacks, 0)} sacks</li>
                <li><strong>Total Cost:</strong> ₱{selectedFulfill.items && selectedFulfill.items.reduce((sum, item) => sum + (item.requested_sacks * Number(item.wholesale_price || 0)), 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</li>
              </ul>
              <p style={{ marginTop: '0.75rem', marginBottom: 0, color: '#b91c1c', fontSize: '0.85rem', fontWeight: '500' }}>
                * Confirming will permanently deduct these items from your physical and allocated inventory, and generate a receipt.
              </p>
            </div>
          )}

          <label htmlFor="fulfill-reference">Reference ID (e.g. Receipt No.)</label>
          <input id="fulfill-reference" type="text" value={fulfillReference} onChange={e => setFulfillReference(e.target.value)} required disabled={isSubmittingFulfill} />
          
          <label htmlFor="fulfill-timestamp">Fulfillment Date</label>
          <input id="fulfill-timestamp" type="datetime-local" value={fulfillTimestamp} onChange={e => setFulfillTimestamp(e.target.value)} disabled={isSubmittingFulfill} />
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button type="submit" className="primary-btn" disabled={isSubmittingFulfill}>
              {isSubmittingFulfill ? 'Processing...' : 'Confirm Fulfillment'}
            </button>
          </div>
        </form>
      </FloatingCard>
    </div>
  );
}