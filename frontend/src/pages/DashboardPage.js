import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileSearch, Upload, BarChart3, TrendingUp, Clock, LogOut, Plus, Trash2,
  Eye, Target, Download, Sparkles, GitCompareArrows, X, ChevronDown, ChevronUp, Loader2, Settings
} from 'lucide-react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell
} from 'recharts';
import { Suspense } from 'react';
import { ScoreOrb } from '../components/Scene3D';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/* ─── Score Ring Component ─── */
function ScoreDisplay({ score, size = "lg" }) {
  const [displayScore, setDisplayScore] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = score;
    if (end <= 0) return;
    const stepTime = Math.max(1500 / end, 10);
    const timer = setInterval(() => {
      start += 1;
      setDisplayScore(start);
      if (start >= end) clearInterval(timer);
    }, stepTime);
    return () => clearInterval(timer);
  }, [score]);
  const color = score < 50 ? 'text-red-400' : score < 75 ? 'text-yellow-400' : 'text-emerald-400';
  const ringColor = score < 50 ? '#EF4444' : score < 75 ? '#F59E0B' : '#10B981';
  const sizeClass = size === "lg" ? "w-40 h-40" : "w-24 h-24";
  const textClass = size === "lg" ? "text-5xl" : "text-2xl";
  const radius = size === "lg" ? 54 : 32;
  const svgSize = size === "lg" ? 140 : 80;
  const circum = 2 * Math.PI * radius;
  const prog = (displayScore / 100) * circum;
  return (
    <div className={`relative ${sizeClass} flex items-center justify-center`}>
      <svg className="absolute inset-0" viewBox={`0 0 ${svgSize} ${svgSize}`}>
        <circle cx={svgSize / 2} cy={svgSize / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={size === "lg" ? 8 : 5} />
        <circle cx={svgSize / 2} cy={svgSize / 2} r={radius} fill="none" stroke={ringColor} strokeWidth={size === "lg" ? 8 : 5}
          strokeDasharray={circum} strokeDashoffset={circum - prog} strokeLinecap="round"
          transform={`rotate(-90 ${svgSize / 2} ${svgSize / 2})`} style={{ transition: 'stroke-dashoffset 1.5s ease-out' }} />
      </svg>
      <span className={`${textClass} text-white font-bold`} style={{ fontFamily: "'JetBrains Mono', monospace" }} data-testid="ats-score-display">{displayScore}</span>
    </div>
  );
}

/* ─── Analysis Card ─── */
function AnalysisCard({ analysis, onView, onDelete, isCompareMode, isSelected, onToggleCompare }) {
  const scoreColor = analysis.ats_score < 50 ? 'text-red-400' : analysis.ats_score < 75 ? 'text-yellow-400' : 'text-emerald-400';
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={`bg-[#0c0c0c] border rounded-xl p-5 transition-all group cursor-pointer ${isSelected ? 'border-indigo-500 ring-1 ring-indigo-500/20' : 'border-white/[0.06] hover:border-white/10'}`}
      onClick={isCompareMode ? onToggleCompare : undefined}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          {isCompareMode && (
            <div className={`w-5 h-5 rounded border mb-2 flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-white/20'}`}>
              {isSelected && <span className="text-white text-xs">&#10003;</span>}
            </div>
          )}
          <h3 className="text-white font-medium text-sm truncate">{analysis.filename}</h3>
          <p className="text-white/40 text-xs mt-0.5">{analysis.job_role_title}</p>
        </div>
        <span className="text-white text-2xl font-bold ml-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{analysis.ats_score}</span>
      </div>
      <div className="flex gap-3 mt-3">
        {[
          { label: 'Skills', val: analysis.score_breakdown?.skill_match, color: 'text-emerald-400' },
          { label: 'Keywords', val: analysis.score_breakdown?.keyword_match, color: 'text-indigo-400' },
          { label: 'Quality', val: analysis.score_breakdown?.resume_quality, color: 'text-yellow-400' },
        ].map(m => (
          <div key={m.label} className="flex-1 bg-[#1A1A1A] rounded px-2.5 py-1.5 text-center">
            <div className="text-white/40 text-[10px] uppercase tracking-wider">{m.label}</div>
            <div className="text-white text-sm font-medium">{m.val || 0}%</div>
          </div>
        ))}
      </div>
      {!isCompareMode && (
        <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); onView(analysis); }} className="flex-1 bg-indigo-600/20 text-indigo-400 text-xs py-1.5 rounded hover:bg-indigo-600/30 transition-colors flex items-center justify-center gap-1" data-testid={`view-analysis-${analysis.id}`}><Eye className="w-3 h-3" /> View</button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(analysis.id); }} className="bg-red-500/10 text-red-400 text-xs py-1.5 px-3 rounded hover:bg-red-500/20 transition-colors" data-testid={`delete-analysis-${analysis.id}`}><Trash2 className="w-3 h-3" /></button>
        </div>
      )}
      <div className="text-white/30 text-[10px] mt-2">{new Date(analysis.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
    </motion.div>
  );
}

