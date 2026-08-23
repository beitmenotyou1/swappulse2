import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { useT } from "@/lib/i18n/I18nProvider";
import useSEO from "@/hooks/useSEO";

export default function ForgotPassword() {
  const t = useT();
  useSEO({
    title: 'Forgot Password',
    description: 'Reset your SwapPulse account password via email.',
    canonicalPath: '/forgot-password',
  });
  const [searchParams] = useSearchParams();
  const migration = searchParams.get("migration") === "1";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await base44.auth.resetPasswordRequest(email);
    } catch {
      // Always show success regardless
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <AuthLayout
      icon={Mail}
      title={migration ? t('auth.forgot.migrateTitle') : t('auth.forgot.resetTitle')}
      subtitle={migration ? t('auth.forgot.migrateSubtitle') : t('auth.forgot.resetSubtitle')}
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          <ArrowLeft className="w-3 h-3 inline mr-1" />{t('auth.forgot.backToLogin')}
        </Link>
      }
    >
      {sent ? (
        <p className="text-sm text-foreground text-center">
          {migration ? t('auth.forgot.migrateSent') : t('auth.forgot.resetSent')}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.forgot.email')}</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('auth.forgot.sending')}
              </>
            ) : (
              t('auth.forgot.sendReset')
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}