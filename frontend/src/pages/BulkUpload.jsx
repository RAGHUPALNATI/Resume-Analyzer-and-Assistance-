import { motion, AnimatePresence } from 'framer-motion';
import { Upload, ScanSearch, Download, X, LoaderCircle, Users, TrendingUp, Layers, Network, ChevronDown, ChevronUp, FileText, CheckCircle, Target, Check } from 'lucide-react';
import { useRef, useState, useMemo } from 'react';
import { Cell, Pie, PieChart, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { useAppData, fetchJSON, fetchPdfOrDocText, formatNumber, sanitizeTopSkills, useCountUp, chartPalette, staggerContainer, fadeItem } from '../utils';

function calculateMockMatchScore(resumeSkills, jdText, confidence) {
  if (!jdText) return Math.round(confidence * 100);
  const jdWords = new Set(jdText.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  let overlap = 0;
  resumeSkills.forEach(skill => {
    const words = skill.toLowerCase().split(/\W+/);
    if (words.some(w => jdWords.has(w))) overlap++;
  });
  let rawScore = (overlap / Math.max(1, resumeSkills.length)) * 60 + (confidence * 40);
  return Math.min(100, Math.max(10, Math.round(rawScore)));
}

export default function BulkUploadPage() {
  const { stats, clusters } = useAppData();
  
  // Tabs & Inputs
  const [activeTab, setActiveTab] = useState('files');
  const [slots, setSlots] = useState([]);
  const [csvFile, setCsvFile] = useState(null);
  const [pasteText, setPasteText] = useState('');
  const [delimiter, setDelimiter] = useState('---');
  
  // Job Description
  const [jobDescription, setJobDescription] = useState('');
  const [threshold, setThreshold] = useState(70);

  // Global UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const idRef = useRef(1);

  // Results State
  const [mode, setMode] = useState(null);
  const [results, setResults] = useState([]);
  const [modeBResults, setModeBResults] = useState(null);
  
  // Table Filtering (Mode B)
  const [searchQuery, setSearchQuery] = useState('');
  const [clusterFilter, setClusterFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState({ key: 'Match Score', dir: 'desc' });
  const [showDidNotMeet, setShowDidNotMeet] = useState(false);

  async function handleDrop(e) {
    e.preventDefault(); setError('');
    const files = Array.from(e.dataTransfer?.files || e.target?.files || []);
    for (const file of files) {
      try { 
        const t = await fetchPdfOrDocText(file); 
        setSlots((c) => [...c, { id: idRef.current++, text: t.trim(), name: file.name }]);
      } catch { setError('Only PDF/DOCX supported.'); }
    }
  }

  function removeSlot(id) { setSlots((c) => c.filter((s) => s.id !== id)); }

  async function analyzeAll() {
    let payload = [];
    if (activeTab === 'files') {
      payload = slots.map((s, i) => ({ text: s.text.trim(), name: s.name || `Resume ${i+1}` })).filter(s => s.text);
    } else if (activeTab === 'csv') {
      if (!csvFile) { setError('Please upload a CSV file.'); return; }
      try {
        const text = await csvFile.text();
        const rows = text.split('\n').map(r => r.split(',')[0].replace(/^"|"$/g, '').trim()).filter(Boolean);
        payload = rows.map((r, i) => ({ text: r, name: `CSV Row ${i+1}` }));
      } catch (e) { setError('Failed to read CSV.'); return; }
    } else if (activeTab === 'text') {
      const sep = delimiter || '---';
      const sections = pasteText.split(sep).map(s => s.trim()).filter(Boolean);
      payload = sections.map((r, i) => ({ text: r, name: `Pasted Resume ${i+1}` }));
    }

    if (!payload.length) { setError('No resumes found to analyze.'); return; }
    
    setLoading(true); setResults([]); setModeBResults(null); setMode(null); setProgress(0); setError('');
    try {
      const collected = [];
      for (let i = 0; i < payload.length; i++) {
        const p = await fetchJSON('/predict', { method: 'POST', body: JSON.stringify({ resume_text: payload[i].text }) });
        collected.push({ 
          index: i, 
          name: payload[i].name,
          cluster_id: p.cluster_id, 
          cluster_name: p.cluster_name, 
          predicted_role: p.predicted_role,
          confidence_score: p.confidence_score, 
          top_skills: p.top_skills 
        });
        setProgress(Math.round(((i + 1) / payload.length) * 100));
      }
      setResults(collected);

      if (jobDescription.trim()) {
        setMode('B');
        const jd = jobDescription.trim();
        const enhanced = collected.map(r => {
           const matchScore = calculateMockMatchScore(r.top_skills, jd, r.confidence_score);
           return { ...r, matchScore };
        });
        const matched = enhanced.filter(r => r.matchScore >= threshold);
        const notMatched = enhanced.filter(r => r.matchScore < threshold);
        setModeBResults({ matched, notMatched, total: enhanced.length, matchRate: Math.round((matched.length / Math.max(1, enhanced.length)) * 100) });
      } else {
        setMode('A');
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  // Exports
  function exportCsvModeB() {
    if (!modeBResults) return;
    const all = [...modeBResults.matched, ...modeBResults.notMatched];
    const h = ['Name', 'Predicted Role', 'Cluster', 'Match Score', 'Top Skills', 'Status'];
    const rows = all.map(r => {
      const status = r.matchScore >= 85 ? 'Strong Match' : (r.matchScore >= threshold ? 'Good Match' : 'Below Threshold');
      return [r.name, r.predicted_role || 'N/A', r.cluster_name, r.matchScore, (r.top_skills||[]).join(' | '), status];
    });
    const csv = [h,...rows].map((r) => r.map((c) => `"${String(c??'').replaceAll('"','""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download = 'fitsift-jd-match-results.csv'; a.click();
  }

  // Shared Analytics Data (Mode A)
  const totalResumes = results.length || stats?.total_resumes || 0;
  const clusterCount = stats?.clusters_found || clusters.length;
  const topSkills = sanitizeTopSkills(stats?.top_skill_domains || []).slice(0, 10);
  const maxSkillCount = topSkills.length ? topSkills[0].count : 1;
  const distribution = stats?.cluster_distribution || [];
  const pieData = distribution.map((d, i) => ({ ...d, fill: chartPalette[i % chartPalette.length] }));
  const totalPie = distribution.reduce((a, d) => a + d.resume_count, 0);
  const coTags = topSkills.slice(0, 8).map((s) => s.skill);

  // Derived Mode A Cluster Breakdown Table
  const modeAClusters = useMemo(() => {
    const map = {};
    distribution.forEach(d => {
       map[d.name] = { count: d.resume_count, share: d.share || Math.round(d.resume_count/totalPie*100) };
    });
    // Use results to calculate average confidence if available
    if (results.length > 0 && mode === 'A') {
      const liveMap = {};
      results.forEach(r => {
        if (!liveMap[r.cluster_name]) liveMap[r.cluster_name] = { count: 0, conf: 0 };
        liveMap[r.cluster_name].count++;
        liveMap[r.cluster_name].conf += r.confidence_score;
      });
      return Object.entries(liveMap).map(([name, data]) => ({
        name,
        count: data.count,
        share: Math.round((data.count / results.length) * 100),
        avgConf: Math.round((data.conf / data.count) * 100)
      })).sort((a,b) => b.count - a.count);
    }
    return distribution.map(d => ({
       name: d.name, count: d.resume_count, share: d.share || Math.round(d.resume_count/totalPie*100), avgConf: 85
    })).sort((a,b) => b.count - a.count);
  }, [distribution, results, totalPie, mode]);

  // Derived Mode B Left/Right Panel Data
  const modeBDistribution = useMemo(() => {
    if (!modeBResults) return [];
    const map = {};
    modeBResults.matched.forEach(r => { map[r.cluster_name] = (map[r.cluster_name] || 0) + 1; });
    return Object.entries(map).map(([name, count], i) => ({ name, count, fill: chartPalette[i % chartPalette.length] })).sort((a,b) => b.count - a.count);
  }, [modeBResults]);

  // Sorting / Filtering for Mode B Table
  const filteredMatched = useMemo(() => {
    if (!modeBResults) return [];
    let data = [...modeBResults.matched];
    if (clusterFilter !== 'All') data = data.filter(r => r.cluster_name === clusterFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(r => r.name.toLowerCase().includes(q) || r.top_skills.some(s => s.toLowerCase().includes(q)));
    }
    data.sort((a,b) => sortConfig.key === 'Match Score' ? (sortConfig.dir === 'desc' ? b.matchScore - a.matchScore : a.matchScore - b.matchScore) : (a.cluster_name.localeCompare(b.cluster_name)));
    return data;
  }, [modeBResults, clusterFilter, searchQuery, sortConfig]);

  const allClustersInMatch = useMemo(() => {
    if (!modeBResults) return [];
    return ['All', ...new Set(modeBResults.matched.map(r => r.cluster_name))];
  }, [modeBResults]);

  const dominantCluster = modeAClusters.length > 0 ? modeAClusters[0].name : '-';

  return (
    <motion.div className="page-stack" variants={staggerContainer} initial="hidden" animate="show">
      {/* SECTION 1: Bulk Upload Inputs */}
      <motion.div className="panel" variants={fadeItem}>
        <div className="section-head-row" style={{ marginBottom: '0px' }}>
          <div className="section-header"><h2>Bulk Upload</h2><p>Upload multiple resumes for batch analysis.</p></div>
        </div>
        
        {/* Tab Switcher */}
        <div className="tab-switcher">
          <button className={`tab-btn ${activeTab==='files'?'active':''}`} onClick={()=>setActiveTab('files')}>Upload Files</button>
          <button className={`tab-btn ${activeTab==='csv'?'active':''}`} onClick={()=>setActiveTab('csv')}>Paste CSV</button>
          <button className={`tab-btn ${activeTab==='text'?'active':''}`} onClick={()=>setActiveTab('text')}>Paste Text</button>
        </div>

        {/* Tab Contents */}
        <div className={`tab-content ${activeTab==='files'?'active':''}`}>
          <label className="upload-label">Resume Files</label>
          <div className="drop-zone clean" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
            <Upload size={18} />
            <div>
              <strong>Drag and drop files here</strong><p>Accepts multiple PDF or DOCX files</p>
              <input type="file" multiple accept=".pdf,.docx,.doc" style={{display:'none'}} id="fileUpload" onChange={handleDrop} />
              <button className="button-accent" style={{marginTop:'8px', padding:'4px 12px', minHeight:'32px', fontSize:'.8rem'}} onClick={() => document.getElementById('fileUpload').click()}>Browse Files</button>
            </div>
          </div>
          {slots.length > 0 && (
            <div className="file-chip-list">
              {slots.map(s => (
                <div key={s.id} className="file-chip">
                  <FileText size={14} className="muted" />
                  {s.name}
                  <button onClick={() => removeSlot(s.id)}><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`tab-content ${activeTab==='csv'?'active':''}`}>
          <label className="upload-label">CSV File</label>
          <div className="file-upload-area">
             <div className="file-icon"><FileText size={18} /></div>
             <div className="file-name">{csvFile ? csvFile.name : 'No file selected'}</div>
             {csvFile && <button className="file-clear" onClick={() => setCsvFile(null)}><X size={16} /></button>}
          </div>
          <input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files[0])} />
          <p className="muted" style={{marginTop:'8px', fontSize:'.85rem'}}>Note: Each row = one resume's text content. First column will be used.</p>
        </div>

        <div className={`tab-content ${activeTab==='text'?'active':''}`}>
          <label className="upload-label">Raw Text</label>
          <textarea className="clean-textarea" value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Paste multiple resumes here, separated by --- on a new line" />
          <div style={{marginTop:'12px', display:'flex', alignItems:'center', gap:'12px'}}>
            <label className="upload-label" style={{margin:0}}>Delimiter:</label>
            <input type="text" className="search-input" style={{width:'80px', padding:'6px 10px'}} value={delimiter} onChange={(e) => setDelimiter(e.target.value)} />
          </div>
        </div>

        <div className="bulk-actions" style={{marginTop:'20px', justifyContent:'flex-end'}}>
          <button className="button-primary" onClick={analyzeAll} disabled={loading}>
            {loading ? <LoaderCircle size={16} className="spin" /> : <ScanSearch size={16} />} Analyze All
          </button>
        </div>

      </motion.div>

      {/* SECTION 2: JD Matching */}
      <motion.div className="jd-card" variants={fadeItem}>
        <h3>Job Description Matching</h3>
        <p>Optional — leave empty to see cluster predictions</p>
        <textarea className="clean-textarea preview" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste job description here to match candidates against it... Leave empty to auto-predict cluster distribution across all 12 clusters." />
        <div className="slider-row">
           <label>Match Threshold</label>
           <input type="range" min="0" max="100" value={threshold} onChange={(e) => setThreshold(parseInt(e.target.value))} className="slider-input" />
           <div className="slider-value">{threshold}%</div>
        </div>
        {error && <div className="notice-banner">{error}</div>}
        {loading && (
          <div className="progress-shell">
            <div className="progress-label">Processing {progress}%</div>
            <div className="progress-track"><motion.div className="progress-fill" initial={{ width: 0 }} animate={{ width: `${progress}%` }} /></div>
          </div>
        )}
        <button className="button-primary full" onClick={analyzeAll} disabled={loading} style={{marginTop:'12px'}}>
            {loading ? <LoaderCircle size={16} className="spin" /> : <Target size={16} />} Analyze Match / Predict Clusters
        </button>
      </motion.div>

      {/* SECTION 3: RESULTS MODE A (No JD) */}
      {mode === 'A' && (
        <motion.div className="analytics-section" variants={fadeItem} initial="hidden" animate="show">
          <div className="section-header"><h2>Cluster Distribution Prediction</h2></div>
          <div className="bulk-stat-grid">
            <div className="stat-card"><div className="stat-info"><div className="stat-label">Total Resumes Uploaded</div><div className="stat-value">{results.length}</div></div><div className="stat-icon-wrap"><Users size={20} /></div></div>
            <div className="stat-card"><div className="stat-info"><div className="stat-label">Clusters Identified</div><div className="stat-value">12</div></div><div className="stat-icon-wrap"><Layers size={20} /></div></div>
            <div className="stat-card"><div className="stat-info"><div className="stat-label">Dominant Cluster</div><div className="stat-value" style={{fontSize:'1.2rem', lineHeight:'1.5'}}>{dominantCluster}</div></div><div className="stat-icon-wrap"><TrendingUp size={20} /></div></div>
          </div>

          <div className="cluster-dist-card">
            <h3>Cluster Breakdown</h3>
            <p>Proportional breakdown of resume clusters</p>
            <div className="dist-layout">
              <div style={{ position: 'relative' }}>
                <div className="chart-wrap" style={{ height: '240px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie data={pieData} dataKey="resume_count" nameKey="name" innerRadius="50%" outerRadius="78%" paddingAngle={2}>
                      {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie></PieChart>
                  </ResponsiveContainer>
                  <div style={{ position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',textAlign:'center',pointerEvents:'none' }}>
                    <div style={{ fontSize:'.72rem',color:'#6B6B6B' }}>Total</div>
                    <div style={{ fontSize:'1.4rem',fontWeight:700 }}>{formatNumber(totalPie)}</div>
                  </div>
                </div>
              </div>
              <div className="legend-list">
                {distribution.map((d, i) => (
                  <div key={d.id} className="legend-row">
                    <span className="legend-dot" style={{ background: chartPalette[i % chartPalette.length] }} />
                    <span className="legend-name">{d.name}</span>
                    <span className="legend-count">{d.resume_count}</span>
                    <span className="legend-pct">{d.share || Math.round(d.resume_count/totalPie*100)}%</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* NEW Cluster Breakdown Table */}
            <div className="table-shell" style={{marginTop:'32px'}}>
              <table className="results-table">
                <thead><tr><th>Rank</th><th>Cluster Name</th><th>Candidates</th><th>% Share</th><th>Avg Skill Score</th></tr></thead>
                <tbody>
                  {modeAClusters.map((c, i) => (
                    <tr key={c.name} className={i===0?'highlight-row':''}>
                      <td>{i+1}</td>
                      <td><span className="cluster-badge">{c.name}</span></td>
                      <td>{c.count}</td>
                      <td>{c.share}%</td>
                      <td>
                        <div className="match-bar-wrap" style={{width:'80px'}}><div className="match-bar-fill" style={{width:`${c.avgConf}%`}} /></div>
                        <span className="match-score-text">{c.avgConf}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Keep Existing Skill Distributions below */}
          <div className="skill-dist-card">
            <h3>Skill Distribution</h3>
            <p>Top 10 skills across all analyzed resumes</p>
            {topSkills.map((s, i) => {
              const pct = Math.round((s.count / maxSkillCount) * 100);
              return (
                <div key={s.skill} className="skill-dist-row">
                  <span className="skill-rank">{i + 1}</span>
                  <span className="skill-dist-name">{s.skill}</span>
                  <div className="skill-dist-bar-wrap"><div className="skill-dist-bar" style={{ width: `${pct}%` }} /></div>
                  <span className="skill-dist-count">{formatNumber(s.count)} occurrences</span>
                  <span className="skill-dist-pct">{pct}%</span>
                </div>
              );
            })}
          </div>

          <div className="cooccur-card">
            <h3>Skill Co-occurrence</h3>
            <p>Skills that frequently appear together across clusters</p>
            <div className="cooccur-tags">
              {coTags.map((t) => <span key={t} className="cooccur-tag">{t}</span>)}
            </div>
          </div>
        </motion.div>
      )}

      {/* SECTION 3: RESULTS MODE B (JD Given) */}
      {mode === 'B' && modeBResults && (
        <motion.div className="analytics-section" variants={fadeItem} initial="hidden" animate="show">
          <div className="section-header"><h2>Job Description Match Results</h2></div>
          <div className="bulk-stat-grid">
            <div className="stat-card"><div className="stat-info"><div className="stat-label">Total Candidates</div><div className="stat-value">{modeBResults.total}</div></div><div className="stat-icon-wrap"><Users size={20} /></div></div>
            <div className="stat-card"><div className="stat-info"><div className="stat-label">Matched Candidates</div><div className="stat-value">{modeBResults.matched.length}</div></div><div className="stat-icon-wrap"><CheckCircle size={20} /></div></div>
            <div className="stat-card"><div className="stat-info"><div className="stat-label">Match Rate</div><div className="stat-value">{modeBResults.matchRate}%</div></div>
              <div className="confidence-ring" style={{width:'50px',height:'50px', flexShrink:0}}>
                <svg width="50" height="50" viewBox="0 0 100 100" className="confidence-ring-svg">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="12" />
                  <motion.circle cx="50" cy="50" r="42" fill="none" stroke="var(--orange)" strokeWidth="12" strokeDasharray={264} initial={{strokeDashoffset:264}} animate={{strokeDashoffset: 264 - (264 * modeBResults.matchRate) / 100}} transition={{duration:1, ease:'easeOut'}} />
                </svg>
              </div>
            </div>
          </div>

          <div className="mode-b-panels">
            <div className="panel">
               <h3>Match Distribution by Cluster</h3>
               <div className="chart-wrap" style={{height:'220px', marginTop:'20px'}}>
                  {modeBDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={modeBDistribution} dataKey="count" nameKey="name" innerRadius="40%" outerRadius="80%" paddingAngle={2}>
                        {modeBDistribution.map((e, i) => <Cell key={i} fill={e.fill} />)}
                      </Pie><RechartsTooltip /></PieChart>
                    </ResponsiveContainer>
                  ) : (<div className="empty-panel"><p className="muted">No matches to display</p></div>)}
               </div>
            </div>
            <div className="panel">
               <h3>Top Matching Clusters</h3>
               <div style={{marginTop:'16px'}}>
                 {modeBDistribution.slice(0,5).map((c, i) => {
                   const maxMatch = modeBDistribution[0].count;
                   const pct = Math.round((c.count / maxMatch) * 100);
                   return (
                     <div key={c.name} className="list-row">
                       <span style={{fontSize:'.9rem', fontWeight:500}}>{i+1}. {c.name}</span>
                       <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                         <span style={{fontSize:'.85rem', color:'var(--muted)'}}>{c.count} matched</span>
                         <div className="match-bar-wrap" style={{width:'60px'}}><div className="match-bar-fill" style={{width:`${pct}%`}} /></div>
                       </div>
                     </div>
                   );
                 })}
               </div>
            </div>
          </div>

          <div className="panel">
            <div className="section-head-row" style={{marginBottom:'20px'}}>
              <h3>Matched Candidates</h3>
              <button className="button-secondary" onClick={exportCsvModeB}><Download size={15}/> Export as CSV</button>
            </div>
            
            <div className="table-filter-bar">
               <input type="text" className="search-input" placeholder="Search resume name or skill..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
               <select className="select-input" value={clusterFilter} onChange={e => setClusterFilter(e.target.value)}>
                 {allClustersInMatch.map(c => <option key={c} value={c}>{c}</option>)}
               </select>
               <select className="select-input" value={sortConfig.key} onChange={e => setSortConfig({key: e.target.value, dir: 'desc'})}>
                 <option value="Match Score">Sort by Score</option>
                 <option value="Cluster Name">Sort by Cluster</option>
               </select>
            </div>

            <div className="table-shell">
              <table className="results-table">
                <thead><tr><th>#</th><th>Resume</th><th>Predicted Role</th><th>Cluster</th><th>Match Score</th><th>Top Skills</th><th>Status</th></tr></thead>
                <tbody>
                  {filteredMatched.length > 0 ? filteredMatched.map((r, i) => (
                    <tr key={i}>
                      <td>{i+1}</td>
                      <td><span style={{fontWeight:500}}>{r.name}</span></td>
                      <td><span style={{fontWeight:600, color:'#166534', background:'#DCFCE7', padding:'2px 8px', borderRadius:'4px', fontSize:'0.8rem'}}>{r.predicted_role || 'N/A'}</span></td>
                      <td><span className="cluster-badge">{r.cluster_name}</span></td>
                      <td>
                        <div className="match-bar-wrap"><div className="match-bar-fill" style={{width:`${r.matchScore}%`}} /></div>
                        <span className="match-score-text">{r.matchScore}%</span>
                      </td>
                      <td>
                        <div style={{display:'flex', gap:'6px', flexWrap:'wrap'}}>
                          {(r.top_skills||[]).slice(0,3).map(s => <span key={s} className="skill-pill">{s}</span>)}
                        </div>
                      </td>
                      <td>
                         <span className={`badge ${r.matchScore >= 85 ? 'badge-strong' : 'badge-good'}`}>
                           {r.matchScore >= 85 ? 'Strong Match' : 'Good Match'}
                         </span>
                      </td>
                    </tr>
                  )) : (<tr><td colSpan="7" className="table-empty">No candidates match your criteria.</td></tr>)}
                </tbody>
              </table>
            </div>

            <div className="collapsible-header" onClick={() => setShowDidNotMeet(!showDidNotMeet)} style={{marginTop:'20px'}}>
               {showDidNotMeet ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
               Did Not Meet Threshold ({modeBResults.notMatched.length})
            </div>
            
            {showDidNotMeet && (
              <div className="table-shell" style={{marginTop:'12px'}}>
                <table className="results-table grey-toned">
                  <thead><tr><th>#</th><th>Resume</th><th>Predicted Role</th><th>Cluster</th><th>Match Score</th><th>Top Skills</th><th>Status</th></tr></thead>
                  <tbody>
                    {modeBResults.notMatched.map((r, i) => (
                      <tr key={i}>
                        <td>{i+1}</td>
                        <td>{r.name}</td>
                        <td><span style={{fontWeight:600, color:'#991B1B', background:'#FEE2E2', padding:'2px 8px', borderRadius:'4px', fontSize:'0.8rem'}}>{r.predicted_role || 'N/A'}</span></td>
                        <td><span className="cluster-badge">{r.cluster_name}</span></td>
                        <td>
                          <div className="match-bar-wrap"><div className="match-bar-fill" style={{width:`${r.matchScore}%`}} /></div>
                          <span className="match-score-text">{r.matchScore}%</span>
                        </td>
                        <td>
                          <div style={{display:'flex', gap:'6px', flexWrap:'wrap'}}>
                            {(r.top_skills||[]).slice(0,3).map(s => <span key={s} className="skill-pill">{s}</span>)}
                          </div>
                        </td>
                        <td><span className="badge badge-below">Below Threshold</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </motion.div>
      )}

    </motion.div>
  );
}
