// Hardware wallet abstraction for SwapPulse. Provides a pluggable interface
// for Ledger (now), with Tangem and other hardware wallets to follow.
//
// Each implementation provides:
//   - connectAndSign(did) → { address, signature, message, nonce }
//
// The Ledger implementation communicates over WebUSB using the TPDU framing
// protocol (same as @ledgerhq/hw-transport). The Ethereum app on the device
// derives an address and signs an EIP-4361 message binding the address to
// the collector's DID.

// --- Ledger constants ---

const LEDGER_VENDOR_ID = 0x2c97;
const CHANNEL_ID = 0x0101;
const TAG_CMD = 0x05;
const TAG_RSP = 0x85;
const PACKET_SIZE = 64;

// Standard Ethereum derivation path: 44'/60'/0'/0/0
const ETH_DERIVATION_PATH = [
  0x80000000 + 44,
  0x80000000 + 60,
  0x80000000 + 0,
  0,
  0,
];

// --- Helpers ---

function toHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function encodePath(path) {
  const data = new Uint8Array(path.length * 4);
  const view = new DataView(data.buffer);
  for (let i = 0; i < path.length; i++) {
    view.setUint32(i * 4, path[i], false); // big-endian
  }
  return data;
}

function u8FromDataView(dv) {
  return new Uint8Array(dv.buffer.slice(dv.byteOffset, dv.byteOffset + dv.byteLength));
}

// --- TPDU-framed APDU exchange over WebUSB ---

async function sendLedgerAPDU(device, apdu) {
  let seq = 0;

  // First command packet: channel(2) + tag(1) + seq(2) + data_length(2) + data
  const firstPacket = new Uint8Array(PACKET_SIZE);
  const firstView = new DataView(firstPacket.buffer);
  firstView.setUint16(0, CHANNEL_ID, false);
  firstPacket[2] = TAG_CMD;
  firstView.setUint16(3, seq, false);
  firstView.setUint16(5, apdu.length, false);
  const firstChunkLen = Math.min(apdu.length, PACKET_SIZE - 7);
  firstPacket.set(apdu.subarray(0, firstChunkLen), 7);
  await device.transferOut(2, firstPacket);

  // Subsequent command packets
  let offset = firstChunkLen;
  while (offset < apdu.length) {
    seq++;
    const pkt = new Uint8Array(PACKET_SIZE);
    const pktView = new DataView(pkt.buffer);
    pktView.setUint16(0, CHANNEL_ID, false);
    pkt[2] = TAG_CMD;
    pktView.setUint16(3, seq, false);
    const chunkLen = Math.min(apdu.length - offset, PACKET_SIZE - 5);
    pkt.set(apdu.subarray(offset, offset + chunkLen), 5);
    offset += chunkLen;
    await device.transferOut(2, pkt);
  }

  // Read first response packet
  const result = await device.transferIn(2, PACKET_SIZE);
  const respPacket = u8FromDataView(result.data);
  const respView = new DataView(respPacket.buffer);
  const respDataLen = respView.getUint16(5, false);

  // Collect response data across packets
  const respData = new Uint8Array(respDataLen);
  const firstRespChunkLen = Math.min(respDataLen, PACKET_SIZE - 7);
  respData.set(respPacket.subarray(7, 7 + firstRespChunkLen), 0);
  let respOffset = firstRespChunkLen;
  let respSeq = 0;
  while (respOffset < respDataLen) {
    respSeq++;
    const more = await device.transferIn(2, PACKET_SIZE);
    const morePacket = u8FromDataView(more.data);
    const chunkLen = Math.min(respDataLen - respOffset, PACKET_SIZE - 5);
    respData.set(morePacket.subarray(5, 5 + chunkLen), respOffset);
    respOffset += chunkLen;
  }

  // Last 2 bytes are SW1 SW2
  const sw1 = respData[respData.length - 2];
  const sw2 = respData[respData.length - 1];
  const data = respData.subarray(0, respData.length - 2);
  return { data, sw1, sw2 };
}

// --- Ledger public API ---

export function isLedgerSupported() {
  return typeof navigator !== 'undefined' && !!navigator.usb;
}

