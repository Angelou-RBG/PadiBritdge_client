import React, { useEffect, useState } from 'react';
import { getOrderRfqs, updateOrderRfq, getExternalRfqs, updateExternalRfq, createOrderRfq, createExternalRfq, getStockListings } from '../services/api';
import { useAuth } from '../context/AuthContext';
import FloatingCard from './FloatingCard';

export default function RFQSListing({ refreshKey = 0, onRfqUpdate, userId }) {
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
  const [isCancelFulfillConfirmOpen, setIsCancelFulfillConfirmOpen] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [requestType, setRequestType] = useState('internal');
  const [buyerId, setBuyerId] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [fulfillmentDeadline, setFulfillmentDeadline] = useState('');
  const [items, setItems] = useState([]);
  const [tempVariety, setTempVariety] = useState('');
  const [tempQuantity, setTempQuantity] = useState('');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [stockListings, setStockListings] = useState([]);

  useEffect(() => {
    let isActive = true;

    async function fetchRfqs() {
      const currentUserId = userId || user?.id || user?._id;
      if (!currentUserId) return;
      try {
        setIsLoading(true);
        const [internalData, externalData] = await Promise.all([
          getOrderRfqs({ millerId: currentUserId }),
          getExternalRfqs({ millerId: currentUserId })
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
  }, [refreshKey, localRefresh, user, userId]);

  useEffect(() => {
    if (isAddModalOpen && stockListings.length === 0) {
      const currentUserId = userId || user?.id || user?._id;
      getStockListings({ userId: currentUserId })
        .then(data => setStockListings(data.stockListings || []))
        .catch(console.error);
    }
  }, [isAddModalOpen, stockListings.length, user, userId]);

  const handleUpdateStatus = async (rfq, newStatus, isExternal = false) => {
    if (newStatus === 'Approved') {
      for (const item of (rfq.items || [])) {
        if (item.physical_sacks !== undefined && item.allocated_sacks !== undefined) {
          const available = Number(item.physical_sacks) - Number(item.allocated_sacks);
          if (Number(item.requested_sacks) > available) {
            alert(`Cannot approve request. ${item.variety_name} requires ${item.requested_sacks} sacks, but only ${available} are currently available in unallocated stock.`);
            return;
          }
        }
      }
    }

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

  const openCancelFulfillConfirm = () => {
    setIsCancelFulfillConfirmOpen(true);
  };

  const handleCancelFulfillConfirm = () => {
    setIsCancelFulfillConfirmOpen(false);
    setFulfillModalOpen(false);
    setSelectedFulfill(null);
    setFulfillReference('');
    setFulfillTimestamp('');
  };

  const handleOpenAddModal = () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setFulfillmentDeadline(nextMonth.toISOString().split('T')[0]);
    setIsAddModalOpen(true);
  };

  const handleAddItem = () => {
    if (tempVariety && tempQuantity) {
      const stockObj = stockListings.find(s => String(s.variety_id) === String(tempVariety));
      const availableVolume = (stockObj?.physical_sacks || 0) - (stockObj?.allocated_sacks || 0);
      
      const currentCartQuantity = items
        .filter(item => String(item.varietyId) === String(tempVariety))
        .reduce((sum, item) => sum + item.requestedSacks, 0);
        
      const requestedAmount = Number(tempQuantity);

      if (requestedAmount + currentCartQuantity > availableVolume) {
        alert(`Cannot allocate ${requestedAmount} sacks. Only ${Math.max(0, availableVolume - currentCartQuantity)} more sacks of ${stockObj?.name} are available.`);
        return;
      }

      setItems(prev => [...prev, { 
        varietyId: Number(tempVariety), 
        requestedSacks: requestedAmount,
        varietyName: stockObj?.name,
        qualityGrade: stockObj?.quality_grade,
        wholesalePrice: stockObj?.wholesale_price || 0
      }]);
      setTempVariety('');
      setTempQuantity('');
    }
  };

  const handleRemoveItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddRecordSubmit = async (event) => {
    event.preventDefault();
    if (items.length === 0) {
      alert('You must add at least one item to the order.');
      return;
    }
    try {
      setIsSubmittingAdd(true);
      const currentUserId = userId || user?.id || user?._id;
      if (requestType === 'internal') {
        await createOrderRfq({ buyerId: buyerId ? Number(buyerId) : currentUserId, millerId: currentUserId, items, fulfillmentDeadline: fulfillmentDeadline || null });
      } else {
        await createExternalRfq({ buyerName: buyerName.trim(), millerId: currentUserId, items, fulfillmentDeadline: fulfillmentDeadline || null });
      }
      setIsAddModalOpen(false);
      setLocalRefresh(prev => prev + 1);
      setItems([]);
      setBuyerId('');
      setBuyerName('');
      setFulfillmentDeadline('');
      if (onRfqUpdate) onRfqUpdate();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to add allocation request.');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  if (isLoading) return <div style={{ marginTop: '3rem' }}>Loading allocation requests...</div>;
  if (error) return <div className="error-text" style={{ marginTop: '3rem' }}>{error}</div>;

  const pendingRfqs = rfqs.filter(r => ['Pending', 'Expired', 'Rejected'].includes(r.status));
  const approvedRfqs = rfqs.filter(r => ['Approved', 'Late', 'Fulfilled'].includes(r.status));

  const pendingExtRfqs = extRfqs.filter(r => ['Pending', 'Expired', 'Rejected'].includes(r.status));
  const approvedExtRfqs = extRfqs.filter(r => ['Approved', 'Late', 'Fulfilled'].includes(r.status));

  const approvedAllocations = [...approvedRfqs.map(rfq => ({ ...rfq, requestType: 'Internal' })), ...approvedExtRfqs.map(rfq => ({ ...rfq, requestType: 'External' }))].sort((left, right) => {
    const leftDeadline = left.fulfillment_deadline ? new Date(left.fulfillment_deadline).getTime() : Number.POSITIVE_INFINITY;
    const rightDeadline = right.fulfillment_deadline ? new Date(right.fulfillment_deadline).getTime() : Number.POSITIVE_INFINITY;
    return leftDeadline - rightDeadline;
  });

  const renderTable = (tableData, emptyMessage, isExternal = false) => (
    <div style={{ overflowX: 'auto', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', marginBottom: '2rem' }}>
      <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '600px' }}>
        <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <tr>
            <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order ID</th>
            <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date Recorded</th>
            <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{isExternal ? 'Buyer Name' : 'Buyer ID'}</th>
            <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Items</th>
            <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Sacks</th>
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
                <td style={{ padding: '16px 20px', color: '#334155' }}>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
                    {rfq.items && rfq.items.map((item, idx) => (
                      <li key={idx}>{item.variety_name} <span style={{ color: '#64748b' }}>({item.quality_grade})</span> - {item.requested_sacks} sacks</li>
                    ))}
                  </ul>
                </td>
                <td style={{ padding: '16px 20px', color: '#059669', fontWeight: '600' }}>{rfq.items ? rfq.items.reduce((sum, item) => sum + item.requested_sacks, 0) : 0} sacks</td>
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
                      <button type="button" onClick={() => handleUpdateStatus(rfq, 'Approved', isExternal)} style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontWeight: 'bold' }} title="Approve">✓</button>
                      <button type="button" onClick={() => handleUpdateStatus(rfq, 'Rejected', isExternal)} style={{ backgroundColor: '#166534', color: 'white', border: 'none', borderRadius: '4px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontWeight: 'bold' }} title="Reject">✕</button>
                    </div>
                  ) : (rfq.status === 'Approved' || rfq.status === 'Late') ? (
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button type="button" onClick={() => openFulfillModal(rfq, isExternal)} style={{ backgroundColor: '#15803d', color: 'white', border: 'none', borderRadius: '4px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }} title="Fulfill">Fulfill</button>
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

  const renderApprovedTable = (tableData, emptyMessage) => (
    <div style={{ overflowX: 'auto', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', marginBottom: '2rem' }}>
      <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '700px' }}>
        <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <tr>
            <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order ID</th>
            <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date Recorded</th>
            <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</th>
            <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Buyer</th>
            <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Items</th>
            <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Sacks</th>
            <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deadline</th>
            <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
            <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tableData.length > 0 ? (
            tableData.map((rfq) => (
              <tr key={`${rfq.requestType}-${rfq.order_id}`} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }}>
                <td style={{ padding: '16px 20px', fontWeight: '600', color: '#0f172a' }}>#{rfq.order_id}</td>
                <td style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.9rem' }}>{rfq.date_recorded ? new Date(rfq.date_recorded).toLocaleDateString() : 'N/A'}</td>
                <td style={{ padding: '16px 20px' }}>
                  <span style={{ fontWeight: '600', color: rfq.requestType === 'Internal' ? '#2563eb' : '#7c3aed', backgroundColor: rfq.requestType === 'Internal' ? '#dbeafe' : '#ede9fe', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>
                    {rfq.requestType}
                  </span>
                </td>
                <td style={{ padding: '16px 20px', color: '#334155' }}>{rfq.requestType === 'Internal' ? rfq.buyer_id : rfq.buyer_name}</td>
                <td style={{ padding: '16px 20px', color: '#334155' }}>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
                    {rfq.items && rfq.items.map((item, idx) => (
                      <li key={idx}>{item.variety_name} <span style={{ color: '#64748b' }}>({item.quality_grade})</span> - {item.requested_sacks} sacks</li>
                    ))}
                  </ul>
                </td>
                <td style={{ padding: '16px 20px', color: '#059669', fontWeight: '600' }}>{rfq.items ? rfq.items.reduce((sum, item) => sum + item.requested_sacks, 0) : 0} sacks</td>
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
                  {(rfq.status === 'Approved' || rfq.status === 'Late') ? (
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button type="button" onClick={() => openFulfillModal(rfq, rfq.requestType === 'External')} style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }} title="Fulfill">Fulfill</button>
                    </div>
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>-</span>
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr><td colSpan="9" style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b' }}>{emptyMessage}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  let maxAllowed = '';
  if (tempVariety) {
    const stockObj = stockListings.find(s => String(s.variety_id) === String(tempVariety));
    if (stockObj) {
      const availableVolume = (stockObj?.physical_sacks || 0) - (stockObj?.allocated_sacks || 0);
      const currentCartQuantity = items.filter(item => String(item.varietyId) === String(tempVariety)).reduce((sum, item) => sum + item.requestedSacks, 0);
      maxAllowed = Math.max(0, availableVolume - currentCartQuantity);
    }
  }

  return (
    <div style={{ marginTop: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h4 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem' }}>Internal Allocation Requests</h4>
        <button type="button" className="primary-btn" onClick={handleOpenAddModal}>
          Add Allocation Request
        </button>
      </div>

      <h5 style={{ color: '#475569', marginBottom: '0.75rem', fontSize: '1.05rem' }}>Pending & Past Requests</h5>
      {renderTable(pendingRfqs, "No pending or past requests found.", false)}

      <h5 style={{ color: '#475569', marginBottom: '0.75rem', fontSize: '1.05rem' }}>Approved Allocations</h5>
      {renderApprovedTable(approvedAllocations, "No approved allocations found.")}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', marginTop: '3rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h4 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem' }}>External Allocation Requests</h4>
      </div>

      <h5 style={{ color: '#475569', marginBottom: '0.75rem', fontSize: '1.05rem' }}>Pending & Past Requests</h5>
      {renderTable(pendingExtRfqs, "No pending or past external requests found.", true)}

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
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                type="button"
                className="ghost-btn"
                onClick={openCancelFulfillConfirm}
                disabled={isSubmittingFulfill}
                style={{ background: '#dcfce7', color: '#14532d', border: '1px solid #86efac' }}
              >
                Cancel Fulfillment
              </button>
              <button type="submit" className="primary-btn" disabled={isSubmittingFulfill}>
                {isSubmittingFulfill ? 'Processing...' : 'Confirm Fulfillment'}
              </button>
            </div>
          </div>
        </form>
      </FloatingCard>

      <FloatingCard
        open={isCancelFulfillConfirmOpen}
        onClose={() => setIsCancelFulfillConfirmOpen(false)}
        title="Cancel Fulfillment?"
      >
        <div className="form-shell">
          <p style={{ marginTop: 0, color: '#475569', lineHeight: '1.6' }}>
            This will close the fulfillment form and discard the current confirmation details. The RFQ record itself will not be changed.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" className="ghost-btn" onClick={() => setIsCancelFulfillConfirmOpen(false)} style={{ background: '#dcfce7', color: '#14532d', border: '1px solid #86efac' }}>
              Keep Editing
            </button>
            <button type="button" className="primary-btn" onClick={handleCancelFulfillConfirm}>
              Yes, Cancel
            </button>
          </div>
        </div>
      </FloatingCard>

      <FloatingCard
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Allocation Request"
      >
        <form className="form-shell" onSubmit={handleAddRecordSubmit}>
          <label htmlFor="request-type">Request Type</label>
          <select id="request-type" value={requestType} onChange={e => setRequestType(e.target.value)} disabled={isSubmittingAdd}>
            <option value="internal">Internal System User (Buyer ID)</option>
            <option value="external">External Walk-in (Buyer Name)</option>
          </select>

          {requestType === 'internal' ? (
            <>
              <label htmlFor="buyer-id">Buyer ID</label>
              <input id="buyer-id" type="number" step="1" min="1" placeholder="Leave blank to use your own ID" value={buyerId} onChange={e => setBuyerId(e.target.value)} disabled={isSubmittingAdd} />
            </>
          ) : (
            <>
              <label htmlFor="buyer-name">Buyer Name</label>
              <input id="buyer-name" type="text" placeholder="e.g. John Doe" value={buyerName} onChange={e => setBuyerName(e.target.value)} required disabled={isSubmittingAdd} />
            </>
          )}

          <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
            <h5 style={{ margin: '0 0 0.5rem 0', color: '#1e293b' }}>Order Items (Cart)</h5>
            {items.length === 0 ? <p style={{ fontSize: '0.85rem', color: '#64748b' }}>No items added yet.</p> : (
              <>
                <ul style={{ paddingLeft: '1.25rem', marginBottom: '1rem', fontSize: '0.9rem', color: '#475569' }}>
                  {items.map((item, index) => (
                    <li key={index} style={{ marginBottom: '0.25rem' }}>
                      {item.varietyName} ({item.qualityGrade}) - {item.requestedSacks} sacks @ ₱{Number(item.wholesalePrice).toLocaleString('en-PH', { minimumFractionDigits: 2 })} = <strong>₱{(item.requestedSacks * item.wholesalePrice).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                      <button type="button" onClick={() => handleRemoveItem(index)} style={{ marginLeft: '0.5rem', color: '#166534', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}>×</button>
                    </li>
                  ))}
                </ul>
                <div style={{ textAlign: 'right', fontWeight: 'bold', marginBottom: '1rem', color: '#0f172a' }}>
                  Order Total: ₱{items.reduce((sum, item) => sum + (item.requestedSacks * item.wholesalePrice), 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8rem', display: 'block', color: '#475569' }}>Variety</label>
                <select value={tempVariety} onChange={e => setTempVariety(e.target.value)} disabled={isSubmittingAdd} style={{ padding: '0.5rem', width: '100%', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                  <option value="">-- Select --</option>
                  {stockListings.map(s => (
                    <option key={s.variety_id} value={s.variety_id}>{s.name} ({s.quality_grade}) - ₱{Number(s.wholesale_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</option>
                  ))}
                </select>
              </div>
              <div style={{ width: '100px' }}>
                <label style={{ fontSize: '0.8rem', display: 'block', color: '#475569' }}>Sacks</label>
                <input type="number" min="1" max={maxAllowed !== '' ? maxAllowed : undefined} step="1" value={tempQuantity} onChange={e => setTempQuantity(e.target.value)} disabled={isSubmittingAdd} style={{ padding: '0.5rem', width: '100%', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
              </div>
              <button type="button" onClick={handleAddItem} className="ghost-btn" style={{ padding: '0.5rem' }}>Add Item</button>
              <button type="button" onClick={handleAddItem} className="primary-btn" style={{ padding: '0.55rem 1rem', height: '36px' }}>Add</button>
            </div>
          </div>

          <label htmlFor="fulfillment-deadline">Fulfillment Deadline</label>
          <input id="fulfillment-deadline" type="date" value={fulfillmentDeadline} onChange={e => setFulfillmentDeadline(e.target.value)} required disabled={isSubmittingAdd} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button type="submit" className="primary-btn" disabled={isSubmittingAdd}>
              {isSubmittingAdd ? 'Submitting...' : 'Add Request'}
            </button>
          </div>
        </form>
      </FloatingCard>
    </div>
  );
}