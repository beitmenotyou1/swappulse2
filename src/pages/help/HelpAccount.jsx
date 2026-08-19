import React from 'react';
import { LogIn, Mail, KeyRound, ShieldCheck, Clock } from 'lucide-react';
import HelpArticle, { HelpSection, HelpSteps, HelpList } from '@/components/help/HelpArticle';

export default function HelpAccount() {
  return (
    <HelpArticle title="Account & Login" subtitle="Passwordless login and account security" slug="account">
      <HelpSection icon={LogIn} title="How login works">
        <p>SwapPulse uses passwordless login. Enter your email and we send a one-time login code. Enter the code to sign in, no password to remember or lose. You can also sign in with Google.</p>
      </HelpSection>
      <HelpSection icon={Mail} title="Logging in">
        <HelpSteps>
          <li>Go to the login page and enter your email.</li>
          <li>Click Send Code. We email you a one-time code.</li>
          <li>Enter the code on the next screen.</li>
          <li>You're signed in. The session persists until you log out.</li>
        </HelpSteps>
      </HelpSection>
      <HelpSection title="Registering">
        <HelpSteps>
          <li>Go to the register page and enter your email.</li>
          <li>We send a verification code (OTP) to your email.</li>
          <li>Enter the code to verify your email.</li>
          <li>Set up your profile and you're ready to go.</li>
        </HelpSteps>
        <p>New users may need an invite code during the alpha phase. If you have one, enter it during registration.</p>
      </HelpSection>
      <HelpSection icon={KeyRound} title="Two-factor authentication">
        <p>For extra security, enable 2FA in Settings. With 2FA on, you'll need a second factor (a code from your authenticator app) in addition to your login code. Rate limiting protects against brute-force attempts.</p>
      </HelpSection>
      <HelpSection icon={ShieldCheck} title="Account security">
        <HelpList>
          <li>Use a current email you can access, it's your only way in.</li>
          <li>Enable 2FA if your account contains valuable collection data.</li>
          <li>Log out from shared devices when you're done.</li>
        </HelpList>
      </HelpSection>
      <HelpSection icon={Clock} title="Activation and expiry">
        <p>Activation links expire after 48 hours. If yours expired, request a new one from the login page. Unverified accounts are managed for 90 days before being removed.</p>
      </HelpSection>
    </HelpArticle>
  );
}