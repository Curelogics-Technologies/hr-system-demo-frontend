import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Upload, X, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Bookmark, Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getCompanies } from '../../api/companies';
import { getStores } from '../../api/stores';
import { getEmployees, getImportTemplates, saveImportTemplate, ImportTemplate } from '../../api/employees';
import { Company, Store, Employee, UserRole } from '../../types';
import { parseExcelFile, processRow, ParsedRow, ImportResult, COLUMN_MAP, matchHeaderToField, downloadImportTemplateExcel } from './bulkImportUtils';
import CustomSelect from '../../components/ui/CustomSelect';

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type Phase = 'upload' | 'preview' | 'processing' | 'done';

export function BulkImportModal({ open, onClose, onComplete }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [isEditingData, setIsEditingData] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [pendingRows, setPendingRows] = useState<ParsedRow[]>([]);
  const [pendingHeaders, setPendingHeaders] = useState<string[]>([]);

  // Reference data for name→id lookups
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [supervisors, setSupervisors] = useState<Employee[]>([]);

  useEffect(() => {
    if (!open) return;
    setPhase('upload'); setFile(null); setRows([]); setResults([]); setProgress(0); setError(null); setGuideOpen(false);
    setShowMappingModal(false); setPendingRows([]); setPendingHeaders([]);
    // Load reference data
    getCompanies().then(setCompanies).catch(() => {});
    getStores().then(setStores).catch(() => {});
    getEmployees({ limit: 500 }).then(r => setSupervisors(r.employees.filter(
      (e: Employee) => ['admin','hr','area_manager','store_manager'].includes(e.role)
    ))).catch(() => {});
  }, [open]);

  const handleFile = useCallback(async (f: File) => {
    setError(null);
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      setError(t('employees.bulkImportAccepted', 'Accepted formats: .xlsx, .xls'));
      return;
    }
    setFile(f);
    try {
      const parsed = await parseExcelFile(f);
      if (parsed.length === 0) { setError(t('employees.bulkImportNoData', 'No valid data rows found.')); return; }
      
      const fileHeaders = Object.keys(parsed[0].data);
      const mappedFields = new Set<string>();
      for (const h of fileHeaders) {
        const key = matchHeaderToField(h);
        if (key) mappedFields.add(key);
      }
      
      const requiredKeys = ['name', 'surname', 'email', 'role', 'personalEmail', 'companyName', 'storeName'];
      const missingRequired = requiredKeys.filter(k => !mappedFields.has(k));
      
      if (missingRequired.length > 0) {
        setPendingRows(parsed);
        setPendingHeaders(fileHeaders);
        setShowMappingModal(true);
      } else {
        setRows(parsed);
        setPhase('preview');
      }
    } catch {
      setError(t('employees.bulkImportNoData', 'Failed to parse file.'));
    }
  }, [t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const startImport = useCallback(async () => {
    setPhase('processing'); setProgress(0); setResults([]);
    const allResults: ImportResult[] = [];
    for (let i = 0; i < rows.length; i++) {
      const result = await processRow(rows[i], companies, stores, supervisors, t);
      allResults.push(result);
      setProgress(i + 1);
      setResults([...allResults]);
    }
    setPhase('done');
    if (allResults.some(r => r.success)) onComplete();
  }, [rows, companies, stores, supervisors, onComplete, t]);

  if (!open) return null;

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const headers = rows.length > 0 ? Object.keys(rows[0].data) : [];

  const S = {
    backdrop: { position: 'fixed' as const, inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13,33,55,0.48)', backdropFilter: 'blur(3px)' },
    card: { background: 'var(--surface)', borderRadius: '16px', width: 'min(680px, 95vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' as const, boxShadow: '0 24px 60px rgba(0,0,0,0.22)', overflow: 'hidden' },
    header: { padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
    body: { flex: 1, overflowY: 'auto' as const, padding: '24px' },
    footer: { padding: '14px 24px', borderTop: '1px solid var(--border)', background: 'var(--surface-warm)', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0 },
    btn: { padding: '9px 20px', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer', border: 'none', transition: 'background 0.15s' },
  };

  return createPortal(
    <div style={S.backdrop} onClick={onClose}>
      <div style={S.card} onClick={e => e.stopPropagation()}>
        {/* Accent stripe */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--accent) 0%, var(--primary) 100%)', flexShrink: 0 }} />

        {/* Header */}
        <div style={S.header}>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', margin: 0, letterSpacing: '-0.02em' }}>
              {t('employees.bulkImportTitle', 'Importa dipendenti da Excel')}
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0', fontFamily: 'var(--font-body)' }}>
              {t('employees.bulkImportSubtitle', 'Carica un file Excel per importare ed inserire multipli dipendenti contemporaneamente.')}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '22px', lineHeight: 1, padding: '4px 6px', borderRadius: 'var(--radius-sm)' }}>×</button>
        </div>

        {/* Body */}
        <div style={S.body}>

          {/* ── UPLOAD phase ── */}
          {phase === 'upload' && (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: '14px', padding: '56px 24px', textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? 'rgba(139,105,20,0.06)' : 'var(--surface-warm)',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
              >
                <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                <Upload size={36} color={dragOver ? 'var(--accent)' : 'var(--text-muted)'} style={{ marginBottom: 12 }} />
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  {t('employees.bulkImportDropzone', 'Trascina qui il file Excel o clicca per sfogliare')}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {t('employees.bulkImportAccepted', 'Formati supportati: .xlsx, .xls')}
                </div>
              </div>

              {/* Downloadable Excel Template Button */}
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); downloadImportTemplateExcel(); }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 8,
                    border: '1px solid var(--primary)', background: 'rgba(2,132,199,0.06)',
                    color: 'var(--primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <FileSpreadsheet size={15} />
                  {t('employees.downloadTemplateExcel', 'Scarica modello Excel (.xlsx)')}
                </button>
              </div>
            </>
          )}

          {/* ── Format guide (collapsible) ── */}
          {phase === 'upload' && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setGuideOpen(!guideOpen); }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 7,
                    border: '1.5px solid var(--border)', background: 'transparent',
                    color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-warm)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  <AlertTriangle size={14} style={{ color: guideOpen ? 'var(--primary)' : 'var(--text-muted)' }} />
                  {guideOpen ? t('employees.bulkImportGuideHide', 'Nascondi guida campi') : t('employees.bulkImportGuideToggle', 'Mostra guida struttura campi')}
                </button>
              </div>

              {guideOpen && (
                <div style={{
                  borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden',
                  fontSize: 12, boxShadow: 'var(--shadow-sm)', background: 'var(--surface)',
                }}>
                  <div style={{
                    background: 'var(--primary)', color: '#fff',
                    padding: '8px 14px', fontWeight: 700, fontSize: 11,
                    letterSpacing: '0.05em', textTransform: 'uppercase'
                  }}>
                    {t('employees.bulkImportGuideTitle', 'Struttura Colonne Excel Supportate')}
                  </div>
                  <div style={{ padding: 14, color: 'var(--text-secondary)' }}>
                    <p style={{ margin: '0 0 10px', fontSize: 12, lineHeight: 1.5 }}>
                      Il sistema riconosce automaticamente i nomi delle colonne in Italiano e Inglese, ignorando parentesi ed eventuali spazi (es. <code>Nome (completo)</code>, <code>Cognome (completo)</code>, <code>Luogo di lavoro</code>, <code>Scadenza contratto</code>, <code>Stato</code>).
                    </p>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.6 }}>
                      <li><strong>Obbligatori:</strong> Nome, Cognome, Email aziendale, Email personale, Ruolo, Azienda, Negozio/Sede</li>
                      <li><strong>Opzionali:</strong> Data assunzione, Scadenza contratto, Orario di lavoro (Tempo Pieno/Part-time), Data nascita, Genere (Maschio/Femmina), Primo soccorso (Sì/No), Stato (Attivo/Inattivo)</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div style={{ margin: '16px 0 0', padding: '10px 14px', borderRadius: 8, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#DC2626', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
              <XCircle size={16} /> {error}
            </div>
          )}

          {/* ── PREVIEW phase ── */}
          {phase === 'preview' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {t('employees.bulkImportPreviewRows', 'File: {{name}} ({{count}} righe trovate)', { name: file?.name, count: rows.length })}
                </span>
                <button onClick={() => setIsEditingData(true)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}>
                  {t('employees.bulkImportEditData', 'Modifica dati')}
                </button>
              </div>

              <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-warm)', zIndex: 1 }}>
                    <tr>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>#</th>
                      {headers.map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 10).map((r) => (
                      <tr key={r.rowIndex} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{r.rowIndex}</td>
                        {headers.map(h => (
                          <td key={h} style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{String(r.data[h] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 10 && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0', textAlign: 'center' }}>
                  {t('employees.bulkImportPreviewMore', 'Mostrando le prime 10 di {{count}} righe.', { count: rows.length })}
                </p>
              )}
            </div>
          )}

          {/* ── PROCESSING phase ── */}
          {phase === 'processing' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
                {t('employees.bulkImportProcessing', 'Importazione in corso... ({{current}}/{{total}})', { current: progress, total: rows.length })}
              </div>
              <div style={{ height: 8, background: 'var(--border-light)', borderRadius: 4, overflow: 'hidden', margin: '0 auto 16px', width: '80%' }}>
                <div style={{ height: '100%', width: `${(progress / rows.length) * 100}%`, background: 'var(--primary)', transition: 'width 0.2s' }} />
              </div>
            </div>
          )}

          {/* ── DONE phase ── */}
          {phase === 'done' && (
            <div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, padding: 14, borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#059669' }}>{successCount}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#059669' }}>{t('employees.bulkImportSuccessCount', 'Importati con successo')}</div>
                </div>
                <div style={{ flex: 1, padding: 14, borderRadius: 10, background: failCount > 0 ? 'rgba(220,38,38,0.08)' : 'var(--surface-warm)', border: `1px solid ${failCount > 0 ? 'rgba(220,38,38,0.2)' : 'var(--border)'}`, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: failCount > 0 ? '#DC2626' : 'var(--text-muted)' }}>{failCount}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: failCount > 0 ? '#DC2626' : 'var(--text-muted)' }}>{t('employees.bulkImportFailCount', 'Falliti / Errori')}</div>
                </div>
              </div>

              {failCount > 0 && (
                <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-warm)' }}>
                      <tr>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Riga</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Errore</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.filter(r => !r.success).map(r => {
                        let errText = typeof r.error === 'string' ? r.error : r.error?.fallback || r.error?.key || 'Errore sconosciuto';
                        if (typeof r.error === 'object' && r.error.key) {
                          errText = String(t(r.error.key, r.error.params || {}));
                        }
                        return (
                          <tr key={r.rowIndex} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '7px 10px', color: '#DC2626', fontWeight: 700 }}>{r.rowIndex}</td>
                            <td style={{ padding: '7px 10px', color: '#DC2626' }}>{errText}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={S.footer}>
          {phase === 'upload' && (
            <button onClick={onClose} style={{ ...S.btn, background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              {t('common.cancel')}
            </button>
          )}

          {phase === 'preview' && (
            <>
              <button onClick={() => { setPhase('upload'); setFile(null); setRows([]); }} style={{ ...S.btn, background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                {t('common.cancel')}
              </button>
              <button onClick={startImport} style={{ ...S.btn, background: 'var(--primary)', color: '#fff' }}>
                {t('employees.bulkImportConfirm', 'Conferma Importazione ({{count}} dipendenti)', { count: rows.length })}
              </button>
            </>
          )}

          {phase === 'done' && (
            <>
              <button onClick={() => { setPhase('upload'); setFile(null); setRows([]); setResults([]); }} style={{ ...S.btn, background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                {t('employees.bulkImportNewImport', 'Nuova Importazione')}
              </button>
              <button onClick={onClose} style={{ ...S.btn, background: 'var(--primary)', color: '#fff' }}>
                {t('employees.bulkImportDone', 'Completato')}
              </button>
            </>
          )}
        </div>

        <EditDataModal 
          open={isEditingData} 
          rows={rows} 
          onClose={() => setIsEditingData(false)} 
          onSave={(newRows) => {
            setRows(newRows);
            setIsEditingData(false);
            setPhase('preview');
            setResults([]);
          }}
        />

        <ColumnMappingModal
          open={showMappingModal}
          headers={pendingHeaders}
          rows={pendingRows}
          onClose={() => {
            setShowMappingModal(false);
            setFile(null);
            setPhase('upload');
          }}
          onSave={(mappedRows) => {
            setRows(mappedRows);
            setShowMappingModal(false);
            setPhase('preview');
          }}
        />
      </div>
    </div>,
    document.body
  );
}

/* ── Edit Data Modal ─────────────────────────────────────────────────── */

function EditDataModal({ 
  open, 
  rows, 
  onClose, 
  onSave 
}: { 
  open: boolean; 
  rows: ParsedRow[]; 
  onClose: () => void; 
  onSave: (newRows: ParsedRow[]) => void; 
}) {
  const { t } = useTranslation();
  const [localRows, setLocalRows] = useState<ParsedRow[]>([]);

  useEffect(() => {
    if (open) {
      setLocalRows(JSON.parse(JSON.stringify(rows)));
    }
  }, [open, rows]);

  if (!open) return null;

  const headers = localRows.length > 0 ? Object.keys(localRows[0].data) : [];

  const handleCellChange = (rowIndex: number, header: string, val: string) => {
    setLocalRows(prev => prev.map(r => r.rowIndex === rowIndex 
      ? { ...r, data: { ...r.data, [header]: val } } 
      : r
    ));
  };

  const S = {
    backdrop: { position: 'fixed' as const, inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' },
    card: { background: 'var(--surface)', borderRadius: '16px', width: 'min(1000px, 95vw)', height: '85vh', display: 'flex', flexDirection: 'column' as const, boxShadow: '0 24px 60px rgba(0,0,0,0.3)', overflow: 'hidden' },
    header: { padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    body: { flex: 1, overflow: 'auto' as const, padding: '0' },
    footer: { padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface-warm)', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0 },
    btn: { padding: '8px 18px', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none' },
    input: { width: '100%', border: 'none', background: 'transparent', padding: '8px 10px', fontSize: '11.5px', color: 'var(--text-primary)', fontFamily: 'inherit', minWidth: '120px' },
  };

  return createPortal(
    <div style={S.backdrop} onClick={onClose}>
      <div style={S.card} onClick={e => e.stopPropagation()}>
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileSpreadsheet size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>{t('employees.bulkImportEditData', 'Modifica dati')}</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>×</button>
        </div>
        
        <div style={S.body}>
          <table style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface-warm)' }}>
              <tr>
                <th style={{ width: 50, padding: '12px 10px', fontSize: 10, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', textAlign: 'left', background: 'var(--surface-warm)', position: 'sticky', left: 0, zIndex: 11 }}>#</th>
                {headers.map(h => (
                  <th key={h} style={{ minWidth: 150, padding: '12px 10px', fontSize: 10, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {localRows.map((row) => (
                <tr key={row.rowIndex} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface)', position: 'sticky', left: 0, zIndex: 1 }}>{row.rowIndex}</td>
                  {headers.map(h => (
                    <td key={h} style={{ padding: 0, borderLeft: '1px solid var(--border-light)' }}>
                      <input 
                        style={S.input}
                        value={String(row.data[h] ?? '')}
                        onChange={e => handleCellChange(row.rowIndex, h, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={S.footer}>
          <button onClick={onClose} style={{ ...S.btn, background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            {t('common.cancel')}
          </button>
          <button 
            onClick={() => onSave(localRows)} 
            style={{ ...S.btn, background: 'var(--primary)', color: '#fff' }}
          >
            {t('employees.bulkImportEditAction', 'Salva modifiche')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}


/* ── Column Mapping Modal ───────────────────────────────────────────────── */

const SCHEMA_FIELDS = [
  { key: 'name', label: 'Nome', format: 'text', required: true },
  { key: 'surname', label: 'Cognome', format: 'text', required: true },
  { key: 'email', label: 'Email Aziendale', format: 'email', required: true },
  { key: 'role', label: 'Ruolo', format: 'text', required: true },
  { key: 'companyName', label: 'Azienda', format: 'text', required: true },
  { key: 'storeName', label: 'Negozio / Sede', format: 'text', required: true },
  { key: 'personalEmail', label: 'Email Personale', format: 'email', required: true },
  { key: 'password', label: 'Password Temporanea', format: 'password', required: false },
  { key: 'weeklyHours', label: 'Ore Settimanali', format: 'number', required: false },
  { key: 'cap', label: 'CAP / Codice Postale', format: 'number', required: false },
  { key: 'supervisorName', label: 'Supervisore / Responsabile', format: 'text', required: false },
  { key: 'department', label: 'Dipartimento / Reparto', format: 'text', required: false },
  { key: 'hireDate', label: 'Data di Assunzione', format: 'date', required: false },
  { key: 'workingType', label: 'Orario di Lavoro', format: 'text', required: false },
  { key: 'dateOfBirth', label: 'Data di Nascita', format: 'date', required: false },
  { key: 'gender', label: 'Genere / Sesso', format: 'text', required: false },
  { key: 'nationality', label: 'Nazionalità', format: 'text', required: false },
  { key: 'iban', label: 'IBAN', format: 'text', required: false },
  { key: 'address', label: 'Indirizzo', format: 'text', required: false },
  { key: 'city', label: 'Città', format: 'text', required: false },
  { key: 'state', label: 'Provincia', format: 'text', required: false },
  { key: 'country', label: 'Nazione / Paese', format: 'text', required: false },
  { key: 'phone', label: 'Telefono', format: 'text', required: false },
  { key: 'status', label: 'Stato (Attivo / Inattivo)', format: 'text', required: false },
  { key: 'maritalStatus', label: 'Stato Civile', format: 'text', required: false },
  { key: 'firstAidFlag', label: 'Primo Soccorso', format: 'text', required: false },
  { key: 'contractType', label: 'Tipo Contratto', format: 'text', required: false },
  { key: 'probationMonths', label: 'Mesi di Prova', format: 'number', required: false },
  { key: 'contractEndDate', label: 'Scadenza Contratto', format: 'date', required: false },
  { key: 'terminationDate', label: 'Data di Risoluzione / Cessazione', format: 'date', required: false },
  { key: 'terminationType', label: 'Tipo Cessazione', format: 'text', required: false },
];

const FIELD_TO_HEADER: Record<string, string> = {
  name: 'name',
  surname: 'surname',
  email: 'email',
  role: 'role',
  companyName: 'company',
  storeName: 'store',
  personalEmail: 'personal email',
  password: 'temporary password',
  weeklyHours: 'weekly hours',
  cap: 'postal code',
  supervisorName: 'supervisor',
  department: 'department',
  hireDate: 'hire date',
  workingType: 'work schedule',
  dateOfBirth: 'date of birth',
  gender: 'gender',
  nationality: 'nationality',
  iban: 'iban',
  address: 'address',
  city: 'city',
  state: 'state',
  country: 'country',
  phone: 'company phone numbers',
  status: 'status',
  maritalStatus: 'marital status',
  firstAidFlag: 'first aid',
  contractType: 'contract type',
  probationMonths: 'probation period',
  contractEndDate: 'contract end date',
  terminationDate: 'termination date',
  terminationType: 'termination type',
};

function getHeaderFormat(header: string, rows: ParsedRow[]): 'text' | 'email' | 'number' | 'password' | 'date' {
  const lowerHeader = header.toLowerCase();
  if (lowerHeader.includes('pass') || lowerHeader.includes('pwd')) {
    return 'password';
  }
  if (
    lowerHeader.includes('data') ||
    lowerHeader.includes('date') ||
    lowerHeader.includes('nascita') ||
    lowerHeader.includes('assunzione') ||
    lowerHeader.includes('cessazione') ||
    lowerHeader.includes('risoluzione') ||
    lowerHeader.includes('scadenza')
  ) {
    return 'date';
  }

  const values = rows.map(r => r.data[header]);
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (values.some(val => val && emailRegex.test(String(val).trim()))) return 'email';

  const dateRegex = /^(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}|\d{1,2}[-\/.]\d{1,2}[-\/.]\d{4})$/;
  if (values.some(val => val && dateRegex.test(String(val).trim()))) return 'date';

  const hasNumbers = values.some(val => val !== '' && val !== null && val !== undefined && !isNaN(Number(val)));
  const allNumbersOrEmpty = values.every(val => val === '' || val === null || val === undefined || !isNaN(Number(val)));
  if (hasNumbers && allNumbersOrEmpty) return 'number';

  return 'text';
}

function ColumnMappingModal({
  open,
  headers,
  rows,
  onClose,
  onSave
}: {
  open: boolean;
  headers: string[];
  rows: ParsedRow[];
  onClose: () => void;
  onSave: (mappedRows: ParsedRow[]) => void;
}) {
  const { t } = useTranslation();
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [savedTemplates, setSavedTemplates] = useState<ImportTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    if (open) {
      getImportTemplates().then(setSavedTemplates).catch(() => {});
    }
  }, [open]);

  const initialMappedKeys = React.useMemo(() => {
    const matched = new Set<string>();
    if (!headers) return matched;
    for (const h of headers) {
      const key = matchHeaderToField(h);
      if (key) matched.add(key);
    }
    return matched;
  }, [headers]);

  const unmappedHeaders = React.useMemo(() => {
    if (!headers) return [];
    return headers.filter(h => !matchHeaderToField(h));
  }, [headers]);

  const headerFormats = React.useMemo(() => {
    const formats: Record<string, 'text' | 'email' | 'number' | 'password' | 'date'> = {};
    for (const h of unmappedHeaders) {
      formats[h] = getHeaderFormat(h, rows);
    }
    return formats;
  }, [unmappedHeaders, rows]);

  const getAvailableSchemaFields = (currentHeader: string, format: string) => {
    const selectedKeys = Object.entries(mapping)
      .filter(([h, k]) => h !== currentHeader && k !== '')
      .map(([h, k]) => k);

    return SCHEMA_FIELDS.filter(field => {
      if (initialMappedKeys.has(field.key) || selectedKeys.includes(field.key)) return false;
      if (format === 'date') return field.format === 'date' || field.format === 'text';
      if (field.format === 'date') return format === 'date' || format === 'text' || format === 'number';
      if (field.format === format) return true;
      if (format === 'text' || format === 'number') return true;
      return false;
    });
  };

  const handleSelectField = (header: string, fieldKey: string) => {
    setMapping(prev => ({
      ...prev,
      [header]: fieldKey
    }));
  };

  const handleApplyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const tpl = savedTemplates.find(t => String(t.id) === templateId);
    if (tpl && tpl.mappingJson) {
      setMapping(tpl.mappingJson);
    }
  };

  const handleSaveTemplateAction = async () => {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    try {
      const created = await saveImportTemplate(templateName.trim(), mapping);
      setSavedTemplates(prev => [...prev, created]);
      setSelectedTemplateId(String(created.id));
      setShowSavePrompt(false);
      setTemplateName('');
    } catch (e) {
      console.error(e);
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSave = () => {
    const newRows = rows.map(row => {
      const newData = { ...row.data };
      for (const [header, fieldKey] of Object.entries(mapping)) {
        if (fieldKey) {
          const targetHeader = FIELD_TO_HEADER[fieldKey] || fieldKey;
          newData[targetHeader] = newData[header];
          delete newData[header];
        }
      }
      return {
        ...row,
        data: newData
      };
    });
    onSave(newRows);
  };

  if (!open) return null;

  const S = {
    backdrop: { position: 'fixed' as const, inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13,33,55,0.48)', backdropFilter: 'blur(3px)' },
    card: { background: 'var(--surface)', borderRadius: '16px', width: 'min(640px, 95vw)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' as const, boxShadow: '0 24px 60px rgba(0,0,0,0.22)', overflow: 'hidden' },
    header: { padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    body: { flex: 1, overflowY: 'auto' as const, padding: '20px' },
    footer: { padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface-warm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 },
    btn: { padding: '8px 18px', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none' },
    row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-light)' },
    select: { padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '12px', width: '220px' }
  };

  return createPortal(
    <div style={S.backdrop} onClick={onClose}>
      <div style={S.card} onClick={e => e.stopPropagation()}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--accent) 0%, var(--primary) 100%)', flexShrink: 0 }} />

        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} color="var(--accent)" />
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Mappatura Manuale Colonne</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}>×</button>
        </div>

        <div style={S.body}>
          {/* Saved Templates Selector */}
          {savedTemplates.length > 0 && (
            <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, background: 'var(--surface-warm)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Bookmark size={16} color="var(--primary)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Modello salvato:</span>
              <div style={{ flex: 1 }}>
                <CustomSelect
                  value={selectedTemplateId || null}
                  onChange={val => handleApplyTemplate(val || '')}
                  options={savedTemplates.map(t => ({ value: String(t.id), label: t.name }))}
                  placeholder="Seleziona un modello salvato per questa azienda..."
                  isClearable={true}
                  searchable={true}
                  controlMinHeight={34}
                />
              </div>
            </div>
          )}

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
            Alcune colonne del tuo file non corrispondono automaticamente ai campi standard. Assegna ciascuna colonna del file al campo di destinazione corretto:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {unmappedHeaders.map(h => {
              const fmt = headerFormats[h] || 'text';
              const available = getAvailableSchemaFields(h, fmt);
              const selectedValue = mapping[h] || '';

              const selectOptions = available.map(f => ({
                value: f.key,
                label: `${f.label}${f.required ? ' *' : ''}`
              }));

              if (selectedValue && !available.some(f => f.key === selectedValue)) {
                const matchedField = SCHEMA_FIELDS.find(f => f.key === selectedValue);
                selectOptions.push({
                  value: selectedValue,
                  label: matchedField ? `${matchedField.label}${matchedField.required ? ' *' : ''}` : selectedValue
                });
              }

              return (
                <div key={h} style={S.row}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{h}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--surface-warm)', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase', fontWeight: 700 }}>
                      {fmt}
                    </span>
                  </div>

                  <div style={{ width: '240px' }}>
                    <CustomSelect
                      value={selectedValue || null}
                      onChange={val => handleSelectField(h, val || '')}
                      options={selectOptions}
                      placeholder="Seleziona campo di destinazione..."
                      isClearable={true}
                      searchable={true}
                      controlMinHeight={36}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Prompt to Save as Template */}
          {showSavePrompt && (
            <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: 'rgba(2,132,199,0.06)', border: '1px solid rgba(2,132,199,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="text"
                placeholder="Nome del modello (es. Export Paghe Zucchetti)"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}
              />
              <button
                type="button"
                onClick={handleSaveTemplateAction}
                disabled={savingTemplate || !templateName.trim()}
                style={{ padding: '7px 14px', borderRadius: 6, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Salva
              </button>
              <button
                type="button"
                onClick={() => setShowSavePrompt(false)}
                style={{ padding: '7px 10px', borderRadius: 6, background: 'none', border: '1px solid var(--border)', fontSize: 12, cursor: 'pointer' }}
              >
                Annulla
              </button>
            </div>
          )}
        </div>

        <div style={S.footer}>
          <button
            type="button"
            onClick={() => setShowSavePrompt(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--primary)' }}
          >
            <Save size={14} /> Salva come modello aziendale
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ ...S.btn, background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              Annulla
            </button>
            <button
              onClick={handleSave}
              style={{ ...S.btn, background: 'var(--primary)', color: '#fff' }}
            >
              Conferma Mappatura
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default BulkImportModal;
