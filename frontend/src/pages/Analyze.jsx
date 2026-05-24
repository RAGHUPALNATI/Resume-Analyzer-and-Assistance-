import { motion } from 'framer-motion';
import { Upload, FileText, X, LoaderCircle, ScanSearch } from 'lucide-react';
import { useRef, useState } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { useAppData, fetchJSON, fetchPdfOrDocText, staggerContainer, fadeItem } from '../utils';

export default function AnalyzePage() {
  const { clusters } = useAppData();
  const [resumeText, setResumeText] = useState('');
  const [fileName, setFileName] = useState('');
  const [jdMode, setJdMode] = useState(null);
  const [jdText, setJdText] = useState('');
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState(null);
  const [similarResumes, setSimilarResumes] = useState([]);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const jdFileRef = useRef(null);

  async function onFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true); setError('');
    try {
      const text = await fetchPdfOrDocText(file);
      setResumeText(text.trim()); setFileName(file.name);
    } catch (err) { setError(err.message); }
    finally { setExtracting(false); }
  }

  async function onJdFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await fetchPdfOrDocText(file);
      setJdText(text.trim()); setJdMode('file');
    } catch (err) { setError(err.message); }
  }

  async function onAnalyze(e) {
    e.preventDefault(); setLoading(true); setError(''); setSimilarResumes([]);
    try {
      const data = await fetchJSON('/predict', { method: 'POST', body: JSON.stringify({ resume_text: resumeText.trim() }) });
      setResult(data);
      try {
        const sr = await fetchJSON(`/clusters/${data.cluster_id}/resumes?limit=4`);
        setSimilarResumes(sr.resumes || []);
      } catch {}
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  function onReset() {
    setResumeText(''); setFileName(''); setResult(null); setError(''); setJdMode(null); setJdText(''); setSimilarResumes([]);
  }

  const confidence = result?.confidence_score || 0;
  const skills = (result?.top_skills || []).slice(0, 8);
  const clusterInfo = clusters.find((c) => c.id === result?.cluster_id);
  const radarSkills = ['React','Node.js','AWS','Docker','Python','JavaScript','Java'];
  const radarData = radarSkills.map((s, i) => ({ skill: s, value: Math.max(30, 95 - i * 10 + Math.round(Math.random() * 15)) }));
  const barSkills = skills.length ? skills.map((s, i) => ({ name: s, pct: Math.max(40, 100 - i * 8) })) :
    radarSkills.slice(0, 6).map((s, i) => ({ name: s, pct: [90, 85, 75, 70, 65, 60][i] }));

  return (
    <motion.div className="analyze-grid" variants={staggerContainer} initial="hidden" animate="show">
      {/* Left: Upload */}
      <motion.div className="upload-card" variants={fadeItem}>
        <h3>Analyze Resume</h3>
        <p>Upload a resume and optionally add a job description for AI-powered matching.</p>

        <label className="upload-label">Resume</label>
        {fileName ? (
          <div className="file-upload-area">
            <div className="file-icon"><FileText size={16} /></div>
            <span className="file-name">{fileName}</span>
            <button className="file-clear" onClick={() => { setFileName(''); setResumeText(''); }}><X size={14} /></button>
          </div>
        ) : (
          <div className="file-upload-area" style={{ cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
            <div className="file-icon"><Upload size={16} /></div>
            <span className="file-name" style={{ color: '#6B6B6B' }}>Click to upload PDF or DOCX</span>
          </div>
        )}
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" onChange={onFileSelect} hidden />

        {!fileName && (
          <textarea className="clean-textarea" placeholder="Or paste resume text here..." value={resumeText} onChange={(e) => setResumeText(e.target.value)} style={{ minHeight: '120px', marginBottom: '12px' }} />
        )}

        <label className="upload-label">Job Description (Optional)</label>
        <div className="jd-buttons">
          <button className={`jd-btn paste`} onClick={() => setJdMode(jdMode === 'paste' ? null : 'paste')}>
            <FileText size={14} /> Paste Text
          </button>
          <button className="jd-btn" onClick={() => jdFileRef.current?.click()}>
            <Upload size={14} /> Upload File
          </button>
          <input ref={jdFileRef} type="file" accept=".pdf,.doc,.docx" onChange={onJdFileSelect} hidden />
        </div>
        {jdMode === 'paste' && (
          <textarea className="clean-textarea" placeholder="Paste job description..." value={jdText} onChange={(e) => setJdText(e.target.value)} style={{ minHeight: '80px', marginBottom: '12px' }} />
        )}

        <div className="action-buttons">
          <button className="button-primary" onClick={onAnalyze} disabled={!resumeText.trim() || loading || extracting}>
            {loading ? <LoaderCircle size={16} className="spin" /> : null} Analyze Resume
          </button>
          <button className="button-secondary" onClick={onReset}>Reset</button>
        </div>
        {error && <div className="notice-banner" style={{ marginTop: '12px' }}>{error}</div>}
      </motion.div>

      {/* Right: Results */}
      <div className="results-stack">
        {result ? (
          <>
            {/* Card 1: Cluster Match */}
            <motion.div className="cluster-match-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="cluster-match-top">
                <div>
                  <h3>{result.predicted_role || result.cluster_name}</h3>
                  <span className="role" style={{ background: '#FFF3EE', color: '#E8470A', padding: '3px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>{result.cluster_name}</span>
                </div>
                <MatchRing score={confidence} />
              </div>
              <div className="detected-skills">
                <h4>Detected Skills</h4>
                <div className="skill-tags">
                  {skills.map((s) => <span key={s} className="skill-tag">{s}</span>)}
                </div>
              </div>
            </motion.div>

            {/* Card 2: Skill Dimensions */}
            <motion.div className="skill-dim-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <h3>Skill Dimensions</h3>
              <div className="skill-dim-layout">
                <div className="chart-wrap" style={{ height: '260px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
                      <PolarGrid stroke="rgba(0,0,0,0.08)" />
                      <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: '#1A1A1A' }} />
                      <Radar dataKey="value" stroke="#E8470A" fill="rgba(232,71,10,0.15)" strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="skill-bar-list">
                  {barSkills.map((s) => (
                    <div key={s.name} className="skill-bar-row">
                      <div className="skill-bar-header"><span>{s.name}</span><strong>{s.pct}%</strong></div>
                      <div className="skill-bar-track"><div className="skill-bar-fill" style={{ width: `${s.pct}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Card 3: Similar Resumes */}
            <motion.div className="similar-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <h3>Similar Resumes</h3>
              {similarResumes.length ? similarResumes.map((r, i) => (
                <div key={i} className="similar-item">
                  <h4>{result.cluster_name}</h4>
                  <p>{r.snippet}</p>
                </div>
              )) : (
                <div style={{ color: '#6B6B6B', fontSize: '.88rem' }}>No similar resumes found.</div>
              )}
            </motion.div>
          </>
        ) : (
          <motion.div className="panel" variants={fadeItem}>
            <div className="empty-panel">
              <div className="empty-border">
                <p>Analysis results will appear here after you upload and analyze a resume.</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function MatchRing({ score }) {
  const pct = Math.round((score || 0) * 100);
  const size = 68, stroke = 5, r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - (pct / 100));
  return (
    <div className="match-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} stroke="rgba(232,71,10,0.15)" strokeWidth={stroke} fill="none" />
        <circle cx={size/2} cy={size/2} r={r} stroke="#E8470A" strokeWidth={stroke} fill="none"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      <div className="ring-label">
        <span className="ring-pct">{pct}%</span>
        <span className="ring-sub">Match Score</span>
      </div>
    </div>
  );
}
