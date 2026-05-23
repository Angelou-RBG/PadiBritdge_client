import React, { useEffect, useState } from 'react';
import { getStockListings } from '../services/api';

export default function StockListing() {
  const [stocks, setStocks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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
  }, []);

  if (isLoading) return <div>Loading stock listings...</div>;
  if (error) return <div className="error-text">{error}</div>;

  return (
    <div className="module-box">
      <h4>Current Stock Listings</h4>
      <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', marginTop: '1rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #ddd' }}>
            <th style={{ padding: '0.5rem 0' }}>Rice Brand / Variety</th>
            <th>Quality Grade</th>
            <th>Available Volume</th>
            <th>Est. Wholesale Price (₱)</th>
          </tr>
        </thead>
        <tbody>
          {stocks.length > 0 ? (
            stocks.map((stock) => (
              <tr key={stock.stock_id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem 0' }}>{stock.name}</td>
                <td>{stock.quality_grade}</td>
                <td>{stock.allocated_sacks} sacks</td>
                <td>₱{Number(stock.wholesale_price).toFixed(2)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="4" style={{ padding: '1rem 0', textAlign: 'center' }}>
                No stock listings available.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}