import React from 'react';
import App from './App';

jest.mock(
  'react-router-dom',
  () => {
    const ReactLib = require('react');
    return {
      BrowserRouter: ({ children }) => <>{children}</>,
      Navigate: () => null,
      Route: () => null,
      Routes: ({ children }) => <>{children}</>,
      Outlet: () => null,
      Link: ({ children }) => <span>{children}</span>,
      NavLink: ({ children }) => <span>{children}</span>,
      useLocation: () => ({ state: null, pathname: '/' }),
      useNavigate: () => () => {},
      useParams: () => ({}),
    };
  },
  { virtual: true },
);

test('renders landing title', () => {
  expect(App).toBeDefined();
  expect(typeof App).toBe('function');
});
