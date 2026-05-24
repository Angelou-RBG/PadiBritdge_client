import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Landing.css';

export default function Landing() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/feed" replace />;
  }

  return (
    <>
      <section className="hero-section">
        <div className="landing-container">
          <h1>PadiBridge</h1>
          <h4>"Connecting Granary to Mill - Digitizing Trade, Trading Fairly"</h4>
          <p>
            A three-fold digital platform designed to revolutionize the local rice ecosystem. We
            bring efficiency, transparency, and resilience to the entire local rice value chain by
            replacing manual processes with a streamlined digital network.
          </p>
          <div className="action-row">
            <Link to="/login" className="primary-btn">
              Login
            </Link>
            <Link to="/signup" className="ghost-btn">
              Sign up
            </Link>
          </div>
        </div>
      </section>

      <section className="cards-section">
        <div className="landing-container">
          <div className="wf-box-green"></div>
          <div className="wf-line long"></div>
          <div className="wf-line long"></div>
          <div className="wf-line med"></div>
          <div className="wf-line med"></div>
          <div className="wf-line short"></div>

          <div className="cards-grid" style={{ marginTop: 20 }}>
            {[1, 2, 3].map((i) => (
              <div className="card-custom" key={i}>
                <div className="card-img-placeholder">
                  <svg viewBox="0 0 24 24" width="40" height="40">
                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                  </svg>
                </div>
                <div className="card-body-custom">
                  <div className="wf-card-title"></div>
                  <div className="wf-card-line"></div>
                  <div className="wf-card-line"></div>
                  <div className="wf-card-line"></div>
                  <div className="wf-card-line short"></div>
                </div>
              </div>
            ))}
          </div>

          <hr style={{ borderColor: '#333', marginTop: 30 }} />
          <div style={{ marginTop: 14 }}>
            <Link to="/signup" className="primary-btn">
              Call-to-action
            </Link>
          </div>
        </div>
      </section>

      <section className="footer-slot-section">
        <div className="landing-container">
          <div className="dashed-slot">Slot</div>
        </div>
      </section>
    </>
  );
}
