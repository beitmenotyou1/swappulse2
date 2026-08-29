// migrate-pds — disabled security tombstone.
//
// The previous implementation exported a repository from the current PDS and
// then reused the current PDS access token against the target PDS import
// endpoint. Access tokens are origin-bound credentials and must never be sent
// to a different PDS. A standards-correct migration requires independent
// authentication to the target PDS plus PLC/DID rotation handling.
//
// Keep this endpoint as an explicit 410 so stale clients cannot invoke the
// unsafe legacy flow while a correct migration protocol is designed.

export default async function(): Promise<Response> {
  return Response.json(
    {
      error: 'PDS migration is temporarily unavailable while SwapPulse upgrades to a standards-correct migration flow.',
      code: 'PDS_MIGRATION_DISABLED',
    },
    { status: 410 },
  );
}
