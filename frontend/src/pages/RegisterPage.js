import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, FileSearch } from 'lucide-react';
import { motion } from 'framer-motion';
import { ParticleCanvas, FloatingShapes } from '../components/Scene3D';

function formatError(detail) {
  if (detail == null) return "Something went wrong.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(e => e?.msg || JSON.stringify(e)).join(" ");
  if (detail?.msg) return detail.msg;
  return String(detail);
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await register(email, password, name);
      navigate('/dashboard');
    } catch (err) {
      setError(formatError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0"><ParticleCanvas particleCount={80} color="#6366F1" /></div>
      <FloatingShapes />
      <div className="absolute inset-0 z-[1] bg-black/50" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30"><FileSearch className="w-5 h-5 text-white" /></div>
            <span className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>SkillScope</span>
          </div>
          <p className="text-white/35 text-sm">Create your account to get started</p>
        </div>
        <div className="bg-black/50 backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-9 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-1 tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Create account</h2>
          <p className="text-white/35 text-sm mb-7">Start analyzing your resume today</p>
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              data-testid="register-error" className="bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 mb-5 text-red-400 text-sm flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />{error}
            </motion.div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-white/45 text-xs font-medium mb-2 uppercase tracking-wider">Full Name</label>
              <input data-testid="register-name-input" type="text" value={name} onChange={e => setName(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all text-sm" placeholder="John Doe (Letters only)" required />
            </div>
            <div>
              <label className="block text-white/45 text-xs font-medium mb-2 uppercase tracking-wider">Email</label>
              <input data-testid="register-email-input" type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all text-sm" placeholder="you@example.com" required />
            </div>
            <div>
              <label className="block text-white/45 text-xs font-medium mb-2 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input data-testid="register-password-input" type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all pr-11 text-sm" placeholder="Min 8 chars, 1 uppercase, 1 number, 1 special (!@#$)" required />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button data-testid="register-submit-button" type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 text-sm shadow-xl shadow-indigo-600/25">
              {loading ? <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating...</div> : <>Create Account <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
          <div className="relative my-7"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/[0.05]" /></div><div className="relative flex justify-center"><span className="bg-black/50 px-4 text-white/15 text-xs">or</span></div></div>
          <p className="text-center text-white/30 text-sm">Already have an account? <Link to="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium" data-testid="go-to-login">Sign in</Link></p>
        </div>
      </motion.div>
    </div>
  );
}
