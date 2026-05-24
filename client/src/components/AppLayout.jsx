import React from 'react';
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
  const { setFilters } = useFilters();
  const isStockManagerPage = location.pathname === '/padi-manage';
  const isQueryPage = location.pathname === '/padi-manage-query';
  const queryParams = new URLSearchParams(location.search);
  const querySection = queryParams.get('section') || '';
  const initialFilters = React.useMemo(() => Object.fromEntries(new URLSearchParams(location.search).entries()), [location.search]);

  const profileId = user?.id || user?._id || null;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const openPadiManageQuery = (section) => {
    navigate(`/padi-manage-query?section=${encodeURIComponent(section)}`);
  };

  return (
    <div className="app-shell">
      <header className="top-bar">
        <NavLink to="/" className="brand">
          PadiBridge
        </NavLink>

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
              <NavLink to="/feed" className={navClass}>
                Home
              </NavLink>
              {profileId && (
                <NavLink to={`/profile/${profileId}`} className={navClass}>
                  Profile
                </NavLink>
              )}
              <NavLink to="/create" className={navClass}>
                Create Post
              </NavLink>
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
