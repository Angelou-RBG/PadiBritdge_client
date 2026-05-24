import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createInventoryLog, getStockListings } from '../services/api';
import { useAuth } from '../context/AuthContext';
import FloatingCard from './FloatingCard';
import PostCard from './PostCard';

export default function StockListing({ isProfileView, isManagerView, onAddRecord, onModifyRecord, refreshKey = 0, userId }) {
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
    } catch (submitError) {
      alert(submitError.response?.data?.message || 'Failed to save transaction.');
    } finally {
      setIsSubmittingTransaction(false);
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
          <button type="button" className="ghost-btn">Export Inventory to CSV</button>
          <button type="button" className="ghost-btn">Generate Weekly Sales Report</button>
        </div>
      )}

      {isManagerView && (
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="primary-btn" onClick={onModifyRecord}>Modify Existing Records</button>
          <button type="button" className="primary-btn" onClick={() => openTransactionModal('update-stock')}>Update Stock</button>
          <button type="button" className="ghost-btn" onClick={() => openTransactionModal('add-transaction')}>Add Transaction</button>
          <button type="button" className="ghost-btn">Post Stock Listing</button>
          <button type="button" className="ghost-btn">Export Inventory to CSV</button>
          <button type="button" className="ghost-btn">Generate Weekly Sales Report</button>
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

          <label htmlFor="transaction-stock">Stock Listing</label>
          <select
            id="transaction-stock"
            value={selectedTransactionStockId}
            onChange={e => setSelectedTransactionStockId(e.target.value)}
            required
            disabled={isSubmittingTransaction}
          >
            <option value="">-- Select Stock --</option>
            {transactionStocks.map(stock => (
                <option key={stock.stock_id} value={stock.variety_id}>
                {stock.name} ({stock.quality_grade})
              </option>
            ))}
          </select>

          <label htmlFor="transaction-type">Transaction Type</label>
          <select
            id="transaction-type"
            value={selectedTransactionType}
            onChange={e => setSelectedTransactionType(e.target.value)}
            required
            disabled={isSubmittingTransaction}
          >
            <option value="">-- Select Type --</option>
            {availableTransactionTypes.map(type => (
              <option key={type.type_name} value={type.type_name}>
                {type.type_name} - {type.category} - {type.quantity_direction}
              </option>
            ))}
          </select>

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

          <label htmlFor="transaction-reference">Reference ID</label>
          <input
            id="transaction-reference"
            type="text"
            placeholder={transactionMode === 'update-stock' ? 'e.g. Restock receipt' : 'e.g. Cash sale, wastage log'}
            value={transactionReference}
            onChange={e => setTransactionReference(e.target.value)}
            disabled={isSubmittingTransaction}
          />

          <label htmlFor="transaction-customer">Customer / Notes</label>
          <input
            id="transaction-customer"
            type="text"
            placeholder={transactionMode === 'update-stock' ? 'Optional supplier or source' : 'Optional customer name or note'}
            value={transactionCustomer}
            onChange={e => setTransactionCustomer(e.target.value)}
            disabled={isSubmittingTransaction}
          />

          <label htmlFor="transaction-timestamp">Transaction Date</label>
          <input
            id="transaction-timestamp"
            type="datetime-local"
            value={transactionTimestamp}
            onChange={e => setTransactionTimestamp(e.target.value)}
            disabled={isSubmittingTransaction}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button type="submit" className="primary-btn" disabled={isSubmittingTransaction}>
              {isSubmittingTransaction ? 'Saving...' : 'Save Transaction'}
            </button>
          </div>
        </form>
      </FloatingCard>
    </div>
  );
}