import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  Link as LinkIcon, 
  FileText, 
  Target, 
  CheckCircle, 
  XCircle, 
  MinusCircle,
  AlertTriangle,
  AlertCircle,
  Copy,
  RotateCcw,
  Sparkles,
  Check
} from 'lucide-react';
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { analyzeResume } from '../utils/geminiService';

export default function ATSEditor() {
  const [activeTab, setActiveTab] = useState('pdf');
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfBase64, setPdfBase64] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [urlFetchStatus, setUrlFetchStatus] = useState({ status: 'idle', message: '', name: '' });
  
  const [jobDescription, setJobDescription] = useState('');
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [copiedText, setCopiedText] = useState(false);

  const fileInputRef = useRef(null);

  // Handlers for Input Methods
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPdfBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPdfBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return;
    
    setUrlFetchStatus({ status: 'loading', message: 'Fetching PDF...', name: '' });
    try {
      const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(urlInput)}`);
      if (!response.ok) throw new Error("Fetch failed");
      
      const blob = await response.blob();
      if (blob.type !== 'application/pdf') throw new Error("Not a PDF");

      const reader = new FileReader();
      reader.onloadend = () => {
        setPdfBase64(reader.result);
        setUrlFetchStatus({ 
          status: 'success', 
          message: 'PDF fetched successfully.', 
          name: urlInput.split('/').pop() || 'fetched-document.pdf' 
        });
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      setUrlFetchStatus({ 
        status: 'error', 
        message: 'Could not fetch this URL. Try downloading the PDF and uploading it directly.', 
        name: '' 
      });
      setPdfBase64('');
    }
  };

  const canAnalyze = () => {
    if (activeTab === 'pdf' && pdfBase64) return true;
    if (activeTab === 'text' && resumeText.trim().length > 50) return true;
    if (activeTab === 'url' && pdfBase64 && urlFetchStatus.status === 'success') return true;
    return false;
  };

  const handleAnalyze = async () => {
    setError(null);
    setResults(null);
    setIsAnalyzing(true);
    
    try {
      let inputData = '';
      let inputType = '';

      if (activeTab === 'pdf') {
        inputData = pdfBase64;
        inputType = 'pdf';
      } else if (activeTab === 'text') {
        inputData = resumeText;
        inputType = 'text';
      } else if (activeTab === 'url') {
        inputData = pdfBase64;
        inputType = 'pdf';
      }

      const parsedData = await analyzeResume(inputData, inputType, jobDescription);
      setResults(parsedData);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetAll = () => {
    setActiveTab('pdf');
    setPdfFile(null);
    setPdfBase64('');
    setResumeText('');
    setUrlInput('');
    setUrlFetchStatus({ status: 'idle', message: '', name: '' });
    setJobDescription('');
    setResults(null);
    setError(null);
  };

  const copyReport = () => {
    if (!results) return;
    const report = `
ATS Score: ${results.atsScore}/100 (${results.scoreLabel})
Reason: ${results.scoreReason}
Role: ${results.predicted_role || 'N/A'}
Cluster: ${results.cluster} (${results.clusterConfidence}% confidence)

Sections Found:
${Object.entries(results.sectionsFound).map(([k, v]) => `- ${k}: ${v ? 'Yes' : 'No'}`).join('\n')}

Skills:
Detected: ${results.detectedSkills?.join(', ')}
Missing: ${results.missingSkills?.join(', ')}

Formatting Issues:
${results.formattingIssues?.length ? results.formattingIssues.join('\n') : 'None'}

