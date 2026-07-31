import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  Upload, X, FileSpreadsheet, CheckCircle2, AlertTriangle, AlertCircle, Info,
  Download, BookOpen, Save, ArrowRight, ArrowLeft, Building2, Store as StoreIcon,
} from 'lucide-react';
import { getCompanies } from '../../api/companies';
import { getStores } from '../../api/stores';
import {
  getEmployees, getImportTemplates, saveImportTemplate, getImportPrecheck,
  bulkImportEmployees, ImportTemplate, ImportPrecheck,
} from '../../api/employees';
import { Company, Store, Employee } from '../../types';
import {
  parseExcelFile, ParsedRow,
  FIELD_CATALOG, REQUIRED_FIELD_KEYS, fieldLabel,
  buildInitialMapping, validateRows, RowValidation, RowIssue,
  ValidationContext, downloadSampleEmployeesExcel,
} from './bulkImportUtils';

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type Step = 1 | 2 | 3 | 4;

/* ── Shared visual tokens ─────────────────────────────────────────────────── */

const OK = { fg: '#15803D', bg: 'rgba(21,128,61,0.10)', border: 'rgba(21,128,61,0.30)' };
const WARN = { fg: '#B45309', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.35)' };
const ERR = { fg: '#B91C1C', bg: 'rgba(220,38,38,0.09)', border: 'rgba(220,38,38,0.32)' };

