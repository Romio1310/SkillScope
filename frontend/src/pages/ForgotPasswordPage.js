import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, FileSearch, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ParticleCanvas, FloatingShapes } from '../components/Scene3D';

function formatError(detail) {
  if (detail == null) return "Something went wrong.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(e => e?.msg || JSON.stringify(e)).join(" ");
  if (detail?.msg) return detail.msg;
  return String(detail);
}

export default function ForgotPasswordPage() {
  const { forgotPassword, verifyOtp, resetPassword } = useAuth();
  const navigate = useNavigate();
  
  // Steps: 1 = Email, 2 = OTP, 3 = Reset, 4 = Success
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email);
      setStep(2);
    } catch (err) {
      setError(formatError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verifyOtp(email, otp);
      setStep(3);
    } catch (err) {
      setError(formatError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await resetPassword(email, otp, newPassword);
      setStep(4);
    } catch (err) {
      setError(formatError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <ParticleCanvas particleCount={80} color="#6366F1" />
      </div>
      <FloatingShapes />
      <div className="absolute inset-0 z-[1] bg-black/50" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <FileSearch className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>SkillScope</span>
          </div>
          <p className="text-white/35 text-sm">Account Recovery</p>
        </div>
        
        <div className="bg-black/50 backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-9 shadow-2xl overflow-hidden relative">
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 mb-5 text-red-400 text-sm flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />{error}
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }}>
                <h2 className="text-2xl font-bold text-white mb-1 tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Forgot Password</h2>
                <p className="text-white/35 text-sm mb-7">Enter your email and we'll send you an OTP.</p>
                <form onSubmit={handleRequestOtp} className="space-y-5">
                  <div>
                    <label className="block text-white/45 text-xs font-medium mb-2 uppercase tracking-wider">Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all text-sm"
                      placeholder="you@example.com" required />
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 text-sm shadow-xl shadow-indigo-600/25">
                    {loading ? <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending...</div> : <>Send Verification Code <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }}>
                <h2 className="text-2xl font-bold text-white mb-1 tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Enter OTP</h2>
                <p className="text-white/35 text-sm mb-7">We've sent a 6-digit code to {email}. Check your terminal logs.</p>
                <form onSubmit={handleVerifyOtp} className="space-y-5">
                  <div>
                    <label className="block text-white/45 text-xs font-medium mb-2 uppercase tracking-wider">Verification Code</label>
                    <input type="text" value={otp} onChange={e => setOtp(e.target.value)} maxLength={6}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all text-sm tracking-[0.5em] font-mono text-center"
                      placeholder="------" required />
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 text-sm shadow-xl shadow-indigo-600/25">
                    {loading ? <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Verifying...</div> : <>Verify Code <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }}>
                <h2 className="text-2xl font-bold text-white mb-1 tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>New Password</h2>
                <p className="text-white/35 text-sm mb-7">Create a secure new password for your account.</p>
                <form onSubmit={handleResetPassword} className="space-y-5">
                  <div>
                    <label className="block text-white/45 text-xs font-medium mb-2 uppercase tracking-wider">Password</label>
                    <div className="relative">
                      <input type={showPw ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all pr-11 text-sm"
                        placeholder="Min 8 chars, uppercase, number, special" required />
                      <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 text-sm shadow-xl shadow-emerald-600/25">
                    {loading ? <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Resetting...</div> : <>Reset Password <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center text-center py-6">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2 tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Password Reset!</h2>
                <p className="text-white/40 text-sm mb-8">Your password has been successfully updated.</p>
                <button onClick={() => navigate('/login')}
                  className="w-full bg-white/[0.08] hover:bg-white/[0.12] text-white font-semibold py-3.5 rounded-xl transition-all active:scale-[0.98] text-sm border border-white/[0.05]">
                  Return to Login
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {step < 4 && (
            <>
              <div className="relative my-7"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/[0.05]" /></div><div className="relative flex justify-center"><span className="bg-black/50 px-4 text-white/15 text-xs">or</span></div></div>
              <p className="text-center text-white/30 text-sm">
                Remember your password? <Link to="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
