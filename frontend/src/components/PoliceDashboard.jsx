import React, { useState, useEffect, useRef } from 'react';
import Layout from './shared/Layout';
import NotificationModal from './shared/NotificationModal';
import HashChainModal from './shared/HashChainModal';
import { 
  fetchCases, fetchCaseStats, createCase, updateCase, deleteCase, 
  fetchCaseDetail, uploadFile, deleteDocument, searchCaseDocuments, 
  fetchDocumentText, downloadUrl,
  fetchCaseHashChain, verifyCaseIntegrity, simulateDocumentTamper,
  restoreDocumentTamper, fetchSystemIntegrity
} from '../lib/api.js';

const navItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'mycases', label: 'My Cases' },
  { id: 'allcases', label: 'Show All Cases' },
  { id: 'createcase', label: 'Create New Case' },
  { id: 'versions', label: 'Hash Chain & Integrity' },
  { id: 'activity', label: 'My Activity' },
  { id: 'profile', label: 'Profile' },
];

const CASE_CATEGORIES = [
  { id: 'fir_police_reports', label: 'FIRs and police reports', desc: 'First Information Reports, formal complaints, preliminary inquiry reports (PyMuPDF + OCR & BART Summary Enabled)', is_fir: true },
  { id: 'investigation_records', label: 'Investigation records', desc: 'Case diary entries, inspection notes, scene of crime reports' },
  { id: 'witness_statements', label: 'Witness statements', desc: 'Recorded statements under Section 161/164 CrPC / BNSS' },
  { id: 'charge_sheets', label: 'Charge sheets', desc: 'Final police investigation reports / charge sheets submitted to court' },
  { id: 'court_filings', label: 'Court filings', desc: 'Judicial petitions, remand applications, bail applications, affidavits' },
  { id: 'evidence_records', label: 'Evidence records', desc: 'Panchnamas, recovery memos, seizure lists, chain of custody logs' },
  { id: 'forensic_reports', label: 'Forensic reports', desc: 'Ballistic, chemical, digital cyber forensics, post-mortem / autopsy' },
  { id: 'legal_notices_judgments', label: 'Legal notices and judgments', desc: 'Statutory notices, summons, court orders, bail orders, judgments' },
];

