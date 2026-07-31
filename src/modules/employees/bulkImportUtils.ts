import * as XLSX from 'xlsx';
import { Employee, Company, Store, UserRole } from '../../types';

/* ── Header Normalization Helper ────────────────────────────────────────── */
export function normalizeHeader(raw: string): string {
  if (!raw) return '';
  let str = String(raw).trim();
  // Strip parenthetical text e.g. "Nome (completo)" -> "Nome"
  str = str.replace(/\([^)]*\)/g, '');
  // Replace hyphens, underscores, slashes, dots with spaces
  str = str.replace(/[-_.\/]/g, ' ');
  // Collapse multiple spaces & lowercase
  return str.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * COLUMN_MAP indexed with every space removed, so a header whose words are
 * split differently from the alias still resolves: "E-mail" normalises to
 * "e mail", which collapses to "email"; "E-mail personale" collapses to
 * "emailpersonale", matching the alias "email personale". Built once.
 */
let collapsedColumnMap: Record<string, string> | null = null;
function getCollapsedColumnMap(): Record<string, string> {
  // Built on first use: COLUMN_MAP is declared further down this module.
  if (collapsedColumnMap) return collapsedColumnMap;
  const index: Record<string, string> = {};
  for (const [key, field] of Object.entries(COLUMN_MAP)) {
    const collapsed = key.replace(/\s+/g, '');
    // First alias wins, so an exact alias is never shadowed by a later one.
    if (!(collapsed in index)) index[collapsed] = field;
  }
  collapsedColumnMap = index;
  return index;
}

export function matchHeaderToField(rawHeader: string): string | undefined {
  if (!rawHeader) return undefined;

  const norm = normalizeHeader(rawHeader);
  if (COLUMN_MAP[norm]) return COLUMN_MAP[norm];

  const directNorm = rawHeader.trim().toLowerCase();
  if (COLUMN_MAP[directNorm]) return COLUMN_MAP[directNorm];

  // Last resort: ignore word spacing entirely. Catches "E-mail", "E mail",
  // "Data Nascita" vs "datanascita", and similar exporter quirks without
  // needing a new alias for every variant.
  const collapsed = norm.replace(/\s+/g, '');
  return collapsed ? getCollapsedColumnMap()[collapsed] : undefined;
}

/* ── Column header → API field mapping ─────────────────────────────────── */
export const COLUMN_MAP: Record<string, string> = {
  // English
  'name': 'name',
  'surname': 'surname',
  'email': 'email',
  'role': 'role',
  'company': 'companyName',
  'company name': 'companyName',
  'store': 'storeName',
  'store name': 'storeName',
  'workplace': 'storeName',
  'work location': 'storeName',
  'supervisor': 'supervisorName',
  'department': 'department',
  'temporary password': 'password',
  'hire date': 'hireDate',
  'contract end': 'contractEndDate',
  'contract end date': 'contractEndDate',
  'contract expiry': 'contractEndDate',
  'work schedule': 'workingType',
  'weekly hours': 'weeklyHours',
  'personal email': 'personalEmail',
  'date of birth': 'dateOfBirth',
  'birth date': 'dateOfBirth',
  'nationality': 'nationality',
  'gender': 'gender',
  'iban': 'iban',
  'country': 'country',
  'state': 'state',
  'province': 'state',
  'city': 'city',
  'address': 'address',
  'postal code': 'cap',
  'zip code': 'cap',
  'cap': 'cap',
  'company phone numbers': 'phone',
  'phone': 'phone',
  'mobile': 'phone',
  'marital status': 'maritalStatus',
  'first aid': 'firstAidFlag',
  'first aider': 'firstAidFlag',
  'contract type': 'contractType',
  'probation period': 'probationMonths',
  'termination date': 'terminationDate',
  'termination type': 'terminationType',
  'employment status': 'status',
  'status': 'status',

  // Italian
  'nome': 'name',
  'cognome': 'surname',
  'ruolo': 'role',
  'azienda': 'companyName',
  'società': 'companyName',
  'societa': 'companyName',
  'impresa': 'companyName',
  'nome azienda': 'companyName',
  'negozio': 'storeName',
  'punto vendita': 'storeName',
  'filiale': 'storeName',
  'sede': 'storeName',
  'luogo di lavoro': 'storeName',
  'luogo lavoro': 'storeName',
  'supervisore': 'supervisorName',
  'responsabile': 'supervisorName',
  'dipartimento': 'department',
  'reparto': 'department',
  'password temporanea': 'password',
  'password': 'password',
  'data di assunzione': 'hireDate',
  'data assunzione': 'hireDate',
  'fine contratto': 'contractEndDate',
  'data fine contratto': 'contractEndDate',
  'scadenza contratto': 'contractEndDate',
  'orario di lavoro': 'workingType',
  'orario lavoro': 'workingType',
  'tipo orario': 'workingType',
  'ore settimanali': 'weeklyHours',
  'email personale': 'personalEmail',
  'mail personale': 'personalEmail',
  'posta elettronica personale': 'personalEmail',
  'data di nascita': 'dateOfBirth',
  'data nascita': 'dateOfBirth',
  'nazionalità': 'nationality',
  'nazionalita': 'nationality',
  'genere': 'gender',
  'sesso': 'gender',
  'nazione': 'country',
  'paese': 'country',
  'stato': 'status', // Fixed: Italian 'Stato' = Attivo/Inattivo status!
  'stato dipendente': 'status',
  'stato lavorativo': 'status',
  'provincia': 'state', // Italian province = state
  'città': 'city',
  'citta': 'city',
  'indirizzo': 'address',
  'codice postale': 'cap',
  'numeri di telefono aziendali': 'phone',
  'telefono aziendale': 'phone',
  'telefono': 'phone',
  'cellulare': 'phone',
  'stato civile': 'maritalStatus',
  'primo soccorso': 'firstAidFlag',
  'primo soccorritore': 'firstAidFlag',
  'tipo di contratto': 'contractType',
  'tipo contratto': 'contractType',
  'periodo di prova': 'probationMonths',
  'data di cessazione': 'terminationDate',
  'data cessazione': 'terminationDate',
  'data di risoluzione': 'terminationDate',
  'data risoluzione': 'terminationDate',
  'tipo di cessazione': 'terminationType',
  'tipo cessazione': 'terminationType',
  'tipo risoluzione': 'terminationType',
};