Improvements:
${results.improvementSuggestions?.map((s, i) => `${i+1}. ${s}`).join('\n')}
    `.trim();
    
    navigator.clipboard.writeText(report);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const getScoreColor = (score) => {
    if (score <= 40) return '#EF4444';
    if (score <= 60) return '#F59E0B';
    if (score <= 80) return '#E8470A';
    return '#22C55E';
  };

  const getReadinessColorClass = (label) => {
    switch (label) {
      case 'Not Ready': return 'bg-red-100 text-red-800';
      case 'Partially Ready': return 'bg-amber-100 text-amber-800';
      case 'Almost Ready': return 'bg-orange-100 text-orange-800';
      case 'Role Ready': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 bg-[#FAF7F2] min-h-screen">
      
      {/* PAGE HEADER */}
      <div className="mb-8 text-center sm:text-left">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Role Readiness</h1>
        <p className="text-slate-600 mb-4 max-w-2xl">
          AI-powered resume analysis using Google Gemini. Get your ATS score, skill gaps, and improvement suggestions.
        </p>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FFF3EE] text-[#E8470A] rounded-full text-xs font-semibold">
          <Sparkles size={14} />
          ⚡ Powered by Google Gemini 1.5 Flash
        </div>
      </div>

      {/* LAYOUT */}
      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* LEFT PANEL (40%) */}
        <div className="w-full lg:w-[40%] flex flex-col gap-6">
          
          {/* Resume Input Card */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            
            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-6">
              {[
                { id: 'pdf', label: '📄 Upload PDF' },
                { id: 'text', label: '✏️ Paste Text' },
                { id: 'url', label: '🔗 From URL' }
              ].map(tab => (
                <button
                  key={tab.id}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id 
                      ? 'border-[#E8470A] text-[#E8470A]' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div className="min-h-[220px]">
              
              {activeTab === 'pdf' && (
                <div 
                  className="border-2 border-dashed border-[#E8470A]/40 rounded-xl p-8 text-center hover:bg-orange-50 transition-colors cursor-pointer flex flex-col items-center justify-center h-full"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input 
                    type="file" 
                    className="hidden" 
                    accept=".pdf" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                  <Upload size={32} className="text-[#E8470A] mb-3" />
                  <p className="font-medium text-gray-800">Drag & drop your resume PDF here</p>
                  <p className="text-sm text-gray-500 mt-1">or click to browse — PDF only</p>
                  
                  {pdfFile && (
                    <div className="mt-4 inline-flex items-center gap-2 bg-orange-100 text-[#E8470A] px-3 py-1.5 rounded-full text-sm">
                      <FileText size={14} />
                      <span className="truncate max-w-[150px]">{pdfFile.name}</span>
                      <XCircle size={14} className="cursor-pointer hover:text-red-600" onClick={(e) => { e.stopPropagation(); setPdfFile(null); setPdfBase64(''); }} />
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'text' && (
                <div className="h-full relative">
                  <textarea
                    className="w-full h-full min-h-[200px] p-4 border border-gray-200 rounded-xl focus:border-[#E8470A] focus:ring-1 focus:ring-[#E8470A] outline-none resize-none text-sm"
                    placeholder="Paste your full resume content here..."
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                  />
                  <div className="absolute bottom-3 right-4 text-xs text-gray-400">
                    {resumeText.length} chars
                  </div>
                </div>
              )}

              {activeTab === 'url' && (
                <div className="flex flex-col gap-4 h-full justify-center">
                  <div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <LinkIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="url"
                          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:border-[#E8470A] outline-none text-sm"
                          placeholder="https://... public PDF URL"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                        />
                      </div>
                      <button 
                        onClick={handleFetchUrl}
                        disabled={urlFetchStatus.status === 'loading'}
                        className="px-4 py-2 bg-[#E8470A] text-white rounded-lg font-medium text-sm hover:bg-[#D13D06] disabled:opacity-50 whitespace-nowrap"
                      >
                        {urlFetchStatus.status === 'loading' ? 'Fetching...' : 'Fetch PDF'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 ml-1">Must be a publicly accessible PDF link</p>
                  </div>

                  {urlFetchStatus.status === 'success' && (
                    <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-sm self-start">
                      <CheckCircle size={14} />
                      <span className="truncate max-w-[200px]">{urlFetchStatus.name}</span>
                    </div>
                  )}

                  {urlFetchStatus.status === 'error' && (
                    <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                      <AlertCircle size={14} /> {urlFetchStatus.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Job Description Card */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-1">
              Target Job Description <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">(Optional)</span>
            </h3>
            <p className="text-xs text-gray-500 mb-4">Add a JD for role-specific match score and targeted skill gap analysis</p>
            <textarea
              className="w-full h-32 p-3 border border-gray-200 rounded-xl focus:border-[#E8470A] outline-none resize-none text-sm"
              placeholder="Paste the job description here...&#10;Leave empty for general ATS analysis."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </div>

          {/* Analyze Button */}
          <div className="text-center">
            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze() || isAnalyzing}
              className="w-full py-3.5 bg-[#E8470A] text-white rounded-xl font-medium shadow-sm hover:bg-[#D13D06] disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex justify-center items-center gap-2 text-lg"
            >
              {isAnalyzing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Gemini is analyzing...
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  ✨ Analyze with Gemini
                </>
              )}
            </button>
            <p className="text-xs text-gray-400 mt-3">Usually takes 5–10 seconds</p>
          </div>

        </div>

        {/* RIGHT PANEL (60%) */}
        <div className="w-full lg:w-[60%]">
          
          {/* Error State */}
          {error && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-red-200 rounded-xl p-6 shadow-sm mb-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="text-red-500" size={24} />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Analysis Failed</h3>
              <p className="text-sm text-red-600 mb-6">{error}</p>
              <button onClick={handleAnalyze} className="px-6 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors font-medium text-sm">
                Try Again
              </button>
            </motion.div>
          )}

          {/* Empty State */}
          {!isAnalyzing && !results && !error && (
            <div className="h-full min-h-[400px] border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-center p-8 bg-white/50">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <Target size={32} className="text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-900 text-lg mb-2">Your AI-powered analysis will appear here</h3>
              <p className="text-gray-500 max-w-sm text-sm">Upload your resume and click Analyze with Gemini to get detailed ATS insights.</p>
            </div>
          )}

          {/* Loading State */}
          {isAnalyzing && (
            <div className="space-y-4">
              <div className="text-center mb-6 text-sm font-medium text-gray-500 animate-pulse">
                Gemini is reading your resume...
              </div>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-xl p-6 shadow-sm flex flex-col gap-4">
                  <div className="h-6 bg-gray-200 rounded-md w-1/3 animate-pulse" />
                  <div className="h-4 bg-gray-100 rounded-md w-full animate-pulse" />
                  <div className="h-4 bg-gray-100 rounded-md w-4/5 animate-pulse" />
                </div>
              ))}
            </div>
          )}

          {/* Results State */}
          {results && !isAnalyzing && (
            <div className="space-y-6">
              <AnimatePresence>
                
                {/* Card 1: ATS Score */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * 1 }} className="bg-white rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-center gap-8">
                  <div className="relative w-[180px] h-[180px]">
                    <RadialBarChart 
                      width={180} 
                      height={180} 
                      innerRadius="70%" 
                      outerRadius="100%" 
                      data={[{ value: results.atsScore, fill: getScoreColor(results.atsScore) }]} 
                      startAngle={90} 
                      endAngle={-270}
                    >
                      <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                      <RadialBar minAngle={15} background={{ fill: '#f3f4f6' }} clockWise={true} dataKey="value" cornerRadius={10} />
                    </RadialBarChart>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-bold text-gray-900">{results.atsScore}</span>
                      <span className="text-xs text-gray-500">/ 100</span>
                    </div>
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">ATS Score</h3>
                    <div className="inline-block px-3 py-1 rounded-full text-sm font-medium mb-3" style={{ backgroundColor: `${getScoreColor(results.atsScore)}20`, color: getScoreColor(results.atsScore) }}>
                      {results.scoreLabel}
                    </div>
                    <p className="text-gray-500 text-sm italic mb-4">"{results.scoreReason}"</p>
                    <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                      {results.predicted_role && (
                        <span className="bg-green-600 text-white text-xs px-2.5 py-1 rounded font-bold shadow-sm">Predicted Role: {results.predicted_role}</span>
                      )}
                      <span className="bg-[#E8470A] text-white text-xs px-2 py-1 rounded">Cluster: {results.cluster}</span>
                      <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded border border-gray-200">Confidence: {results.clusterConfidence}%</span>
                    </div>
                  </div>
                </motion.div>

                {/* Card 2: Sections */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * 2 }} className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="font-semibold text-gray-900 text-lg mb-1">Resume Sections</h3>
                  <p className="text-sm text-gray-500 mb-5">Required sections detected in your resume</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: 'contactInfo', label: 'Contact Information', req: true },
                      { key: 'summary', label: 'Professional Summary', req: true },
                      { key: 'experience', label: 'Work Experience', req: true },
                      { key: 'education', label: 'Education', req: true },
                      { key: 'skills', label: 'Skills', req: true },
                      { key: 'certifications', label: 'Certifications', req: false },
                      { key: 'projects', label: 'Projects', req: false },
                      { key: 'achievements', label: 'Achievements', req: false },
                    ].map(sec => {
                      const isFound = results.sectionsFound?.[sec.key];
                      return (
                        <div key={sec.key} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                          <span className="text-sm font-medium text-gray-700">{sec.label}</span>
                          <div className="flex items-center gap-1.5">
                            {isFound ? (
                              <><CheckCircle size={16} className="text-green-500" /><span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Found</span></>
                            ) : sec.req ? (
                              <><XCircle size={16} className="text-red-500" /><span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Missing</span></>
                            ) : (
                              <><MinusCircle size={16} className="text-gray-400" /><span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Optional</span></>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>

                {/* Card 3: Skills Analysis */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * 3 }} className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="font-semibold text-gray-900 text-lg mb-5">Skill Analysis</h3>
                  
                  <div className="space-y-6">
                    {/* Detected */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Skills You Have</span>
                        <span className="text-xs text-gray-500">{results.detectedSkills?.length || 0} skills detected</span>
                      </div>
                      <div className="p-4 rounded-xl bg-green-50/50 border border-green-100 flex flex-wrap gap-2">
                        {results.detectedSkills?.length > 0 ? results.detectedSkills.map((s, i) => (
                          <span key={i} className="px-2.5 py-1 bg-[#DCFCE7] text-[#166534] text-xs rounded-full border border-green-200">{s}</span>
                        )) : <span className="text-sm text-gray-400 italic">None detected</span>}
                      </div>
                    </div>

                    {/* Missing */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Skills to Add</span>
                        <span className="text-xs text-gray-500">{results.missingSkills?.length || 0} skills missing</span>
                      </div>
                      <div className="p-4 rounded-xl bg-red-50/50 border border-red-100 flex flex-wrap gap-2">
                        {results.missingSkills?.length > 0 ? results.missingSkills.map((s, i) => (
                          <span key={i} className="px-2.5 py-1 bg-[#FEE2E2] text-[#991B1B] text-xs rounded-full border border-red-200">{s}</span>
                        )) : <span className="text-sm text-gray-400 italic">None missing</span>}
                      </div>
                    </div>

                    {/* Extra */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Additional Strengths</span>
                        <span className="text-xs text-gray-500">Skills you have beyond typical requirements</span>
                      </div>
                      <div className="p-4 rounded-xl bg-gray-50/50 border border-gray-100 flex flex-wrap gap-2">
                        {results.extraSkills?.length > 0 ? results.extraSkills.map((s, i) => (
                          <span key={i} className="px-2.5 py-1 bg-[#F3F4F6] text-[#6B7280] text-xs rounded-full border border-gray-200">{s}</span>
                        )) : <span className="text-sm text-gray-400 italic">None found</span>}
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Card 4: JD Match (Conditional) */}
                {results.jdMatchScore !== undefined && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * 4 }} className="bg-white rounded-xl p-6 shadow-sm border border-orange-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-2 h-full bg-[#E8470A]" />
                    <h3 className="font-semibold text-gray-900 text-lg mb-6">Job Description Match</h3>
                    
                    <div className="flex flex-col md:flex-row gap-6 mb-6">
                      <div className="flex-shrink-0 flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="text-4xl font-bold" style={{ color: getScoreColor(results.jdMatchScore) }}>
                          {results.jdMatchScore}%
                        </div>
                        <div className={`mt-2 px-3 py-1 rounded-full text-xs font-medium ${getReadinessColorClass(results.roleReadinessLabel)}`}>
                          {results.roleReadinessLabel}
                        </div>
                      </div>

                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                          <span className="text-xs font-medium text-green-800 block mb-2">Matched Keywords</span>
                          <div className="flex flex-wrap gap-1.5">
                            {results.jdMatchedKeywords?.map((k, i) => <span key={i} className="px-2 py-0.5 bg-[#DCFCE7] text-[#166534] text-[10px] rounded-full">{k}</span>)}
                          </div>
                        </div>
                        <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                          <span className="text-xs font-medium text-red-800 block mb-2">Missing Keywords</span>
                          <div className="flex flex-wrap gap-1.5">
                            {results.jdMissingKeywords?.map((k, i) => <span key={i} className="px-2 py-0.5 bg-[#FEE2E2] text-[#991B1B] text-[10px] rounded-full">{k}</span>)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded font-medium">This role belongs to → {results.jdCluster}</span>
                      </div>
                      <p className="text-xs text-gray-500 italic mb-4">{results.jdClusterReason}</p>
                      
                      {results.cluster === results.jdCluster ? (
                        <div className="p-3 bg-green-100 text-green-800 rounded-lg text-sm border border-green-200 flex items-center gap-2">
                          🎯 You're already in the right skill profile!
                        </div>
                      ) : (
                        <div className="p-3 bg-orange-50 text-orange-800 rounded-lg text-sm border border-orange-200">
                          <p className="mb-2">You're in <strong>{results.cluster}</strong>. This role needs <strong>{results.jdCluster}</strong> profile.</p>
                          <div className="flex items-center justify-center gap-2 text-xs font-mono text-orange-600 bg-orange-100/50 p-2 rounded">
                            {results.cluster} <span className="opacity-50">——→</span> {results.jdCluster}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Card 5: Bullet Point Rewriter */}
                {results.bulletPointQuality?.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * 5 }} className="bg-white rounded-xl p-6 shadow-sm">
                    <h3 className="font-semibold text-gray-900 text-lg mb-1">Bullet Point Improvements</h3>
                    <p className="text-sm text-gray-500 mb-5">Gemini identified weak bullet points and rewrote them</p>
                    
                    <div className="space-y-4">
                      {results.bulletPointQuality.map((bp, i) => (
                        <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                          <div className="p-4 bg-[#FEF2F2] border-b border-[#FECACA]">
                            <span className="text-xs font-semibold text-red-800 uppercase tracking-wider block mb-1">Original</span>
                            <p className="text-sm text-gray-700">{bp.original}</p>
                          </div>
                          <div className="p-4 bg-[#F0FDF4] border-b border-[#BBF7D0] relative group">
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-xs font-semibold text-green-800 uppercase tracking-wider">Improved ✨</span>
                              <button 
                                onClick={() => navigator.clipboard.writeText(bp.improved)}
                                className="text-xs flex items-center gap-1 px-2 py-1 border border-[#E8470A] text-[#E8470A] rounded hover:bg-[#E8470A] hover:text-white transition-colors"
                              >
                                <Copy size={12} /> Copy
                              </button>
                            </div>
                            <p className="text-sm text-gray-900 mb-3 pr-16">{bp.improved}</p>
                            <p className="text-xs text-gray-500 italic bg-white/50 p-2 rounded border border-green-100">Why: {bp.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Card 6: Improvement Roadmap */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * 6 }} className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="font-semibold text-gray-900 text-lg mb-1">Your Improvement Roadmap</h3>
                  <p className="text-sm text-gray-500 mb-5">Specific actions to improve your resume score</p>
                  
                  <div className="space-y-3 mb-6">
                    {results.improvementSuggestions?.map((sug, i) => {
                      let priorityClass = "bg-[#F3F4F6] text-[#6B7280]";
                      let priorityLabel = "Good to Have";
                      if (i < 3) {
                        priorityClass = "bg-[#FEE2E2] text-[#991B1B]";
                        priorityLabel = "High Priority";
                      } else if (i < 6) {
                        priorityClass = "bg-[#FEF9C3] text-[#854D0E]";
                        priorityLabel = "Medium Priority";
                      }

                      return (
                        <div key={i} className="flex gap-3 p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-[#E8470A] text-xs font-bold flex items-center justify-center mt-0.5">
                            {i + 1}
                          </span>
                          <div>
                            <p className="text-sm text-gray-800 mb-1">{sug}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${priorityClass}`}>{priorityLabel}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-[#FFF3EE] p-4 rounded-xl border border-orange-100">
                    <span className="text-xs font-semibold text-[#E8470A] uppercase tracking-wider mb-2 block">Gemini's Overall Feedback</span>
                    <p className="text-sm text-gray-700 italic leading-relaxed">{results.overallFeedback}</p>
                  </div>
                </motion.div>

                {/* Card 7: Formatting Issues */}
                {results.formattingIssues !== undefined && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * 7 }} className="bg-white rounded-xl p-6 shadow-sm">
                    <h3 className="font-semibold text-gray-900 text-lg mb-1">Formatting Issues</h3>
                    <p className="text-sm text-gray-500 mb-5">These formatting problems may cause ATS to misread your resume</p>
                    
                    {results.formattingIssues?.length > 0 ? (
                      <ul className="space-y-3">
                        {results.formattingIssues.map((issue, i) => (
                          <li key={i} className="flex gap-3 items-start p-3 bg-orange-50/50 border border-orange-100 rounded-lg">
                            <AlertTriangle size={18} className="text-[#E8470A] flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-gray-700">{issue}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="flex items-center gap-2 p-4 bg-green-50 text-green-700 rounded-lg border border-green-100">
                        <Check size={20} className="text-green-500" />
                        <span className="text-sm font-medium">No major formatting issues detected!</span>
                      </div>
                    )}
                  </motion.div>
                )}
                
                {/* Export & Actions Footer */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 * 8 }} className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-gray-200">
                  <button 
                    onClick={copyReport}
                    className="flex-1 py-3 px-4 flex items-center justify-center gap-2 border-2 border-[#E8470A] text-[#E8470A] rounded-xl font-medium hover:bg-orange-50 transition-colors"
                  >
                    {copiedText ? <Check size={18} /> : <Copy size={18} />}
                    {copiedText ? "Copied!" : "📋 Copy Full Report"}
                  </button>
                  <button 
                    onClick={resetAll}
                    className="flex-1 py-3 px-4 flex items-center justify-center gap-2 bg-[#E8470A] text-white rounded-xl font-medium hover:bg-[#D13D06] transition-colors"
                  >
                    <RotateCcw size={18} />
                    🔄 Analyze Another Resume
                  </button>
                </motion.div>

              </AnimatePresence>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
