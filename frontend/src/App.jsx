import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Database, Target, LayoutDashboard, Menu, ScanSearch, Upload, X, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { AppDataContext, fetchJSON, pageVariants, pageTransition } from './utils';
import DashboardPage from './pages/Dashboard';
import AnalyzePage from './pages/Analyze';
import BulkUploadPage from './pages/BulkUpload';
import ATSEditorPage from './pages/ATSEditor';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/analyze', label: 'Analyze', icon: ScanSearch },
  { to: '/bulk', label: 'Bulk Upload', icon: Upload },
  { to: '/role-readiness', label: 'Role Readiness', icon: Target },
];

function ShellNavbar({ onMenuOpen }) {
  return (
    <header className="navbar-shell">
      <div className="navbar-inner">
        <Link to="/" className="brand">
          <span className="brand-mark"><Database size={16} /></span>
          <span>FitSift</span>
        </Link>
        <nav className="nav-links desktop-only">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="nav-link-inner">
                <item.icon size={15} />
                <span className="nav-link-text">{item.label}</span>
              </span>
            </NavLink>
          ))}
        </nav>
        <div className="nav-actions">
          <Link to="/analyze" className="btn-cta desktop-only">Get Started <ArrowRight size={15} /></Link>
          <button type="button" className="menu-button mobile-only" onClick={onMenuOpen}><Menu size={18} /></button>
        </div>
      </div>
    </header>
  );
}

function MobileMenu({ open, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="mobile-menu-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="mobile-menu-panel" initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="mobile-menu-top"><span>Navigation</span><button type="button" className="icon-button" onClick={onClose}><X size={16} /></button></div>
            <div className="mobile-menu-links">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={onClose}>
                  {({ isActive }) => (
                    <span className={`mobile-nav-link ${isActive ? 'active' : ''}`}>
                      <item.icon size={15} /><span>{item.label}</span>
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AppShell() {
  const location = useLocation();
  const [stats, setStats] = useState(null);
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const [s, c] = await Promise.all([fetchJSON('/stats'), fetchJSON('/clusters')]);
        if (!alive) return;
        setStats(s); setClusters(c);
      } catch (e) { if (alive) setError(e.message || 'Failed to load data.'); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const Page = ({ children }) => (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>{children}</motion.div>
  );

  return (
    <AppDataContext.Provider value={{ stats, clusters, loading, error }}>
      <div className="app-shell">
        <ShellNavbar onMenuOpen={() => setMobileMenuOpen(true)} />
        <MobileMenu open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        <main className="app-main">
          {error && <div className="notice-banner">{error}</div>}
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Page><DashboardPage /></Page>} />
              <Route path="/analyze" element={<Page><AnalyzePage /></Page>} />
              <Route path="/bulk" element={<Page><BulkUploadPage /></Page>} />
              <Route path="/role-readiness" element={<Page><ATSEditorPage /></Page>} />
            </Routes>
          </AnimatePresence>
        </main>
      </div>
    </AppDataContext.Provider>
  );
}

export default function App() { return <AppShell />; }