const ROLE_VALUES: UserRole[] = ['admin', 'hr', 'area_manager', 'store_manager', 'employee'];

const WORKING_TYPE_MAP: Record<string, string> = {
  'full time': 'full_time', 'full_time': 'full_time', 'fulltime': 'full_time', 'full-time': 'full_time',
  'part time': 'part_time', 'part_time': 'part_time', 'parttime': 'part_time', 'part-time': 'part_time',
  'tempo pieno': 'full_time', 'tempo parziale': 'part_time',
};

const GENDER_MAP: Record<string, string> = {
  'm': 'M', 'male': 'M', 'maschile': 'M', 'maschio': 'M', 'uomo': 'M',
  'f': 'F', 'female': 'F', 'femminile': 'F', 'femmina': 'F', 'donna': 'F',
  'other': 'other', 'altro': 'other',
};

const STATUS_MAP: Record<string, string> = {
  'attivo': 'active', 'active': 'active',
  'inattivo': 'inactive', 'inactive': 'inactive', 'disattivato': 'inactive',
};

const MARITAL_VALUES = [
  'Celibe', 'Nubile', 'Coniugato', 'Coniugata', 'Divorziato', 'Divorziata',
  'Vedovo', 'Vedova', 'Separato', 'Separata', 'Unione Civile',
];

const CONTRACT_TYPE_VALUES = [
  'Tempo Indeterminato', 'Tempo Determinato', 'Apprendistato',
  'Stage / Tirocinio', 'Partita IVA / Collaborazione', 'Altro',
];

const TERMINATION_TYPE_VALUES = [
  'Dimissioni volontarie', 'Fine contratto', 'Licenziamento',
  'Pensionamento', 'Risoluzione consensuale', 'Altro',
];

/* ── Helpers ───────────────────────────────────────────────────────────── */

function generateUniqueId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'EMP-';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#!$%&';
  const all = upper + lower + digits + special;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(special)];
  for (let i = 0; i < 8; i++) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function parseExcelDate(value: unknown): string {
  if (!value && value !== 0) return '';
  if (typeof value === 'number') {
    // Excel date serial number
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const y = String(date.y).padStart(4, '0');
      const m = String(date.m).padStart(2, '0');
      const d = String(date.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  const str = String(value).trim();
  // Try ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmy = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  // Try MM/DD/YYYY
  const mdy = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  return str;
}

function parseBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const str = String(value).trim().toLowerCase();
  return str === 'true' || str === 'yes' || str === '1' || str === 'sì' || str === 'si';
}

function matchDropdown(value: string, options: string[]): string | null {
  const lower = value.trim().toLowerCase();
  const found = options.find(o => o.toLowerCase() === lower);
  return found ?? null;
}

/* ── Parse Excel File ──────────────────────────────────────────────────── */

export interface ParsedRow {
  rowIndex: number;
  data: Record<string, unknown>;
}

export function parseExcelFile(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: false });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        const rows: ParsedRow[] = json.map((row: Record<string, unknown>, i: number) => ({ rowIndex: i + 2, data: row }));
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/* ── Map + Validate + Create ───────────────────────────────────────────── */

