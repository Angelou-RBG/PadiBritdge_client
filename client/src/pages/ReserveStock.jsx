import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPost, getStockListings, createOrderRfq } from '../services/api';

export default function ReserveStock() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [stockListings, setStockListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [items, setItems] = useState([]);
  const [tempVariety, setTempVariety] = useState('');
  const [tempQuantity, setTempQuantity] = useState('');
  const [fulfillmentDeadline, setFulfillmentDeadline] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function fetchData() {
      try {
        const postData = await getPost(id);
        const fetchedPost = postData?.post;
        if (!fetchedPost) {
          throw new Error('Post not found');
        }
        
        if (isActive) {
          setPost(fetchedPost);
        }

        const millerId = fetchedPost.user_id || fetchedPost.userId;
        const stocksData = await getStockListings({ userId: millerId });
        
        if (isActive) {
          setStockListings(stocksData?.stockListings || []);

          const nextMonth = new Date();
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          setFulfillmentDeadline(nextMonth.toISOString().split('T')[0]);
        }
      } catch (err) {
        if (isActive) {
          setError(err.response?.data?.message || err.message || 'Failed to load details.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }
    fetchData();

    return () => {
      isActive = false;
    };
  }, [id]);

  const handleAddItem = () => {
    if (tempVariety && tempQuantity) {
      const stockObj = stockListings.find(s => String(s.variety_id) === String(tempVariety));
      setItems(prev => [...prev, { 
        varietyId: Number(tempVariety), 
        requestedSacks: Number(tempQuantity),
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) {
      alert('You must add at least one item.');
      return;
    }
    try {
      setIsSubmitting(true);
      const millerId = post.user_id || post.userId;
      await createOrderRfq({
        buyerId: user?.id || user?._id,
        millerId,
        items,
        fulfillmentDeadline: fulfillmentDeadline || null
      });
      navigate(-1);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit allocation request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <section className="page-shell"><div>Loading...</div></section>;
  if (error) return <section className="page-shell"><div className="error-text">{error}</div></section>;

  return (
    <section className="page-shell card-shell">
      <button type="button" className="ghost-btn" onClick={() => navigate(-1)} style={{ marginBottom: '1rem' }}>Back</button>
      <h2 style={{ margin: '0 0 0.5rem 0' }}>{post?.user || 'Miller Name'}</h2>
      <h5 style={{ margin: '0 0 2rem 0', color: '#64748b' }}>Miller ID: {post?.user_id || post?.userId}</h5>

      <div style={{ overflowX: 'auto', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '600px' }}>
          <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <tr>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '600', fontSize: '0.85rem' }}>Rice Brand / Variety</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '600', fontSize: '0.85rem' }}>Quality Grade</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '600', fontSize: '0.85rem' }}>Available Volume</th>
              <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '600', fontSize: '0.85rem' }}>Est. Wholesale Price (₱)</th>
            </tr>
          </thead>
          <tbody>
            {stockListings.map((stock) => (
              <tr key={stock.stock_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px 16px', fontWeight: '500', color: '#0f172a' }}>{stock.name}</td>
                <td style={{ padding: '12px 16px', color: '#334155' }}>{stock.quality_grade}</td>
                <td style={{ padding: '12px 16px', color: '#059669', fontWeight: '500' }}>{(stock.physical_sacks || 0) - (stock.allocated_sacks || 0)} sacks</td>
                <td style={{ padding: '12px 16px', color: '#0f172a' }}>₱{Number(stock.wholesale_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="form-shell" onSubmit={handleSubmit}>
        <h4 style={{ marginBottom: '1rem' }}>Request Allocation</h4>
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
              <select value={tempVariety} onChange={e => setTempVariety(e.target.value)} disabled={isSubmitting} style={{ padding: '0.5rem', width: '100%', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                <option value="">-- Select --</option>
                {stockListings.map(s => (
                  <option key={s.variety_id} value={s.variety_id}>{s.name} ({s.quality_grade}) - ₱{Number(s.wholesale_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</option>
                ))}
              </select>
            </div>
            <div style={{ width: '100px' }}>
              <label style={{ fontSize: '0.8rem', display: 'block', color: '#475569' }}>Sacks</label>
              <input type="number" min="1" step="1" value={tempQuantity} onChange={e => setTempQuantity(e.target.value)} disabled={isSubmitting} style={{ padding: '0.5rem', width: '100%', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
            </div>
            <button type="button" onClick={handleAddItem} className="ghost-btn" style={{ padding: '0.5rem' }}>Add Item</button>
            <button type="button" onClick={handleAddItem} className="primary-btn" style={{ padding: '0.55rem 1rem', height: '36px' }}>Add</button>
          </div>
        </div>

        <label htmlFor="fulfillment-deadline">Fulfillment Deadline</label>
        <input id="fulfillment-deadline" type="date" value={fulfillmentDeadline} onChange={e => setFulfillmentDeadline(e.target.value)} required disabled={isSubmitting} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button type="submit" className="primary-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </form>
    </section>
  );
}