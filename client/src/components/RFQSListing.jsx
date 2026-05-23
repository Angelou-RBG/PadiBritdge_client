import React, { useEffect, useState } from 'react';
import { getOrderRfqs, updateOrderRfq } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function RFQSListing({ onAddRecord, refreshKey = 0, onRfqUpdate }) {
  const [rfqs, setRfqs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const [localRefresh, setLocalRefresh] = useState(0);

  useEffect(() => {
    let isActive = true;

    async function fetchRfqs() {
      if (!user) return;
      try {
        setIsLoading(true);
        const data = await getOrderRfqs({ millerId: user.id || user._id });
        if (isActive) {
          setRfqs(data?.orderRfqs || []);
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

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await updateOrderRfq(orderId, { status: newStatus });
      setLocalRefresh(prev => prev + 1);
      if (onRfqUpdate) onRfqUpdate();
    } catch (err) {
      alert(err.response?.data?.message || `Failed to ${newStatus.toLowerCase()} request.`);
    }
  };

  if (isLoading) return <div style={{ marginTop: '3rem' }}>Loading allocation requests...</div>;
  if (error) return <div className="error-text" style={{ marginTop: '3rem' }}>{error}</div>;

  const pendingRfqs = rfqs.filter(r => ['Pending', 'Expired', 'Rejected'].includes(r.status));
  const approvedRfqs = rfqs.filter(r => ['Approved', 'Late'].includes(r.status));

  const renderTable = (tableData, emptyMessage) => (
    <div style={{ overflowX: 'auto', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', marginBottom: '2rem' }}>
      <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '600px' }}>
        <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <tr>
            <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order ID</th>
            <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date Recorded</th>
            <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Buyer ID</th>
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
                <td style={{ padding: '16px 20px', color: '#334155' }}>{rfq.buyer_id}</td>
                <td style={{ padding: '16px 20px', color: '#334155' }}>{rfq.variety_name} <span style={{ fontSize: '0.8rem', color: '#64748b' }}>({rfq.quality_grade})</span></td>
                <td style={{ padding: '16px 20px', color: '#059669', fontWeight: '600' }}>{rfq.requested_sacks} sacks</td>
                <td style={{ padding: '16px 20px', color: '#b91c1c', fontWeight: '500', fontSize: '0.9rem' }}>{rfq.fulfillment_deadline ? new Date(rfq.fulfillment_deadline).toLocaleDateString() : 'Not Set'}</td>
                <td style={{ padding: '16px 20px' }}>
                  <span style={{ 
                    fontWeight: '600', 
                    color: rfq.status === 'Approved' ? '#059669' : (rfq.status === 'Late' ? '#ea580c' : (rfq.status === 'Expired' ? '#475569' : (rfq.status === 'Pending' ? '#334155' : '#dc2626'))),
                    backgroundColor: rfq.status === 'Approved' ? '#d1fae5' : (rfq.status === 'Late' ? '#ffedd5' : (rfq.status === 'Expired' ? '#e2e8f0' : (rfq.status === 'Pending' ? '#f1f5f9' : '#fee2e2'))),
                    padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem'
                  }}>
                    {rfq.status}
                  </span>
                </td>
                <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                  {rfq.status === 'Pending' ? (
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button type="button" onClick={() => handleUpdateStatus(rfq.order_id, 'Approved')} style={{ backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontWeight: 'bold' }} title="Approve">✓</button>
                      <button type="button" onClick={() => handleUpdateStatus(rfq.order_id, 'Rejected')} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontWeight: 'bold' }} title="Reject">✕</button>
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
      {renderTable(pendingRfqs, "No pending or past requests found.")}

      <h5 style={{ color: '#475569', marginBottom: '0.75rem', fontSize: '1.05rem' }}>Approved Transactions</h5>
      {renderTable(approvedRfqs, "No approved transactions found.")}
    </div>
  );
}