export default function PoliceDashboard({ onLogout }) {
  const [activeNav, setActiveNav] = useState('dashboard');
  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [myCasesStatusFilter, setMyCasesStatusFilter] = useState('All');
  const [notif, setNotif] = useState({ isOpen: false, title: '', message: '', type: 'success' });

  const [systemIntegrity, setSystemIntegrity] = useState(null);

  const loadSystemIntegrity = async () => {
    try {
      const data = await fetchSystemIntegrity();
      setSystemIntegrity(data);
      return data;
    } catch (err) {
      console.error('Failed to load system integrity', err);
      return null;
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [casesList, statsData, integData] = await Promise.all([
        fetchCases(),
        fetchCaseStats(),
        loadSystemIntegrity()
      ]);
      setCases(casesList || []);
      setStats(statsData || {});
      if (casesList && casesList.length > 0 && !selectedCaseId) {
        setSelectedCaseId(casesList[0].id);
      }
    } catch (err) {
      console.error('Failed to load cases data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleNavWithFilter = (nav, filter = 'All') => {
    setMyCasesStatusFilter(filter);
    setActiveNav(nav);
  };

  const handleSelectCase = (caseId) => {
    setSelectedCaseId(caseId);
    setActiveNav('chargesheet');
  };

  const handleCaseCreated = async (newCase) => {
    await loadData();
    setSelectedCaseId(newCase.id);
    setActiveNav('chargesheet');
    setNotif({
      isOpen: true,
      title: 'Case Registration Successful',
      message: `Case ${newCase.case_number} registered in secure database docket.\nYou may now upload FIRs, witness statements, and evidence files.`,
      type: 'success'
    });
  };

  const handleDeleteCase = async (caseId, caseNumber) => {
    if (!confirm(`Are you sure you want to permanently delete case ${caseNumber} and all its documents?`)) return;
    try {
      await deleteCase(caseId);
      await loadData();
      if (selectedCaseId === caseId) setSelectedCaseId(null);
      setActiveNav('mycases');
      setNotif({
        isOpen: true,
        title: 'Case Record Deleted',
        message: `Case ${caseNumber} and associated records successfully removed.`,
        type: 'info'
      });
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const unreadAlertsCount =
    cases.filter(c => c.priority === 'urgent').length +
    (systemIntegrity?.tampered_cases_count || 0);

  return (
    <Layout
      title="Law Enforcement & Investigation Portal"
      titleIcon="🛡️"
      userLabel="Investigating Officer"
      userIcon=""
      navItems={navItems}
      activeNav={activeNav}
      onNavChange={(nav) => handleNavWithFilter(nav, 'All')}
      onLogout={onLogout}
      unreadCount={unreadAlertsCount}
    >
      <NotificationModal
        isOpen={notif.isOpen}
        onClose={() => setNotif(prev => ({ ...prev, isOpen: false }))}
        title={notif.title}
        message={notif.message}
        type={notif.type}
      />

      {activeNav === 'dashboard' && (
        <DashboardView
          cases={cases}
          stats={stats}
          systemIntegrity={systemIntegrity}
          unreadCount={unreadAlertsCount}
          onNav={handleNavWithFilter}
          onSelectCase={handleSelectCase}
        />
      )}

      {activeNav === 'mycases' && (
        <MyCasesView
          cases={cases}
          initialStatusFilter={myCasesStatusFilter}
          onSelect={handleSelectCase}
          onDelete={handleDeleteCase}
          onNav={handleNavWithFilter}
        />
      )}

      {activeNav === 'allcases' && (
        <AllCasesView
          cases={cases}
          onSelect={handleSelectCase}
          onNav={handleNavWithFilter}
        />
      )}

      {activeNav === 'createcase' && (
        <CreateCaseView
          onCreated={handleCaseCreated}
          onNav={handleNavWithFilter}
        />
      )}

      {activeNav === 'chargesheet' && (
        <ChargeSheetView
          caseId={selectedCaseId}
          onBack={() => handleNavWithFilter('mycases', 'All')}
          onRefreshCases={loadData}
          onNav={handleNavWithFilter}
        />
      )}

      {activeNav === 'versions' && (
        <VersionHistoryView
          cases={cases}
          systemIntegrity={systemIntegrity}
          onRefreshIntegrity={loadSystemIntegrity}
          onSelectCase={handleSelectCase}
          onNav={handleNavWithFilter}
        />
      )}

      {activeNav === 'activity' && (
        <MyActivityView
          cases={cases}
          onBack={() => handleNavWithFilter('dashboard', 'All')}
        />
      )}

      {activeNav === 'profile' && (
        <ProfileView
          onBack={() => handleNavWithFilter('dashboard', 'All')}
        />
      )}

      {activeNav === 'alerts' && (
        <AlertsView
          cases={cases}
          systemIntegrity={systemIntegrity}
          onSelectCase={handleSelectCase}
          onNav={handleNavWithFilter}
        />
      )}
    </Layout>
  );
}

// ── Dashboard View ─────────────────────────────────────────────────────────────

function DashboardView({ cases, stats, systemIntegrity, unreadCount, onNav, onSelectCase }) {
  const totalCases = stats.total_cases ?? cases.length;
  const underInv = stats.under_investigation ?? cases.filter(c => c.status === 'under_investigation').length;
  const chargesheeted = stats.chargesheeted ?? cases.filter(c => c.status === 'chargesheeted').length;
  const totalDocs = stats.total_documents ?? 0;

  const pendingActions = cases.filter(c => c.status === 'under_investigation');

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px', color: 'var(--color-ink)' }}>
          Police Officer Investigation Dashboard
        </h2>
        <p style={{ fontSize: 13, color: 'var(--color-charcoal)', margin: 0, fontWeight: 500 }}>
          Investigating Officer (IO) · Cyber Crime & Special Investigation Division
        </p>
      </div>

      {/* Global Tamper Alert Banner */}
      {systemIntegrity?.system_status === 'TAMPER_DETECTED' && (
        <div style={{ background: '#fef2f2', border: '2px solid #ef4444', borderRadius: 8, padding: '14px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 26 }}>🚨</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#b91c1c', letterSpacing: '0.04em' }}>
                SECURITY TAMPER ALERT: DOCUMENT INTEGRITY BREACH DETECTED
              </div>
              <div style={{ fontSize: 12, color: '#7f1d1d', marginTop: 2 }}>
                Cryptographic hash chain audit detected {systemIntegrity.total_tampered_documents} tampered document(s) in {systemIntegrity.tampered_cases_count} case(s). Physical disk bytes do not match recorded SHA-256 block ledger!
              </div>
            </div>
          </div>
          <button onClick={() => onNav('versions', 'All')} className="btn-primary" style={{ background: '#b91c1c', fontSize: 11, padding: '8px 16px' }}>
            AUDIT HASH CHAIN LEDGER →
          </button>
        </div>
      )}

      {/* STAT CARDS - Computed strictly from real database counts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Assigned Cases', value: totalCases.toString(), target: 'mycases', filter: 'All' },
          { label: 'Under Active Investigation', value: underInv.toString(), target: 'mycases', filter: 'under_investigation' },
          { label: 'Chargesheeted / Filed', value: chargesheeted.toString(), target: 'mycases', filter: 'chargesheeted' },
          { label: 'Vaulted Evidentiary Documents', value: totalDocs.toString(), warn: totalDocs > 0, target: 'mycases', filter: 'All' },
        ].map(s => (
          <div key={s.label} className="stat-card" onClick={() => onNav(s.target, s.filter)} title={`Navigate to ${s.label}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-charcoal)', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 32, fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: s.warn ? 'var(--accent-gold)' : 'var(--color-ink)', lineHeight: 1 }}>
                  {s.value}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        <div className="section-card" onClick={() => onNav('mycases')} style={{ cursor: 'pointer' }} title="Click to view My Cases">
          <div className="section-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Active Cases Docket</span>
            <span style={{ fontSize: 11, color: 'var(--primary)', textTransform: 'none', fontWeight: 600 }}>View All My Cases →</span>
          </div>
          <div className="section-card-body" style={{ padding: 0 }}>
            {cases.length === 0 ? (
              <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--color-body)' }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>📂</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>No cases registered yet</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Click "Create New Case" to register your first investigation docket.</div>
              </div>
            ) : (
              cases.slice(0, 4).map(c => (
                <div
                  key={c.id}
                  style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={(e) => { e.stopPropagation(); onSelectCase(c.id); }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{c.case_number}</span>
                    <span className={`badge ${c.status === 'under_investigation' ? 'badge-active' : c.status === 'chargesheeted' ? 'badge-pending' : 'badge-done'}`}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 2 }}>{c.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-charcoal)', fontWeight: 500 }}>
                    {c.crime_type} · <span style={{ color: '#000000', fontWeight: 700 }}>IO: {c.investigating_officer || 'Investigating Officer'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header">Police Station Investigation Actions</div>
          <div className="section-card-body">
            {pendingActions.length === 0 ? (
              <div style={{ padding: '16px 0', color: 'var(--color-charcoal)', fontStyle: 'italic', fontSize: 13, textAlign: 'center' }}>
                No pending officer action items. Register a case docket to begin investigation.
              </div>
            ) : (
              pendingActions.slice(0, 4).map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 14, color: 'var(--accent-gold)', fontWeight: 700 }}>•</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>
                    Case {c.case_number}: Inquire into {c.title} and upload evidentiary records
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="section-card">
        <div
          className="section-card-header"
          onClick={() => onNav('mycases')}
          style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span>Investigation Overview Table</span>
          <span style={{ fontSize: 11, color: 'var(--accent-gold)', textTransform: 'uppercase', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.06em', fontWeight: 700 }}>
            REGISTER NEW DOSSIER →
          </span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Case Number</th>
              <th>Investigation Title</th>
              <th>Penal Sections / Crime</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '28px', color: 'var(--color-body)' }}>
                  No case dossiers found in database.
                </td>
              </tr>
            ) : (
              cases.slice(0, 5).map(c => (
                <tr key={c.id} onClick={() => onSelectCase(c.id)} style={{ cursor: 'pointer' }}>
                  <td className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{c.case_number}</td>
                  <td style={{ fontWeight: 600 }}>{c.title}</td>
                  <td>{c.crime_type}</td>
                  <td>
                    <span className="badge badge-warning" style={{ fontSize: 10 }}>{c.priority.toUpperCase()}</span>
                  </td>
                  <td>
                    <span className={`badge ${c.status === 'under_investigation' ? 'badge-active' : c.status === 'chargesheeted' ? 'badge-pending' : 'badge-done'}`}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn-secondary"
                      style={{ padding: '4px 10px', fontSize: 11 }}
                      onClick={(e) => { e.stopPropagation(); onSelectCase(c.id); }}
                    >
                      OPEN DOSSIER
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── My Cases View ─────────────────────────────────────────────────────────────

function MyCasesView({ cases, onSelect, onDelete, onNav, initialStatusFilter = 'All' }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);

  const filteredCases = cases.filter(c => {
    const matchesSearch =
      !searchTerm ||
      c.case_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.crime_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.investigating_officer && c.investigating_officer.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      statusFilter === 'All' ||
      c.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px', color: 'var(--color-ink)' }}>
            Investigative Case Dossiers
          </h2>
          <p style={{ fontSize: 13, color: 'var(--color-charcoal)', margin: 0, fontWeight: 500 }}>
            Official Law Enforcement Investigation Files & Evidentiary Folders
          </p>
        </div>
        <button
          onClick={() => onNav('createcase')}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ffffff' }}
        >
          <span style={{ color: '#ffffff' }}>+ REGISTER NEW CASE</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="section-card" style={{ padding: 14, marginBottom: 18 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <input
              type="text"
              placeholder="Search by FIR/Case Number, Crime Type, Officer, Title..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="field-input"
            />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', fontWeight: 700, color: 'var(--color-charcoal)' }}>
              Status:
            </span>
            {['All', 'under_investigation', 'chargesheeted', 'closed'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '6px 12px',
                  background: statusFilter === st ? '#1A1A1A' : '#ffffff',
                  color: statusFilter === st ? '#ffffff' : 'var(--color-charcoal)',
                  border: '1px solid #cbd5e1',
                  borderRadius: 4,
                  fontSize: 11,
                  fontFamily: 'Oswald, sans-serif',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  cursor: 'pointer'
                }}
              >
                {st === 'All' ? 'ALL' : st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cases Table */}
      <div className="section-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Case ID</th>
              <th>Investigation Title</th>
              <th>Penal Sections / Crime</th>
              <th>Investigating Officer</th>
              <th>Priority</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCases.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--color-body)' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-ink)' }}>No matching cases found</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Try clearing search filters or click "Register New Case" to create one.</div>
                </td>
              </tr>
            ) : (
              filteredCases.map(c => (
                <tr key={c.id} onClick={() => onSelect(c.id)} style={{ cursor: 'pointer' }}>
                  <td className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{c.case_number}</td>
                  <td style={{ fontWeight: 600 }}>{c.title}</td>
                  <td>{c.crime_type}</td>
                  <td style={{ fontWeight: 500 }}>{c.investigating_officer || 'Investigating Officer'}</td>
                  <td>
                    <span className="badge badge-warning" style={{ fontSize: 10 }}>{c.priority.toUpperCase()}</span>
                  </td>
                  <td>
                    <span className={`badge ${c.status === 'under_investigation' ? 'badge-active' : c.status === 'chargesheeted' ? 'badge-pending' : 'badge-done'}`}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                      <button
                        className="btn-primary"
                        style={{ padding: '5px 12px', fontSize: 11 }}
                        onClick={() => onSelect(c.id)}
                      >
                        OPEN DOSSIER
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ padding: '5px 8px', fontSize: 11, color: '#b91c1c', borderColor: '#fca5a5' }}
                        title="Delete Case"
                        onClick={() => onDelete(c.id, c.case_number)}
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── All Cases View (Department Wide) ──────────────────────────────────────────

function AllCasesView({ cases, onSelect, onNav }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px', color: 'var(--color-ink)' }}>
            Department-Wide Investigation Dockets
          </h2>
          <p style={{ fontSize: 13, color: 'var(--color-charcoal)', margin: 0, fontWeight: 500 }}>
            Unified Legal Record Access Across Specialized Investigative Units
          </p>
        </div>
        <button onClick={() => onNav('createcase')} className="btn-primary">
          + REGISTER CASE
        </button>
      </div>

      <div className="section-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Case Number</th>
              <th>Title</th>
              <th>Crime Category</th>
              <th>Investigating Officer</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--color-body)' }}>
                  No registered department cases available.
                </td>
              </tr>
            ) : (
              cases.map(c => (
                <tr key={c.id} onClick={() => onSelect(c.id)} style={{ cursor: 'pointer' }}>
                  <td className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{c.case_number}</td>
                  <td style={{ fontWeight: 600 }}>{c.title}</td>
                  <td>{c.crime_type}</td>
                  <td>{c.investigating_officer || 'Investigating Officer'}</td>
                  <td>
                    <span className={`badge ${c.status === 'under_investigation' ? 'badge-active' : 'badge-pending'}`}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => onSelect(c.id)}>
                      VIEW DOSSIER
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Create Case View ──────────────────────────────────────────────────────────

function CreateCaseView({ onCreated, onNav }) {
  const [formData, setFormData] = useState({
    case_number: '',
    title: '',
    crime_type: 'Theft / Burglary (BNS 303 / IPC 379)',
    investigating_officer: 'Investigating Officer',
    police_station: 'Cyber Crime & Special Branch, HQ',
    priority: 'high',
    status: 'under_investigation',
    incident_date: new Date().toISOString().slice(0, 10),
    description: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.case_number.trim()) {
      setError('Case Number and Case Title are required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const created = await createCase(formData);
      onCreated(created);
    } catch (err) {
      setError(err.message || 'Failed to create case dossier.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px', color: 'var(--color-ink)' }}>
            Create New Investigation Case (FIR)
          </h2>
          <p style={{ fontSize: 13, color: 'var(--color-charcoal)', margin: 0, fontWeight: 500 }}>
            Official Case Registration & Evidentiary Docket Ingestion
          </p>
        </div>
        <button type="button" onClick={() => onNav('mycases')} className="btn-secondary" style={{ fontSize: 12 }}>
          ← BACK TO MY CASES
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="section-card" style={{ marginBottom: 20 }}>
          <div className="section-card-header">Case Meta Data & Particulars</div>
          <div className="section-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', padding: '10px 14px', borderRadius: 4, color: '#b91c1c', fontSize: 13, fontWeight: 600 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'Oswald, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-charcoal)', marginBottom: 6, fontWeight: 700 }}>
                  FIR / Case Number *
                </label>
                <input
                  required
                  placeholder="e.g. FIR-2026/0142"
                  className="field-input mono"
                  type="text"
                  value={formData.case_number}
                  onChange={e => setFormData({ ...formData, case_number: e.target.value })}
                  style={{ fontWeight: 700, color: 'var(--primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'Oswald, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-charcoal)', marginBottom: 6, fontWeight: 700 }}>
                  Crime Category / Penal Sections *
                </label>
                <select
                  className="field-input"
                  value={formData.crime_type}
                  onChange={e => setFormData({ ...formData, crime_type: e.target.value })}
                >
                  <option>Theft / Burglary (BNS 303 / IPC 379)</option>
                  <option>Banking Fraud & Cybercrime (IT Act 66D / IPC 420)</option>
                  <option>Homicide / Attempt (BNS 103 / IPC 302)</option>
                  <option>Physical Assault & Grievous Hurt</option>
                  <option>Narcotics & NDPS Act Violation</option>
                  <option>Commercial Embezzlement</option>
                  <option>General IPC / BNS Incident</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'Oswald, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-charcoal)', marginBottom: 6, fontWeight: 700 }}>
                  Investigation Officer (IO) *
                </label>
                <input
                  required
                  className="field-input"
                  type="text"
                  value={formData.investigating_officer}
                  onChange={e => setFormData({ ...formData, investigating_officer: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'Oswald, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-charcoal)', marginBottom: 6, fontWeight: 700 }}>
                  Case Title / Investigation Brief *
                </label>
                <input
                  required
                  className="field-input"
                  type="text"
                  placeholder="e.g. Unauthorized Intrusion into Server Cluster"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'Oswald, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-charcoal)', marginBottom: 6, fontWeight: 700 }}>
                  Police Station / Jurisdiction
                </label>
                <input
                  className="field-input"
                  type="text"
                  value={formData.police_station}
                  onChange={e => setFormData({ ...formData, police_station: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'Oswald, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-charcoal)', marginBottom: 6, fontWeight: 700 }}>
                  Priority Level
                </label>
                <select
                  className="field-input"
                  value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: e.target.value })}
                >
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'Oswald, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-charcoal)', marginBottom: 6, fontWeight: 700 }}>
                  Incident Date
                </label>
                <input
                  className="field-input"
                  type="date"
                  value={formData.incident_date}
                  onChange={e => setFormData({ ...formData, incident_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontFamily: 'Oswald, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-charcoal)', marginBottom: 6, fontWeight: 700 }}>
                Incident Synopsis / Initial Report Summary
              </label>
              <textarea
                className="field-input"
                rows={4}
                placeholder="Narrative of complaint, source of information, scene findings, and initial police actions taken..."
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" onClick={() => onNav('mycases')} className="btn-secondary">
            CANCEL
          </button>
          <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: '12px 28px', fontSize: 14 }}>
            {submitting ? 'COMMITTING TO DATABASE...' : 'REGISTER CASE DOSSIER'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── ChargeSheetView / Case Workspace with 8 Subtabs & FIR OCR Pipeline ────────

function ChargeSheetView({ caseId, onBack, onRefreshCases, onNav }) {
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('fir_police_reports');
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [viewingDocModal, setViewingDocModal] = useState(null);
  const [docText, setDocText] = useState('');
  const [loadingDocText, setLoadingDocText] = useState(false);
  const [notif, setNotif] = useState({ isOpen: false, title: '', message: '', type: 'success' });

  const [showHashChainModal, setShowHashChainModal] = useState(false);
  const [verifyingIntegrity, setVerifyingIntegrity] = useState(false);

  const loadCase = async () => {
    if (!caseId) return;
    try {
      setLoading(true);
      const data = await fetchCaseDetail(caseId);
      setCaseData(data);
    } catch (err) {
      console.error('Failed to load case detail', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCase();
  }, [caseId]);

  const handleVerifyIntegrity = async () => {
    try {
      setVerifyingIntegrity(true);
      const res = await verifyCaseIntegrity(caseId);
      setCaseData(prev => ({ ...prev, integrity: res }));
      setNotif({
        isOpen: true,
        title: res.is_valid ? 'Integrity Audit Passed' : 'Tampering Detected!',
        message: res.is_valid
          ? `All ${res.total_blocks} chained evidence document(s) verified intact.\nSHA-256 digests and previous block pointers match.`
          : `ALERT: ${res.tampered_blocks_count} document(s) failed cryptographic check! Disk content does not match blockchain ledger.`,
        type: res.is_valid ? 'success' : 'error'
      });
      onRefreshCases?.();
    } catch (err) {
      alert('Integrity audit failed: ' + err.message);
    } finally {
      setVerifyingIntegrity(false);
    }
  };

  const handleSimulateTamper = async (docId) => {
    try {
      await simulateDocumentTamper(caseId, docId);
      await loadCase();
      onRefreshCases?.();
      setNotif({
        isOpen: true,
        title: 'Tamper Test Simulated',
        message: 'A byte alteration was injected into the disk file.\nNotice the red Tamper Alert and failed SHA-256 check.',
        type: 'warning'
      });
    } catch (err) {
      alert('Simulation failed: ' + err.message);
    }
  };

  const handleRestoreTamper = async (docId) => {
    try {
      await restoreDocumentTamper(caseId, docId);
      await loadCase();
      onRefreshCases?.();
      setNotif({
        isOpen: true,
        title: 'Original File Restored',
        message: 'Original evidence file bytes restored.\nHash chain cryptographic audit is once again 100% intact.',
        type: 'success'
      });
    } catch (err) {
      alert('Restore failed: ' + err.message);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await updateCase(caseId, { status: newStatus });
      setCaseData(prev => ({ ...prev, status: newStatus }));
      onRefreshCases?.();
      setNotif({
        isOpen: true,
        title: 'Status Updated',
        message: `Case status changed to ${newStatus.replace('_', ' ').toUpperCase()}`,
        type: 'success'
      });
    } catch (err) {
      alert('Status update failed: ' + err.message);
    }
  };

  const handleFileUpload = (catId, isFir = false) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.png,.jpg,.jpeg,.txt';
    input.onchange = async (evt) => {
      const file = evt.target.files?.[0];
      if (!file) return;

      setUploading(true);
      try {
        await uploadFile(file, caseId, catId);
        setNotif({
          isOpen: true,
          title: isFir ? 'FIR Ingestion Initiated' : 'Document Ingested',
          message: isFir
            ? `${file.name} uploaded successfully.\nPyMuPDF text extraction + OCR & DistilBART summarization started in background.`
            : `${file.name} securely archived in local storage under ${catId.replace(/_/g, ' ')}.`,
          type: 'success'
        });
        setTimeout(loadCase, 1000);
      } catch (err) {
        setNotif({
          isOpen: true,
          title: 'Upload Failed',
          message: err.message || 'File upload failed.',
          type: 'error'
        });
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const handleDeleteDoc = async (docId, fname) => {
    if (!confirm(`Delete ${fname} from case records?`)) return;
    try {
      await deleteDocument(docId);
      loadCase();
      setNotif({
        isOpen: true,
        title: 'Document Deleted',
        message: `${fname} removed from vault records.`,
        type: 'info'
      });
    } catch (err) {
      alert('Failed to delete document: ' + err.message);
    }
  };

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const res = await searchCaseDocuments(caseId, searchQuery.trim());
      setSearchResults(res);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const handleOpenDocModal = async (doc) => {
    setViewingDocModal(doc);
    setDocText('');
    setLoadingDocText(true);
    try {
      const res = await fetchDocumentText(doc.id);
      setDocText(res.text || 'No text extracted.');
    } catch (err) {
      setDocText('Extracted text unavailable.');
    } finally {
      setLoadingDocText(false);
    }
  };

  if (!caseId || (loading && !caseData)) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-charcoal)' }}>
        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Oswald, sans-serif' }}>LOADING CASE DOSSIER...</div>
      </div>
    );
  }

  const activeCategoryMeta = CASE_CATEGORIES.find(c => c.id === activeCategory) || CASE_CATEGORIES[0];
  const docsBySubtab = caseData.documents_by_subtab || {};
  const currentCategoryDocs = docsBySubtab[activeCategory] || [];

  return (
    <div>
      <NotificationModal
        isOpen={notif.isOpen}
        onClose={() => setNotif(prev => ({ ...prev, isOpen: false }))}
        title={notif.title}
        message={notif.message}
        type={notif.type}
      />

      {/* Document Viewer Modal */}
      {viewingDocModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#ffffff', border: '2px solid #1A1A1A', borderRadius: 8, width: '100%', maxWidth: 640, maxHeight: '85vh', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ background: '#1A1A1A', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--accent-gold)' }}>
              <div>
                <div style={{ fontSize: 11, fontFamily: 'Oswald, sans-serif', color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Government Law Enforcement Vault</div>
                <div style={{ fontSize: 16, color: '#ffffff', fontWeight: 700, margin: 0 }}>Document Inspection Viewer</div>
              </div>
              <button onClick={() => setViewingDocModal(null)} style={{ background: 'transparent', border: 'none', color: '#ffffff', fontSize: 18, cursor: 'pointer', fontWeight: 700 }}>✕</button>
            </div>

            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 6, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontFamily: 'Oswald, sans-serif', fontWeight: 700, marginBottom: 4 }}>File Particulars</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-ink)', marginBottom: 6 }}>{viewingDocModal.filename}</div>
                <div style={{ fontSize: 12, color: 'var(--color-charcoal)' }}>
                  Category: <strong>{viewingDocModal.subtab?.replace(/_/g, ' ')}</strong> · Size: <strong>{viewingDocModal.file_size_bytes ? (viewingDocModal.file_size_bytes / 1024).toFixed(1) + ' KB' : 'N/A'}</strong>
                </div>
              </div>

              {viewingDocModal.summary && (
                <div style={{ background: '#fefce8', border: '1px solid #fef08a', borderRadius: 6, padding: 14, marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: '#854d0e', textTransform: 'uppercase', fontFamily: 'Oswald, sans-serif', fontWeight: 700, marginBottom: 4 }}>
                    AI Generated Document Summary (DistilBART Pipeline)
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: '#713f12' }}>{viewingDocModal.summary}</div>
                </div>
              )}

              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6, padding: 14 }}>
                <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', fontFamily: 'Oswald, sans-serif', fontWeight: 700, marginBottom: 6 }}>
                  Extracted Text Content (PyMuPDF / OCR)
                </div>
                {loadingDocText ? (
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>Loading document text...</div>
                ) : (
                  <div className="mono" style={{ fontSize: 12, color: '#1e293b', whiteSpace: 'pre-wrap', maxHeight: 240, overflowY: 'auto', lineHeight: 1.6 }}>
                    {docText}
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="mono" style={{ fontSize: 11, color: '#64748b' }}>DOC-ID: {viewingDocModal.id}</span>
              <a href={downloadUrl(viewingDocModal.id)} download className="btn-primary" style={{ textDecoration: 'none', padding: '6px 16px', fontSize: 12 }}>
                DOWNLOAD ORIGINAL
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Case Header Dossier Banner */}
      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, padding: 20, marginBottom: 20, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <button onClick={onBack} className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }}>
                ← BACK
              </button>
              <span className="mono" style={{ background: '#1A1A1A', color: 'var(--accent-gold)', padding: '3px 10px', borderRadius: 4, fontWeight: 700, fontSize: 13 }}>
                {caseData.case_number}
              </span>
              <span className={`badge ${caseData.status === 'under_investigation' ? 'badge-active' : caseData.status === 'chargesheeted' ? 'badge-pending' : 'badge-done'}`}>
                {caseData.status.replace('_', ' ')}
              </span>
              <span className="badge badge-warning" style={{ fontSize: 10 }}>{caseData.priority?.toUpperCase()} PRIORITY</span>
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px', color: 'var(--color-ink)' }}>{caseData.title}</h1>
            <div style={{ fontSize: 13, color: 'var(--color-charcoal)' }}>
              Crime Classification: <strong>{caseData.crime_type}</strong> · Investigating Officer: <strong>{caseData.investigating_officer || 'Investigating Officer'}</strong> · Station: <strong>{caseData.police_station || 'HQ'}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 10, fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', color: 'var(--color-charcoal)', fontWeight: 700 }}>
                Update Case Status:
              </span>
              <select
                className="field-input"
                style={{ width: 'auto', padding: '5px 10px', fontSize: 12, fontWeight: 600 }}
                value={caseData.status}
                onChange={e => handleStatusChange(e.target.value)}
              >
                <option value="under_investigation">Under Investigation</option>
                <option value="chargesheeted">Chargesheeted</option>
                <option value="closed">Closed / Solved</option>
              </select>
            </div>
          </div>
        </div>

        {caseData.description && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9', fontSize: 13, color: 'var(--color-charcoal)', lineHeight: 1.6 }}>
            <strong>Incident Description:</strong> {caseData.description}
          </div>
        )}
      </div>

      {/* Cryptographic Hash Chain & Tamper Evidence Banner */}
      {caseData.integrity && (
        caseData.integrity.tamper_detected ? (
          <div style={{ background: '#fef2f2', border: '2px solid #ef4444', borderRadius: 8, padding: '16px 20px', marginBottom: 20, boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 28 }}>🚨</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#b91c1c', letterSpacing: '0.04em' }}>
                    CRITICAL TAMPER ALERT: DOCUMENT INTEGRITY COMPROMISED
                  </div>
                  <div style={{ fontSize: 13, color: '#7f1d1d', marginTop: 2 }}>
                    {caseData.integrity.tampered_blocks_count} document(s) failed cryptographic SHA-256 verification. Physical file content does not match the immutable blockchain ledger!
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowHashChainModal(true)} className="btn-secondary" style={{ background: '#ffffff', color: '#b91c1c', borderColor: '#ef4444', fontWeight: 700, fontSize: 12 }}>
                  🔗 INSPECT HASH CHAIN LEDGER
                </button>
                <button onClick={handleVerifyIntegrity} disabled={verifyingIntegrity} className="btn-primary" style={{ background: '#b91c1c', fontSize: 12 }}>
                  {verifyingIntegrity ? 'AUDITING...' : '🔄 RE-AUDIT INTEGRITY'}
                </button>
              </div>
            </div>

            {/* Tampered Documents Summary */}
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #fecaca', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {caseData.integrity.tampered_documents?.map((t, idx) => (
                <div key={idx} style={{ background: '#ffffff', padding: '8px 12px', borderRadius: 4, border: '1px solid #fca5a5', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ color: '#b91c1c' }}>Block #{t.block_index} ({t.filename}):</strong> <span style={{ color: '#4b5563' }}>{t.reason}</span>
                  </div>
                  <button onClick={() => handleRestoreTamper(t.document_id)} className="btn-secondary" style={{ padding: '3px 8px', fontSize: 11, background: '#f0fdf4', color: '#166534', borderColor: '#86efac', fontWeight: 700 }}>
                    ↺ Restore File
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: '12px 18px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>🛡️</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                  CRYPTOGRAPHIC HASH CHAIN: <span style={{ color: '#15803d' }}>INTACT & VERIFIED (0 TAMPERING DETECTED)</span>
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  {caseData.integrity.total_blocks} chained evidence block(s) · SHA-256 sequential non-repudiation log active
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowHashChainModal(true)} className="btn-secondary" style={{ padding: '6px 14px', fontSize: 11, fontWeight: 600 }}>
                🔗 VIEW HASH CHAIN LEDGER ({caseData.integrity.total_blocks})
              </button>
              <button onClick={handleVerifyIntegrity} disabled={verifyingIntegrity} className="btn-secondary" style={{ padding: '6px 14px', fontSize: 11 }}>
                {verifyingIntegrity ? 'AUDITING...' : 'VERIFY INTEGRITY'}
              </button>
            </div>
          </div>
        )
      )}

      {/* In-Case Semantic Search Section */}
      <div className="section-card" style={{ padding: 14, marginBottom: 20 }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              placeholder="Evidentiary Semantic Search: query keywords, forensic observations, or witness quotes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="field-input"
            />
          </div>
          <button type="submit" disabled={searching} className="btn-primary" style={{ padding: '9px 20px' }}>
            {searching ? 'SEARCHING...' : 'SEARCH CASE FILES'}
          </button>
          {searchResults && (
            <button type="button" onClick={() => { setSearchResults(null); setSearchQuery(''); }} className="btn-secondary">
              CLEAR
            </button>
          )}
        </form>

        {searchResults && (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ fontSize: 12, fontFamily: 'Oswald, sans-serif', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: 8 }}>
              Search Results ({searchResults.results_count} Matches for "{searchResults.query}")
            </div>
            {searchResults.hits.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--color-body)', padding: '10px 0' }}>No evidentiary chunks matched this search.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {searchResults.hits.map((h, i) => (
                  <div key={i} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 6, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>{h.filename} ({h.subtab?.replace(/_/g, ' ')})</span>
                      <span className="badge badge-active" style={{ fontSize: 10 }}>Score: {(h.similarity_score * 100).toFixed(0)}%</span>
                    </div>
                    <div className="mono" style={{ fontSize: 12, color: 'var(--color-ink)', lineHeight: 1.6, marginBottom: 4 }}>
                      "{h.text}"
                    </div>
                    {h.document_summary && (
                      <div style={{ fontSize: 11, color: '#b45309', marginTop: 4, fontWeight: 600 }}>
                        Summary: {h.document_summary}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 8 Case Categories / Subtabs */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
        {/* Left Subtab Navigation */}
        <div className="section-card" style={{ padding: 10 }}>
          <div style={{ fontSize: 11, fontFamily: 'Oswald, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-charcoal)', fontWeight: 700, padding: '6px 8px 10px', borderBottom: '1px solid var(--border)' }}>
            EVIDENTIARY CATEGORIES (8)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
            {CASE_CATEGORIES.map(cat => {
              const count = (docsBySubtab[cat.id] || []).length;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 4,
                    border: '1px solid',
                    borderColor: isActive ? 'var(--primary)' : 'transparent',
                    background: isActive ? '#1A1A1A' : '#ffffff',
                    color: isActive ? '#ffffff' : 'var(--color-ink)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: isActive ? '#ffffff' : 'var(--color-ink)' }}>
                      {cat.label}
                    </span>
                    {cat.is_fir && (
                      <span style={{ fontSize: 10, color: isActive ? 'var(--accent-gold)' : '#b45309', fontWeight: 700 }}>
                        OCR & AI Summary Enabled
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      background: isActive ? 'var(--accent-gold)' : '#e2e8f0',
                      color: isActive ? '#000000' : 'var(--color-charcoal)',
                      padding: '2px 7px',
                      borderRadius: 10,
                      fontSize: 11,
                      fontWeight: 700
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Active Subtab Documents Area */}
        <div className="section-card">
          <div className="section-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span>{activeCategoryMeta.label}</span>
              <div style={{ fontSize: 11, color: 'var(--color-charcoal)', fontWeight: 500, textTransform: 'none', marginTop: 2 }}>
                {activeCategoryMeta.desc}
              </div>
            </div>
            <button
              onClick={() => handleFileUpload(activeCategory, activeCategoryMeta.is_fir)}
              disabled={uploading}
              className="btn-primary"
              style={{ fontSize: 12, padding: '7px 16px' }}
            >
              {uploading ? 'INGESTING...' : '+ UPLOAD DOCUMENT'}
            </button>
          </div>

          <div className="section-card-body">
            {currentCategoryDocs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--color-body)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-ink)' }}>
                  No documents in {activeCategoryMeta.label}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-charcoal)', maxWidth: 420, margin: '6px auto 16px' }}>
                  {activeCategoryMeta.is_fir
                    ? 'Upload primary FIR document or police report. PyMuPDF & PaddleOCR will extract the text and generate a BART executive summary.'
                    : 'Upload case related attachments under this category. Documents will be stored in secure local storage.'}
                </div>
                <button
                  onClick={() => handleFileUpload(activeCategory, activeCategoryMeta.is_fir)}
                  disabled={uploading}
                  className="btn-secondary"
                  style={{ fontSize: 12 }}
                >
                  UPLOAD FIRST {activeCategoryMeta.label.toUpperCase()}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {currentCategoryDocs.map(doc => (
                  <div
                    key={doc.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 16 }}>📄</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-ink)' }}>{doc.filename}</span>
                          <span className={`badge ${doc.status === 'completed' ? 'badge-active' : 'badge-pending'}`}>
                            {doc.status}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-charcoal)' }}>
                          Size: <strong>{doc.file_size_bytes ? (doc.file_size_bytes / 1024).toFixed(1) + ' KB' : 'N/A'}</strong> · Pages: <strong>{doc.page_count || 1}</strong> · Date: <strong>{doc.upload_date}</strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn-secondary"
                          style={{ padding: '5px 12px', fontSize: 11 }}
                          onClick={() => handleOpenDocModal(doc)}
                        >
                          VIEW DOCUMENT
                        </button>
                        <a
                          href={downloadUrl(doc.id)}
                          download
                          className="btn-secondary"
                          style={{ padding: '5px 12px', fontSize: 11, textDecoration: 'none' }}
                        >
                          DOWNLOAD
                        </a>
                        <button
                          className="btn-secondary"
                          style={{ padding: '5px 8px', fontSize: 11, color: '#b91c1c', borderColor: '#fca5a5' }}
                          title="Delete document"
                          onClick={() => handleDeleteDoc(doc.id, doc.filename)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* FIR AI Summary Highlight Box */}
                    {doc.summary && (
                      <div style={{ background: '#fefce8', border: '1px solid #fef08a', borderRadius: 4, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#854d0e', fontWeight: 700, marginBottom: 3 }}>
                          AI Extracted Executive Summary:
                        </div>
                        <div style={{ fontSize: 12, color: '#713f12', lineHeight: 1.5 }}>
                          {doc.summary}
                        </div>
                      </div>
                    )}

                    {/* Cryptographic SHA-256 Fingerprint & Tamper Status */}
                    {(() => {
                      const tamperedEntry = caseData.integrity?.tampered_documents?.find(t => t.document_id === doc.id);
                      const isTampered = !!tamperedEntry;
                      return (
                        <div
                          style={{
                            background: isTampered ? '#fef2f2' : '#f8fafc',
                            border: `1px solid ${isTampered ? '#fca5a5' : '#e2e8f0'}`,
                            borderRadius: 4,
                            padding: '8px 12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 8
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span
                              className={`badge ${isTampered ? 'badge-warning' : 'badge-active'}`}
                              style={{
                                background: isTampered ? '#fee2e2' : undefined,
                                color: isTampered ? '#b91c1c' : undefined,
                                borderColor: isTampered ? '#fca5a5' : undefined,
                                fontSize: 10
                              }}
                            >
                              {isTampered ? '🚨 TAMPER DETECTED' : '🔒 HASH CHAIN INTACT'}
                            </span>
                            <span className="mono" style={{ fontSize: 11, color: isTampered ? '#b91c1c' : '#475569', fontWeight: 600 }}>
                              SHA-256: {doc.file_hash ? `${doc.file_hash.slice(0, 16)}...${doc.file_hash.slice(-8)}` : 'Recorded in Chain'}
                            </span>
                            {isTampered && (
                              <span style={{ fontSize: 11, color: '#991b1b', fontWeight: 600 }}>
                                ({tamperedEntry.reason})
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {isTampered ? (
                              <button
                                onClick={() => handleRestoreTamper(doc.id)}
                                className="btn-secondary"
                                style={{ padding: '3px 10px', fontSize: 11, background: '#f0fdf4', color: '#166534', borderColor: '#86efac', fontWeight: 700 }}
                              >
                                ↺ Restore Original File
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSimulateTamper(doc.id)}
                                className="btn-secondary"
                                style={{ padding: '3px 10px', fontSize: 11, color: '#dc2626', borderColor: '#fca5a5' }}
                                title="Corrupt file bytes on disk to test tamper notification"
                              >
                                🧪 Test Tamper Detection
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cryptographic Hash Chain Ledger Modal */}
      <HashChainModal
        isOpen={showHashChainModal}
        onClose={() => setShowHashChainModal(false)}
        caseData={caseData}
        integrityData={caseData.integrity}
        onReaudit={handleVerifyIntegrity}
        onRestore={handleRestoreTamper}
        onSimulate={handleSimulateTamper}
        verifying={verifyingIntegrity}
      />
    </div>
  );
}

// ── Version History & Tamper Audit View ────────────────────────────────────────

// ── Version History & Hash Chain Audit Ledger View ────────────────────────────

function VersionHistoryView({ cases, systemIntegrity, onRefreshIntegrity, onSelectCase, onNav }) {
  const [auditing, setAuditing] = useState(false);

  const handleRunFullAudit = async () => {
    try {
      setAuditing(true);
      await onRefreshIntegrity?.();
    } finally {
      setAuditing(false);
    }
  };

  const isGlobalTampered = systemIntegrity?.system_status === 'TAMPER_DETECTED';
  const totalAudited = systemIntegrity?.total_cases_audited ?? cases.length;
  const tamperedCount = systemIntegrity?.tampered_cases_count ?? 0;
  const totalTamperedDocs = systemIntegrity?.total_tampered_documents ?? 0;
  const totalEvidenceDocs = cases.reduce((acc, c) => acc + (c.total_documents || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px', color: 'var(--color-ink)' }}>
            Cryptographic Hash Chain & Tamper Audit Ledger
          </h2>
          <p style={{ fontSize: 13, color: 'var(--color-charcoal)', margin: 0, fontWeight: 500 }}>
            Tamper-Evident SHA-256 Non-Repudiation Chaining & Autonomous File Integrity Verification
          </p>
        </div>
        <button
          onClick={handleRunFullAudit}
          disabled={auditing}
          className="btn-primary"
          style={{ fontSize: 12, padding: '8px 18px' }}
        >
          {auditing ? 'AUDITING REPOSITORY...' : '🔄 RUN FULL VAULT AUDIT'}
        </button>
      </div>

      {/* Global Status Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <div className="section-card" style={{ padding: 18, borderLeft: isGlobalTampered ? '4px solid #ef4444' : '4px solid #15803d' }}>
          <div style={{ fontSize: 11, fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', color: 'var(--color-charcoal)', fontWeight: 700, marginBottom: 6 }}>
            Vault Cryptographic Status
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: isGlobalTampered ? '#b91c1c' : '#15803d' }}>
            {isGlobalTampered ? '🚨 TAMPERING DETECTED' : '🛡️ 100% INTACT & SECURE'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-charcoal)', marginTop: 4 }}>
            {isGlobalTampered
              ? `${tamperedCount} case(s) with ${totalTamperedDocs} altered document(s)`
              : 'All evidence blocks and disk hashes verified'}
          </div>
        </div>

        <div className="section-card" style={{ padding: 18 }}>
          <div style={{ fontSize: 11, fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', color: 'var(--color-charcoal)', fontWeight: 700, marginBottom: 6 }}>
            Audited Investigation Dockets
          </div>
          <div style={{ fontSize: 28, fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: 'var(--color-ink)', lineHeight: 1 }}>
            {totalAudited}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-charcoal)', marginTop: 4 }}>
            Registered cases tracked in hash chain
          </div>
        </div>

        <div className="section-card" style={{ padding: 18 }}>
          <div style={{ fontSize: 11, fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', color: 'var(--color-charcoal)', fontWeight: 700, marginBottom: 6 }}>
            Chained Evidentiary Files
          </div>
          <div style={{ fontSize: 28, fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: 'var(--color-ink)', lineHeight: 1 }}>
            {totalEvidenceDocs}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-charcoal)', marginTop: 4 }}>
            SHA-256 digests mathematically chained
          </div>
        </div>
      </div>

      {/* Case Ledgers Table */}
      <div className="section-card">
        <div className="section-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Case Hash Chain Registry</span>
          <span style={{ fontSize: 11, color: 'var(--color-charcoal)', textTransform: 'none', fontWeight: 500 }}>
            Click "AUDIT CHAIN" to inspect block-by-block cryptographic sequence
          </span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Case Number</th>
              <th>Case Title</th>
              <th>Chained Documents</th>
              <th>Priority</th>
              <th>Integrity Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--color-body)' }}>
                  No cases or documents currently in repository ledger. Register a case docket to initialize hash chains.
                </td>
              </tr>
            ) : (
              cases.map(c => {
                const isCaseTampered = systemIntegrity?.tampered_cases?.some(tc => tc.case_id === c.id);
                return (
                  <tr key={c.id}>
                    <td className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>
                      {c.case_number}
                    </td>
                    <td style={{ fontWeight: 600 }}>{c.title}</td>
                    <td>
                      <strong>{c.total_documents || 0}</strong> block(s)
                    </td>
                    <td>
                      <span className="badge badge-warning" style={{ fontSize: 10 }}>{c.priority.toUpperCase()}</span>
                    </td>
                    <td>
                      {isCaseTampered ? (
                        <span className="badge badge-warning" style={{ background: '#fee2e2', color: '#b91c1c', borderColor: '#fca5a5' }}>
                          🚨 TAMPER DETECTED
                        </span>
                      ) : (
                        <span className="badge badge-active">
                          🛡️ HASH CHAIN INTACT
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn-secondary"
                        style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600 }}
                        onClick={() => onSelectCase(c.id)}
                      >
                        🔗 AUDIT CHAIN
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── My Activity View ──────────────────────────────────────────────────────────

function MyActivityView({ cases, onBack }) {
  const activities = cases.map(c => ({
    time: c.created_at ? new Date(c.created_at).toLocaleString('en-IN') : 'Recent',
    mod: 'Case Ingestion',
    act: `Registered investigation file: ${c.case_number} — ${c.title}`,
    sec: c.priority?.toUpperCase() || 'HIGH',
    st: c.status?.replace('_', ' ').toUpperCase() || 'ACTIVE'
  }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px', color: 'var(--color-ink)' }}>
            Officer Investigation Audit Trail
          </h2>
          <p style={{ fontSize: 13, color: 'var(--color-charcoal)', margin: 0, fontWeight: 500 }}>
            Immutable Officer Log · Session Active
          </p>
        </div>
        <button onClick={onBack} className="btn-secondary">
          ← BACK TO DASHBOARD
        </button>
      </div>

      <div className="section-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Module</th>
              <th>Action Performed</th>
              <th>Security Level</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {activities.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: 'var(--color-body)' }}>
                  No investigation activity recorded yet. Create a case or upload evidentiary documents to generate audit trail.
                </td>
              </tr>
            ) : (
              activities.map((r, i) => (
                <tr key={i}>
                  <td className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{r.time}</td>
                  <td>{r.mod}</td>
                  <td style={{ fontWeight: 600 }}>{r.act}</td>
                  <td><span className="badge badge-warning" style={{ fontSize: 10 }}>{r.sec}</span></td>
                  <td><span className="badge badge-active">{r.st}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Profile View ──────────────────────────────────────────────────────────────

function ProfileView({ onBack }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px', color: 'var(--color-ink)' }}>
            Investigating Officer Official Profile
          </h2>
          <p style={{ fontSize: 13, color: 'var(--color-charcoal)', margin: 0, fontWeight: 500 }}>
            Government Law Enforcement Credential & Departmental Identity
          </p>
        </div>
        <button onClick={onBack} className="btn-secondary">
          ← BACK TO DASHBOARD
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
        <div className="section-card" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#1A1A1A', color: 'var(--accent-gold)', border: '2px solid var(--accent-gold)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, marginBottom: 14 }}>
            🛡️
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: 'var(--color-ink)' }}>INVESTIGATING OFFICER (IO)</h3>
          <div style={{ fontSize: 12, color: 'var(--accent-gold)', fontWeight: 700, fontFamily: 'Oswald, sans-serif', letterSpacing: '0.08em' }}>
            BADGE ID: IND-POL-8492
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-charcoal)', marginTop: 4 }}>Cyber Crime & Special Task Branch</div>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <span className="badge badge-active">SECURITY CLEARANCE: LEVEL-IV</span>
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header">Service & Station Particulars</div>
          <div className="section-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <span style={{ fontSize: 11, fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', color: 'var(--color-charcoal)', fontWeight: 700 }}>Department</span>
                <div style={{ fontSize: 14, fontWeight: 600 }}>State Police Headquarters</div>
              </div>
              <div>
                <span style={{ fontSize: 11, fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', color: 'var(--color-charcoal)', fontWeight: 700 }}>Division</span>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Cyber Investigation & Forensic Ingestion</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <span style={{ fontSize: 11, fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', color: 'var(--color-charcoal)', fontWeight: 700 }}>Official Email</span>
                <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>io.division@police.gov.in</div>
              </div>
              <div>
                <span style={{ fontSize: 11, fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', color: 'var(--color-charcoal)', fontWeight: 700 }}>Digital Signature ID</span>
                <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: '#15803d' }}>DSC-SHA256-ACTIVE</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Alerts View ───────────────────────────────────────────────────────────────

function AlertsView({ cases, systemIntegrity, onSelectCase, onNav }) {
  const tamperAlerts = (systemIntegrity?.tampered_cases || []).map(tc => ({
    title: `CRITICAL INTEGRITY BREACH: Document Tampering in ${tc.case_number}`,
    desc: `Cryptographic SHA-256 verification failed for ${tc.tampered_docs?.length || 1} file(s) in "${tc.title}". Evidentiary chain-of-custody broken or disk bytes modified.`,
    priority: 'URGENT',
    badge: 'TAMPER DETECTED',
    color: '#b91c1c',
    bg: '#fef2f2',
    caseId: tc.case_id,
    isTamper: true,
  }));

  const activeAlerts = cases.filter(c => c.priority === 'urgent' || c.priority === 'high').map(c => ({
    title: `High Priority Case: ${c.case_number}`,
    desc: `Case "${c.title}" classified under ${c.crime_type}. Investigating Officer: ${c.investigating_officer || 'Investigating Officer'}. Status: ${c.status.replace('_', ' ').toUpperCase()}.`,
    priority: c.priority.toUpperCase(),
    badge: c.status.replace('_', ' ').toUpperCase(),
    color: c.priority === 'urgent' ? '#b91c1c' : '#b45309',
    bg: c.priority === 'urgent' ? '#fef2f2' : '#fefce8',
    caseId: c.id,
    isTamper: false,
  }));

  const allAlerts = [...tamperAlerts, ...activeAlerts];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px', color: 'var(--color-ink)' }}>
          Critical Legal & Evidentiary Action Alerts
        </h2>
        <p style={{ fontSize: 13, color: 'var(--color-charcoal)', margin: 0, fontWeight: 500 }}>
          High-Priority Reminders, Court Hearing Dates & Evidentiary Tamper Notifications
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {allAlerts.length === 0 ? (
          <div className="section-card" style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--color-body)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-ink)' }}>No active critical alerts</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Urgent reminders and tamper breach notifications will appear here.</div>
          </div>
        ) : (
          allAlerts.map((a, i) => (
            <div
              key={i}
              onClick={() => onSelectCase(a.caseId)}
              style={{ background: a.bg, border: `1px solid ${a.color}40`, borderRadius: 6, padding: 16, cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: a.color }}>{a.title}</span>
                <span className="badge" style={{ background: '#ffffff', color: a.color, borderColor: a.color }}>{a.badge}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-charcoal)', lineHeight: 1.5 }}>
                {a.desc}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
