import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createInventoryLog, getStockListings, updateStockListing } from '../services/api';
import { useAuth } from '../context/AuthContext';
import FloatingCard from './FloatingCard';
import NotificationBean from './NotificationBean';
import PostCard from './PostCard';

export default function StockListing({ isProfileView, isManagerView, onAddRecord, onStockUpdate, refreshKey = 0, userId }) {
  const [stocks, setStocks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('table');
  const [localRefresh, setLocalRefresh] = useState(0);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [transactionMode, setTransactionMode] = useState('update-stock');
  const [transactionStocks, setTransactionStocks] = useState([]);
  const [selectedTransactionStockId, setSelectedTransactionStockId] = useState('');
  const [selectedTransactionType, setSelectedTransactionType] = useState('');
  const [transactionQuantity, setTransactionQuantity] = useState('');
  const [transactionReference, setTransactionReference] = useState('');
  const [transactionCustomer, setTransactionCustomer] = useState('');
  const [transactionTimestamp, setTransactionTimestamp] = useState('');
  const [isSubmittingTransaction, setIsSubmittingTransaction] = useState(false);
  const [isModifyModalOpen, setIsModifyModalOpen] = useState(false);
  const [selectedStockId, setSelectedStockId] = useState('');
  const [modifyPhysical, setModifyPhysical] = useState('');
  const [modifyAllocated, setModifyAllocated] = useState('');
  const [modifyPrice, setModifyPrice] = useState('');
  const [modifyReferenceId, setModifyReferenceId] = useState('');
  const [isSubmittingModify, setIsSubmittingModify] = useState(false);
  const [modifyNotification, setModifyNotification] = useState(null);
  
  const { user } = useAuth();
  const navigate = useNavigate();

  const updateStockTypes = [
    { type_name: 'RESTOCK', category: 'Inbound', quantity_direction: 'Positive (+)' },
    { type_name: 'PRODUCTION', category: 'Inbound', quantity_direction: 'Positive (+)' },
    { type_name: 'CUSTOMER RETURN', category: 'Inbound', quantity_direction: 'Positive (+)' },
  ];

  const addTransactionTypes = [
    { type_name: 'SALE', category: 'Outbound', quantity_direction: 'Negative (-)' },
    { type_name: 'WASTAGE', category: 'Outbound', quantity_direction: 'Negative (-)' },
  ];

  const availableTransactionTypes = transactionMode === 'update-stock' ? updateStockTypes : addTransactionTypes;

  useEffect(() => {
    let isActive = true;

    async function fetchStocks() {
      try {
        setIsLoading(true);
        const data = await getStockListings(userId ? { userId } : {});
        if (isActive) {
          setStocks(data?.stockListings || []);
        }
      } catch (err) {
        if (isActive) {
          setError(err.response?.data?.message || 'Failed to load stock listings.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    fetchStocks();

    return () => {
      isActive = false;
    };
  }, [refreshKey, localRefresh, userId]);

  useEffect(() => {
    if (!isTransactionModalOpen) {
      return undefined;
    }

    let isActive = true;

    async function fetchTransactionStocks() {
      try {
        const currentUserId = userId || user?.id || user?._id;
        const data = await getStockListings({ userId: currentUserId });
        if (isActive) {
          setTransactionStocks(data?.stockListings || []);
        }
      } catch (fetchError) {
        if (isActive) {
          setTransactionStocks([]);
        }
      }
    }

    fetchTransactionStocks();

    return () => {
      isActive = false;
    };
  }, [isTransactionModalOpen, user, userId]);

  useEffect(() => {
    if (!isTransactionModalOpen) {
      return;
    }

    if (!availableTransactionTypes.length) {
      return;
    }

    const hasCurrentType = availableTransactionTypes.some(item => item.type_name === selectedTransactionType);
    if (!hasCurrentType) {
      setSelectedTransactionType(availableTransactionTypes[0].type_name);
    }
  }, [availableTransactionTypes, isTransactionModalOpen, selectedTransactionType]);

  useEffect(() => {
    if (!isTransactionModalOpen) {
      return;
    }

    if (!transactionStocks.length) {
      setSelectedTransactionStockId('');
      return;
    }

    const hasCurrentStock = transactionStocks.some(stock => String(stock.variety_id) === String(selectedTransactionStockId));
    if (!hasCurrentStock) {
      setSelectedTransactionStockId(String(transactionStocks[0].variety_id));
    }
  }, [isTransactionModalOpen, selectedTransactionStockId, transactionStocks]);

  const openTransactionModal = (mode) => {
    const nextMode = mode === 'add-transaction' ? 'add-transaction' : 'update-stock';
    setTransactionMode(nextMode);
    setTransactionQuantity('');
    setTransactionReference('');
    setTransactionCustomer('');
    setTransactionTimestamp('');
    setSelectedTransactionStockId('');
    setSelectedTransactionType('');
    setIsTransactionModalOpen(true);
  };

  const closeTransactionModal = () => {
    setIsTransactionModalOpen(false);
    setTransactionMode('update-stock');
    setSelectedTransactionStockId('');
    setSelectedTransactionType('');
    setTransactionQuantity('');
    setTransactionReference('');
    setTransactionCustomer('');
    setTransactionTimestamp('');
    setIsSubmittingTransaction(false);
  };

  const handleTransactionSubmit = async (event) => {
    event.preventDefault();

    if (!selectedTransactionStockId || !selectedTransactionType || !transactionQuantity) {
      return;
    }

    try {
      const isOutbound = addTransactionTypes.some(t => t.type_name === selectedTransactionType);
      if (isOutbound && transactionMode === 'add-transaction') {
        const stock = transactionStocks.find(s => String(s.variety_id) === String(selectedTransactionStockId));
        if (stock) {
          const availableForOutbound = (stock.physical_sacks || 0) - (stock.allocated_sacks || 0);
          if (Number(transactionQuantity) > availableForOutbound) {
            alert(`Cannot deduct ${transactionQuantity} sacks. Only ${availableForOutbound} unallocated sacks are available. Deducting this would result in negative available stock.`);
            return;
          }
        }
      }

      setIsSubmittingTransaction(true);
      const currentUserId = user?.id || user?._id;
      await createInventoryLog({
        userId: currentUserId,
        varietyId: Number(selectedTransactionStockId),
        transactionType: selectedTransactionType,
        quantityChange: Number(transactionQuantity),
        referenceId: transactionReference.trim() || `${transactionMode === 'update-stock' ? 'STOCK' : 'TXN'}-${Date.now()}`,
        customerId: transactionCustomer.trim() || null,
        timestamp: transactionTimestamp || null,
      });
      setLocalRefresh(prev => prev + 1);
      closeTransactionModal();
      if (onStockUpdate) onStockUpdate();
    } catch (submitError) {
      alert(submitError.response?.data?.message || 'Failed to save transaction.');
    } finally {
      setIsSubmittingTransaction(false);
    }
  };

  const handleStockSelect = (e) => {
    const stockId = e.target.value;
    setSelectedStockId(stockId);
    if (stockId) {
      const stock = stocks.find(s => String(s.stock_id) === String(stockId));
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

  const getLocalDateTimeValue = () => {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
  };

  const handleModifyRecordSubmit = async (event) => {
    event.preventDefault();
    setModifyNotification(null);
    try {
      const currentStock = stocks.find(s => String(s.stock_id) === String(selectedStockId));
      if (!currentStock) {
        setModifyNotification({ type: 'error', message: 'Selected stock listing could not be found.' });
        return;
      }

      const nextPhysical = Number(modifyPhysical);
      const nextAllocated = Number(modifyAllocated);
      const nextPrice = Number(modifyPrice);
      const changedFields = [];

      if (nextAllocated > nextPhysical) {
        setModifyNotification({ type: 'error', message: 'Allocated volume cannot exceed total physical volume.' });
        return;
      }

      if (Number(currentStock.physical_sacks) !== nextPhysical) changedFields.push('physical_sacks');
      if (Number(currentStock.allocated_sacks) !== nextAllocated) changedFields.push('allocated_sacks');
      if (Number(currentStock.wholesale_price) !== nextPrice) changedFields.push('wholesale_price');

      if (changedFields.length === 0) {
        setModifyNotification({ type: 'error', message: 'No changes detected.' });
        return;
      }

      setIsSubmittingModify(true);
      await updateStockListing(selectedStockId, {
        userId: user?.id || user?._id,
        physicalSacks: nextPhysical,
        allocatedSacks: nextAllocated,
        wholesalePrice: nextPrice,
        referenceId: modifyReferenceId.trim() || 'MODIFICATION',
        timestamp: getLocalDateTimeValue(),
      });
      setIsModifyModalOpen(false);
      setLocalRefresh(prev => prev + 1);
      setSelectedStockId('');
      setModifyReferenceId('');
      if (onStockUpdate) onStockUpdate();
    } catch (err) {
      setModifyNotification({ type: 'error', message: err.response?.data?.message || 'Failed to modify record.' });
    } finally {
      setIsSubmittingModify(false);
    }
  };

  if (isLoading) return <div>Loading stock listings...</div>;
  if (error) return <div className="error-text">{error}</div>;

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h4 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem' }}>Current Stock Listings</h4>
        <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '0.25rem', borderRadius: '8px' }}>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            style={{
              padding: '0.4rem 1rem',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: viewMode === 'table' ? '#16a34a' : 'transparent',
              color: viewMode === 'table' ? '#fff' : '#166534',
              fontWeight: viewMode === 'table' ? '600' : '500',
              boxShadow: viewMode === 'table' ? '0 1px 3px rgba(22,101,52,0.18)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontSize: '0.9rem'
            }}
          >
            Table View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('card')}
            style={{
              padding: '0.4rem 1rem',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: viewMode === 'card' ? '#16a34a' : 'transparent',
              color: viewMode === 'card' ? '#fff' : '#166534',
              fontWeight: viewMode === 'card' ? '600' : '500',
              boxShadow: viewMode === 'card' ? '0 1px 3px rgba(22,101,52,0.18)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontSize: '0.9rem'
            }}
          >
            Card View
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div style={{ overflowX: 'auto', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rice Brand / Variety</th>
                <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quality Grade</th>
                {(isProfileView || isManagerView) && (
                  <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Physical Volume</th>
                )}
                <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Allocated Volume</th>
                <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Available Volume</th>
                <th style={{ padding: '14px 20px', color: '#475569', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Est. Wholesale Price (₱)</th>
              </tr>
            </thead>
            <tbody>
              {stocks.length > 0 ? (
                stocks.map((stock) => (
                  <tr key={stock.stock_id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }}>
                    <td style={{ padding: '16px 20px', fontWeight: '600', color: '#0f172a' }}>{stock.name}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ backgroundColor: '#f1f5f9', color: '#334155', padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '500' }}>
                        {stock.quality_grade}
                      </span>
                    </td>
                    {(isProfileView || isManagerView) && (
                      <td style={{ padding: '16px 20px', color: '#0f172a', fontWeight: '500' }}>{stock.physical_sacks} sacks</td>
                    )}
                    <td style={{ padding: '16px 20px', color: '#b91c1c', fontWeight: '500' }}>{stock.allocated_sacks} sacks</td>
                    <td style={{ padding: '16px 20px', color: '#059669', fontWeight: '600' }}>{(stock.physical_sacks || 0) - (stock.allocated_sacks || 0)} sacks</td>
                    <td style={{ padding: '16px 20px', color: '#0f172a', fontWeight: '500' }}>
                      ₱{Number(stock.wholesale_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={(isProfileView || isManagerView) ? 6 : 5} style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b' }}>
                    No stock listings available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {stocks.length > 0 ? (
            stocks.map((stock) => (
              <PostCard
                key={stock.stock_id}
                post={{
                  title: stock.name,
                  user: 'Your Inventory',
                  tags: [
                    stock.quality_grade,
                    `₱${Number(stock.wholesale_price).toFixed(2)} / sack`,
                    ...((isProfileView || isManagerView) ? [`Physical: ${stock.physical_sacks} sacks`] : []),
                    `Allocated: ${stock.allocated_sacks} sacks`
                  ],
                  textBody: `Available volume: ${(stock.physical_sacks || 0) - (stock.allocated_sacks || 0)} sacks ready for wholesale allocation.`,
                }}
              />
            ))
          ) : (
            <div className="post-card" style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b' }}>
              No stock listings available.
            </div>
          )}
        </div>
      )}

      {isProfileView && !isManagerView && (
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="primary-btn" onClick={() => navigate('/padi-manage')}>Open PadiManage</button>
          <button type="button" className="primary-btn" onClick={() => openTransactionModal('update-stock')}>Update Stock</button>
          <button type="button" className="ghost-btn" onClick={() => openTransactionModal('add-transaction')}>Add Transaction</button>
          <button type="button" className="ghost-btn">Post Stock Listing</button>
        </div>
      )}

      {isManagerView && (
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="primary-btn" onClick={() => setIsModifyModalOpen(true)}>Modify Existing Records</button>
          <button type="button" className="primary-btn" onClick={() => openTransactionModal('update-stock')}>Update Stock</button>
          <button type="button" className="ghost-btn" onClick={() => openTransactionModal('add-transaction')}>Add Transaction</button>
          <button type="button" className="ghost-btn">Post Stock Listing</button>
        </div>
      )}

      <FloatingCard
        open={isTransactionModalOpen}
        onClose={closeTransactionModal}
        title={transactionMode === 'update-stock' ? 'Update Stock' : 'Add Transaction'}
      >
        <form className="form-shell" onSubmit={handleTransactionSubmit}>
          <p style={{ marginTop: 0, color: '#64748b', lineHeight: '1.5' }}>
            {transactionMode === 'update-stock'
              ? 'Record inbound stock movements outside the system using a positive quantity change.'
              : 'Record outbound stock movements outside the system using a positive quantity change.'}
          </p>

          <label htmlFor="transaction-stock" style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block', color: '#1e293b' }}>Stock Listing</label>
          <select
            id="transaction-stock"
            value={selectedTransactionStockId}
            onChange={e => setSelectedTransactionStockId(e.target.value)}
            required
            disabled={isSubmittingTransaction}
            style={{ padding: '0.75rem', fontSize: '1.05rem', width: '100%', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', marginBottom: '1.25rem', cursor: 'pointer' }}
          >
            <option value="">-- Select Stock --</option>
            {transactionStocks.map(stock => (
                <option key={stock.stock_id} value={stock.variety_id}>
                {stock.name} ({stock.quality_grade})
              </option>
            ))}
          </select>

          <label>Transaction Type</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {availableTransactionTypes.map(type => {
              const isSelected = selectedTransactionType === type.type_name;
              return (
                <button
                  key={type.type_name}
                  type="button"
                  onClick={() => setSelectedTransactionType(type.type_name)}
                  disabled={isSubmittingTransaction}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    border: isSelected ? '1px solid #16a34a' : '1px solid #cbd5e1',
                    backgroundColor: isSelected ? '#16a34a' : '#f8fafc',
                    color: isSelected ? '#fff' : '#475569',
                    fontWeight: '500',
                    cursor: isSubmittingTransaction ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {type.type_name}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0 1rem' }}>
            <div>
              <label htmlFor="transaction-quantity">Quantity Change (Sacks)</label>
              <input
                id="transaction-quantity"
                type="number"
                min="1"
                step="1"
                value={transactionQuantity}
                onChange={e => setTransactionQuantity(e.target.value)}
                required
                disabled={isSubmittingTransaction}
              />
            </div>

            <div>
              <label htmlFor="transaction-reference">Reference ID</label>
              <input
                id="transaction-reference"
                type="text"
                placeholder={transactionMode === 'update-stock' ? 'e.g. Restock receipt' : 'e.g. Cash sale, wastage log'}
                value={transactionReference}
                onChange={e => setTransactionReference(e.target.value)}
                disabled={isSubmittingTransaction}
              />
            </div>

            <div>
              <label htmlFor="transaction-customer">Customer / Notes</label>
              <input
                id="transaction-customer"
                type="text"
                placeholder={transactionMode === 'update-stock' ? 'Optional supplier or source' : 'Optional customer name or note'}
                value={transactionCustomer}
                onChange={e => setTransactionCustomer(e.target.value)}
                disabled={isSubmittingTransaction}
              />
            </div>

            <div>
              <label htmlFor="transaction-timestamp">Transaction Date</label>
              <input
                id="transaction-timestamp"
                type="datetime-local"
                value={transactionTimestamp}
                onChange={e => setTransactionTimestamp(e.target.value)}
                disabled={isSubmittingTransaction}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button type="submit" className="primary-btn" disabled={isSubmittingTransaction}>
              {isSubmittingTransaction ? 'Saving...' : 'Save Transaction'}
            </button>
          </div>
        </form>
      </FloatingCard>

      <FloatingCard
        open={isModifyModalOpen}
        onClose={() => setIsModifyModalOpen(false)}
        title="Modify Existing Record"
      >
        <NotificationBean type={modifyNotification?.type} message={modifyNotification?.message} />
        <form className="form-shell" onSubmit={handleModifyRecordSubmit}>
          <label htmlFor="modify-stock" style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '0.5rem', display: 'block', color: '#1e293b' }}>Select Stock Listing</label>
          <select 
            id="modify-stock" 
            value={selectedStockId} 
            onChange={handleStockSelect} 
            required 
            disabled={isSubmittingModify}
            style={{ padding: '0.75rem', fontSize: '1.05rem', width: '100%', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', marginBottom: '1.25rem', cursor: 'pointer' }}
          >
            <option value="">-- Select Stock --</option>
            {stocks.map(s => (
              <option key={s.stock_id} value={s.stock_id}>{s.name} ({s.quality_grade})</option>
            ))}
          </select>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0 1rem' }}>
            <div>
              <label htmlFor="modify-physical">Total Physical Volume (Sacks)</label>
              <input id="modify-physical" type="number" step="1" min="0" value={modifyPhysical} onChange={e => setModifyPhysical(e.target.value)} required disabled={isSubmittingModify || !selectedStockId} />
            </div>

            <div>
              <label htmlFor="modify-allocated">Allocated Volume (Sacks)</label>
              <input id="modify-allocated" type="number" step="1" min="0" value={modifyAllocated} onChange={e => setModifyAllocated(e.target.value)} required disabled={isSubmittingModify || !selectedStockId} />
            </div>

            <div>
              <label htmlFor="modify-price">Est. Wholesale Price (₱)</label>
              <input id="modify-price" type="number" step="0.01" min="0" value={modifyPrice} onChange={e => setModifyPrice(e.target.value)} required disabled={isSubmittingModify || !selectedStockId} />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <p style={{ margin: '0.25rem 0 1rem', color: '#64748b', fontSize: '0.9rem', lineHeight: '1.4' }}>
                Only changed fields are logged, so updating both allocated volume and price creates two inventory log entries.
              </p>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="modify-reference">Reference ID / Notes (Optional)</label>
              <input id="modify-reference" type="text" placeholder="e.g., Audit or correction" value={modifyReferenceId} onChange={e => setModifyReferenceId(e.target.value)} disabled={isSubmittingModify || !selectedStockId} />
              
              <p style={{ margin: '0.5rem 0 0', color: '#64748b', fontSize: '0.9rem', lineHeight: '1.4' }}>
                The correction time is recorded automatically when you save the changes.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button type="submit" className="primary-btn" disabled={isSubmittingModify || !selectedStockId}>
              {isSubmittingModify ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </FloatingCard>
    </div>
  );
}