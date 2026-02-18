import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api.service';
import { useGameStore } from '../../stores/gameStore';

export const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const setUser = useGameStore(s => s.setUser);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = isLogin 
        ? await api.auth.login({ email, password })
        : await api.auth.register({ email, username, password });
      localStorage.setItem('access_token', res.access_token);
      localStorage.setItem('refresh_token', res.refresh_token);
      setUser(res.user as any);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error');
    }
  };

  return (
    <div className="min-h-screen bg-slide-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="font-display text-5xl text-center text-white mb-2">DEALT / SLIDE</h1>
        <p className="text-center text-white/40 mb-8">Real blocks. Real beef.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="input" />
          {!isLogin && <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} className="input" />}
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="input" />
          {error && <p className="text-neon-red text-sm">{error}</p>}
          <button type="submit" className="btn-primary w-full">{isLogin ? 'Login' : 'Register'}</button>
        </form>
        
        <p className="text-center text-white/40 mt-4">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => setIsLogin(!isLogin)} className="text-neon-purple hover:text-neon-cyan">
            {isLogin ? 'Register' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
};
export default AuthPage;
