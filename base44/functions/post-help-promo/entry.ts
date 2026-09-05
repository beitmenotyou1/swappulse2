// RETIRED: in-app Help articles moved to the canonical SwapPulse GitBook.
// This function intentionally performs no publishing. The legacy scheduled
// workflow may still invoke it until the workflow record is removed by Base44,
// but it can no longer create AT Protocol posts or publish /help/* links.

const DOCUMENTATION_URL = 'https://swappulse.gitbook.io/swappulse-docs/';

export default async function postHelpPromoRetired(_req: Request): Promise<Response> {
  return Response.json({
    ok: true,
    retired: true,
    documentation_url: DOCUMENTATION_URL,
    message: 'Help article promotion is retired. Documentation is maintained in GitBook.',
  });
}