export async function connectLedgerDevice() {
  if (!navigator.usb) throw new Error('WebUSB is not supported in this browser.');
  const device = await navigator.usb.requestDevice({
    filters: [{ vendorId: LEDGER_VENDOR_ID }],
  });
  await device.open();
  if (device.configuration === null) {
    await device.selectConfiguration(1);
  }
  await device.claimInterface(0);
  return device;
}

export async function getLedgerAddress(device) {
  const pathBytes = encodePath(ETH_DERIVATION_PATH);
  const apdu = new Uint8Array(5 + 1 + pathBytes.length + 1);
  apdu[0] = 0xe0; // CLA
  apdu[1] = 0x02; // INS: GET_PUBLIC_KEY
  apdu[2] = 0x00; // P1: no display
  apdu[3] = 0x00; // P2: no chain code
  apdu[4] = 1 + pathBytes.length + 1; // Lc
  apdu[5] = ETH_DERIVATION_PATH.length; // path length (number of components)
  apdu.set(pathBytes, 6);
  apdu[apdu.length - 1] = 0x00; // display flags

  const { data, sw1, sw2 } = await sendLedgerAPDU(device, apdu);
  if (sw1 !== 0x90 || sw2 !== 0x00) {
    if (sw1 === 0x6d) throw new Error('Ethereum app not open on your Ledger. Open it and try again.');
    throw new Error(`Ledger error: ${toHex([sw1, sw2])}`);
  }

  // Response: pk_len(1) + pk(65) + addr_len(1) + addr(40 ASCII)
  const pkLen = data[0];
  const addrLen = data[1 + pkLen];
  const addrAscii = new TextDecoder().decode(data.subarray(2 + pkLen, 2 + pkLen + addrLen));
  return '0x' + addrAscii.toLowerCase();
}

export async function signLedgerPersonalMessage(device, message) {
  const pathBytes = encodePath(ETH_DERIVATION_PATH);
  const messageBytes = new TextEncoder().encode(message);
  const apdu = new Uint8Array(5 + 1 + pathBytes.length + 4 + messageBytes.length);
  apdu[0] = 0xe0; // CLA
  apdu[1] = 0xc0; // INS: SIGN_PERSONAL_MESSAGE
  apdu[2] = 0x00; // P1
  apdu[3] = 0x00; // P2
  apdu[4] = apdu.length - 5; // Lc
  apdu[5] = ETH_DERIVATION_PATH.length; // path length
  apdu.set(pathBytes, 6);
  const msgLenView = new DataView(apdu.buffer, 6 + pathBytes.length);
  msgLenView.setUint32(0, messageBytes.length, false); // big-endian message length
  apdu.set(messageBytes, 6 + pathBytes.length + 4);

  const { data, sw1, sw2 } = await sendLedgerAPDU(device, apdu);
  if (sw1 !== 0x90 || sw2 !== 0x00) {
    if (sw1 === 0x6d) throw new Error('Ethereum app not open on your Ledger. Open it and try again.');
    if (sw1 === 0x69 && sw2 === 0x85) throw new Error('Transaction rejected on the Ledger.');
    throw new Error(`Ledger signing error: ${toHex([sw1, sw2])}`);
  }

  // Response: v(1) + r(32) + s(32)
  const v = data[0];
  const r = data.subarray(1, 33);
  const s = data.subarray(33, 65);
  return '0x' + toHex(r) + toHex(s) + v.toString(16).padStart(2, '0');
}

// Connects to a Ledger, derives the address, and signs an EIP-4361 message
// binding the address to the collector's DID. Returns the link-wallet payload.
export async function connectAndSignLedger(did) {
  const device = await connectLedgerDevice();
  try {
    const address = await getLedgerAddress(device);
    const nonce = (crypto.randomUUID && crypto.randomUUID()) || Math.random().toString(36).slice(2, 10);
    const message = [
      'SwapPulse Wallet Link',
      `DID: ${did}`,
      `Nonce: ${nonce}`,
      `Timestamp: ${Date.now()}`,
    ].join('\n');
    const signature = await signLedgerPersonalMessage(device, message);
    return { address, signature, message, nonce };
  } finally {
    try { await device.close(); } catch {}
  }
}