export interface ImportResult {
  rowIndex: number;
  success: boolean;
  error?: string | { key: string; params?: Record<string, any>; fallback?: string };
  employee?: Employee;
}


/* ── Export Employees to Excel ─────────────────────────────────────────────── */

/**
 * Exports an array of Employee objects to an Excel file (.xlsx) whose column
 * structure exactly matches the import template (English column headers).
 */
export function exportEmployeesToExcel(employees: Employee[], filename = 'employees_export.xlsx'): void {
  const rows = employees.map((emp) => ({
    'Nome':                    emp.name ?? '',
    'Cognome':                 emp.surname ?? '',
    'Email':                   emp.email ?? '',
    'Ruolo':                   emp.role ?? '',
    'Azienda':                 emp.companyName ?? '',
    'Negozio':                 emp.storeName ?? '',
    'Supervisore':             emp.supervisorName ?? '',
    'Dipartimento':            emp.department ?? '',
    'Data assunzione':         emp.hireDate ?? '',
    'Orario di lavoro':        emp.workingType === 'full_time' ? 'Tempo Pieno' : emp.workingType === 'part_time' ? 'Part-time' : '',
    'Fine contratto':          emp.contractEndDate ?? '',
    'Tipo contratto':          emp.contractType ?? '',
    'Ore settimanali':         emp.weeklyHours != null ? emp.weeklyHours : '',
    'Email personale':         emp.personalEmail ?? '',
    'Data nascita':            emp.dateOfBirth ?? '',
    'Nazionalità':             emp.nationality ?? '',
    'Genere':                  emp.gender ?? '',
    'CAP':                     emp.cap ?? '',
    'IBAN':                    emp.iban ?? '',
    'Primo soccorso':          emp.firstAidFlag ? 'Sì' : 'No',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{}]);
  const workbook  = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');

  // Set uniform column widths for readability
  const colCount = Object.keys(rows[0] ?? {
    'Nome': '', 'Cognome': '', 'Email': '', 'Ruolo': '', 'Azienda': '', 'Negozio': '',
    'Supervisore': '', 'Dipartimento': '', 'Data assunzione': '', 'Orario di lavoro': '',
    'Fine contratto': '', 'Tipo contratto': '', 'Ore settimanali': '',
    'Email personale': '', 'Data nascita': '', 'Nazionalità': '',
    'Genere': '', 'CAP': '', 'IBAN': '', 'Primo soccorso': '',
  }).length;
  worksheet['!cols'] = Array(colCount).fill({ wch: 22 });

  XLSX.writeFile(workbook, filename);
}



/* ═══════════════════════════════════════════════════════════════════════════
   Import wizard: field catalogue, validation engine, sample workbook.

   Validation is deliberately separated from creation. The old processRow() did
   both — it POSTed each row as it validated it, so the operator only discovered
   a bad row after earlier rows had already been created. Everything below is
   pure: it reports what *would* happen, and the wizard only calls the bulk
   endpoint once the operator has seen and accepted the outcome.
   ═══════════════════════════════════════════════════════════════════════════ */

export type FieldType = 'text' | 'email' | 'date' | 'number' | 'enum' | 'bool';

export interface FieldDef {
  key: string;
  /**
   * Labels are fixed per language so the operator can always cross-reference
   * their Italian file against our English database column.
   */
  labelIt: string;
  labelEn: string;
  type: FieldType;
  required: boolean;
  /** Human-facing example used in the guide and the sample workbook. */
  example: string;
  /** For enums: what the operator may write. */
  accepts?: string[];
  /** What we actually store, shown in the guide so the mapping is never a mystery. */
  storedAs?: string;
}

/**
 * Every column the importer understands. Single source of truth for the guide
 * modal, the mapping dropdown and the downloadable sample file — so those three
 * can never disagree with each other or with the parser.
 */
export const FIELD_CATALOG: FieldDef[] = [
  { key: 'name',          labelIt: 'Nome',            labelEn: 'First name',     type: 'text',  required: true, example: 'Mario' },
  { key: 'surname',       labelIt: 'Cognome',         labelEn: 'Surname',        type: 'text',  required: true, example: 'Rossi' },
  { key: 'email',         labelIt: 'Email aziendale', labelEn: 'Work email',     type: 'email', required: true, example: 'mario.rossi@azienda.it' },
  { key: 'personalEmail', labelIt: 'Email personale', labelEn: 'Personal email', type: 'email', required: true, example: 'mario.rossi@gmail.com' },
  {
    key: 'role', labelIt: 'Ruolo', labelEn: 'Role', type: 'enum', required: true, example: 'Dipendente',
    accepts: ['Dipendente / Employee', 'Responsabile Negozio / Store manager', 'Responsabile Area / Area manager', 'Risorse Umane / HR'],
    storedAs: 'employee | store_manager | area_manager | hr',
  },
  { key: 'companyName', labelIt: 'Azienda',         labelEn: 'Company', type: 'text', required: true, example: 'FUSARO UOMO' },
  { key: 'storeName',   labelIt: 'Luogo di lavoro', labelEn: 'Store',   type: 'text', required: true, example: 'Milano' },

  {
    key: 'status', labelIt: 'Stato', labelEn: 'Status', type: 'enum', required: false, example: 'Attivo',
    accepts: ['Attivo / Active', 'Inattivo / Inactive'], storedAs: 'active | inactive',
  },
  {
    key: 'gender', labelIt: 'Genere', labelEn: 'Gender', type: 'enum', required: false, example: 'Maschio',
    accepts: ['Maschio / Maschile / M', 'Femmina / Femminile / F'], storedAs: 'M | F',
  },
  {
    key: 'workingType', labelIt: 'Orario di lavoro', labelEn: 'Working time', type: 'enum', required: false, example: 'Tempo Pieno',
    accepts: ['Tempo Pieno / Full time', 'Tempo Parziale / Part time'], storedAs: 'full_time | part_time',
  },
  { key: 'contractType',    labelIt: 'Tipo contratto',     labelEn: 'Contract type',    type: 'enum', required: false, example: 'Tempo Indeterminato', accepts: CONTRACT_TYPE_VALUES },
  { key: 'maritalStatus',   labelIt: 'Stato civile',       labelEn: 'Marital status',   type: 'enum', required: false, example: 'Coniugato',           accepts: MARITAL_VALUES },
  { key: 'terminationType', labelIt: 'Tipo di cessazione', labelEn: 'Termination type', type: 'enum', required: false, example: 'Dimissioni volontarie', accepts: TERMINATION_TYPE_VALUES },

  { key: 'hireDate',        labelIt: 'Data di assunzione',  labelEn: 'Hire date',         type: 'date', required: false, example: '01/03/2024' },
  { key: 'contractEndDate', labelIt: 'Scadenza contratto',  labelEn: 'Contract end date', type: 'date', required: false, example: '31/12/2026' },
  { key: 'dateOfBirth',     labelIt: 'Data di nascita',     labelEn: 'Date of birth',     type: 'date', required: false, example: '15/06/1990' },
  { key: 'terminationDate', labelIt: 'Data di risoluzione', labelEn: 'Termination date',  type: 'date', required: false, example: '' },

  { key: 'weeklyHours',     labelIt: 'Ore settimanali', labelEn: 'Weekly hours',     type: 'number', required: false, example: '40' },
  { key: 'probationMonths', labelIt: 'Mesi di prova',   labelEn: 'Probation months', type: 'number', required: false, example: '6' },
  {
    key: 'firstAidFlag', labelIt: 'Primo soccorritore', labelEn: 'First aid officer', type: 'bool', required: false, example: 'Si',
    accepts: ['Si / True / 1', 'No / False / 0'], storedAs: 'true | false',
  },

  { key: 'department',     labelIt: 'Reparto',       labelEn: 'Department',  type: 'text', required: false, example: 'Vendite' },
  { key: 'supervisorName', labelIt: 'Responsabile',  labelEn: 'Supervisor',  type: 'text', required: false, example: 'Luca Bianchi' },
  { key: 'phone',          labelIt: 'Telefono',      labelEn: 'Phone',       type: 'text', required: false, example: '+39 333 1234567' },
  { key: 'nationality',    labelIt: 'Nazionalita',   labelEn: 'Nationality', type: 'text', required: false, example: 'Italiana' },
  { key: 'iban',           labelIt: 'IBAN',          labelEn: 'IBAN',        type: 'text', required: false, example: 'IT60X0542811101000000123456' },
  { key: 'address',        labelIt: 'Indirizzo',     labelEn: 'Address',     type: 'text', required: false, example: 'Via Roma 10' },
  { key: 'cap',            labelIt: 'CAP',           labelEn: 'Postal code', type: 'text', required: false, example: '20121' },
  { key: 'city',           labelIt: 'Citta',         labelEn: 'City',        type: 'text', required: false, example: 'Milano' },
  { key: 'state',          labelIt: 'Provincia',     labelEn: 'Province',    type: 'text', required: false, example: 'MI' },
  { key: 'country',        labelIt: 'Paese',         labelEn: 'Country',     type: 'text', required: false, example: 'Italia' },
];

export const REQUIRED_FIELD_KEYS = FIELD_CATALOG.filter((f) => f.required).map((f) => f.key);

export function fieldLabel(key: string, lang: string): string {
  const def = FIELD_CATALOG.find((f) => f.key === key);
  if (!def) return key;
  return lang.startsWith('it') ? def.labelIt : def.labelEn;
}

/* ── Issue model ─────────────────────────────────────────────────────────── */

export type IssueCode =
  | 'REQUIRED_MISSING'
  | 'INVALID_EMAIL'
  | 'DUPLICATE_IN_FILE'
  | 'ALREADY_EXISTS'
  | 'COMPANY_NOT_FOUND'
  | 'STORE_NOT_FOUND'
  | 'STORE_WRONG_COMPANY'
  | 'INVALID_ROLE'
  | 'ADMIN_NOT_ALLOWED'
  | 'INVALID_DATE'
  | 'INVALID_NUMBER'
  | 'STORE_OVER_CAPACITY'
  | 'SUPERVISOR_NOT_FOUND'
  | 'VALUE_NOT_RECOGNISED';

export interface RowIssue {
  /** Field the issue belongs to, so the preview can highlight that exact cell. */
  field: string;
  code: IssueCode;
  value?: string;
  /** Extra context, e.g. "3/2" for a capacity breach. */
  detail?: string;
}

export interface RowValidation {
  rowIndex: number;
  /** Blocking — the row will not be imported. */
  errors: RowIssue[];
  /** Non-blocking — the row imports, but the operator is told. */
  warnings: RowIssue[];
  /** Normalised payload for the bulk endpoint; null when the row is blocked. */
  payload: Record<string, unknown> | null;
  /** Resolved values for display in the confirmation step. */
  display: { name: string; email: string; company: string; store: string; role: string };
}

export interface ValidationContext {
  companies: Company[];
  stores: Store[];
  supervisors: Employee[];
  /** Work emails already present in the platform, lowercased. */
  existingEmails: Set<string>;
  /** Current active headcount per store id, for capacity warnings. */
  storeHeadcount: Map<number, number>;
  /** Capacity per store id; 0 or missing means unlimited. */
  storeCapacity: Map<number, number>;
}

const IMPORT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Roles an import may create — never 'admin'. */
const IMPORTABLE_ROLES: UserRole[] = ['hr', 'area_manager', 'store_manager', 'employee'];

const ROLE_ALIASES: Record<string, UserRole> = {
  'employee': 'employee', 'dipendente': 'employee', 'impiegato': 'employee', 'operaio': 'employee', 'commesso': 'employee',
  'store manager': 'store_manager', 'responsabile negozio': 'store_manager', 'responsabile punto vendita': 'store_manager', 'direttore negozio': 'store_manager',
  'area manager': 'area_manager', 'responsabile area': 'area_manager', 'responsabile di area': 'area_manager',
  'hr': 'hr', 'risorse umane': 'hr', 'human resources': 'hr', 'ufficio personale': 'hr',
  'admin': 'admin', 'amministratore': 'admin', 'administrator': 'admin', 'super admin': 'admin',
};

function resolveImportRole(raw: string): { role: UserRole | null; isAdmin: boolean } {
  const key = raw.trim().toLowerCase().replace(/[_\s]+/g, ' ');
  const direct = ROLE_ALIASES[key];
  if (direct === 'admin') return { role: null, isAdmin: true };
  return { role: direct ?? null, isAdmin: false };
}

/**
 * Applies the operator's column to field mapping to one parsed row.
 * `mapping` maps the file's raw header to a field key ('' means ignore).
 */
export function applyMapping(row: ParsedRow, mapping: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [header, value] of Object.entries(row.data)) {
    const field = mapping[header];
    if (!field) continue;
    const str = String(value ?? '').trim();
    if (str !== '') mapped[field] = str;
  }
  return mapped;
}

