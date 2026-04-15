import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, X, Trash2, Mail, Shield, Target, BarChart3, Loader2, UserPlus, ClipboardList, AlertTriangle, CheckCircle, Trophy, Award, Medal } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamStats, setTeamStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showThreshold, setShowThreshold] = useState(false);
  const [showCandidate, setShowCandidate] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [analyses, setAnalyses] = useState([]);

  const fetchTeams = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/teams`, { withCredentials: true });
      setTeams(data);
      if (data.length > 0 && !selectedTeam) setSelectedTeam(data[0]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [selectedTeam]);

  const fetchTeamDetail = useCallback(async (teamId) => {
    try {
      const [teamRes, statsRes] = await Promise.all([
        axios.get(`${API}/teams/${teamId}`, { withCredentials: true }),
        axios.get(`${API}/teams/${teamId}/stats`, { withCredentials: true })
      ]);
      setSelectedTeam(teamRes.data);
      setTeamStats(statsRes.data);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);
  useEffect(() => { if (selectedTeam?.id) fetchTeamDetail(selectedTeam.id); }, [selectedTeam?.id]);

  const fetchAnalyses = async () => {
    const { data } = await axios.get(`${API}/analyses`, { withCredentials: true });
    setAnalyses(data);
  };

  /* Create Team */
  function CreateTeamModal() {
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [saving, setSaving] = useState(false);
    const handle = async () => {
      if (!name.trim()) return;
      setSaving(true);
      try {
        await axios.post(`${API}/teams`, { name, description: desc }, { withCredentials: true });
        setShowCreate(false); fetchTeams();
      } catch (err) { console.error(err); } finally { setSaving(false); }
    };
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" data-testid="create-team-modal">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#0c0c0c] border border-white/[0.06] rounded-2xl p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-bold text-lg" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Create Team</h2>
            <button onClick={() => setShowCreate(false)} className="text-white/30 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-white/50 text-xs block mb-1.5 uppercase tracking-wider">Team Name</label>
              <input data-testid="team-name-input" value={name} onChange={e => setName(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-indigo-500/50" placeholder="e.g. Engineering Hiring" />
            </div>
            <div>
              <label className="text-white/50 text-xs block mb-1.5 uppercase tracking-wider">Description (optional)</label>
              <input value={desc} onChange={e => setDesc(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-indigo-500/50" placeholder="Brief description" />
            </div>
            <button data-testid="create-team-button" onClick={handle} disabled={saving || !name.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-all disabled:opacity-40 text-sm">
              {saving ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  /* Invite Member Modal */
  function InviteModal() {
    const [email, setEmail] = useState('');
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');
    const handle = async () => {
      if (!email.trim()) return;
      setSaving(true); setMsg('');
      try {
        await axios.post(`${API}/teams/${selectedTeam.id}/invite`, { email }, { withCredentials: true });
        setMsg('Invited!'); fetchTeamDetail(selectedTeam.id);
        setTimeout(() => setShowInvite(false), 800);
      } catch (err) { setMsg(err.response?.data?.detail || 'Failed'); } finally { setSaving(false); }
    };
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#0c0c0c] border border-white/[0.06] rounded-2xl p-6 w-full max-w-md">
          <div className="flex justify-between mb-5"><h2 className="text-white font-bold text-lg" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Invite Member</h2><button onClick={() => setShowInvite(false)} className="text-white/30 hover:text-white"><X className="w-5 h-5" /></button></div>
          <div className="space-y-4">
            <input data-testid="invite-email-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="member@example.com"
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-indigo-500/50" />
            {msg && <p className={`text-sm ${msg === 'Invited!' ? 'text-emerald-400' : 'text-red-400'}`}>{msg}</p>}
            <button data-testid="send-invite-button" onClick={handle} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-all disabled:opacity-40 text-sm">{saving ? 'Inviting...' : 'Send Invite'}</button>
          </div>
        </motion.div>
      </div>
    );
  }

  /* Set Threshold Modal */
  function ThresholdModal() {
    const [role, setRole] = useState('software_engineer');
    const [score, setScore] = useState(60);
    const [saving, setSaving] = useState(false);
    const handle = async () => {
      setSaving(true);
      try {
        await axios.post(`${API}/teams/${selectedTeam.id}/thresholds`, { job_role: role, min_score: parseInt(score) }, { withCredentials: true });
        fetchTeamDetail(selectedTeam.id); setShowThreshold(false);
      } catch (err) { console.error(err); } finally { setSaving(false); }
    };
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#0c0c0c] border border-white/[0.06] rounded-2xl p-6 w-full max-w-md">
          <div className="flex justify-between mb-5"><h2 className="text-white font-bold text-lg" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Set ATS Threshold</h2><button onClick={() => setShowThreshold(false)} className="text-white/30 hover:text-white"><X className="w-5 h-5" /></button></div>
          <div className="space-y-4">
            <select value={role} onChange={e => setRole(e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500/50 appearance-none">
              <option value="software_engineer">Software Engineer</option>
              <option value="data_scientist">Data Scientist</option>
              <option value="product_manager">Product Manager</option>
            </select>
            <div>
              <label className="text-white/50 text-xs mb-1.5 block">Minimum Score: <span className="text-indigo-400 font-bold">{score}</span></label>
              <input type="range" min="0" max="100" value={score} onChange={e => setScore(e.target.value)} className="w-full accent-indigo-500" />
            </div>
            <button onClick={handle} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-all disabled:opacity-40 text-sm">{saving ? 'Saving...' : 'Set Threshold'}</button>
          </div>
        </motion.div>
      </div>
    );
  }

  /* Add Candidate Modal */
  function CandidateModal() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const handle = async () => {
      if (!name.trim()) return;
      setSaving(true);
      try {
        await axios.post(`${API}/teams/${selectedTeam.id}/candidates`, { name, email, notes }, { withCredentials: true });
        fetchTeamDetail(selectedTeam.id); setShowCandidate(false);
      } catch (err) { console.error(err); } finally { setSaving(false); }
    };
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#0c0c0c] border border-white/[0.06] rounded-2xl p-6 w-full max-w-md">
          <div className="flex justify-between mb-5"><h2 className="text-white font-bold text-lg" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Add Candidate</h2><button onClick={() => setShowCandidate(false)} className="text-white/30 hover:text-white"><X className="w-5 h-5" /></button></div>
          <div className="space-y-4">
            <input data-testid="candidate-name-input" value={name} onChange={e => setName(e.target.value)} placeholder="Candidate name"
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-indigo-500/50" />
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (optional)"
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-indigo-500/50" />
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-indigo-500/50" />
            <button data-testid="add-candidate-button" onClick={handle} disabled={saving || !name.trim()} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-all disabled:opacity-40 text-sm">{saving ? 'Adding...' : 'Add Candidate'}</button>
          </div>
        </motion.div>
      </div>
    );
  }

  /* Share Analysis Modal */
  function ShareModal() {
    const [selectedAnalysis, setSelectedAnalysis] = useState('');
    const [selectedCandidate, setSelectedCandidate] = useState('');
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState(null);
    useEffect(() => { fetchAnalyses(); }, []);
    const candidates = selectedTeam?.candidates || [];
    const handle = async () => {
      if (!selectedAnalysis) return;
      setSaving(true);
      try {
        const { data } = await axios.post(`${API}/teams/${selectedTeam.id}/share-analysis`, { analysis_id: selectedAnalysis, candidate_id: selectedCandidate }, { withCredentials: true });
        setResult(data); fetchTeamDetail(selectedTeam.id);
      } catch (err) { console.error(err); } finally { setSaving(false); }
    };
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#0c0c0c] border border-white/[0.06] rounded-2xl p-6 w-full max-w-md">
          <div className="flex justify-between mb-5"><h2 className="text-white font-bold text-lg" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Share Analysis</h2><button onClick={() => setShowShare(false)} className="text-white/30 hover:text-white"><X className="w-5 h-5" /></button></div>
          {result ? (
            <div className="text-center py-4">
              {result.passes_threshold ? <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" /> : <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-3" />}
              <p className="text-white font-medium">Score: {result.ats_score}/100</p>
              {result.threshold > 0 && <p className={`text-sm mt-1 ${result.passes_threshold ? 'text-emerald-400' : 'text-yellow-400'}`}>{result.passes_threshold ? 'Passes' : 'Below'} threshold ({result.threshold})</p>}
              <button onClick={() => setShowShare(false)} className="mt-4 text-indigo-400 text-sm">Close</button>
            </div>
          ) : (
            <div className="space-y-4">
              <select data-testid="share-analysis-select" value={selectedAnalysis} onChange={e => setSelectedAnalysis(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500/50 appearance-none">
                <option value="">Select analysis...</option>
                {analyses.map(a => <option key={a.id} value={a.id}>{`${a.filename} - ${a.job_role_title} (${a.ats_score})`}</option>)}
              </select>
              {candidates.length > 0 && (
                <select value={selectedCandidate} onChange={e => setSelectedCandidate(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500/50 appearance-none">
                  <option value="">Assign to candidate (optional)...</option>
                  {candidates.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <button data-testid="share-analysis-button" onClick={handle} disabled={saving || !selectedAnalysis} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-all disabled:opacity-40 text-sm">{saving ? 'Sharing...' : 'Share to Team'}</button>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  /* Leaderboard Section Component */
  function LeaderboardSection({ teamId }) {
    const [leaderboard, setLeaderboard] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      if (!teamId) return;
      const fetch = async () => {
        setLoading(true);
        try {
          const { data } = await axios.get(`${API}/teams/${teamId}/leaderboard`, { withCredentials: true });
          setLeaderboard(data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
      };
      fetch();
    }, [teamId]);

    if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-indigo-500 animate-spin" /></div>;
    if (!leaderboard || leaderboard.leaderboard.filter(c => c.best_score > 0).length === 0) return null;

    const ranked = leaderboard.leaderboard.filter(c => c.best_score > 0);
    const medalColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];
    const medalBgs = ['bg-yellow-400/10 border-yellow-400/20', 'bg-gray-300/10 border-gray-300/20', 'bg-amber-600/10 border-amber-600/20'];

    return (
      <div className="bg-[#0c0c0c] border border-white/[0.06] rounded-xl p-5" data-testid="leaderboard-section">
        <h3 className="text-white font-medium text-sm mb-4 flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          <Trophy className="w-4 h-4 text-yellow-400" /> Candidate Ranking
        </h3>
        <div className="space-y-2">
          {ranked.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-4 px-4 py-3 rounded-xl ${i < 3 ? `border ${medalBgs[i]}` : 'bg-white/[0.02]'} transition-all hover:bg-white/[0.04]`}
              data-testid={`leaderboard-rank-${c.rank}`}
            >
              {/* Rank */}
              <div className="w-8 text-center shrink-0">
                {i === 0 && <Trophy className="w-5 h-5 text-yellow-400 mx-auto" />}
                {i === 1 && <Award className="w-5 h-5 text-gray-300 mx-auto" />}
                {i === 2 && <Medal className="w-5 h-5 text-amber-600 mx-auto" />}
                {i >= 3 && <span className="text-white/30 text-sm font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>#{c.rank}</span>}
              </div>

              {/* Avatar */}
              <div className={`w-9 h-9 rounded-xl ${i < 3 ? 'bg-indigo-600/30' : 'bg-white/5'} flex items-center justify-center shrink-0`}>
                <span className={`text-sm font-bold ${i < 3 ? 'text-indigo-300' : 'text-white/40'}`}>{c.name?.[0]?.toUpperCase()}</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium text-sm">{c.name}</div>
                <div className="text-white/30 text-[10px]">{c.total_analyses} analyses &middot; {c.best_role || 'N/A'}</div>
              </div>

              {/* Score */}
              <div className="text-right shrink-0">
                <div className={`text-xl font-bold ${c.best_score >= 75 ? 'text-emerald-400' : c.best_score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}>{c.best_score}</div>
                <div className="text-white/25 text-[10px]">avg {c.avg_score}</div>
              </div>

              {/* Pass/Fail Badge */}
              <div className="shrink-0">
                {c.passes_threshold ? (
                  <div className="bg-emerald-500/15 border border-emerald-500/20 rounded-lg px-2 py-1 text-emerald-400 text-[10px] font-medium flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Pass
                  </div>
                ) : (
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1 text-white/30 text-[10px] font-medium">
                    --
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  const removeMember = async (email) => {
    try { await axios.delete(`${API}/teams/${selectedTeam.id}/members/${email}`, { withCredentials: true }); fetchTeamDetail(selectedTeam.id); } catch (err) { console.error(err); }
  };

  const removeCandidate = async (id) => {
    try { await axios.delete(`${API}/teams/${selectedTeam.id}/candidates/${id}`, { withCredentials: true }); fetchTeamDetail(selectedTeam.id); } catch (err) { console.error(err); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-indigo-500 animate-spin" /></div>;

  if (teams.length === 0) {
    return (
      <div className="space-y-6" data-testid="teams-empty">
        <div className="bg-[#0c0c0c] border border-white/[0.06] rounded-2xl p-12 text-center">
          <Users className="w-12 h-12 text-white/15 mx-auto mb-4" />
          <h2 className="text-white font-bold text-xl mb-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>No teams yet</h2>
          <p className="text-white/40 text-sm mb-6 max-w-sm mx-auto">Create a team workspace to share analyses, track candidates, and set ATS score thresholds.</p>
          <button data-testid="create-first-team" onClick={() => setShowCreate(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-6 rounded-xl transition-all inline-flex items-center gap-2 text-sm shadow-lg shadow-indigo-600/20">
            <Plus className="w-4 h-4" /> Create Your First Team
          </button>
        </div>
        <AnimatePresence>{showCreate && <CreateTeamModal />}</AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="teams-page">
      {/* Team Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <select value={selectedTeam?.id || ''} onChange={e => { const t = teams.find(t => t.id === e.target.value); setSelectedTeam(t); }}
            className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500/50 appearance-none">
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button onClick={() => setShowCreate(true)} className="text-indigo-400 hover:text-indigo-300 transition-colors"><Plus className="w-5 h-5" /></button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowShare(true)} data-testid="share-to-team-button" className="bg-indigo-600/15 text-indigo-400 text-xs py-2 px-3 rounded-lg hover:bg-indigo-600/25 transition-colors flex items-center gap-1.5 border border-indigo-500/20"><ClipboardList className="w-3.5 h-3.5" /> Share Analysis</button>
          <button onClick={() => setShowCandidate(true)} data-testid="add-candidate-trigger" className="bg-emerald-600/15 text-emerald-400 text-xs py-2 px-3 rounded-lg hover:bg-emerald-600/25 transition-colors flex items-center gap-1.5 border border-emerald-500/20"><UserPlus className="w-3.5 h-3.5" /> Add Candidate</button>
          <button onClick={() => setShowInvite(true)} className="bg-white/5 text-white/60 text-xs py-2 px-3 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1.5 border border-white/[0.06]"><Mail className="w-3.5 h-3.5" /> Invite</button>
          <button onClick={() => setShowThreshold(true)} className="bg-white/5 text-white/60 text-xs py-2 px-3 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1.5 border border-white/[0.06]"><Target className="w-3.5 h-3.5" /> Thresholds</button>
        </div>
      </div>

      {/* Stats */}
      {teamStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Shared Analyses', value: teamStats.total_shared, icon: BarChart3, color: 'text-indigo-400' },
            { label: 'Avg Score', value: teamStats.average_score, icon: Target, color: teamStats.average_score >= 60 ? 'text-emerald-400' : 'text-yellow-400' },
            { label: 'Members', value: teamStats.member_count, icon: Users, color: 'text-blue-400' },
            { label: 'Candidates', value: teamStats.candidate_count, icon: UserPlus, color: 'text-purple-400' },
          ].map(s => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-[#0c0c0c] border border-white/[0.06] rounded-xl p-4 hover:border-white/10 transition-all">
              <s.icon className={`w-4 h-4 ${s.color} mb-2`} />
              <div className={`text-2xl font-bold ${s.color}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</div>
              <div className="text-white/35 text-xs mt-0.5">{s.label}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Thresholds */}
      {selectedTeam?.thresholds && Object.keys(selectedTeam.thresholds).length > 0 && (
        <div className="bg-[#0c0c0c] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-white/60 text-xs uppercase tracking-wider mb-3 font-medium">ATS Score Thresholds</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(selectedTeam.thresholds).map(([role, score]) => (
              <div key={role} className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-1.5 flex items-center gap-2">
                <span className="text-white/60 text-xs">{role.replace(/_/g, ' ')}</span>
                <span className="text-indigo-400 text-xs font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{`>=${score}`}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members & Candidates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#0c0c0c] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-white font-medium text-sm mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-indigo-400" /> Members ({selectedTeam?.members?.length || 0})</h3>
          <div className="space-y-2">
            {(selectedTeam?.members || []).map(m => (
              <div key={m.email} className="flex items-center justify-between py-1.5 group">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600/20 flex items-center justify-center text-indigo-400 text-xs font-bold">{m.name?.[0]?.toUpperCase() || m.email?.[0]?.toUpperCase()}</div>
                  <div><div className="text-white/80 text-sm">{m.name || m.email}</div><div className="text-white/30 text-[10px]">{m.role}</div></div>
                </div>
                {m.role !== 'owner' && <button onClick={() => removeMember(m.email)} className="text-red-400/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>}
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[#0c0c0c] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-white font-medium text-sm mb-3 flex items-center gap-2"><UserPlus className="w-4 h-4 text-emerald-400" /> Candidates ({selectedTeam?.candidates?.length || 0})</h3>
          {(selectedTeam?.candidates || []).length === 0 ? (
            <p className="text-white/30 text-sm py-4 text-center">No candidates yet</p>
          ) : (
            <div className="space-y-2">
              {(selectedTeam?.candidates || []).map(c => (
                <div key={c.id} className="flex items-center justify-between py-1.5 group">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-600/20 flex items-center justify-center text-emerald-400 text-xs font-bold">{c.name?.[0]?.toUpperCase()}</div>
                    <div><div className="text-white/80 text-sm">{c.name}</div><div className="text-white/30 text-[10px]">{c.analysis_ids?.length || 0} analyses</div></div>
                  </div>
                  <button onClick={() => removeCandidate(c.id)} className="text-red-400/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Shared Analyses */}
      {selectedTeam?.shared_analyses?.length > 0 && (
        <div className="bg-[#0c0c0c] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-white font-medium text-sm mb-3 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-indigo-400" /> Shared Analyses</h3>
          <div className="space-y-2">
            {selectedTeam.shared_analyses.map(sa => {
              const threshold = selectedTeam.thresholds?.[sa.job_role_title?.toLowerCase().replace(/ /g, '_')] || 0;
              const passes = threshold > 0 ? sa.ats_score >= threshold : null;
              return (
                <div key={sa.id} className="flex items-center justify-between bg-white/[0.02] rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`text-xl font-bold ${sa.ats_score >= 75 ? 'text-emerald-400' : sa.ats_score >= 50 ? 'text-yellow-400' : 'text-red-400'}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>{sa.ats_score}</div>
                    <div><div className="text-white/80 text-sm">{sa.filename}</div><div className="text-white/30 text-[10px]">{sa.job_role_title} &middot; by {sa.shared_by_name}</div></div>
                  </div>
                  <div className="flex items-center gap-2">
                    {passes !== null && (passes ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-yellow-400" />)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Candidate Ranking Leaderboard */}
      <LeaderboardSection teamId={selectedTeam?.id} />

      {/* Modals */}
      <AnimatePresence>
        {showCreate && <CreateTeamModal />}
        {showInvite && <InviteModal />}
        {showThreshold && <ThresholdModal />}
        {showCandidate && <CandidateModal />}
        {showShare && <ShareModal />}
      </AnimatePresence>
    </div>
  );
}
