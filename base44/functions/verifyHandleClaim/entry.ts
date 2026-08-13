// org.swappulse.handleClaim verification - confirms a user owns a custom domain
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
    // Parallelize the two independent verification fetches (DNS-over-HTTPS + well-known HTML).
    let txtRecords = [];
    let txtMatch = false;
    let htmlMatch = false;
    const [dohResult, htmlResult] = await Promise.allSettled([
      fetch(`https://dns.google/resolve?name=${encodeURIComponent(txtName)}&type=TXT`).then((r) => r.json()),
      fetch(`https://${domain}/.well-known/atproto-did`, { redirect: 'follow' }).then(async (r) => {
        if (r.ok) return (await r.text()).trim();
        return '';
      }),
    ]);
    if (dohResult.status === 'fulfilled') {
      txtRecords = (dohResult.value?.Answer || [])
        .filter((a) => a.type === 16)
        .map((a) => String(a.data || '').replace(/"/g, ''));
      txtMatch = txtRecords.some((t) => t.includes(`did=${did}`));
    } else {
      console.error('handleClaim DNS lookup failed', dohResult.reason?.message || dohResult.reason);
    }
    if (htmlResult.status === 'fulfilled') {
      htmlMatch = htmlResult.value === did;
    } else {
      console.error('handleClaim well-known fetch failed', htmlResult.reason?.message || htmlResult.reason);
    }

    const verified = txtMatch || htmlMatch;
    const method = txtMatch ? 'txt_record' : htmlMatch ? 'html_file' : null;

    return Response.json({ verified, method, domain, did, txtRecords });
  } catch (error) {
    console.error('verifyHandleClaim error', error?.message || error);
    return Response.json({ error: error?.message || 'verification failed' }, { status: 500 });
  }
});