/* ─── AI Suggestions Panel ─── */
function AISuggestionsPanel({ analysisId }) {
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(true);

  const fetchSuggestions = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post(`${API}/analyses/${analysisId}/suggestions`, {}, { withCredentials: true });
      setSuggestions(data.suggestions);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate suggestions');
    } finally {
      setLoading(false);
    }
  };

  const renderMarkdown = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, i) => {
      if (line.startsWith('## ')) return <h3 key={i} className="text-white font-semibold text-sm mt-4 mb-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{line.replace('## ', '')}</h3>;
      if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="text-white/80 font-medium text-sm mt-2">{line.replace(/\*\*/g, '')}</p>;
      if (line.match(/^\d+\.\s/)) return <p key={i} className="text-white/70 text-sm pl-4 py-0.5">{line}</p>;
      if (line.startsWith('- ') || line.startsWith('* ')) return <p key={i} className="text-white/70 text-sm pl-4 py-0.5">&bull; {line.replace(/^[-*]\s/, '')}</p>;
      if (line.trim() === '') return <div key={i} className="h-1" />;
      return <p key={i} className="text-white/60 text-sm py-0.5">{line}</p>;
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-[#0c0c0c] border border-white/[0.06] rounded-2xl overflow-hidden" data-testid="ai-suggestions-section">
      <div className="p-6 pb-3 flex items-center justify-between">
        <h3 className="text-white font-medium text-sm flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          <Sparkles className="w-4 h-4 text-amber-400" />AI Resume Improvement Suggestions
        </h3>
        <div className="flex items-center gap-2">
          {suggestions && <button onClick={() => setExpanded(!expanded)} className="text-white/40 hover:text-white transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>}
        </div>
      </div>
      <div className="px-6 pb-6">
        {!suggestions && !loading && (
          <button data-testid="generate-suggestions-button" onClick={fetchSuggestions}
            className="w-full bg-gradient-to-r from-amber-600/15 to-orange-600/15 border border-amber-500/20 text-amber-300 py-3.5 rounded-xl hover:from-amber-600/25 hover:to-orange-600/25 transition-all flex items-center justify-center gap-2 text-sm font-medium active:scale-[0.98]">
            <Sparkles className="w-4 h-4" /> Generate AI Suggestions
          </button>
        )}
        {loading && (
          <div className="flex items-center justify-center py-8 gap-3">
            <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
            <span className="text-white/50 text-sm">Analyzing your resume and generating personalized suggestions...</span>
          </div>
        )}
        {error && <div className="bg-red-500/8 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>}
        {suggestions && expanded && (
          <div className="mt-2 max-h-[500px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
            {renderMarkdown(suggestions)}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Comparison View ─── */
function ComparisonView({ comparison, onClose }) {
  const analyses = comparison.analyses || [];
  const maxScore = Math.max(...analyses.map(a => a.ats_score));
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6" data-testid="comparison-view">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-lg tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          <GitCompareArrows className="w-5 h-5 inline mr-2 text-indigo-400" />Resume Comparison
        </h2>
        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors" data-testid="close-comparison"><X className="w-5 h-5" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {analyses.map(a => (
          <div key={a.id} className={`bg-[#111111] border rounded-lg p-5 ${a.id === comparison.best_overall ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : 'border-white/10'}`}>
            {a.id === comparison.best_overall && <div className="text-emerald-400 text-[10px] uppercase tracking-wider font-medium mb-2">Best Overall</div>}
            <h3 className="text-white text-sm font-medium truncate">{a.filename}</h3>
            <p className="text-white/40 text-xs">{a.job_role_title}</p>
            <div className="mt-3 flex items-center gap-4">
              <ScoreDisplay score={a.ats_score} size="sm" />
              <div className="flex-1 space-y-1.5">
                {[
                  { label: 'Skills', val: a.score_breakdown?.skill_match, color: '#10B981' },
                  { label: 'Keywords', val: a.score_breakdown?.keyword_match, color: '#6366F1' },
                  { label: 'Quality', val: a.score_breakdown?.resume_quality, color: '#F59E0B' },
                  { label: 'Projects', val: a.score_breakdown?.project_relevance, color: '#EC4899' },
                ].map(m => (
                  <div key={m.label} className="flex items-center gap-2">
                    <span className="text-white/40 text-[10px] w-14">{m.label}</span>
                    <div className="flex-1 bg-white/5 rounded-full h-1.5"><div className="h-full rounded-full" style={{ width: `${m.val || 0}%`, backgroundColor: m.color, transition: 'width 1s' }} /></div>
                    <span className="text-white/60 text-[10px] w-8 text-right">{m.val || 0}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 mt-3 text-[10px]">
              <span className="text-emerald-400/60">{a.matched_count} matched</span>
              <span className="text-white/20">|</span>
              <span className="text-red-400/60">{a.missing_count} missing</span>
            </div>
          </div>
        ))}
      </div>
      {comparison.common_matched_skills?.length > 0 && (
        <div className="bg-[#0c0c0c] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-white text-sm font-medium mb-2">Common Matched Skills</h3>
          <div className="flex flex-wrap gap-1.5">{comparison.common_matched_skills.map(s => <span key={s} className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-0.5 rounded">{s}</span>)}</div>
        </div>
      )}
      {comparison.common_missing_skills?.length > 0 && (
        <div className="bg-[#0c0c0c] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-white text-sm font-medium mb-2">Common Missing Skills</h3>
          <div className="flex flex-wrap gap-1.5">{comparison.common_missing_skills.map(s => <span key={s} className="bg-red-500/10 text-red-400 text-xs px-2 py-0.5 rounded">{s}</span>)}</div>
        </div>
      )}
    </motion.div>
  );
}

/* ─── Custom Role Modal ─── */
function CustomRoleModal({ onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [categories, setCategories] = useState([{ name: 'core', skills: '' }]);
  const [keywords, setKeywords] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addCategory = () => setCategories([...categories, { name: '', skills: '' }]);
  const removeCategory = (i) => setCategories(categories.filter((_, idx) => idx !== i));
  const updateCategory = (i, field, val) => { const c = [...categories]; c[i][field] = val; setCategories(c); };

  const handleCreate = async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    const skills = {};
    for (const cat of categories) {
      if (!cat.name.trim() || !cat.skills.trim()) continue;
      skills[cat.name.trim().toLowerCase()] = cat.skills.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    }
    if (Object.keys(skills).length === 0) { setError('Add at least one category with skills'); return; }
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.post(`${API}/job-roles/custom`, {
        title: title.trim(),
        skills,
        keywords: keywords.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
      }, { withCredentials: true });
      onCreated(data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create role');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" data-testid="custom-role-modal">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#0c0c0c] border border-white/[0.06] rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-lg" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Create Custom Role</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        {error && <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3 mb-4 text-red-400 text-sm">{error}</div>}
        <div className="space-y-4">
          <div>
            <label className="text-white/60 text-xs block mb-1">Role Title</label>
            <input data-testid="custom-role-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. DevOps Engineer"
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-white/50 text-xs uppercase tracking-wider font-medium">Skill Categories</label>
              <button onClick={addCategory} className="text-indigo-400 text-xs hover:text-indigo-300 flex items-center gap-1"><Plus className="w-3 h-3" /> Add Category</button>
            </div>
            {categories.map((cat, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input value={cat.name} onChange={e => updateCategory(i, 'name', e.target.value)} placeholder="Category name"
                  className="w-28 bg-[#1A1A1A] border border-white/10 rounded-md px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-indigo-500" />
                <input value={cat.skills} onChange={e => updateCategory(i, 'skills', e.target.value)} placeholder="skill1, skill2, skill3"
                  className="flex-1 bg-[#1A1A1A] border border-white/10 rounded-md px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-indigo-500" />
                {categories.length > 1 && <button onClick={() => removeCategory(i)} className="text-red-400/60 hover:text-red-400"><X className="w-4 h-4" /></button>}
              </div>
            ))}
          </div>
          <div>
            <label className="text-white/60 text-xs block mb-1">Keywords (comma separated, optional)</label>
            <input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="keyword1, keyword2, keyword3"
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-md px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 text-sm" />
          </div>
          <button data-testid="create-custom-role-button" onClick={handleCreate} disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-md transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : 'Create Role'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Results View ─── */
function ResultsView({ analysis, onBack }) {
  const breakdownData = [
    { name: 'Skill Match', value: analysis.score_breakdown.skill_match, weight: '50%', fill: '#10B981' },
    { name: 'Keywords', value: analysis.score_breakdown.keyword_match, weight: '20%', fill: '#6366F1' },
    { name: 'Quality', value: analysis.score_breakdown.resume_quality, weight: '15%', fill: '#F59E0B' },
    { name: 'Projects', value: analysis.score_breakdown.project_relevance, weight: '15%', fill: '#EC4899' },
  ];
  const categorySkills = {};
  (analysis.matched_skills || []).forEach(s => {
    if (!categorySkills[s.category]) categorySkills[s.category] = { matched: 0, missing: 0 };
    categorySkills[s.category].matched += 1;
  });
  (analysis.missing_skills || []).forEach(s => {
    if (!categorySkills[s.category]) categorySkills[s.category] = { matched: 0, missing: 0 };
    categorySkills[s.category].missing += 1;
  });
  const radarData = Object.entries(categorySkills).map(([cat, data]) => ({
    category: cat.charAt(0).toUpperCase() + cat.slice(1),
    score: Math.round((data.matched / (data.matched + data.missing)) * 100)
  }));

  const handleExport = async () => {
    try {
      const response = await axios.get(`${API}/analyses/${analysis.id}/export`, { withCredentials: true, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `skillscope_report_${analysis.id.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  return (
    <div data-testid="results-view" className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-white/60 hover:text-white text-sm flex items-center gap-1 transition-colors" data-testid="back-to-dashboard">&larr; Back to Dashboard</button>
        <div className="flex items-center gap-3">
          <span className="text-white/30 text-xs">{analysis.filename}</span>
          <button onClick={handleExport} data-testid="export-pdf-button"
            className="bg-indigo-600/20 text-indigo-400 text-xs py-1.5 px-3 rounded hover:bg-indigo-600/30 transition-colors flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
        </div>
      </div>

      {/* Score + Breakdown Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#0c0c0c] border border-white/[0.06] rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
            <ScoreOrb score={analysis.ats_score} size={180} />
          </div>
          <div className="relative z-10">
            <div className="text-white/40 text-xs uppercase tracking-[0.2em] mb-4 text-center">ATS Score</div>
            <ScoreDisplay score={analysis.ats_score} size="lg" />
            <div className="text-white/50 text-sm mt-3 text-center">{analysis.job_role_title}</div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="md:col-span-2 bg-[#0c0c0c] border border-white/[0.06] rounded-2xl p-6">
          <h3 className="text-white font-medium text-sm mb-4 tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Score Breakdown</h3>
          <div style={{ width: '100%', minWidth: 200, height: 192 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={breakdownData} layout="vertical" barSize={20}>
                <XAxis type="number" domain={[0, 100]} tick={{ fill: '#fff', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#fff', fontSize: 12 }} axisLine={false} tickLine={false} width={90} />
                <Tooltip 
                  contentStyle={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 12 }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>{breakdownData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-2">
            {breakdownData.map(b => (
              <div key={b.name} className="text-[10px] text-white/40"><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: b.fill }} />{b.name} ({b.weight})</div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Skills Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-[#0c0c0c] border border-white/[0.06] rounded-2xl p-6">
          <h3 className="text-white font-medium text-sm mb-4" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Skills by Category</h3>
          {radarData.length > 0 && (
            <div style={{ width: '100%', minWidth: 200, height: 224 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="category" tick={{ fill: '#A1A1AA', fontSize: 10 }} />
                  <Radar name="Score" dataKey="score" stroke="#6366F1" fill="#6366F1" fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-[#0c0c0c] border border-white/[0.06] rounded-2xl p-6">
          <h3 className="text-white font-medium text-sm mb-3" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Skills Overview</h3>
          <div className="flex gap-4 mb-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded px-3 py-2 flex-1 text-center">
              <div className="text-white text-xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{analysis.matched_skills?.length || 0}</div>
              <div className="text-white/60 text-[10px] uppercase tracking-wider">Matched</div>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded px-3 py-2 flex-1 text-center">
              <div className="text-white text-xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{analysis.missing_skills?.length || 0}</div>
              <div className="text-white/60 text-[10px] uppercase tracking-wider">Missing</div>
            </div>
          </div>
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
            {(analysis.matched_skills || []).slice(0, 10).map(s => (
              <div key={s.skill} className="flex items-center gap-2 text-xs"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" /><span className="text-white/80">{s.skill}</span><span className="text-white/30 text-[10px] ml-auto">{s.category}</span></div>
            ))}
            {(analysis.missing_skills || []).slice(0, 10).map(s => (
              <div key={s.skill} className="flex items-center gap-2 text-xs"><div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" /><span className="text-white/50">{s.skill}</span><span className="text-white/30 text-[10px] ml-auto">{s.category}</span></div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Gap Analysis */}
      {analysis.gaps?.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-[#0c0c0c] border border-white/[0.06] rounded-2xl p-6" data-testid="gap-analysis-section">
          <h3 className="text-white font-medium text-sm mb-4" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}><Target className="w-4 h-4 inline mr-2 text-indigo-400" />Skill Gap Analysis</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {['high', 'medium', 'low'].map(priority => {
              const items = analysis.gaps.filter(g => g.priority === priority);
              if (!items.length) return null;
              const c = { high: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', dot: 'bg-red-400' }, medium: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-400', dot: 'bg-yellow-400' }, low: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-400' } }[priority];
              return (
                <div key={priority} className={`${c.bg} border ${c.border} rounded-lg p-4`}>
                  <div className={`${c.text} text-xs uppercase tracking-[0.15em] font-medium mb-2`}>{priority} Priority ({items.length})</div>
                  <div className="space-y-1 max-h-40 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                    {items.map(g => <div key={g.skill} className="flex items-center gap-1.5 text-xs"><div className={`w-1 h-1 rounded-full ${c.dot} shrink-0`} /><span className="text-white/70">{g.skill}</span></div>)}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* AI Suggestions */}
      <AISuggestionsPanel analysisId={analysis.id} />

      {/* Roadmap */}
      {analysis.roadmap?.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="bg-[#0c0c0c] border border-white/[0.06] rounded-2xl p-6" data-testid="roadmap-section">
          <h3 className="text-white font-medium text-sm mb-4" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}><TrendingUp className="w-4 h-4 inline mr-2 text-emerald-400" />Learning Roadmap</h3>
          <div className="space-y-4">
            {analysis.roadmap.map(phase => (
              <div key={phase.phase} className={`border-l-2 ${({ high: 'border-l-red-500', medium: 'border-l-yellow-500', low: 'border-l-blue-500' })[phase.priority] || 'border-l-white/20'} pl-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-white/5 text-white/60 text-[10px] px-2 py-0.5 rounded font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Phase {phase.phase}</span>
                  <span className="text-white/80 text-sm font-medium">{phase.title}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {phase.items.map(item => (
                    <div key={item.skill} className="bg-[#1A1A1A] rounded p-3 hover:bg-[#222] transition-colors">
                      <div className="text-white/80 text-sm font-medium">{item.skill}</div>
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 text-xs hover:text-indigo-300 transition-colors block mt-1 truncate">{item.resource}</a>
                      <div className="text-white/30 text-[10px] mt-1 flex items-center gap-1"><Clock className="w-3 h-3" /> {item.estimated_duration}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* ─── Main Dashboard Page ─── */
export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState('dashboard');
  const [analyses, setAnalyses] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [jobRoles, setJobRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  // Compare state
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [comparing, setComparing] = useState(false);
  // Custom role modal
  const [showRoleModal, setShowRoleModal] = useState(false);
  // Drag and drop
  const [dragOver, setDragOver] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [analysesRes, statsRes, rolesRes] = await Promise.all([
        axios.get(`${API}/analyses`, { withCredentials: true }),
        axios.get(`${API}/dashboard/stats`, { withCredentials: true }),
        axios.get(`${API}/job-roles`, { withCredentials: true })
      ]);
      setAnalyses(analysesRes.data);
      setStats(statsRes.data);
      setJobRoles(rolesRes.data);
      if (rolesRes.data.length > 0 && !selectedRole) setSelectedRole(rolesRes.data[0].key);
    } catch (err) { console.error('Failed to fetch data', err); }
    finally { setLoadingData(false); }
  }, [selectedRole]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpload = async () => {
    if (!uploadFile || !selectedRole) return;
    setUploading(true); setUploadError('');
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('job_role', selectedRole);
    try {
      const { data } = await axios.post(`${API}/analyze`, formData, { withCredentials: true, headers: { 'Content-Type': 'multipart/form-data' } });
      setSelectedAnalysis(data); setView('results'); setUploadFile(null); fetchData();
    } catch (err) {
      setUploadError(typeof err.response?.data?.detail === 'string' ? err.response.data.detail : 'Upload failed.');
    } finally { setUploading(false); }
  };

  const handleDelete = async (id) => {
    try { await axios.delete(`${API}/analyses/${id}`, { withCredentials: true }); setAnalyses(prev => prev.filter(a => a.id !== id)); fetchData(); } catch (err) { console.error('Delete failed', err); }
  };

  const handleDeleteCustomRole = async (roleId) => {
    try { await axios.delete(`${API}/job-roles/custom/${roleId}`, { withCredentials: true }); fetchData(); } catch (err) { console.error('Delete role failed', err); }
  };

  const toggleCompareId = (id) => {
    setCompareIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 5 ? [...prev, id] : prev);
  };

  const handleCompare = async () => {
    if (compareIds.length < 2) return;
    setComparing(true);
    try {
      const { data } = await axios.post(`${API}/compare`, { analysis_ids: compareIds }, { withCredentials: true });
      setComparison(data); setView('comparison');
    } catch (err) { console.error('Comparison failed', err); }
    finally { setComparing(false); }
  };

  const handleLogout = async () => { await logout(); navigate('/login'); };

  /* Results View */
  if (view === 'results' && selectedAnalysis) {
    return <ResultsView analysis={selectedAnalysis} onBack={() => { setView('dashboard'); setSelectedAnalysis(null); }} />;
  }

  /* Comparison View */
  if (view === 'comparison' && comparison) {
    return <ComparisonView comparison={comparison} onClose={() => { setView('dashboard'); setComparison(null); setIsCompareMode(false); setCompareIds([]); }} />;
  }

  /* Dashboard View */
  return (
    <div data-testid="dashboard-page" className="space-y-8">
      {/* Upload Section */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-[#0c0c0c] border border-white/[0.06] rounded-2xl p-6" data-testid="upload-section">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-xl tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            <Upload className="w-5 h-5 inline mr-2 text-indigo-400" />Analyze Resume
          </h2>
          <button onClick={() => setShowRoleModal(true)} data-testid="create-custom-role-trigger"
            className="text-indigo-400 text-xs hover:text-indigo-300 flex items-center gap-1.5 bg-indigo-600/10 px-3 py-2 rounded-lg border border-indigo-500/20 hover:border-indigo-500/40 transition-all">
            <Settings className="w-3.5 h-3.5" /> Custom Role
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-white/50 text-xs mb-2 block uppercase tracking-wider font-medium">Target Role</label>
            <select data-testid="job-role-select" value={selectedRole} onChange={e => setSelectedRole(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-colors appearance-none">
              {jobRoles.map(r => (
                <option key={r.key} value={r.key}>{`${r.title} (${r.total_skills} skills)${r.is_custom ? ' *' : ''}`}</option>
              ))}
            </select>
            {jobRoles.find(r => r.key === selectedRole && r.is_custom) && (
              <button onClick={() => handleDeleteCustomRole(jobRoles.find(r => r.key === selectedRole)?.id)}
                className="text-red-400/50 text-[10px] mt-1.5 hover:text-red-400 transition-colors flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> Delete custom role
              </button>
            )}
          </div>
          <div>
            <label className="text-white/50 text-xs mb-2 block uppercase tracking-wider font-medium">Resume (PDF)</label>
            <label className={`drop-zone flex items-center gap-2 w-full bg-white/[0.02] border-2 border-dashed border-white/[0.08] rounded-xl px-4 py-3 text-white/40 cursor-pointer hover:border-indigo-500/40 hover:bg-indigo-500/[0.02] transition-all ${dragOver ? 'dragover' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) setUploadFile(e.dataTransfer.files[0]); }}>
              <Upload className="w-4 h-4 shrink-0" /><span className="text-sm truncate">{uploadFile ? uploadFile.name : 'Drop PDF or click to browse'}</span>
              <input data-testid="resume-file-input" type="file" accept=".pdf" onChange={e => setUploadFile(e.target.files[0])} className="hidden" />
            </label>
          </div>
          <div className="flex items-end">
            <button data-testid="analyze-button" onClick={handleUpload} disabled={!uploadFile || uploading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/30">
              {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><BarChart3 className="w-4 h-4" /> Analyze</>}
            </button>
          </div>
        </div>
        {uploadError && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} data-testid="upload-error" className="bg-red-500/8 border border-red-500/20 rounded-lg p-3 mt-4 text-red-400 text-sm">{uploadError}</motion.div>}
      </motion.div>

        {/* Stats */}
        {stats && stats.total_analyses > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="stats-section">
            {[
              { label: 'Total Analyses', value: stats.total_analyses, icon: BarChart3, color: 'text-indigo-400' },
              { label: 'Average Score', value: stats.average_score, icon: Target, color: stats.average_score >= 75 ? 'text-emerald-400' : stats.average_score >= 50 ? 'text-yellow-400' : 'text-red-400' },
              { label: 'Highest Score', value: stats.highest_score, icon: TrendingUp, color: 'text-emerald-400' },
              { label: 'Latest Score', value: stats.latest_score, icon: Clock, color: stats.latest_score >= 75 ? 'text-emerald-400' : stats.latest_score >= 50 ? 'text-yellow-400' : 'text-red-400' },
            ].map((stat, i) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
                className="bg-[#0c0c0c] border border-white/[0.06] rounded-xl p-4 hover:border-white/10 transition-all group">
                <stat.icon className={`w-4 h-4 ${stat.color} mb-2 group-hover:scale-110 transition-transform`} />
                <div className="text-2xl font-bold text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{stat.value}</div>
                <div className="text-white/35 text-xs mt-0.5">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Analysis History */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-lg tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              <Clock className="w-5 h-5 inline mr-2 text-white/40" />Analysis History
            </h2>
            {analyses.length >= 2 && (
              <div className="flex items-center gap-2">
                {isCompareMode ? (
                  <>
                    <span className="text-white/40 text-xs">{compareIds.length} selected</span>
                    <button onClick={handleCompare} disabled={compareIds.length < 2 || comparing} data-testid="run-comparison-button"
                      className="bg-indigo-600 text-white text-xs py-1.5 px-3 rounded-md hover:bg-indigo-500 transition-colors disabled:opacity-40 flex items-center gap-1.5">
                      {comparing ? <Loader2 className="w-3 h-3 animate-spin" /> : <GitCompareArrows className="w-3 h-3" />} Compare
                    </button>
                    <button onClick={() => { setIsCompareMode(false); setCompareIds([]); }} className="text-white/40 text-xs hover:text-white transition-colors">Cancel</button>
                  </>
                ) : (
                  <button onClick={() => setIsCompareMode(true)} data-testid="compare-mode-button"
                    className="text-indigo-400 text-xs hover:text-indigo-300 flex items-center gap-1 bg-indigo-600/10 px-3 py-1.5 rounded-md border border-indigo-500/20">
                    <GitCompareArrows className="w-3.5 h-3.5" /> Compare
                  </button>
                )}
              </div>
            )}
          </div>
          {loadingData ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-indigo-500 animate-spin" /></div>
          ) : analyses.length === 0 ? (
            <div className="bg-[#0c0c0c] border border-white/[0.06] rounded-xl p-12 text-center" data-testid="empty-state">
              <FileSearch className="w-10 h-10 text-white/20 mx-auto mb-3" /><p className="text-white/40 text-sm">No analyses yet. Upload a resume to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="analysis-list">
              {analyses.map(a => (
                <AnalysisCard key={a.id} analysis={a}
                  onView={(a) => { setSelectedAnalysis(a); setView('results'); }}
                  onDelete={handleDelete}
                  isCompareMode={isCompareMode}
                  isSelected={compareIds.includes(a.id)}
                  onToggleCompare={() => toggleCompareId(a.id)}
                />
              ))}
            </div>
          )}
        </motion.div>

      {/* Custom Role Modal */}
      <AnimatePresence>
        {showRoleModal && <CustomRoleModal onClose={() => setShowRoleModal(false)} onCreated={() => fetchData()} />}
      </AnimatePresence>
    </div>
  );
}
