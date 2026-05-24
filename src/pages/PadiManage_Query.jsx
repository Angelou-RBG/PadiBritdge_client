import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getInventoryLogs, getOrderRfqs, getTransactions } from '../services/api';
import { useAuth } from '../context/AuthContext';

const SECTION_LABELS = {
  'inventory-logs': 'Inventory Logs',
  'order-rfqs': 'Allocation Requests',
  'transactions': 'Transactions',
};

function formatDateTime(value) {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatItemSummary(items = []) {
  if (!items.length) {
    return 'N/A';
  }

  return items
    .map(item => `${item.variety_name || 'Item'} x ${item.requested_sacks || item.item_quantity || 0}`)
    .join(', ');
}

function mergeOrderRfqs(buyerOrders = [], millerOrders = []) {
  const merged = new Map();

  const appendOrder = (order, role) => {
    const existing = merged.get(order.order_id);

    if (!existing) {
      merged.set(order.order_id, {
        ...order,
        roles: [role],
      });
      return;
    }

    existing.roles = Array.from(new Set([...(existing.roles || []), role]));
    if (!existing.items?.length && order.items?.length) {
      existing.items = order.items;
    }
  };

  buyerOrders.forEach(order => appendOrder(order, 'buyer'));
  millerOrders.forEach(order => appendOrder(order, 'miller'));

  return Array.from(merged.values());
}

export default function PadiManage_Query() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const requestedSection = queryParams.get('section') || 'inventory-logs';
  const activeSection = SECTION_LABELS[requestedSection] ? requestedSection : 'inventory-logs';

  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isActive = true;

    async function fetchRecords() {
      try {
        setIsLoading(true);
        setError('');

        const currentUserId = user?.id || user?._id;
        if (!currentUserId) {
          throw new Error('Current user id is required.');
        }

        if (activeSection === 'inventory-logs') {
          const data = await getInventoryLogs({ userId: currentUserId });
          if (isActive) {
            setRecords(data?.inventoryLogs || []);
          }
          return;
        }

        if (activeSection === 'order-rfqs') {
          const [buyerData, millerData] = await Promise.all([
            getOrderRfqs({ buyerId: currentUserId }),
            getOrderRfqs({ millerId: currentUserId }),
          ]);

          if (isActive) {
            setRecords(mergeOrderRfqs(buyerData?.orderRfqs || [], millerData?.orderRfqs || []));
          }
          return;
        }

        const data = await getTransactions({ userId: currentUserId });
        if (isActive) {
          setRecords(data?.transactions || []);
        }
      } catch (fetchError) {
        if (isActive) {
          setError(fetchError.response?.data?.message || fetchError.message || 'Failed to load history records.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    fetchRecords();

    return () => {
      isActive = false;
    };
  }, [user, activeSection]);

  const filters = {
    section: activeSection,
    transactionType: queryParams.get('transactionType') || '',
    valueChanged: queryParams.get('valueChanged') || '',
    referenceId: queryParams.get('referenceId') || '',
    customerId: queryParams.get('customerId') || '',
    status: queryParams.get('status') || '',
    role: queryParams.get('role') || '',
    orderId: queryParams.get('orderId') || '',
    startDate: queryParams.get('startDate') || '',
    endDate: queryParams.get('endDate') || '',
  };

  const filteredRecords = records.filter((record) => {
    if (activeSection === 'inventory-logs') {
      if (filters.transactionType && record.transaction_type !== filters.transactionType) {
        return false;
      }

      if (filters.valueChanged && record.value_changed !== filters.valueChanged) {
        return false;
      }

      if (filters.referenceId && !String(record.reference_id || '').toLowerCase().includes(filters.referenceId.toLowerCase())) {
        return false;
      }

      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        const recordDate = new Date(record.logged_at || record.timestamp);
        if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(recordDate.getTime()) && recordDate < startDate) {
          return false;
        }
      }

      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        const recordDate = new Date(record.logged_at || record.timestamp);
        if (!Number.isNaN(endDate.getTime()) && !Number.isNaN(recordDate.getTime()) && recordDate > endDate) {
          return false;
        }
      }

      return true;
    }

    if (activeSection === 'order-rfqs') {
      if (filters.status && record.status !== filters.status) {
        return false;
      }

      if (filters.role && !(record.roles || []).includes(filters.role)) {
        return false;
      }

      if (filters.orderId && String(record.order_id) !== String(filters.orderId)) {
        return false;
      }

      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        const recordDate = new Date(record.date_recorded || record.fulfillment_deadline);
        if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(recordDate.getTime()) && recordDate < startDate) {
          return false;
        }
      }

      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        const recordDate = new Date(record.date_recorded || record.fulfillment_deadline);
        if (!Number.isNaN(endDate.getTime()) && !Number.isNaN(recordDate.getTime()) && recordDate > endDate) {
          return false;
        }
      }

      return true;
    }

    if (filters.transactionType && record.transaction_type !== filters.transactionType) {
      return false;
    }

    if (filters.referenceId && !String(record.reference_id || '').toLowerCase().includes(filters.referenceId.toLowerCase())) {
      return false;
    }

    if (filters.customerId && !String(record.customer_id || '').toLowerCase().includes(filters.customerId.toLowerCase())) {
      return false;
    }

    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      const recordDate = new Date(record.timestamp);
      if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(recordDate.getTime()) && recordDate < startDate) {
        return false;
      }
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      const recordDate = new Date(record.timestamp);
      if (!Number.isNaN(endDate.getTime()) && !Number.isNaN(recordDate.getTime()) && recordDate > endDate) {
        return false;
      }
    }

    return true;
  });

  const sectionLabel = SECTION_LABELS[activeSection];

  return (
    <section style={{ display: 'grid', gap: '1rem', paddingTop: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>PadiManage Query</h2>
          <p style={{ margin: '0.35rem 0 0', color: '#64748b' }}>
            Search and review your {sectionLabel.toLowerCase()} only.
          </p>
        </div>

        <button
          type="button"
          className="ghost-btn"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => navigate(-1)}
        >
          Back
        </button>
      </div>

      <div style={{ padding: '0.85rem 1rem', borderRadius: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e3a8a', fontWeight: 600 }}>
        Current section: {sectionLabel}
      </div>

      {isLoading ? (
        <div>Loading history records...</div>
      ) : error ? (
        <div className="error-text">{error}</div>
      ) : activeSection === 'inventory-logs' ? (
        <div style={{ overflowX: 'auto', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '900px' }}>
            <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time</th>
                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>User</th>
                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Variety</th>
                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transaction</th>
                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Changed Field</th>
                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Before</th>
                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>After</th>
                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reference</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length > 0 ? filteredRecords.map(record => (
                <tr key={record.log_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px', color: '#0f172a', fontSize: '0.82rem' }}>{formatDateTime(record.logged_at || record.timestamp)}</td>
                  <td style={{ padding: '10px 14px', color: '#0f172a', fontSize: '0.82rem' }}>{record.user_id}</td>
                  <td style={{ padding: '10px 14px', color: '#0f172a', fontSize: '0.82rem' }}>{record.variety_name || record.variety_id}</td>
                  <td style={{ padding: '10px 14px', color: '#0f172a', fontSize: '0.82rem' }}>{record.transaction_type}</td>
                  <td style={{ padding: '10px 14px', color: '#0f172a', fontSize: '0.82rem' }}>{record.value_changed}</td>
                  <td style={{ padding: '10px 14px', color: '#0f172a', fontSize: '0.82rem' }}>{String(record.before_value)}</td>
                  <td style={{ padding: '10px 14px', color: '#0f172a', fontSize: '0.82rem' }}>{String(record.after_value)}</td>
                  <td style={{ padding: '10px 14px', color: '#0f172a', fontSize: '0.82rem' }}>{record.reference_id}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="8" style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b' }}>
                    No matching inventory log records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : activeSection === 'order-rfqs' ? (
        <div style={{ overflowX: 'auto', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '980px' }}>
            <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recorded</th>
                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order ID</th>
                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</th>
                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Buyer</th>
                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Miller</th>
                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deadline</th>
                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Items</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length > 0 ? filteredRecords.map(record => (
                <tr key={record.order_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px', color: '#0f172a', fontSize: '0.82rem' }}>{formatDateTime(record.date_recorded)}</td>
                  <td style={{ padding: '10px 14px', color: '#0f172a', fontSize: '0.82rem' }}>{record.order_id}</td>
                  <td style={{ padding: '10px 14px', color: '#0f172a', fontSize: '0.82rem' }}>{(record.roles || []).join(', ') || 'N/A'}</td>
                  <td style={{ padding: '10px 14px', color: '#0f172a', fontSize: '0.82rem' }}>{record.buyer_id}</td>
                  <td style={{ padding: '10px 14px', color: '#0f172a', fontSize: '0.82rem' }}>{record.miller_id}</td>
                  <td style={{ padding: '10px 14px', color: '#0f172a', fontSize: '0.82rem' }}>{record.status}</td>
                  <td style={{ padding: '10px 14px', color: '#0f172a', fontSize: '0.82rem' }}>{formatDateTime(record.fulfillment_deadline)}</td>
                  <td style={{ padding: '10px 14px', color: '#0f172a', fontSize: '0.82rem' }}>{formatItemSummary(record.items)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="8" style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b' }}>
                    No matching allocation request records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '900px' }}>
            <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time</th>
                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transaction ID</th>
                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>User</th>
                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</th>
                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reference</th>
                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length > 0 ? filteredRecords.map(record => (
                <tr key={record.transaction_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px', color: '#0f172a', fontSize: '0.82rem' }}>{formatDateTime(record.timestamp)}</td>
                  <td style={{ padding: '10px 14px', color: '#0f172a', fontSize: '0.82rem' }}>{record.transaction_id}</td>
                  <td style={{ padding: '10px 14px', color: '#0f172a', fontSize: '0.82rem' }}>{record.user_name || record.user_id}</td>
                  <td style={{ padding: '10px 14px', color: '#0f172a', fontSize: '0.82rem' }}>{record.transaction_type}</td>
                  <td style={{ padding: '10px 14px', color: '#0f172a', fontSize: '0.82rem' }}>{record.reference_id}</td>
                  <td style={{ padding: '10px 14px', color: '#0f172a', fontSize: '0.82rem' }}>{record.customer_id || 'N/A'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" style={{ padding: '3rem 1rem', textAlign: 'center', color: '#64748b' }}>
                    No matching transaction records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}