/** Auto-mapping seed: every header run through the alias table. */
export function buildInitialMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const used = new Set<string>();
  for (const h of headers) {
    const field = matchHeaderToField(h);
    // One target field per column: a second header claiming the same field is
    // left unmapped for the operator to resolve rather than silently winning.
    if (field && !used.has(field)) {
      mapping[h] = field;
      used.add(field);
    } else {
      mapping[h] = '';
    }
  }
  return mapping;
}

/**
 * Validates every row without writing anything.
 *
 * Duplicate and capacity checks are computed across the whole file rather than
 * per row, so the operator sees the true outcome of importing it as a batch.
 */
export function validateRows(
  rows: ParsedRow[],
  mapping: Record<string, string>,
  ctx: ValidationContext,
): RowValidation[] {
  const seenEmails = new Map<string, number>();
  const projectedLoad = new Map<number, number>();

  return rows.map((row) => {
    const mapped = applyMapping(row, mapping);
    const errors: RowIssue[] = [];
    const warnings: RowIssue[] = [];

    // ── Required fields ───────────────────────────────────────────────────
    for (const key of REQUIRED_FIELD_KEYS) {
      if (!mapped[key]) errors.push({ field: key, code: 'REQUIRED_MISSING' });
    }

    // ── Emails ────────────────────────────────────────────────────────────
    const email = (mapped.email ?? '').toLowerCase();
    if (mapped.email && !IMPORT_EMAIL_RE.test(mapped.email)) {
      errors.push({ field: 'email', code: 'INVALID_EMAIL', value: mapped.email });
    } else if (email) {
      if (ctx.existingEmails.has(email)) {
        errors.push({ field: 'email', code: 'ALREADY_EXISTS', value: mapped.email });
      } else if (seenEmails.has(email)) {
        errors.push({ field: 'email', code: 'DUPLICATE_IN_FILE', value: mapped.email, detail: String(seenEmails.get(email)) });
      } else {
        seenEmails.set(email, row.rowIndex);
      }
    }
    if (mapped.personalEmail && !IMPORT_EMAIL_RE.test(mapped.personalEmail)) {
      errors.push({ field: 'personalEmail', code: 'INVALID_EMAIL', value: mapped.personalEmail });
    }

    // ── Role. An import must never be able to mint an administrator: the file
    //    comes from an external HR system and nothing in it is trustworthy
    //    enough to grant full tenant access.
    let role: UserRole | null = null;
    if (mapped.role) {
      const resolved = resolveImportRole(mapped.role);
      if (resolved.isAdmin) {
        errors.push({ field: 'role', code: 'ADMIN_NOT_ALLOWED', value: mapped.role });
      } else if (!resolved.role || !IMPORTABLE_ROLES.includes(resolved.role)) {
        errors.push({ field: 'role', code: 'INVALID_ROLE', value: mapped.role });
      } else {
        role = resolved.role;
      }
    }

    // ── Company ───────────────────────────────────────────────────────────
    let company: Company | undefined;
    if (mapped.companyName) {
      const needle = mapped.companyName.trim().toLowerCase();
      company = ctx.companies.find((c) => (c.name ?? '').trim().toLowerCase() === needle);
      if (!company) errors.push({ field: 'companyName', code: 'COMPANY_NOT_FOUND', value: mapped.companyName });
    }

    // ── Store (must belong to the resolved company) ───────────────────────
    let store: Store | undefined;
    if (mapped.storeName) {
      const needle = mapped.storeName.trim().toLowerCase();
      const candidates = company ? ctx.stores.filter((s) => s.companyId === company!.id) : ctx.stores;
      store = candidates.find((s) => (s.name ?? '').trim().toLowerCase() === needle);
      if (!store) {
        const elsewhere = ctx.stores.find((s) => (s.name ?? '').trim().toLowerCase() === needle);
        errors.push({
          field: 'storeName',
          code: elsewhere && company ? 'STORE_WRONG_COMPANY' : 'STORE_NOT_FOUND',
          value: mapped.storeName,
        });
      } else {
        // Capacity warns but never blocks: an over-full store is a staffing
        // decision for HR, not a reason to reject payroll data.
        const capacity = ctx.storeCapacity.get(store.id) ?? 0;
        if (capacity > 0) {
          const next = (projectedLoad.get(store.id) ?? ctx.storeHeadcount.get(store.id) ?? 0) + 1;
          projectedLoad.set(store.id, next);
          if (next > capacity) {
            warnings.push({ field: 'storeName', code: 'STORE_OVER_CAPACITY', value: store.name, detail: `${next}/${capacity}` });
          }
        }
      }
    }

    // ── Supervisor (optional; an unknown name warns and is dropped) ───────
    let supervisorId: number | null = null;
    if (mapped.supervisorName) {
      const needle = mapped.supervisorName.trim().toLowerCase();
      const sup = ctx.supervisors.find(
        (s) => `${s.name} ${s.surname}`.trim().toLowerCase() === needle || (s.email ?? '').toLowerCase() === needle,
      );
      if (sup) supervisorId = sup.id;
      else warnings.push({ field: 'supervisorName', code: 'SUPERVISOR_NOT_FOUND', value: mapped.supervisorName });
    }

    // ── Dates ─────────────────────────────────────────────────────────────
    const dates: Record<string, string | null> = {};
    for (const def of FIELD_CATALOG) {
      if (def.type !== 'date') continue;
      const raw = mapped[def.key];
      if (!raw) { dates[def.key] = null; continue; }
      const parsed = parseExcelDate(raw);
      if (!ISO_DATE_RE.test(parsed)) {
        errors.push({ field: def.key, code: 'INVALID_DATE', value: raw });
        dates[def.key] = null;
      } else {
        dates[def.key] = parsed;
      }
    }

    // ── Numbers ───────────────────────────────────────────────────────────
    const numbers: Record<string, number | null> = {};
    for (const def of FIELD_CATALOG) {
      if (def.type !== 'number') continue;
      const raw = mapped[def.key];
      if (!raw) { numbers[def.key] = null; continue; }
      const n = Number(String(raw).replace(',', '.'));
      if (!Number.isFinite(n)) {
        errors.push({ field: def.key, code: 'INVALID_NUMBER', value: raw });
        numbers[def.key] = null;
      } else {
        numbers[def.key] = n;
      }
    }

    // ── Controlled vocabularies. An unrecognised value warns and is dropped
    //    rather than blocking: losing an optional attribute is recoverable,
    //    rejecting the whole employee is not.
    function enumValue<T>(key: string, resolver: (v: string) => T | null): T | null {
      const raw = mapped[key];
      if (!raw) return null;
      const value = resolver(raw);
      if (value === null) {
        warnings.push({ field: key, code: 'VALUE_NOT_RECOGNISED', value: raw });
        return null;
      }
      return value;
    }

    const workingType = enumValue('workingType', (v) => WORKING_TYPE_MAP[v.toLowerCase()] ?? null);
    const gender = enumValue('gender', (v) => GENDER_MAP[v.toLowerCase()] ?? null);
    const maritalStatus = enumValue('maritalStatus', (v) => matchDropdown(v, MARITAL_VALUES));
    const contractType = enumValue('contractType', (v) => matchDropdown(v, CONTRACT_TYPE_VALUES));
    const terminationType = enumValue('terminationType', (v) => matchDropdown(v, TERMINATION_TYPE_VALUES));
    const status = mapped.status ? (STATUS_MAP[mapped.status.toLowerCase()] ?? 'active') : 'active';

    const display = {
      name: `${mapped.name ?? ''} ${mapped.surname ?? ''}`.trim(),
      email: mapped.email ?? '',
      company: mapped.companyName ?? '',
      store: mapped.storeName ?? '',
      role: role ?? mapped.role ?? '',
    };

    if (errors.length > 0) {
      return { rowIndex: row.rowIndex, errors, warnings, payload: null, display };
    }

    return {
      rowIndex: row.rowIndex,
      errors,
      warnings,
      display,
      payload: {
        rowIndex: row.rowIndex,
        companyId: company ? company.id : null,
        storeId: store ? store.id : null,
        supervisorId,
        name: mapped.name,
        surname: mapped.surname,
        email: mapped.email,
        personalEmail: mapped.personalEmail ?? null,
        role,
        status,
        department: mapped.department ?? null,
        hireDate: dates.hireDate,
        contractEndDate: dates.contractEndDate,
        dateOfBirth: dates.dateOfBirth,
        terminationDate: dates.terminationDate,
        workingType,
        weeklyHours: numbers.weeklyHours,
        probationMonths: numbers.probationMonths,
        nationality: mapped.nationality ?? null,
        gender,
        iban: mapped.iban ?? null,
        address: mapped.address ?? null,
        cap: mapped.cap ?? null,
        phone: mapped.phone ?? null,
        country: mapped.country ?? null,
        state: mapped.state ?? null,
        city: mapped.city ?? null,
        firstAidFlag: mapped.firstAidFlag ? parseBool(mapped.firstAidFlag) : false,
        maritalStatus,
        contractType,
        terminationType,
        companyName: mapped.companyName,
        storeName: mapped.storeName,
      },
    };
  });
}

