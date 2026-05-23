import React from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import '../pages/Feed.css';
import { useAuth } from '../context/AuthContext';

function navClass({ isActive }) {
  return isActive ? 'nav-link active' : 'nav-link';
}

export default function AppLayout() {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();

  const profileId = user?.id || user?._id || 'me';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
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
              <NavLink to={`/profile/${profileId}`} className={navClass}>
                Profile
              </NavLink>
              <NavLink to="/create" className={navClass}>
                Create
              </NavLink>
              <button type="button" className="logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </>
          )}
        </nav>
      </header>

      {location.pathname === '/' ? (
        <div className="landing-content">
          <Outlet />
        </div>
      ) : location.pathname === '/feed' ? (
        <div className="feed-content">
          <div className="feed-container">
            <aside className="sidebar scrollable-col">
              <div className="sidebar-header">Navigation</div>
              <NavLink to="/feed" className={({isActive})=> isActive? 'nav-link-custom active' : 'nav-link-custom'}>Homepage</NavLink>
              <NavLink to="#" className="nav-link-custom">Future NAV</NavLink>
              <NavLink to="#" className="nav-link-custom">Future NAV</NavLink>
              <div className="sidebar-divider"></div>
              <NavLink to="#" className="nav-link-custom">Nav Item</NavLink>
            </aside>

            <section className="feed-area scrollable-col">
              <Outlet />
            </section>

            <aside className="modules scrollable-col">
              <div className="module-box">Module</div>
              <div className="module-box">Module</div>
              <div className="module-box">Module</div>
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
