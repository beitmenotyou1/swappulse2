import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildDay1Email, buildDay3Email, buildDay7Email } from '../../shared/emailContent.ts';
import { sendBrandedEmail } from '../../shared/smtpSender.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

function day1Body(name) {
  return [
    "Three steps to get started, " + (name || "collector"),
    "",
    "You're in. Now let's make SwapPulse yours. Here are the three things every collector does on day one.",
    "",
    "1. Add cards to your collection",
    "   Search for any Pokemon TCG card, pick the condition and variant, and add it. Your collection is stored in your AT Protocol repository, so you own it completely.",
    "   -> https://swappulse.org/collection",
    "",
    "2. Scan a card with AI",
    "   Point your phone camera at any card and the AI scanner identifies it automatically. Batch mode lets you rip through a stack in minutes. Corrections you submit train the model.",
    "   -> https://swappulse.org/scan",
    "",
    "3. Check your feed",
    "   The Fresh Pulls feed shows pack openings in real time. The Trade Floor surfaces active listings, with wishlist matches bumped to the top for you.",
    "   -> https://swappulse.org/",
    "",
    "Tip: Install SwapPulse as a PWA on your phone's home screen for the full app experience, including offline access and push notifications.",
    "",
    "SwapPulse Alpha",
  ].join("\n");
}

function day3Body(name, matches) {
  const banner = matches > 0
    ? matches + " trade match" + (matches === 1 ? "" : "es") + " found - someone wants what you have. Check the Trade Floor now."
    : "";
  return [
    "Ready to trade, " + (name || "collector") + "?",
    "",
    banner,
    "",
    "How trading works on SwapPulse:",
    "  1. List what you offer and what you want. Set visibility to public, wishlist-only, or scoped to a circle.",
    "  2. Smart matchmaking finds matches - when your offer matches someone's want, both parties get notified.",
    "  3. Negotiate privately in the trade thread.",
    "  4. Check the fairness meter - the trade calculator balances card values and conditions so nobody gets ripped off.",
    "  5. Leave trading feedback to build your trust score.",
    "",
    "Show off your binder - ten pages, six slots each, six themes. Drag and drop your best pulls and publish it to the community.",
    "  -> Binders: https://swappulse.org/binders",
    "  -> Trade Floor: https://swappulse.org/trades",
    "",
    "SwapPulse Alpha",
  ].join("\n");
}

function day7Body(name) {
  return [
    "Go deeper, " + (name || "collector"),
    "",
    "You've got the basics down. Here are four features most collectors haven't discovered yet.",
    "",
    "Market Watch - track your collection value in real time, set price alerts, and vote in community sentiment polls. Pricing syncs from TCGDex every 30 minutes.",
    "  -> https://swappulse.org/market",
    "",
    "Collector Journals - write long-form articles about your collecting journey, embed card stats, and tag your pieces.",
    "  -> https://swappulse.org/profile",
    "",
    "Local Meetups - find collectors near you. Meetups are trust-gated, and pre-meetup trade matching connects you with attendees who have cards you want.",
    "  -> https://swappulse.org/meetups",
    "",
    "Go Live - paste your stream URL, set a duration, and go live. A red ring appears around your profile picture so everyone knows you are streaming. Recordings can be converted into podcast episodes.",
    "  -> https://swappulse.org/spaces",
    "",
    "One more thing: you can claim a custom domain handle like @yourbrand.com via DNS verification, giving you a verification badge and a portable identity across the AT Protocol network.",
    "",
    "We'd love your feedback - reply to this email or hit the Feedback button in the app. Every alpha tester's input goes straight into our roadmap.",
    "",
    "SwapPulse Alpha",
  ].join("\n");
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const svc = base44.asServiceRole;
    const now = Date.now();

    const [allUsers, sentRecords] = await Promise.all([
      svc.entities.User.list(),
      svc.entities.OnboardingEmail.filter({}, "-created_date", 5000),
    ]);

    const sent = new Set(sentRecords.map((r) => r.user_id + ":" + r.email_type));

    let day1 = 0, day3 = 0, day7 = 0, failed = 0;
    const pendingCreates: any[] = [];
    const send = async (u, type, emailObj) => {
      try {
        await sendBrandedEmail({ to: u.email, ...emailObj });
        pendingCreates.push({
          user_id: u.id,
          email_type: type,
          sent_at: new Date().toISOString(),
        });
        return true;
      } catch (e) {
        failed++;
        return false;
      }
    };

    for (const u of allUsers) {
      if (!u.email) continue;
      const ageDays = (now - new Date(u.created_date).getTime()) / DAY_MS;

      if (ageDays >= 1 && !sent.has(u.id + ":day1")) {
        if (await send(u, "day1", buildDay1Email(u.full_name))) { day1++; sent.add(u.id + ":day1"); }
      }
      if (ageDays >= 3 && !sent.has(u.id + ":day3")) {
        if (await send(u, "day3", buildDay3Email(u.full_name, 0))) { day3++; sent.add(u.id + ":day3"); }
      }
      if (ageDays >= 7 && !sent.has(u.id + ":day7")) {
        if (await send(u, "day7", buildDay7Email(u.full_name))) { day7++; sent.add(u.id + ":day7"); }
      }
    }

    // Batch-create all onboarding email logs in one call.
    if (pendingCreates.length) {
      try { await svc.entities.OnboardingEmail.bulkCreate(pendingCreates); } catch (e) {
        console.error('dispatchOnboardingEmails bulkCreate failed', e?.message || e);
      }
    }

    return Response.json({ day1, day3, day7, failed, users: allUsers.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});