/* ── Sample workbook ─────────────────────────────────────────────────────── */

const SAMPLE_PEOPLE = [
  { n: 'Mario',   s: 'Rossi',    r: 'Dipendente',           g: 'Maschio', w: 'Tempo Pieno',    d: 'Vendite',       h: '01/03/2024', b: '15/06/1990', wh: '40', m: 'Coniugato', fa: 'Si' },
  { n: 'Giulia',  s: 'Bianchi',  r: 'Responsabile Negozio', g: 'Femmina', w: 'Tempo Pieno',    d: 'Direzione',     h: '15/01/2022', b: '22/09/1985', wh: '40', m: 'Nubile',    fa: 'No' },
  { n: 'Luca',    s: 'Ferrari',  r: 'Responsabile Area',    g: 'Maschio', w: 'Tempo Pieno',    d: 'Operations',    h: '10/06/2021', b: '05/11/1980', wh: '40', m: 'Coniugato', fa: 'Si' },
  { n: 'Sofia',   s: 'Esposito', r: 'Risorse Umane',        g: 'Femmina', w: 'Tempo Pieno',    d: 'Risorse Umane', h: '20/02/2023', b: '18/04/1988', wh: '40', m: 'Nubile',    fa: 'No' },
  { n: 'Marco',   s: 'Conti',    r: 'Dipendente',           g: 'Maschio', w: 'Tempo Parziale', d: 'Magazzino',     h: '05/09/2024', b: '30/01/1996', wh: '20', m: 'Celibe',    fa: 'No' },
  { n: 'Chiara',  s: 'Lombardi', r: 'Dipendente',           g: 'Femmina', w: 'Tempo Pieno',    d: 'Cassa',         h: '12/11/2023', b: '07/05/1994', wh: '40', m: 'Nubile',    fa: 'Si' },
  { n: 'Alessio', s: 'Greco',    r: 'Dipendente',           g: 'Maschio', w: 'Tempo Parziale', d: 'Vendite',       h: '03/04/2025', b: '14/08/1999', wh: '24', m: 'Celibe',    fa: 'No' },
  { n: 'Martina', s: 'Ricci',    r: 'Dipendente',           g: 'Femmina', w: 'Tempo Pieno',    d: 'Vendite',       h: '08/07/2022', b: '25/12/1992', wh: '38', m: 'Coniugata', fa: 'No' },
  { n: 'Davide',  s: 'Moretti',  r: 'Responsabile Negozio', g: 'Maschio', w: 'Tempo Pieno',    d: 'Direzione',     h: '01/02/2020', b: '11/03/1983', wh: '40', m: 'Coniugato', fa: 'Si' },
  { n: 'Elena',   s: 'Barbieri', r: 'Dipendente',           g: 'Femmina', w: 'Tempo Parziale', d: 'Cassa',         h: '19/10/2024', b: '02/02/1997', wh: '18', m: 'Nubile',    fa: 'No' },
];

