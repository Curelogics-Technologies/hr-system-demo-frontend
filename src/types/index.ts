export type UserRole = 'admin' | 'hr' | 'area_manager' | 'store_manager' | 'employee' | 'store_terminal';

export interface User {
  id: number;
  companyId: number | null;
  storeId: number | null;
  supervisorId: number | null;
  name: string;
  surname: string | null;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  isSuperAdmin: boolean;
  avatarFilename?: string | null;

  // Device binding (employee self-service only)
  isDeviceRegistered?: boolean;
  deviceResetPending?: boolean;
  requiresDeviceRegistration?: boolean;
  uniqueId?: string | null;
  deviceMetadata?: any;
  lastSeenIp?: string | null;
  lastSeenAt?: string | null;
}

export interface Company {
  id: number;
  name: string;
  slug?: string;
  isActive: boolean;
  logoFilename?: string | null;
  bannerFilename?: string | null;
  groupId?: number | null;
  groupName?: string | null;
  ownerUserId?: number | null;
  ownerName?: string | null;
  ownerSurname?: string | null;
  ownerAvatarFilename?: string | null;
  registrationNumber?: string | null;
  vatNumber?: string | null;
  sdiRecipientCode?: string | null;
  pecEmail?: string | null;
  companyEmail?: string | null;
  companyPhoneNumbers?: string | null;
  officesLocations?: string | null;
  country?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  timezones?: string | null;
  currency?: string | null;
  pricePerEmployee?: number | null;
  pricePerDevice?: number | null;
  extraStoragePricePerGb?: number | null;
  storageLimitGb?: number | null;
  accessValidFrom?: string | null;
  accessValidTo?: string | null;
  discountPercent?: number | null;
  discountValidFrom?: string | null;
  discountValidTo?: string | null;
  billReminderDaysBefore?: number | null;
  gracePeriodDays?: number | null;
  storeCount: number;
  employeeCount: number;
  activeDevicesCount: number;
  employeeDevicesCount?: number;
  storageUsedBytes: number;
  createdAt: string;
}

export interface Store {
  id: number;
  companyId: number;
  companyName?: string;   // populated when super admin fetches across companies
  groupName?: string | null;
  companyLogoFilename?: string | null;
  logoFilename?: string | null;
  name: string;
  code: string;
  address: string | null;
  cap: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  phone?: string | null;
  timezone?: string | null;
  maxStaff: number | null;
  isActive: boolean;
  employeeCount?: number;
  createdAt: string;

  // Record audit trail. Null on stores created before these were tracked.
  updatedAt?: string | null;
  createdByName?: string | null;
  updatedByName?: string | null;
}

export interface StoreOperatingHour {
  id?: number;
  storeId?: number;
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  peakStartTime?: string | null;
  peakEndTime?: string | null;
  plannedShiftCount?: number | null;
  plannedStaffCount?: number | null;
  shiftPlanNotes?: string | null;
  isClosed: boolean;
}

export interface Employee {
  id: number;
  companyId: number;
  storeId: number | null;
  supervisorId: number | null;
  name: string;
  surname: string;
  email: string;
  role: UserRole;
  uniqueId: string | null;
  department: string | null;
  hireDate: string | null;
  contractEndDate: string | null;
  terminationDate: string | null;
  workingType: 'full_time' | 'part_time' | null;
  weeklyHours: number | null;
  status: 'active' | 'inactive';
  isSuperAdmin?: boolean;
  firstAidFlag: boolean;
  maritalStatus: string | null;
  storeName?: string;
  supervisorName?: string;
  companyName?: string;
  companyGroupName?: string | null;
  // Sensitive — only returned for admin/hr or self
  personalEmail?: string | null;
  dateOfBirth?: string | null;
  nationality?: string | null;
  gender?: string | null;
  iban?: string | null;
  phone?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  address?: string | null;
  cap?: string | null;
  contractType?: string | null;
  probationMonths?: number | null;
  terminationType?: string | null;
  avatarFilename?: string | null;

  // Device binding (HR/admin view)
  deviceResetPending?: boolean;
  deviceRegistered?: boolean;
  deviceRegisteredAt?: string | null;
  deviceMetadata?: any;
  lastSeenIp?: string | null;
  lastSeenAt?: string | null;

  // Record audit trail. Null on records created before these were tracked.
  createdAt?: string | null;
  updatedAt?: string | null;
  createdByName?: string | null;
  updatedByName?: string | null;
}

export interface EmployeeAssociationEntry {
  id: number;
  name: string;
  surname: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  isSuperAdmin?: boolean;
  companyId: number;
  companyName: string;
  storeId: number | null;
  storeName: string | null;
  supervisorId: number | null;
  avatarFilename: string | null;
}

export interface EmployeeAssociationStore {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
  logoFilename?: string | null;
  employees: EmployeeAssociationEntry[];
}

export interface EmployeeAssociationCompany {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  logoFilename?: string | null;
  groupName?: string | null;
  stores: EmployeeAssociationStore[];
  unassignedEmployees: EmployeeAssociationEntry[];
  employeeCount: number;
}

