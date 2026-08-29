// Deprecated duplicate transaction path. The canonical self-service flow is:
// chain-tx-draft -> device-local signature -> chain-tx-submit.
// Keeping this endpoint closed prevents policy drift and alternate relay access.
export default async function(): Promise<Response> {
  return Response.json({
    error: 'This transaction endpoint has been retired. Use the hash-bound chain-tx-draft and chain-tx-submit flow.',
    code: 'CHAIN_TRANSACTION_PATH_RETIRED',
  }, { status: 410 });
}
