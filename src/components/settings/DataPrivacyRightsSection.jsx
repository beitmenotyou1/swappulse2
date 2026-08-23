import React, { useState, useEffect } from 'react';
import { Shield, Download, FileText, Lock, AlertTriangle, Loader2, Cookie, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import SettingRow from '@/components/settings/SettingRow';
import SettingSelect from '@/components/settings/SettingSelect';

export default function DataPrivacyRightsSection() {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestType, setRequestType] = useState('rectification');
  const [details, setDetails] = useState('');
  const [consent, setConsent] = useState(null);
  const [loadingConsent, setLoadingConsent] = useState(true);
  const [updatingConsent, setUpdatingConsent] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.entities.ConsentRecord.filter({}, '-created_date', 1).catch(() => []);
        if (res && res.length > 0) setConsent(res[0]);
      } finally {
        setLoadingConsent(false);
      }
    })();
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await base44.functions.invoke('export-my-data', {});
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `swappulse-data-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Data exported', description: 'Your data archive has been downloaded.' });
    } catch (e) {
      toast({ title: 'Export failed', description: e?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const handleSubmitRequest = async () => {
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('submit-data-subject-request', { request_type: requestType, details });
      if (res?.data?.ok) {
        toast({ title: 'Request submitted', description: res.data.message || 'We will respond within 30 days.' });
        setDetails('');
      } else {
        toast({ title: 'Failed', description: res?.data?.error || 'Please try again.', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Failed', description: e?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const updateConsent = async (patch) => {
    setUpdatingConsent(true);
    try {
      const payload = {
        cookie_categories: consent?.cookie_categories || { essential: true, analytics: false, marketing: false, functional: true },
        analytics_consent: patch.analytics_consent ?? consent?.analytics_consent ?? true,
        marketing_consent: patch.marketing_consent ?? consent?.marketing_consent ?? true,
        notification_consent: patch.notification_consent ?? consent?.notification_consent ?? true,
        do_not_sell: patch.do_not_sell ?? consent?.do_not_sell ?? false,
      };
      const res = await base44.functions.invoke('update-consent-preferences', payload);
      if (res?.data?.ok) {
        setConsent(res.data.record);
        toast({ title: 'Preferences updated' });
      }
    } catch (e) {
      toast({ title: 'Update failed', description: e?.message || '', variant: 'destructive' });
    } finally {
      setUpdatingConsent(false);
    }
  };

  const doNotSell = !!consent?.do_not_sell;

  return (
    <div className="space-y-4">
      {/* Intro */}
      <div className="rounded-xl border border-border bg-secondary/50 p-4">
        <p className="flex items-center gap-2 text-sm font-bold"><Shield className="h-4 w-4 text-primary" /> Your data, your rights</p>
        <p className="mt-1 text-xs text-muted-foreground">
          SwapPulse complies with GDPR, CCPA, and the UK Data Protection Act. Use the tools below to access, export,
          correct, or delete your data, and to control how your information is shared.
        </p>
      </div>

      {/* Cookie preferences */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="flex items-center gap-2 text-sm font-bold"><Cookie className="h-4 w-4 text-primary" /> Cookie preferences</p>
        <p className="mt-1 text-xs text-muted-foreground">Manage which optional cookies you allow. Essential cookies are always on.</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => {
            try { localStorage.removeItem('swappulse-cookie-consent'); } catch {}
            window.location.reload();
          }}
        >
          <Cookie className="h-4 w-4" /> Re-open cookie banner
        </Button>
      </div>

      {/* Download my data */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="flex items-center gap-2 text-sm font-bold"><Download className="h-4 w-4 text-primary" /> Download your data</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Export a complete archive of your SwapPulse data as JSON. This includes your collection, trades, posts,
          binders, journals, messages, and settings, your full data portability right.
        </p>
        <Button className="mt-3" size="sm" onClick={handleExport} disabled={exporting}>
          {exporting ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing archive…</> : <><Download className="h-4 w-4" /> Download my data</>}
        </Button>
      </div>

      {/* Do Not Sell or Share */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="flex items-center gap-2 text-sm font-bold"><Shield className="h-4 w-4 text-primary" /> Do Not Sell or Share My Personal Information</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Under CCPA, you can opt out of having your data shared (federated) to the wider AT Protocol network.
          SwapPulse federates your records to Bluesky and other compatible apps as a core feature.
        </p>
        {doNotSell && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Site functions are limited while this is on.</strong> Your posts,
              trades, and profile won't appear on Bluesky or other federated apps. You can turn this off any time to
              re-enable full federation.
            </p>
          </div>
        )}
        <div className="mt-3">
          <SettingRow
            label="Opt out of sale/sharing"
            description="Stops outbound federation of your records to the AT Protocol network."
            checked={doNotSell}
            onChange={(v) => updateConsent({ do_not_sell: v })}
          />
        </div>
      </div>

      {/* Communication consent */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="flex items-center gap-2 text-sm font-bold"><Lock className="h-4 w-4 text-primary" /> Communication consent</p>
        <p className="mt-1 text-xs text-muted-foreground">Withdraw consent for optional communications at any time.</p>
        <div className="mt-3 space-y-1">
          <SettingRow
            label="Marketing emails"
            description="Onboarding sequence and weekly digest."
            checked={consent?.marketing_consent !== false}
            onChange={(v) => updateConsent({ marketing_consent: v })}
          />
          <SettingRow
            label="Analytics"
            description="Aggregate usage insights (no individual tracking)."
            checked={consent?.analytics_consent !== false}
            onChange={(v) => updateConsent({ analytics_consent: v })}
          />
          <SettingRow
            label="Push notifications"
            description="Trade matches, replies, mentions."
            checked={consent?.notification_consent !== false}
            onChange={(v) => updateConsent({ notification_consent: v })}
          />
        </div>
      </div>

      {/* Submit a data subject request */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="flex items-center gap-2 text-sm font-bold"><FileText className="h-4 w-4 text-primary" /> Submit a data request</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Request rectification, objection, restriction, or erasure. For immediate access or portability, use
          "Download your data" above. We respond to all requests within 30 days.
        </p>
        <div className="mt-3 space-y-2">
          <SettingSelect
            value={requestType}
            onChange={setRequestType}
            label="Request type"
            options={[
              { value: 'rectification', label: 'Rectification, correct inaccurate data' },
              { value: 'objection', label: 'Objection, stop certain processing' },
              { value: 'restriction', label: 'Restriction, limit processing temporarily' },
              { value: 'erasure', label: 'Erasure, request data deletion' },
              { value: 'access', label: 'Access, request a copy (via email)' },
              { value: 'portability', label: 'Portability, data transfer request' },
              { value: 'consent_withdrawal', label: 'Consent withdrawal' },
            ]}
          />
          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Describe what you need…"
            className="min-h-[80px]"
          />
          <Button size="sm" onClick={handleSubmitRequest} disabled={submitting}>
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : 'Submit request'}
          </Button>
        </div>
      </div>

      {/* Links */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-bold">Legal documents</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Link to="/privacy" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <ExternalLink className="h-3.5 w-3.5" /> Privacy Policy
          </Link>
          <Link to="/terms" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <ExternalLink className="h-3.5 w-3.5" /> Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}