export interface EmployeeAssociationsResponse {
  subject: {
    id: number;
    role: UserRole;
    companyId: number;
    companyName: string | null;
    storeId: number | null;
    storeName: string | null;
    supervisorId: number | null;
    name: string;
    surname: string;
    email: string;
    status: 'active' | 'inactive';
    avatarFilename: string | null;
  };
  scope: 'company' | 'company_group' | 'managed' | 'store' | 'self' | 'none';
  summary: {
    companyCount: number;
    storeCount: number;
    employeeCount: number;
  };
  companies: EmployeeAssociationCompany[];
}

export type TrainingType = 'product' | 'general' | 'low_risk_safety' | 'fire_safety';

export interface Training {
  id: number;
  userId: number;
  companyId: number;
  trainingType: TrainingType;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
}

export interface MedicalCheck {
  id: number;
  userId: number;
  companyId: number;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Message {
  id: number;
  companyId: number;
  companyName?: string | null;
  senderId: number;
  recipientId: number;
  subject: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  senderName?: string;
  senderRole?: UserRole;
  senderAvatarFilename?: string | null;
  recipientName?: string;
  recipientRole?: UserRole;
  recipientAvatarFilename?: string | null;
  direction?: 'received' | 'sent';
  attachmentFilename?: string | null;
}

export interface PermissionGrid {
  grid: Record<string, Record<string, boolean>>;
  moduleMeta: Record<string, { active: boolean }>;
}

export type PermissionMap = Record<string, boolean>;

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  code: string;
}

export interface EmployeeListResponse {
  employees: Employee[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export type PaymentProvider = 'stripe' | 'paypal';
export type SubscriptionStatus = 'pending' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete';

export interface Subscription {
  id: number;
  companyId?: number;
  provider: PaymentProvider;
  status: SubscriptionStatus;
  seatQuantity: number;
  deviceQuantity: number;
  pendingSeatQuantity: number | null;
  pendingDeviceQuantity: number | null;
  unitPriceEmployee: number;
  unitPriceDevice: number;
  currency: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  gracePeriodEndsAt: string | null;
  billReminderDaysBefore?: number;
  gracePeriodDays?: number;
  createdAt?: string;
}

export interface BillingTransaction {
  id: number;
  provider: PaymentProvider;
  amountCents: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  description: string | null;
  seatQuantity?: number;
  deviceQuantity?: number;
  invoiceUrl: string | null;
  failureCode?: string | null;
  failureMessage: string | null;
  attemptCount?: number;
  paidAt: string | null;
  createdAt: string;
}

export interface LicenseSnapshot {
  /** False for companies grandfathered in before the billing module. */
  billingEnforced?: boolean;
  hasSubscription: boolean;
  status: string | null;
  employeesLicensed: number;
  employeesInUse: number;
  employeesRemaining: number;
  terminalsLicensed: number;
  terminalsInUse: number;
  terminalsRemaining: number;
  pendingUpgrade: {
    employees: number;
    terminals: number;
    amountCents: number | null;
    requestedAt: string | null;
  } | null;
  scheduledReduction: { employees: number | null; terminals: number | null } | null;
}

export interface LicenseQuote {
  extraEmployees: number;
  extraTerminals: number;
  isIncrease: boolean;
  isDecrease: boolean;
  additionalMonthly: number;
  amountDueNow: number;
  amountDueNowCents: number;
  newMonthlyTotal: number;
  remainingRatio: number;
  daysRemaining: number | null;
  /** Length of the current billing period in whole days. */
  totalDays?: number;
}

export interface BillingOverview {
  company: {
    id: number;
    name: string;
    currency: string;
    vatNumber?: string | null;
    sdiRecipientCode?: string | null;
    pecEmail?: string | null;
    pricePerEmployee: number;
    pricePerDevice: number;
  };
  subscription: Subscription | null;
  liveUsage: {
    employeeCount: number;
    deviceCount: number;
    calculatedMonthlyTotal: number;
  };
  readiness?: {
    canCheckout: boolean;
    missingFields: string[];
    pricingConfigured: boolean;
    hasBillableQuantity: boolean;
    activeProvider: 'stripe' | 'paypal' | null;
  };
  /** What the company bought versus what it is using. */
  licenses?: LicenseSnapshot;
  /** The card the provider will bill, when there is one on file. */
  paymentMethod?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  } | null;
  transactions: BillingTransaction[];
}

export interface SuperAdminBillingCompanyRow {
  id: number;
  name: string;
  slug: string;
  currency: string;
  pricePerEmployee: number;
  pricePerDevice: number;
  billReminderDaysBefore: number;
  gracePeriodDays: number;
  employeeCount: number;
  activeDevicesCount: number;
  subscriptionId: number | null;
  provider: PaymentProvider | null;
  subscriptionStatus: SubscriptionStatus | null;
  seatQuantity: number | null;
  deviceQuantity: number | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean | null;
  gracePeriodEndsAt: string | null;
  lastPaidAt: string | null;
  totalRevenueCents: number | null;
}

