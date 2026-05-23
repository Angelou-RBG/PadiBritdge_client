import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStockListings } from '../services/api';
import PostCard from './PostCard';

export default function StockListing({ isProfileView, isManagerView, onAddRecord, onModifyRecord, refreshKey = 0 }) {
  const [stocks, setStocks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('table');
  const navigate = useNavigate();

  useEffect(() => {
    let isActive = true;

    async function fetchStocks() {
      try {
        setIsLoading(true);
        const data = await getStockListings();
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
  }, [refreshKey]);

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
              backgroundColor: viewMode === 'table' ? '#fff' : 'transparent',
              color: viewMode === 'table' ? '#0f172a' : '#64748b',
              fontWeight: viewMode === 'table' ? '600' : '500',
              boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
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
              backgroundColor: viewMode === 'card' ? '#fff' : 'transparent',
              color: viewMode === 'card' ? '#0f172a' : '#64748b',
              fontWeight: viewMode === 'card' ? '600' : '500',
              boxShadow: viewMode === 'card' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
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
          <button type="button" className="primary-btn" onClick={() => navigate('/stock-manager')}>Open PadiManage</button>
          <button type="button" className="ghost-btn">Post Stock Listing</button>
          <button type="button" className="ghost-btn">Export Inventory to CSV</button>
          <button type="button" className="ghost-btn">Generate Weekly Sales Report</button>
        </div>
      )}

      {isManagerView && (
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="primary-btn" onClick={onModifyRecord}>Modify Existing Records</button>
          <button type="button" className="ghost-btn">Post Stock Listing</button>
          <button type="button" className="ghost-btn">Export Inventory to CSV</button>
          <button type="button" className="ghost-btn">Generate Weekly Sales Report</button>
        </div>
      )}
    </div>
  );
}