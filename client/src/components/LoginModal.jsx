import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { ShieldCheck, LogIn, User, Sparkles, X, Lock, CheckCircle2 } from 'lucide-react';

export default function LoginModal({ isOpen, onClose }) {
  const { loginWithGoogleCredential, loginAsDemo } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setLoading(true);
      setError(null);
      let userInfo = null;
      if (credentialResponse.credential) {
        try {
          userInfo = jwtDecode(credentialResponse.credential);
        } catch (e) {
          console.warn('Could not decode client token:', e);
        }
      }
      
      const res = await loginWithGoogleCredential(credentialResponse.credential, userInfo);
      if (res.success) {
        onClose();
      } else {
        setError(res.error || 'Google Login failed');
      }
    } catch (err) {
      setError('An error occurred during Google Sign-In.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (role, name) => {
    try {
      setLoading(true);
      setError(null);
      const res = await loginAsDemo(role, name);
      if (res.success) {
        onClose();
      } else {
        setError(res.error || 'Demo login failed');
      }
    } catch (err) {
      setError('Failed to log in as demo profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl shadow-amber-500/5 space-y-6">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-1">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white font-mono tracking-tight m-0">Sign In to GOLDINTEL Profile</h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Authenticate your profile to unlock multi-tenant session isolation, custom backtest history, and protected data ingestion.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono text-center">
            {error}
          </div>
        )}

        {/* Google Sign-In Button Container */}
        <div className="space-y-3">
          <div className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider text-center">
            Option 1: Google OAuth Sign-In
          </div>

          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google Authentication Failed')}
              theme="filled_black"
              shape="pill"
              text="continue_with"
              size="large"
              width="280"
            />
          </div>
        </div>

        <div className="relative flex items-center justify-center my-2">
          <div className="border-t border-slate-800 w-full" />
          <span className="bg-slate-900 px-3 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
            OR
          </span>
        </div>

        {/* 1-Click Demo Profiles */}
        <div className="space-y-2">
          <div className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider text-center flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Option 2: 1-Click Demo Quant Profiles</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => handleDemoLogin('QUANT_ANALYST', 'Dr. Aris Thorne (Senior Quant)')}
              disabled={loading}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:border-amber-500/50 hover:bg-slate-800 transition text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <img
                  src="https://api.dicebear.com/7.x/bottts/svg?seed=SeniorQuant"
                  alt="Avatar"
                  className="w-8 h-8 rounded-lg bg-slate-950 p-0.5"
                />
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-amber-300 transition font-mono">
                    Dr. Aris Thorne
                  </div>
                  <div className="text-[10px] text-slate-400">Senior Quant Analyst & Strategist</div>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Full Access
              </span>
            </button>

            <button
              onClick={() => handleDemoLogin('RISK_MANAGER', 'Maya Lin (Institutional Risk Officer)')}
              disabled={loading}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:border-blue-500/50 hover:bg-slate-800 transition text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <img
                  src="https://api.dicebear.com/7.x/bottts/svg?seed=RiskOfficer"
                  alt="Avatar"
                  className="w-8 h-8 rounded-lg bg-slate-950 p-0.5"
                />
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-blue-300 transition font-mono">
                    Maya Lin
                  </div>
                  <div className="text-[10px] text-slate-400">Institutional Risk Officer</div>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Risk Suite
              </span>
            </button>
          </div>
        </div>

        <div className="text-[10px] text-center text-slate-500 leading-relaxed font-mono">
          🔒 Secure Auth: Profile verification protects production datasets from unauthorized overwrites.
        </div>

      </div>
    </div>
  );
}
