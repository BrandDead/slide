// ============================================================
// AuthScreen — Supabase login/signup screen
// Wires directly to Supabase Auth. On success, calls onAuthSuccess.
// ============================================================
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../services/supabase';
import './AuthScreen.css';

interface AuthScreenProps {
  onAuthSuccess: (user: any) => void;
}

type Tab = 'signin' | 'signup';

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [tab, setTab] = useState<Tab>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sign-in fields
  const [siEmail, setSiEmail] = useState('');
  const [siPassword, setSiPassword] = useState('');

  // Sign-up fields
  const [suUsername, setSuUsername] = useState('');
  const [suGangName, setSuGangName] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suPassword, setSuPassword] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: siEmail,
        password: siPassword,
      });
      if (authError) throw authError;
      if (data.user) onAuthSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: suEmail,
        password: suPassword,
        options: {
          data: {
            username: suUsername,
            gang_name: suGangName || `${suUsername}'s Gang`,
          },
        },
      });
      if (authError) throw authError;
      if (data.user) {
        setSuccessMsg('Account created! Check your email to confirm, then sign in.');
        setTab('signin');
      }
    } catch (err: any) {
      setError(err.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-logo">
        <h1 className="auth-title">DEALT / SLIDE</h1>
        <p className="auth-subtitle">Build your empire. Own the block.</p>
      </div>

      <div className="auth-card">
        {/* Tabs */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${tab === 'signin' ? 'active' : ''}`}
            onClick={() => { setTab('signin'); setError(null); }}
          >
            SIGN IN
          </button>
          <button
            className={`auth-tab ${tab === 'signup' ? 'active' : ''}`}
            onClick={() => { setTab('signup'); setError(null); }}
          >
            SIGN UP
          </button>
        </div>

        {/* Error / Success */}
        {error && <div className="auth-error">{error}</div>}
        {successMsg && <div className="auth-success">{successMsg}</div>}

        <AnimatePresence mode="wait">
          {tab === 'signin' ? (
            <motion.form
              key="signin"
              className="auth-form"
              onSubmit={handleSignIn}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="auth-field">
                <label>Email</label>
                <input
                  type="email"
                  value={siEmail}
                  onChange={(e) => setSiEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="auth-field">
                <label>Password</label>
                <input
                  type="password"
                  value={siPassword}
                  onChange={(e) => setSiPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
              <motion.button
                type="submit"
                className="auth-btn"
                disabled={loading}
                whileTap={{ scale: 0.97 }}
              >
                {loading ? 'SIGNING IN...' : 'SIGN IN'}
              </motion.button>
            </motion.form>
          ) : (
            <motion.form
              key="signup"
              className="auth-form"
              onSubmit={handleSignUp}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="auth-field">
                <label>Username</label>
                <input
                  type="text"
                  value={suUsername}
                  onChange={(e) => setSuUsername(e.target.value)}
                  placeholder="OGKing"
                  required
                  maxLength={32}
                />
              </div>
              <div className="auth-field">
                <label>Gang Name</label>
                <input
                  type="text"
                  value={suGangName}
                  onChange={(e) => setSuGangName(e.target.value)}
                  placeholder="The Untouchables"
                  maxLength={48}
                />
              </div>
              <div className="auth-field">
                <label>Email</label>
                <input
                  type="email"
                  value={suEmail}
                  onChange={(e) => setSuEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="auth-field">
                <label>Password</label>
                <input
                  type="password"
                  value={suPassword}
                  onChange={(e) => setSuPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <motion.button
                type="submit"
                className="auth-btn"
                disabled={loading}
                whileTap={{ scale: 0.97 }}
              >
                {loading ? 'CREATING GANG...' : 'CREATE GANG'}
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AuthScreen;
