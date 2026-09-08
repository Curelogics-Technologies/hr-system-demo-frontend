import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Percent, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import billingApi from '../../api/billing';
import { useToast } from '../../context/ToastContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import type { BillingTaxRate } from '../../types';

/**
 * The tax rate every total on this page is built from.
 *
 * The rate itself is created once in the Stripe dashboard and Stripe is what
 * charges it - this panel is a mirror, not a control. It exists so an admin
 * can answer three questions without leaving the app and without opening
 * Stripe: what rate am I charging, is it the same rate on both providers, and
 * is what I am looking at current.
 *
 * That last one is why `source` and `syncedAt` are as prominent as the
 * percentage. A rate read from configuration because Stripe was unreachable
 * looks identical to one confirmed a minute ago, and only one of them is safe
 * to quote to a customer.
 */
export const BillingTaxCard: React.FC<{
  tax: BillingTaxRate | null;
  canSync: boolean;
  onSynced?: (tax: BillingTaxRate) => void;
}> = ({ tax, canSync, onSynced }) => {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [local, setLocal] = useState<BillingTaxRate | null>(null);

  const rate = local ?? tax;

  const handleSync = async () => {
    setSyncing(true);
    try {
      const fresh = await billingApi.syncTaxRate();
      setLocal(fresh);
      onSynced?.(fresh);
      if (fresh.ok) {
        showToast(
          t('billing.taxSyncOk', 'Aliquota aggiornata da Stripe: {{percent}}%', {
            percent: fresh.percent,
          }),
          'success'
        );
      } else {
        // Reaching Stripe and finding nothing usable is not an error the
        // browser should swallow: it is the answer, and it needs reading.
        showToast(
          fresh.syncError ||
            t('billing.taxSyncNoRate', 'Stripe non ha restituito un’aliquota utilizzabile.'),
          'error'
        );
      }
    } catch (err: any) {
      showToast(
        err?.response?.data?.error ||
          t('billing.taxSyncFailed', 'Impossibile leggere l’aliquota da Stripe'),
        'error'
      );
    } finally {
      setSyncing(false);
    }
  };

  const fromStripe = rate?.source === 'stripe';
  const syncedLabel = rate?.syncedAt
    ? new Date(rate.syncedAt).toLocaleString(i18n.language === 'en' ? 'en-GB' : 'it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const row: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    padding: '7px 0',
    fontSize: 12.5,
    borderBottom: '1px solid var(--border-light)',
  };

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: 20,
        marginBottom: 20,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 14,
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 800,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Percent size={16} style={{ color: 'var(--accent)' }} />
            {t('billing.taxCardTitle', 'Aliquota fiscale')}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            {t(
              'billing.taxCardSubtitle',
              'Creata nel pannello Stripe e applicata dal gestore di pagamento. Qui è solo mostrata.'
            )}
          </p>
        </div>

        {canSync && (
          <Button size="sm" variant="secondary" onClick={handleSync} loading={syncing}>
            <RefreshCw size={13} /> {t('billing.taxSync', 'Sincronizza da Stripe')}
          </Button>
        )}
      </div>

      {!rate || (!rate.enabled && rate.source === 'env' && !rate.stripeTaxRateId) ? (
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
            fontSize: 12.5,
            color: 'var(--text-muted)',
          }}
        >
          <AlertTriangle size={15} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
          {t(
            'billing.taxNotConfigured',
            'Nessuna aliquota configurata: gli abbonamenti vengono addebitati senza imposta.'
          )}
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
              marginBottom: 12,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: 30,
                fontWeight: 900,
                fontFamily: 'var(--font-display)',
                color: 'var(--accent)',
                lineHeight: 1,
              }}
            >
              {rate.percent}%
            </span>
            {rate.displayName && (
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {rate.displayName}
                {rate.jurisdiction ? ` · ${rate.jurisdiction}` : ''}
              </span>
            )}
            {fromStripe ? (
              <Badge variant="success">
                <CheckCircle2 size={11} /> {t('billing.taxFromStripe', 'Da Stripe')}
              </Badge>
            ) : (
              <Badge variant="warning">
                {t('billing.taxFromEnv', 'Da configurazione locale')}
              </Badge>
            )}
          </div>

          {/* The three ways this can be configured correctly and still bill
              wrongly. Each is silent at the provider, so each is called out. */}
          {rate.inclusive && (
            <div style={warnBox}>
              <AlertTriangle size={14} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
              {t(
                'billing.taxInclusiveWarning',
                'L’aliquota su Stripe è impostata come INCLUSIVA: l’imposta verrebbe scorporata dal prezzo delle licenze invece di essere aggiunta. Impostala come esclusiva.'
              )}
            </div>
          )}
          {!rate.active && (
            <div style={warnBox}>
              <AlertTriangle size={14} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
              {t(
                'billing.taxArchivedWarning',
                'L’aliquota è archiviata su Stripe: i nuovi abbonamenti verranno rifiutati.'
              )}
            </div>
          )}
          {rate.syncError && (
            <div style={warnBox}>
              <AlertTriangle size={14} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
              {t('billing.taxSyncError', 'Ultima sincronizzazione non riuscita: {{error}}', {
                error: rate.syncError,
              })}
            </div>
          )}

          <div style={{ marginTop: 6 }}>
            <div style={row}>
              <span style={{ color: 'var(--text-muted)' }}>
                {t('billing.taxStripeRateId', 'ID aliquota Stripe')}
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                {rate.stripeTaxRateId || '—'}
              </span>
            </div>
            <div style={row}>
              <span style={{ color: 'var(--text-muted)' }}>
                {t('billing.taxType', 'Tipo')}
              </span>
              <span>
                {rate.inclusive
                  ? t('billing.taxInclusive', 'Inclusiva (scorporata)')
                  : t('billing.taxExclusive', 'Esclusiva (aggiunta al totale)')}
              </span>
            </div>
            {/* Both providers have to charge the same thing. Showing the PayPal
                figure beside the Stripe one makes that checkable at a glance
                instead of on an invoice. */}
            <div style={row}>
              <span style={{ color: 'var(--text-muted)' }}>
                {t('billing.taxPaypal', 'Percentuale applicata ai piani PayPal')}
              </span>
              <span
                style={{
                  fontWeight: 700,
                  color:
                    rate.paypalPercent === rate.percent ? 'var(--text-primary)' : '#dc2626',
                }}
              >
                {rate.paypalPercent}%
                {rate.paypalPercent === rate.percent
                  ? ` · ${t('billing.taxAligned', 'allineata')}`
                  : ` · ${t('billing.taxNotAligned', 'NON allineata')}`}
              </span>
            </div>
            <div style={{ ...row, borderBottom: 'none' }}>
              <span style={{ color: 'var(--text-muted)' }}>
                {t('billing.taxLastSync', 'Ultima sincronizzazione')}
              </span>
              <span>{syncedLabel || t('billing.taxNeverSynced', 'mai')}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const warnBox: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'flex-start',
  padding: '9px 11px',
  marginBottom: 10,
  borderRadius: 'var(--radius-md)',
  background: 'rgba(245,158,11,0.10)',
  border: '1px solid rgba(245,158,11,0.35)',
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--text-primary)',
};

export default BillingTaxCard;
