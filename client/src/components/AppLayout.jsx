import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import '../pages/Feed.css';
import { useFilters } from '../context/FilterContext';
import { useAuth } from '../context/AuthContext';
import SearchFilter from './SearchFilter';

function navClass({ isActive }) {
  return isActive ? 'nav-link active' : 'nav-link';
}

export default function AppLayout() {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const isFeedShell = /^\/(feed|create|padi-manage|padi-manage-query)$/.test(location.pathname) || /^\/(post|edit|read|reserve)\/[^/]+$/.test(location.pathname);
  const { filters, setFilters } = useFilters();
  const [searchTitle, setSearchTitle] = useState(filters?.title || '');
  const isStockManagerPage = location.pathname === '/padi-manage';
  const isQueryPage = location.pathname === '/padi-manage-query';
  const queryParams = new URLSearchParams(location.search);
  const querySection = queryParams.get('section') || '';
  const initialFilters = React.useMemo(() => Object.fromEntries(new URLSearchParams(location.search).entries()), [location.search]);

  const profileId = user?.id || user?._id || null;

  useEffect(() => {
    setSearchTitle(filters?.title || '');
  }, [filters?.title]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const openPadiManageQuery = (section) => {
    navigate(`/padi-manage-query?section=${encodeURIComponent(section)}`);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setFilters((prev) => ({ ...prev, title: searchTitle }));
    if (location.pathname !== '/feed') {
      navigate('/feed');
    }
  };

  return (
    <div className="app-shell">
      <header className="top-bar">
        <NavLink to="/" className="brand">
          PadiBridge
        </NavLink>

        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', margin: '0 1rem', flex: 1, maxWidth: '400px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '1.1rem', pointerEvents: 'none' }} aria-hidden="true">🔍</span>
            <input 
              type="search" 
              placeholder="Search posts by title..." 
              value={searchTitle} 
              onChange={(e) => setSearchTitle(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 2.5rem 0.5rem 1rem', borderRadius: '9999px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem' }}
            />
          </div>
        </form>

        <nav className="nav-items" aria-label="Main Navigation">
          {!isAuthenticated ? (
            <>
              <NavLink to="/" className={navClass}>
                Home
              </NavLink>

              <NavLink to="/login" className={navClass}>
                Login
              </NavLink>
              <NavLink to="/signup" className={navClass}>
                Signup
              </NavLink>
            </>
          ) : (
            <>
              <NavLink 
                to="/create" 
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  backgroundColor: '#16a34a',
                  color: '#fff',
                  padding: '0.4rem 1.25rem',
                  borderRadius: '9999px',
                  textDecoration: 'none',
                  fontWeight: '500',
                  marginRight: '0.5rem'
                }}
              >
                Create Post
              </NavLink>
              <NavLink to="/feed" className={navClass}>
                Home
              </NavLink>
              {profileId && (
                <NavLink to={`/profile/${profileId}`} className={navClass}>
                  {user?.username ? `@${user.username}` : 'Profile'}
                </NavLink>
              )}
              <button type="button" className="logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </>
          )}
        </nav>
      </header>
      {/* Right Navigation Side Bar */}
      {location.pathname === '/' ? (
        <div className="landing-content">
          <Outlet />
        </div>
      ) : isFeedShell ? (
        <div className="feed-content">
          <div className="feed-container">
            <aside className="sidebar scrollable-col">
              <div className="sidebar-header">Navigation</div>
              <NavLink to="/feed" className={({isActive})=> isActive? 'nav-link-custom active' : 'nav-link-custom'}>Homepage</NavLink>
              <NavLink to="/padi-manage" className={({isActive})=> isActive? 'nav-link-custom active' : 'nav-link-custom'}>PadiManage</NavLink>
              <NavLink to="#" className="nav-link-custom">Future NAV</NavLink>
              <NavLink to="#" className="nav-link-custom">Future NAV</NavLink>
              <div className="sidebar-divider"></div>
              <NavLink to="#" className="nav-link-custom">Nav Item</NavLink>
            </aside>

            <section className="feed-area scrollable-col">
              <Outlet />
            </section>

            <aside className="modules scrollable-col">
              {location.pathname === '/feed' && <SearchFilter mode="feed" onFilterChange={setFilters} />}
              {isQueryPage && (
                <SearchFilter
                  mode="history"
                  activeSection={querySection || 'inventory-logs'}
                  initialFilters={initialFilters}
                  onFilterChange={(filters) => navigate(`/padi-manage-query?${new URLSearchParams(filters).toString()}`)}
                />
              )}
              {isStockManagerPage && (
                <div className="search-module">
                  <h4>History</h4>
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    <button type="button" className="ghost-btn" onClick={() => openPadiManageQuery('inventory-logs')}>
                      Inventory Logs
                    </button>
                    <button type="button" className="ghost-btn" onClick={() => openPadiManageQuery('order-rfqs')}>
                      Allocation Requests
                    </button>
                    <button type="button" className="ghost-btn" onClick={() => openPadiManageQuery('transactions')}>
                      Transactions
                    </button>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      ) : (
        <main className="content-shell">
          <Outlet />
        </main>
      )}
    </div>
  );
}
