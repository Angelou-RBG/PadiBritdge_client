import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import AppLayout from './components/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { FilterProvider } from './context/FilterContext';
import { AuthProvider } from './context/AuthContext';
import Create from './pages/Create';
import Edit from './pages/Edit';
import EditProfile from './pages/EditProfile';
import Feed from './pages/Feed';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Post from './pages/Post';
import Profile from './pages/Profile';
import Read from './pages/Read';
import PadiManage_Query from './pages/PadiManage_Query';
import Signup from './pages/Signup';
import PadiManage from './pages/PadiManage';
import ReserveStock from './pages/ReserveStock';

function App() {
  return (
    <AuthProvider>
      <FilterProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              <Route element={<ProtectedRoute />}>
                <Route path="/feed" element={<Feed />} />
                <Route path="/profile/:userId" element={<Profile />} />
                <Route path="/create" element={<Create />} />
                <Route path="/edit-profile" element={<EditProfile />} />
                <Route path="/padi-manage" element={<PadiManage />} />
                <Route path="/stock-manager" element={<PadiManage />} />
                <Route path="/padi-manage-query" element={<PadiManage_Query />} />
                <Route path="/edit/:id" element={<Edit />} />
                <Route path="/post/:id" element={<Post />} />
                <Route path="/read/:id" element={<Read />} />
                <Route path="/reserve/:id" element={<ReserveStock />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </FilterProvider>
    </AuthProvider>
  );
}

export default App;