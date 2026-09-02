import apiClient from './client';
import {
  BillingOverview,
  BillingTransaction,
  LicenseQuote,
  LicenseSnapshot,
  PaymentProvider,
  SuperAdminBillingCompanyRow,
} from '../types';

export const billingApi = {
  /**
   * Initiates hosted Stripe or PayPal checkout session
   */
  createCheckoutSession: async (
    provider: PaymentProvider,
    companyId?: number,
    licenses?: { employeeLicenses: number; terminalLicenses: number }
  ): Promise<{ checkoutUrl: string; billingAttemptId: number }> => {
    const { data } = await apiClient.post('/billing/checkout', {
      provider,
      companyId,
      ...(licenses || {}),
    });
    return data;
  },

  /**
   * Retrieves company subscription overview, live usage, and pricing
   */
  getBillingOverview: async (companyId?: number): Promise<BillingOverview> => {
    const params = companyId ? { companyId } : {};
    const { data } = await apiClient.get('/billing/overview', { params });
    return data;
  },

  /**
   * Retrieves paginated payment transactions history
   */
  getTransactions: async (
    page = 1,
    limit = 20,
    companyId?: number
  ): Promise<{
    data: BillingTransaction[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> => {
    const params: Record<string, any> = { page, limit };
    if (companyId) params.companyId = companyId;
    const { data } = await apiClient.get('/billing/transactions', { params });
    return data;
  },

  /**
   * Cancels subscription at the end of current billing period
   */
  cancelSubscription: async (companyId?: number): Promise<{ success: boolean }> => {
    const { data } = await apiClient.post('/billing/cancel', { companyId });
    return data;
  },

  /**
   * Reactivates a pending cancelled subscription
   */
  reactivateSubscription: async (companyId?: number): Promise<{ success: boolean }> => {
    const { data } = await apiClient.post('/billing/reactivate', { companyId });
    return data;
  },

  /**
   * Manually syncs live active employee and terminal quantities with gateway
   */
  /**
   * Current allowance, usage and any change in flight.
   */
  getLicenses: async (companyId?: number): Promise<LicenseSnapshot> => {
    const params = companyId ? { companyId } : {};
    const { data } = await apiClient.get('/billing/licenses', { params });
    return data;
  },

  /**
   * What a proposed license change would cost. No side effects.
   */
  quoteLicenses: async (
    employeeLicenses: number,
    terminalLicenses: number,
    companyId?: number
  ): Promise<LicenseQuote> => {
    const { data } = await apiClient.post('/billing/licenses/quote', {
      employeeLicenses,
      terminalLicenses,
      companyId,
    });
    return data;
  },

  /**
   * Buys more licenses (charged now, prorated) or schedules a reduction.
   * An increase is granted only once the provider confirms payment.
   */
  changeLicenses: async (
    employeeLicenses: number,
    terminalLicenses: number,
    companyId?: number
  ): Promise<{
    status: 'applied' | 'awaiting_payment' | 'scheduled';
    applied: boolean;
    amountDueNow: number;
    additionalMonthly?: number;
    newMonthlyTotal?: number;
    currency: string;
    extraEmployees?: number;
    extraTerminals?: number;
    newEmployees: number;
    newTerminals: number;
    effectiveAt?: string;
    approveUrl?: string;
    deferredReason?: 'PAYPAL_NO_MIDCYCLE_CHARGE';
  }> => {
    const { data } = await apiClient.post('/billing/licenses', {
      employeeLicenses,
      terminalLicenses,
      companyId,
    });
    return data;
  },

  /**
   * Asks the provider what happened to an upgrade still shown as pending and
   * settles it. The way out when the UI says "awaiting confirmation".
   */
  verifyPendingUpgrade: async (
    companyId?: number
  ): Promise<{
    changed: boolean;
    outcome: 'paid' | 'failed' | 'pending' | 'none';
    licenses: LicenseSnapshot;
  }> => {
    const { data } = await apiClient.post('/billing/licenses/verify', { companyId });
    return data;
  },

  /**
   * Hosted page for replacing the card on an active subscription.
   */
  updatePaymentMethod: async (companyId?: number): Promise<{ url: string }> => {
    const { data } = await apiClient.post('/billing/payment-method', { companyId });
    return data;
  },

  /**
   * Lightweight restriction check used by the app shell.
   */
  getStatus: async (): Promise<{
    isBlocked: boolean;
    restricted: boolean;
    reason?: string | null;
    gracePeriodEndsAt?: string | null;
  }> => {
    const { data } = await apiClient.get('/billing/status');
    return data;
  },

  /**
   * The audit trail behind the licensed quantities.
   */
  getHeadcountHistory: async (
    companyId?: number,
    limit = 100
  ): Promise<{
    events: Array<{
      id: number;
      resourceType: 'employee' | 'terminal';
      changeType: 'added' | 'removed';
      delta: number;
      resultingCount: number;
      userLabel: string | null;
      /** Employee photo, read live so a changed photo shows everywhere. */
      avatarFilename: string | null;
      /** For a terminal, the logo and name of the store it belongs to. */
      storeLogoFilename: string | null;
      storeName: string | null;
      billedAt: string | null;
      occurredAt: string;
    }>;
    totals: { employeeCount: number; deviceCount: number };
  }> => {
    const params: Record<string, any> = { limit };
    if (companyId) params.companyId = companyId;
    const { data } = await apiClient.get('/billing/headcount-history', { params });
    return data;
  },

  /**
   * Super Admin overview of all tenant companies
   */
  getSuperAdminOverview: async (): Promise<SuperAdminBillingCompanyRow[]> => {
    const { data } = await apiClient.get('/billing/admin/overview');
    return data;
  },

  /**
   * Super Admin detail view for a company
   */
  getAdminCompanyBilling: async (
    companyId: number
  ): Promise<BillingOverview> => {
    const { data } = await apiClient.get(`/billing/admin/companies/${companyId}`);
    return data;
  },
};

export default billingApi;
