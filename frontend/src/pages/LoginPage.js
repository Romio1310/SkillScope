import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, FileSearch, Zap, Shield, TrendingUp, Cpu } from 'lucide-react';
import { motion } from 'framer-motion';
import { ParticleCanvas, FloatingShapes } from '../components/Scene3D';

function formatError(detail) {
  if (detail == null) return "Something went wrong.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(e => e?.msg || JSON.stringify(e)).join(" ");
  if (detail?.msg) return detail.msg;
  return String(detail);
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(formatError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] flex relative overflow-hidden">
      {/* Particle Background */}
      <div className="absolute inset-0 z-0">
        <ParticleCanvas particleCount={100} color="#6366F1" />
      </div>
      <FloatingShapes />

      {/* Gradient overlays */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-r from-black/70 via-black/30 to-black/60" />
      <div className="absolute bottom-0 left-0 right-0 h-40 z-[1] bg-gradient-to-t from-[#030303] to-transparent" />
      <div className="absolute top-0 left-0 right-0 h-40 z-[1] bg-gradient-to-b from-[#030303]/50 to-transparent" />

      {/* Left Side - Branding */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative z-10">
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }} className="max-w-lg px-16">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-600/30">
              <FileSearch className="w-8 h-8 text-white" />
            </div>
            <span className="text-4xl font-extrabold text-white tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>SkillScope</span>
          </div>
          <h1 className="text-5xl font-extrabold text-white leading-[1.1] mb-5 tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            Know exactly<br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">where you stand.</span>
          </h1>
          <p className="text-white/45 text-lg leading-relaxed mb-12">
            AI-powered resume analysis that tells you your real ATS score, identifies skill gaps, and builds your personalized learning roadmap.
          </p>
          <div className="space-y-5">
            {[
              { icon: Zap, label: 'Instant ATS Score', desc: 'Get your 0-100 score in seconds', gradient: 'from-yellow-500/20 to-orange-500/20' },
              { icon: Shield, label: '13 Role Templates', desc: 'Software Engineer to Cybersecurity Analyst', gradient: 'from-indigo-500/20 to-purple-500/20' },
              { icon: TrendingUp, label: 'AI-Powered Suggestions', desc: 'GPT-4o analyzes and improves your resume', gradient: 'from-emerald-500/20 to-teal-500/20' },
              { icon: Cpu, label: 'Team Workspace', desc: 'Track candidates with ranking leaderboards', gradient: 'from-pink-500/20 to-rose-500/20' },
            ].map((f, i) => (
              <motion.div key={f.label} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.12 }}
                className="flex items-center gap-4 group">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.gradient} border border-white/[0.06] flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                  <f.icon className="w-5 h-5 text-white/80" />
                </div>
                <div>
                  <div className="text-white/90 text-sm font-semibold">{f.label}</div>
                  <div className="text-white/30 text-xs">{f.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center px-6 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-2">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
                <FileSearch className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>SkillScope</span>
            </div>
          </div>

          <div className="bg-black/50 backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-9 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-1 tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Welcome back</h2>
            <p className="text-white/35 text-sm mb-7">Sign in to continue to your dashboard</p>

            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                data-testid="login-error" className="bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 mb-5 text-red-400 text-sm flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />{error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-white/45 text-xs font-medium mb-2 uppercase tracking-wider">Email</label>
                <input data-testid="login-email-input" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all text-sm"
                  placeholder="you@example.com" required />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-white/45 text-xs font-medium uppercase tracking-wider">Password</label>
                  <Link to="/forgot-password" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Forgot Password?</Link>
                </div>
                <div className="relative">
                  <input data-testid="login-password-input" type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all pr-11 text-sm"
                    placeholder="Enter your password" required />
                  <button type="button" onClick={() => setShowPw(!showPw)} data-testid="toggle-password-visibility"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button data-testid="login-submit-button" type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 text-sm shadow-xl shadow-indigo-600/25 hover:shadow-indigo-500/35">
                {loading ? (
                  <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in...</div>
                ) : (<>Sign In <ArrowRight className="w-4 h-4" /></>)}
              </button>
            </form>

            <div className="relative my-7"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/[0.05]" /></div><div className="relative flex justify-center"><span className="bg-black/50 px-4 text-white/15 text-xs">or</span></div></div>

            <p className="text-center text-white/30 text-sm">
              Don't have an account?{' '}
              <Link to="/register" className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium" data-testid="go-to-register">Create one</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
