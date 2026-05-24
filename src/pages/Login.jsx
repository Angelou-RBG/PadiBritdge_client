import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginRequest } from '../services/authService';

function buildAuthPayload(responseData, email) {
  return {
    token: responseData?.token || responseData?.accessToken || `dev-token-${Date.now()}`,
    user: responseData?.user || { id: email, email },
  };
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const nextRoute = useMemo(() => location.state?.from?.pathname || '/feed', [location.state]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const data = await loginRequest({ email, password });
      const payload = buildAuthPayload(data, email);
      login(payload, rememberMe);
      navigate(nextRoute, { replace: true });
    } catch (error) {
      setErrorMessage(error.response?.data?.message || 'Login failed. Check your credentials and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page-shell card-shell">
      <h2>Welcome back</h2>
      <p>Sign in to continue to your feed.</p>

      <form className="form-shell" onSubmit={handleSubmit}>
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <label className="checkbox-row" htmlFor="remember-me">
          <input
            id="remember-me"
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
          />
          Remember me
        </label>

        {errorMessage && <p className="error-text">{errorMessage}</p>}

        <button className="primary-btn" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in...' : 'Login'}
        </button>
      </form>

      <p>
        New here? <Link to="/signup">Create an account</Link>
      </p>
    </section>
  );
}
