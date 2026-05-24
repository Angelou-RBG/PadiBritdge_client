import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signupRequest } from '../services/authService';

export default function Signup() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await signupRequest({ fullName, username, email, password });
      navigate('/login', {
        replace: true,
        state: { signupComplete: true, suggestedEmail: email },
      });
    } catch (error) {
      setErrorMessage(error.response?.data?.message || 'Signup failed. Please try a different email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page-shell card-shell">
      <h2>Create account</h2>
      <p>Join PadiBridge and set up your profile.</p>

      <form className="form-shell" onSubmit={handleSubmit}>
        <label htmlFor="signup-name">Full name</label>
        <input
          id="signup-name"
          type="text"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />

        <label htmlFor="signup-username">Username</label>
        <input
          id="signup-username"
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
          required
        />

        <label htmlFor="signup-email">Email</label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label htmlFor="signup-password">Password</label>
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {errorMessage && <p className="error-text">{errorMessage}</p>}

        <button className="primary-btn" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Signup'}
        </button>
      </form>

      <p>
        Already registered? <Link to="/login">Login</Link>
      </p>
    </section>
  );
}
