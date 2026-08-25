import type { TFunction } from 'i18next';

/**
 * Turns a billing API failure into a message in the user's language.
 *
 * The server answers with a machine-readable `code` plus an English or Italian
 * sentence. Showing that sentence directly means the toast ignores the language
 * the user picked, so the code is translated here and the server text is only
 * a last resort for cases we do not model.
 */
export function billingErrorMessage(err: any, t: TFunction): string {
  const data = err?.response?.data ?? {};
  const code: string | undefined = data.code;

  switch (code) {
    case 'LICENSE_LIMIT_REACHED':
      return data.resource === 'terminal'
        ? t('billing.err_licenseLimitTerminal', {
            inUse: data.inUse,
            licensed: data.licensed,
          })
        : t('billing.err_licenseLimitEmployee', {
            inUse: data.inUse,
            licensed: data.licensed,
          });

    case 'COMPANY_DETAILS_INCOMPLETE':
      return t('billing.err_companyDetailsIncomplete');

    case 'PRICING_NOT_CONFIGURED':
      return t('billing.err_pricingNotConfigured');

    case 'NOTHING_TO_BILL':
      return t('billing.err_nothingToBill');

    case 'SUBSCRIPTION_ALREADY_ACTIVE':
      return t('billing.err_alreadyActive');

    case 'LICENSES_BELOW_USAGE':
      return data.resource === 'terminal'
        ? t('billing.err_belowUsageTerminal', { inUse: data.inUse })
        : t('billing.err_belowUsageEmployee', { inUse: data.inUse });

    case 'UPGRADE_IN_PROGRESS':
      return t('billing.err_upgradeInProgress');

    case 'NO_ACTIVE_SUBSCRIPTION':
      return t('billing.err_noActiveSubscription');

    case 'PROVIDER_NOT_SUPPORTED':
      return t('billing.err_providerNotSupported');

    case 'SUBSCRIPTION_REQUIRED':
      return t('billing.err_subscriptionRequired');

    case 'SUBSCRIPTION_BLOCKED':
      return t('billing.err_subscriptionBlocked');

    case 'INVALID_LICENSES':
      return t('billing.err_invalidLicenses');

    default:
      return data.error || data.message || t('billing.err_generic');
  }
}