/**
 * Sample file with ten realistic employees across four roles.
 *
 * Headers follow the selected UI language so the operator recognises them, but
 * the parser accepts either language regardless of which file was downloaded.
 * Company and store are pre-filled from the current selection when known —
 * guessing them would produce a file that fails validation on first upload.
 */
export function downloadSampleEmployeesExcel(lang: string, companyName = '', storeName = ''): void {
  const it = lang.startsWith('it');
  const h = (k: string) => fieldLabel(k, lang);

  const rows = SAMPLE_PEOPLE.map((p, i) => ({
    [h('name')]: p.n,
    [h('surname')]: p.s,
    [h('email')]: `${p.n.toLowerCase()}.${p.s.toLowerCase()}@azienda.it`,
    [h('personalEmail')]: `${p.n.toLowerCase()}.${p.s.toLowerCase()}@gmail.com`,
    [h('role')]: p.r,
    [h('companyName')]: companyName,
    [h('storeName')]: storeName,
    [h('status')]: it ? 'Attivo' : 'Active',
    [h('gender')]: it ? p.g : p.g === 'Maschio' ? 'Male' : 'Female',
    [h('workingType')]: it ? p.w : p.w === 'Tempo Pieno' ? 'Full time' : 'Part time',
    [h('department')]: p.d,
    [h('hireDate')]: p.h,
    [h('dateOfBirth')]: p.b,
    [h('weeklyHours')]: p.wh,
    [h('maritalStatus')]: p.m,
    [h('contractType')]: 'Tempo Indeterminato',
    [h('firstAidFlag')]: it ? p.fa : p.fa === 'Si' ? 'Yes' : 'No',
    [h('phone')]: `+39 33${i} 12345${i}${i}`,
    [h('nationality')]: it ? 'Italiana' : 'Italian',
    [h('city')]: 'Milano',
    [h('cap')]: '20121',
    [h('country')]: it ? 'Italia' : 'Italy',
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = Object.keys(rows[0]).map((k) => ({ wch: Math.max(14, k.length + 2) }));

  // Second sheet documents every field, so the file explains itself offline.
  const legend = FIELD_CATALOG.map((f) => ({
    [it ? 'Colonna (IT)' : 'Column (IT)']: f.labelIt,
    [it ? 'Colonna (EN)' : 'Column (EN)']: f.labelEn,
    [it ? 'Obbligatorio' : 'Required']: f.required ? (it ? 'Si' : 'Yes') : 'No',
    [it ? 'Tipo' : 'Type']: f.type,
    [it ? 'Valori accettati' : 'Accepted values']: (f.accepts ?? []).join('  |  '),
    [it ? 'Salvato come' : 'Stored as']: f.storedAs ?? '',
    [it ? 'Esempio' : 'Example']: f.example,
  }));
  const legendSheet = XLSX.utils.json_to_sheet(legend);
  legendSheet['!cols'] = [{ wch: 24 }, { wch: 24 }, { wch: 13 }, { wch: 10 }, { wch: 52 }, { wch: 34 }, { wch: 28 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, it ? 'Dipendenti' : 'Employees');
  XLSX.utils.book_append_sheet(wb, legendSheet, it ? 'Guida campi' : 'Field guide');
  XLSX.writeFile(wb, it ? 'esempio_dipendenti.xlsx' : 'sample_employees.xlsx');
}
