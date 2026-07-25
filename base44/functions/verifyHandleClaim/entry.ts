// org.swappulse.handleClaim verification — confirms a user owns a custom domain
// by looking up the AT Protocol handle TXT record (_atproto.<domain>) via
// DNS-over-HTTPS, with an HTML well-known fallback. Returns the verification
// result; the caller persists the HandleClaim record and updates the user.
Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const domain = String(body.domain || '').trim().toLowerCase();
    const did = String(body.did || '').trim();
    if (!domain || !did) {
      return Response.json({ error: 'domain and did are required' }, { status: 400 });
    }

    const txtName = `_atproto.${domain}`;
    let txtRecords = [];
    let txtMatch = false;
    try {
      const doh = await fetch(
        `https://dns.google/resolve?name=${encodeURIComponent(txtName)}&type=TXT`,
      ).then((r) => r.json());
      txtRecords = (doh?.Answer || [])
        .filter((a) => a.type === 16)
        .map((a) => String(a.data || '').replace(/"/g, ''));
      txtMatch = txtRecords.some((t) => t.includes(`did=${did}`));
    } catch (e) {
      console.error('handleClaim DNS lookup failed', e?.message || e);
    }

    let htmlMatch = false;
    try {
      const r = await fetch(`https://${domain}/.well-known/atproto-did`, {
        redirect: 'follow',
      });
      if (r.ok) {
        htmlMatch = (await r.text()).trim() === did;
      }
    } catch (e) {
      console.error('handleClaim well-known fetch failed', e?.message || e);
    }

    const verified = txtMatch || htmlMatch;
    const method = txtMatch ? 'txt_record' : htmlMatch ? 'html_file' : null;

    return Response.json({ verified, method, domain, did, txtRecords });
  } catch (error) {
    console.error('verifyHandleClaim error', error?.message || error);
    return Response.json({ error: error?.message || 'verification failed' }, { status: 500 });
  }
});