function StatCard({ value, label, tone }: { value: number; label: string; tone: 'ok' | 'warn' | 'err' | 'plain' }) {
  const c = tone === 'ok' ? OK : tone === 'warn' ? WARN : tone === 'err' ? ERR : null;
  return (
    <div
      style={{
        padding: '11px 13px',
        borderRadius: 10,
        background: c ? c.bg : 'var(--background)',
        border: `1px solid ${c ? c.border : 'var(--border)'}`,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1, color: c ? c.fg : 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Banner({ tone, icon, title, body }: { tone: 'ok' | 'warn' | 'err' | 'info'; icon: React.ReactNode; title: string; body?: string }) {
  const c = tone === 'ok' ? OK : tone === 'warn' ? WARN : tone === 'err' ? ERR
    : { fg: 'var(--primary)', bg: 'rgba(13,33,55,0.05)', border: 'var(--border)' };
  return (
    <div style={{ display: 'flex', gap: 10, padding: '11px 14px', borderRadius: 10, background: c.bg, border: `1px solid ${c.border}` }}>
      <span style={{ color: c.fg, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: c.fg }}>{title}</div>
        {body && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.45 }}>{body}</div>}
      </div>
    </div>
  );
}

/* ── Guide modal ──────────────────────────────────────────────────────────── */

function GuideModal({ open, onClose, lang }: { open: boolean; onClose: () => void; lang: string }) {
  const { t } = useTranslation();
  if (!open) return null;

  const th: React.CSSProperties = {
    textAlign: 'left', padding: '7px 9px', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase',
    letterSpacing: 0.4, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
  };
  const td: React.CSSProperties = {
    padding: '7px 9px', fontSize: 11.5, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-light)',
    verticalAlign: 'top',
  };

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(13,33,55,0.55)', zIndex: 10001,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(980px, 100%)', maxHeight: '88vh', background: 'var(--surface)', borderRadius: 16,
          border: '1px solid var(--border)', boxShadow: '0 24px 60px rgba(13,33,55,0.30)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{ padding: '15px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <BookOpen size={18} color="var(--primary)" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', flex: 1 }}>
            {t('employees.importGuideTitle')}
          </h3>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Banner tone="info" icon={<Info size={15} />} title={t('employees.importGuideIntro')} />
          <Banner tone="info" icon={<Info size={15} />} title={t('employees.importGuideLangNote')} />

          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 7 }}>
              {t('employees.importGuideRulesTitle')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} style={{ display: 'flex', gap: 8, fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 800 }}>•</span>
                  <span>{t(`employees.importGuideRule${n}`)}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
                <thead style={{ background: 'var(--surface-warm)' }}>
                  <tr>
                    <th style={th}>{t('employees.importGuideColName')} (IT)</th>
                    <th style={th}>{t('employees.importGuideColName')} (EN)</th>
                    <th style={th}>{t('employees.importGuideColRequired')}</th>
                    <th style={th}>{t('employees.importGuideColAccepts')}</th>
                    <th style={th}>{t('employees.importGuideColStored')}</th>
                    <th style={th}>{t('employees.importGuideColExample')}</th>
                  </tr>
                </thead>
                <tbody>
                  {FIELD_CATALOG.map((f) => (
                    <tr key={f.key}>
                      <td style={{ ...td, fontWeight: 700, color: 'var(--text-primary)' }}>{f.labelIt}</td>
                      <td style={{ ...td, fontWeight: 700, color: 'var(--text-primary)' }}>{f.labelEn}</td>
                      <td style={td}>
                        {f.required
                          ? <span style={{ color: ERR.fg, fontWeight: 800 }}>{t('employees.importGuideRequiredYes')}</span>
                          : t('employees.importGuideRequiredNo')}
                      </td>
                      <td style={td}>{(f.accepts ?? []).join('  ·  ') || '—'}</td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 10.5 }}>{f.storedAs ?? '—'}</td>
                      <td style={td}>{f.example || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            {t('employees.importGuideClose')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── Main wizard ──────────────────────────────────────────────────────────── */

export function BulkImportModal({ open, onClose, onComplete }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'it';
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [autoMapping, setAutoMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [onlyErrors, setOnlyErrors] = useState(false);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [supervisors, setSupervisors] = useState<Employee[]>([]);
  const [precheck, setPrecheck] = useState<ImportPrecheck | null>(null);

  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [templateMsg, setTemplateMsg] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [doneCount, setDoneCount] = useState<number | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  /* Reset + load reference data whenever the wizard is opened. */
  useEffect(() => {
    if (!open) return;
    setStep(1); setFile(null); setRows([]); setHeaders([]); setMapping({}); setAutoMapping({});
    setError(null); setGuideOpen(false); setOnlyErrors(false);
    setTemplateName(''); setTemplateMsg(null); setImporting(false); setDoneCount(null); setImportError(null);

    getCompanies().then(setCompanies).catch(() => {});
    getStores().then(setStores).catch(() => {});
    getEmployees({ limit: 500 })
      .then((r) => setSupervisors(r.employees.filter((e: Employee) => ['admin', 'hr', 'area_manager', 'store_manager'].includes(e.role))))
      .catch(() => {});
    getImportTemplates().then(setTemplates).catch(() => {});
    getImportPrecheck().then(setPrecheck).catch(() => setPrecheck({ emails: [], stores: [] }));
  }, [open]);

  /* Validation context — rebuilt only when its inputs change. */
  const ctx: ValidationContext = useMemo(() => ({
    companies,
    stores,
    supervisors,
    existingEmails: new Set((precheck?.emails ?? []).map((e) => e.toLowerCase())),
    storeHeadcount: new Map((precheck?.stores ?? []).map((s) => [s.id, s.activeCount])),
    storeCapacity: new Map((precheck?.stores ?? []).map((s) => [s.id, s.maxStaff])),
  }), [companies, stores, supervisors, precheck]);

  /* The single source of truth for every step after upload. */
  const validations: RowValidation[] = useMemo(
    () => (rows.length ? validateRows(rows, mapping, ctx) : []),
    [rows, mapping, ctx],
  );

  const counts = useMemo(() => {
    const errorsCount = validations.filter((v) => v.errors.length > 0).length;
    const warnCount = validations.filter((v) => v.errors.length === 0 && v.warnings.length > 0).length;
    return {
      total: validations.length,
      valid: validations.length - errorsCount,
      errors: errorsCount,
      warnings: warnCount,
    };
  }, [validations]);

  const mappedFields = useMemo(() => new Set(Object.values(mapping).filter(Boolean)), [mapping]);
  const missingRequired = useMemo(
    () => REQUIRED_FIELD_KEYS.filter((k) => !mappedFields.has(k)),
    [mappedFields],
  );

  const handleFile = useCallback(async (f: File) => {
    setError(null);
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      setError(t('employees.importAccepted'));
      return;
    }
    try {
      const parsed = await parseExcelFile(f);
      if (parsed.length === 0) {
        setError(t('employees.bulkImportNoData', 'No valid data rows found.'));
        return;
      }
      const hs = Object.keys(parsed[0].data);
      const auto = buildInitialMapping(hs);
      setFile(f);
      setRows(parsed);
      setHeaders(hs);
      setMapping(auto);
      setAutoMapping(auto);
      setStep(2);
    } catch {
      setError(t('employees.bulkImportNoData', 'Failed to parse file.'));
    }
  }, [t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  /** Inline cell edit in step 2 — revalidation is automatic via useMemo. */
  const editCell = useCallback((rowIndex: number, header: string, value: string) => {
    setRows((prev) => prev.map((r) => (
      r.rowIndex === rowIndex ? { ...r, data: { ...r.data, [header]: value } } : r
    )));
  }, []);

  const issueText = useCallback((issue: RowIssue) => {
    const label = fieldLabel(issue.field, lang);
    const reason = t(`employees.importIssue${issue.code}`, { detail: issue.detail ?? '' });
    return `${label}: ${reason}`;
  }, [t, lang]);

  const handleImport = useCallback(async () => {
    const payloads = validations.filter((v) => v.payload).map((v) => v.payload!);
    if (payloads.length === 0) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await bulkImportEmployees(payloads);
      setDoneCount(res.createdCount);
      onComplete();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string } } })?.response?.data;
      setImportError(data?.error || t('employees.importFailedBody'));
    } finally {
      setImporting(false);
    }
  }, [validations, onComplete, t]);

  const handleSaveTemplate = useCallback(async () => {
    if (!templateName.trim()) return;
    try {
      const saved = await saveImportTemplate(templateName.trim(), mapping);
      setTemplates((prev) => [...prev.filter((x) => x.id !== saved.id), saved]);
      setTemplateName('');
      setTemplateMsg(t('employees.importTemplateSaved'));
      setTimeout(() => setTemplateMsg(null), 2500);
    } catch { /* surfaced by the generic error banner */ }
  }, [templateName, mapping, t]);

  const applyTemplate = useCallback((tpl: ImportTemplate) => {
    // Only headers present in this file are taken from the template, so a
    // template built for a slightly different export cannot inject dead columns.
    const next: Record<string, string> = {};
    for (const h of headers) next[h] = tpl.mappingJson[h] ?? '';
    setMapping(next);
    setTemplateMsg(t('employees.importTemplateApplied'));
    setTimeout(() => setTemplateMsg(null), 2500);
  }, [headers, t]);

  if (!open) return null;

  const canNext = step === 1 ? rows.length > 0 : step === 4 ? false : true;
  const visibleRows = onlyErrors ? validations.filter((v) => v.errors.length > 0) : validations;

  /* ── Step bodies ─────────────────────────────────────────────────────── */

  const renderStep1 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
          background: dragOver ? 'rgba(201,151,58,0.06)' : 'var(--background)',
          borderRadius: 14, padding: '44px 24px', textAlign: 'center', cursor: 'pointer',
          transition: 'border-color .15s, background .15s',
        }}
      >
        <div style={{ marginBottom: 12, color: dragOver ? 'var(--accent)' : 'var(--text-muted)' }}>
          <Upload size={38} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{t('employees.importDropzone')}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5 }}>{t('employees.importAccepted')}</div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
        <button
          onClick={() => setGuideOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '13px 15px', borderRadius: 11,
            border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <BookOpen size={19} color="var(--primary)" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{t('employees.importOpenGuide')}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{FIELD_CATALOG.length} {t('employees.importGuideColName').toLowerCase()}</div>
          </div>
        </button>

        <button
          onClick={() => downloadSampleEmployeesExcel(lang)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '13px 15px', borderRadius: 11,
            border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <Download size={19} color="var(--accent)" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{t('employees.importDownloadSample')}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>.xlsx · 10 {t('employees.importSummaryEmployees')}</div>
          </div>
        </button>
      </div>

      <Banner tone="info" icon={<Info size={15} />} title={t('employees.importSampleHint')} />
      {error && <Banner tone="err" icon={<AlertCircle size={15} />} title={error} />}
    </div>
  );

  const renderStep2 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
        <StatCard value={counts.total} label={t('employees.importTotalRows')} tone="plain" />
        <StatCard value={counts.valid} label={t('employees.importValidRows')} tone="ok" />
        <StatCard value={counts.errors} label={t('employees.importErrorRows')} tone="err" />
        <StatCard value={counts.warnings} label={t('employees.importWarningRows')} tone="warn" />
      </div>

      {counts.errors === 0
        ? <Banner tone="ok" icon={<CheckCircle2 size={15} />} title={t('employees.importNoErrors')} />
        : <Banner tone="warn" icon={<AlertTriangle size={15} />} title={t('employees.importFixErrors')} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>{t('employees.importEditCell')}</span>
        {counts.errors > 0 && (
          <button
            onClick={() => setOnlyErrors((v) => !v)}
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${onlyErrors ? ERR.border : 'var(--border)'}`,
              background: onlyErrors ? ERR.bg : 'var(--surface)',
              color: onlyErrors ? ERR.fg : 'var(--text-secondary)',
            }}
          >
            {onlyErrors ? t('employees.importShowAllRows') : t('employees.importShowOnlyErrors')}
          </button>
        )}
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 11, overflow: 'hidden' }}>
        <div style={{ maxHeight: 430, overflow: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr style={{ background: 'var(--surface-warm)' }}>
                <th style={{ padding: '8px 10px', fontSize: 10.5, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap' }}>
                  {t('employees.importRowLabel')}
                </th>
                {headers.map((h) => {
                  const target = mapping[h];
                  return (
                    <th
                      key={h}
                      style={{
                        padding: '8px 10px', fontSize: 10.5, fontWeight: 800, textAlign: 'left', whiteSpace: 'nowrap',
                        borderBottom: '1px solid var(--border)',
                        color: target ? 'var(--text-primary)' : 'var(--text-disabled)',
                        background: target ? undefined : 'rgba(13,33,55,0.03)',
                      }}
                      title={target ? fieldLabel(target, lang) : t('employees.importColumnIgnored')}
                    >
                      {h}
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: target ? 'var(--accent)' : 'var(--text-disabled)', marginTop: 2 }}>
                        {target ? `→ ${fieldLabel(target, lang)}` : t('employees.importColumnUnmapped')}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((v) => {
                const row = rows.find((r) => r.rowIndex === v.rowIndex)!;
                const issuesByField = new Map<string, RowIssue[]>();
                for (const i of [...v.errors, ...v.warnings]) {
                  issuesByField.set(i.field, [...(issuesByField.get(i.field) ?? []), i]);
                }
                const hasError = v.errors.length > 0;
                return (
                  <React.Fragment key={v.rowIndex}>
                    <tr style={{ background: hasError ? ERR.bg : undefined }}>
                      <td style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>
                        {v.rowIndex}
                      </td>
                      {headers.map((h) => {
                        const field = mapping[h];
                        const fieldIssues = field ? issuesByField.get(field) ?? [] : [];
                        const isError = fieldIssues.some((i) => v.errors.includes(i));
                        const isWarn = !isError && fieldIssues.length > 0;
                        return (
                          <td
                            key={h}
                            style={{
                              padding: 0, borderBottom: '1px solid var(--border-light)',
                              background: isError ? 'rgba(220,38,38,0.13)' : isWarn ? 'rgba(245,158,11,0.13)' : undefined,
                            }}
                            title={fieldIssues.map(issueText).join('\n')}
                          >
                            <input
                              value={String(row.data[h] ?? '')}
                              onChange={(e) => editCell(v.rowIndex, h, e.target.value)}
                              style={{
                                width: '100%', minWidth: 110, border: 'none', outline: 'none', background: 'transparent',
                                padding: '7px 10px', fontSize: 11.5, fontFamily: 'var(--font-body)',
                                color: field ? 'var(--text-primary)' : 'var(--text-disabled)',
                                fontWeight: isError ? 700 : 500,
                              }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                    {(v.errors.length > 0 || v.warnings.length > 0) && (
                      <tr>
                        <td colSpan={headers.length + 1} style={{ padding: '5px 10px 8px 10px', borderBottom: '1px solid var(--border-light)', background: hasError ? 'rgba(220,38,38,0.04)' : 'rgba(245,158,11,0.05)' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {v.errors.map((i, n) => (
                              <span key={`e${n}`} style={{ fontSize: 10.5, fontWeight: 700, color: ERR.fg, background: 'var(--surface)', border: `1px solid ${ERR.border}`, borderRadius: 6, padding: '3px 7px' }}>
                                ✕ {issueText(i)}
                              </span>
                            ))}
                            {v.warnings.map((i, n) => (
                              <span key={`w${n}`} style={{ fontSize: 10.5, fontWeight: 700, color: WARN.fg, background: 'var(--surface)', border: `1px solid ${WARN.border}`, borderRadius: 6, padding: '3px 7px' }}>
                                ⚠ {issueText(i)}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Banner tone="info" icon={<Info size={15} />} title={t('employees.importMappingIntro')} />

      {missingRequired.length > 0 ? (
        <Banner
          tone="err"
          icon={<AlertCircle size={15} />}
          title={t('employees.importMappingMissing')}
          body={missingRequired.map((k) => fieldLabel(k, lang)).join(' · ')}
        />
      ) : (
        <Banner tone="ok" icon={<CheckCircle2 size={15} />} title={t('employees.importMappingAllSet')} />
      )}

      {templates.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)' }}>{t('employees.importSelectTemplate')}:</span>
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => applyTemplate(tpl)}
              style={{ padding: '5px 11px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface-warm)', fontSize: 11.5, fontWeight: 700, color: 'var(--primary)', cursor: 'pointer' }}
            >
              {tpl.name}
            </button>
          ))}
        </div>
      )}

      <div style={{ border: '1px solid var(--border)', borderRadius: 11, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1.1fr', gap: 0, background: 'var(--surface-warm)', padding: '8px 12px', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
          <div>{t('employees.importMappingYourColumn')}</div>
          <div>{t('employees.importMappingSample')}</div>
          <div>{t('employees.importMappingTarget')}</div>
        </div>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {headers.map((h) => {
            const target = mapping[h] ?? '';
            const wasAuto = autoMapping[h] === target && target !== '';
            const sample = String(rows[0]?.data[h] ?? '');
            const duplicate = target !== '' && headers.some((o) => o !== h && mapping[o] === target);
            const def = FIELD_CATALOG.find((f) => f.key === target);
            return (
              <div
                key={h}
                style={{
                  display: 'grid', gridTemplateColumns: '1.1fr 1fr 1.1fr', gap: 10, alignItems: 'center',
                  padding: '9px 12px', borderBottom: '1px solid var(--border-light)',
                  background: duplicate ? ERR.bg : undefined,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h}</div>
                  {target && (
                    <span style={{ display: 'inline-block', marginTop: 3, fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, padding: '2px 6px', borderRadius: 999, color: wasAuto ? OK.fg : 'var(--primary)', background: wasAuto ? OK.bg : 'rgba(13,33,55,0.06)', border: `1px solid ${wasAuto ? OK.border : 'var(--border)'}` }}>
                      {wasAuto ? t('employees.importMappingAuto') : t('employees.importMappingManual')}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sample || '—'}
                </div>

                <div>
                  <select
                    value={target}
                    onChange={(e) => setMapping((prev) => ({ ...prev, [h]: e.target.value }))}
                    style={{
                      width: '100%', padding: '7px 9px', fontSize: 12, borderRadius: 8,
                      border: `1px solid ${duplicate ? ERR.border : 'var(--border)'}`,
                      background: 'var(--surface)', color: target ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontWeight: target ? 600 : 400, outline: 'none', cursor: 'pointer',
                    }}
                  >
                    <option value="">{t('employees.importMappingIgnore')}</option>
                    {FIELD_CATALOG.map((f) => (
                      <option key={f.key} value={f.key}>
                        {fieldLabel(f.key, lang)}{f.required ? ' *' : ''}
                      </option>
                    ))}
                  </select>
                  {duplicate && (
                    <div style={{ fontSize: 10, color: ERR.fg, fontWeight: 700, marginTop: 3 }}>{t('employees.importMappingDuplicate')}</div>
                  )}
                  {def?.storedAs && (
                    <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 3, fontFamily: 'monospace' }}>→ {def.storedAs}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder={t('employees.importTemplateName')}
          style={{ flex: '1 1 200px', padding: '8px 11px', fontSize: 12.5, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', outline: 'none', color: 'var(--text-primary)' }}
        />
        <button
          onClick={handleSaveTemplate}
          disabled={!templateName.trim()}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--surface-warm)', fontSize: 12.5, fontWeight: 700,
            color: templateName.trim() ? 'var(--primary)' : 'var(--text-disabled)',
            cursor: templateName.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          <Save size={14} /> {t('employees.importSaveTemplate')}
        </button>
        {templateMsg && <span style={{ fontSize: 11.5, fontWeight: 700, color: OK.fg }}>✓ {templateMsg}</span>}
      </div>
    </div>
  );

  const renderStep4 = () => {
    const creatable = validations.filter((v) => v.payload);
    const skipped = validations.filter((v) => v.errors.length > 0);
    const warned = validations.filter((v) => v.errors.length === 0 && v.warnings.length > 0);

    // Grouped so the operator sees exactly where the headcount lands.
    const groups = new Map<string, number>();
    for (const v of creatable) {
      const key = `${v.display.company}||${v.display.store}`;
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }

    if (doneCount !== null) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: OK.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={34} color={OK.fg} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            {t('employees.importDoneTitle')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {t('employees.importDoneCreated', { count: doneCount })}
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
          <StatCard value={creatable.length} label={t('employees.importSummaryCreate')} tone="ok" />
          <StatCard value={skipped.length} label={t('employees.importSummarySkip')} tone="err" />
          <StatCard value={warned.length} label={t('employees.importSummaryWarn')} tone="warn" />
        </div>

        {importError && <Banner tone="err" icon={<AlertCircle size={15} />} title={t('employees.importFailedTitle')} body={importError} />}

        {creatable.length === 0 ? (
          <Banner tone="err" icon={<AlertCircle size={15} />} title={t('employees.importSummaryNothing')} />
        ) : (
          <>
            <div style={{ border: '1px solid var(--border)', borderRadius: 11, overflow: 'hidden' }}>
              <div style={{ padding: '9px 13px', borderBottom: '1px solid var(--border)', background: 'var(--surface-warm)', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-muted)' }}>
                {t('employees.importSummaryByCompany')}
              </div>
              <div style={{ padding: 9, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                {[...groups.entries()].map(([key, n]) => {
                  const [company, store] = key.split('||');
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 11px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)' }}>
                      <Building2 size={15} color="var(--primary)" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>{company || '—'}</span>
                      <StoreIcon size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{store || '—'}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: OK.fg, background: OK.bg, border: `1px solid ${OK.border}`, borderRadius: 999, padding: '2px 10px' }}>
                        +{n}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <Banner tone="info" icon={<Info size={15} />} title={t('employees.importSummaryPasswordNote')} />
          </>
        )}

        {skipped.length > 0 && (
          <div style={{ border: `1px solid ${ERR.border}`, borderRadius: 11, overflow: 'hidden' }}>
            <div style={{ padding: '9px 13px', background: ERR.bg, fontSize: 11.5, fontWeight: 800, color: ERR.fg }}>
              {t('employees.importSummarySkippedTitle')} · {skipped.length}
            </div>
            <div style={{ maxHeight: 190, overflowY: 'auto', padding: 9, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {skipped.map((v) => (
                <div key={v.rowIndex} style={{ display: 'flex', gap: 9, alignItems: 'baseline', fontSize: 11.5 }}>
                  <span style={{ fontWeight: 800, color: 'var(--text-muted)', flexShrink: 0 }}>{t('employees.importRowLabel')} {v.rowIndex}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>{v.display.name || '—'}</span>
                  <span style={{ color: ERR.fg }}>{v.errors.map(issueText).join(' · ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {warned.length > 0 && (
          <div style={{ border: `1px solid ${WARN.border}`, borderRadius: 11, overflow: 'hidden' }}>
            <div style={{ padding: '9px 13px', background: WARN.bg, fontSize: 11.5, fontWeight: 800, color: WARN.fg }}>
              {t('employees.importSummaryWarningsTitle')} · {warned.length}
            </div>
            <div style={{ maxHeight: 170, overflowY: 'auto', padding: 9, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {warned.map((v) => (
                <div key={v.rowIndex} style={{ display: 'flex', gap: 9, alignItems: 'baseline', fontSize: 11.5 }}>
                  <span style={{ fontWeight: 800, color: 'var(--text-muted)', flexShrink: 0 }}>{t('employees.importRowLabel')} {v.rowIndex}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>{v.display.name || '—'}</span>
                  <span style={{ color: WARN.fg }}>{v.warnings.map(issueText).join(' · ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const stepTitles = [
    t('employees.importStep1Title'), t('employees.importStep2Title'),
    t('employees.importStep3Title'), t('employees.importStep4Title'),
  ];
  const stepSubs = [
    t('employees.importStep1Sub'), t('employees.importStep2Sub'),
    t('employees.importStep3Sub'), t('employees.importStep4Sub'),
  ];
  const stepLabels = [
    t('employees.importStep1'), t('employees.importStep2'),
    t('employees.importStep3'), t('employees.importStep4'),
  ];

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(13,33,55,0.55)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 'min(1120px, 100%)', maxHeight: '92vh', background: 'var(--surface)', borderRadius: 16,
            border: '1px solid var(--border)', boxShadow: '0 28px 70px rgba(13,33,55,0.32)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{ padding: '15px 20px 12px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(13,33,55,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileSpreadsheet size={20} color="var(--primary)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                  {stepTitles[step - 1]}
                </h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{stepSubs[step - 1]}</div>
              </div>
              {file && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px', borderRadius: 8, background: 'var(--surface-warm)', border: '1px solid var(--border)', maxWidth: 260 }}>
                  <FileSpreadsheet size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)', flexShrink: 0 }}>{rows.length}</span>
                </div>
              )}
              <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>
                <X size={15} />
              </button>
            </div>

            {/* Stepper */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px', background: 'var(--background)', borderRadius: 10, border: '1px solid var(--border)' }}>
              {[1, 2, 3, 4].map((s, idx) => {
                const active = step === s;
                const done = step > s;
                return (
                  <React.Fragment key={s}>
                    {idx > 0 && <div style={{ flex: 1, height: 2, background: done || active ? 'var(--accent)' : 'var(--border)', borderRadius: 2 }} />}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <div
                        style={{
                          width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 800,
                          background: done ? OK.fg : active ? 'var(--accent)' : 'var(--surface)',
                          color: done || active ? '#fff' : 'var(--text-muted)',
                          border: `1px solid ${done ? OK.fg : active ? 'var(--accent)' : 'var(--border)'}`,
                        }}
                      >
                        {done ? '✓' : s}
                      </div>
                      <span style={{ fontSize: 11.5, fontWeight: active ? 800 : 600, color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {stepLabels[idx]}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
          </div>

          {/* Footer */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'var(--surface-warm)' }}>
            <div>
              {step > 1 && doneCount === null && (
                <button
                  onClick={() => setStep((s) => (s - 1) as Step)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 15px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  <ArrowLeft size={15} /> {t('common.back', 'Back')}
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 9 }}>
              {doneCount !== null ? (
                <button
                  onClick={onClose}
                  style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: OK.fg, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  {t('common.close', 'Close')}
                </button>
              ) : step < 4 ? (
                <button
                  onClick={() => setStep((s) => (s + 1) as Step)}
                  disabled={!canNext}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9, border: 'none',
                    background: canNext ? 'var(--primary)' : 'var(--border)',
                    color: canNext ? '#fff' : 'var(--text-disabled)',
                    fontSize: 13, fontWeight: 700, cursor: canNext ? 'pointer' : 'not-allowed',
                  }}
                >
                  {t('common.next', 'Next')} <ArrowRight size={15} />
                </button>
              ) : (
                <button
                  onClick={handleImport}
                  disabled={importing || validations.filter((v) => v.payload).length === 0}
                  style={{
                    padding: '9px 20px', borderRadius: 9, border: 'none',
                    background: importing || validations.filter((v) => v.payload).length === 0 ? 'var(--border)' : OK.fg,
                    color: importing || validations.filter((v) => v.payload).length === 0 ? 'var(--text-disabled)' : '#fff',
                    fontSize: 13, fontWeight: 700,
                    cursor: importing || validations.filter((v) => v.payload).length === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {importing
                    ? t('employees.importImporting')
                    : t('employees.importConfirmButton', { count: validations.filter((v) => v.payload).length })}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} lang={lang} />
    </>,
    document.body,
  );
}

export default BulkImportModal;
