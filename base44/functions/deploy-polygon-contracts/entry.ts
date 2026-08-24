import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';
import {
  USERNAME_ABI,
  USERNAME_BYTECODE,
  CARD_ABI,
  CARD_BYTECODE,
} from '../../shared/polygonCompiledArtifacts.ts';

// Admin-only: deploys the SwapPulseUsername (soulbound) and SwapPulseCardNFT
// (transferable) contracts to Polygon using the deployer wallet configured in
// secrets. Uses pre-compiled ABI/bytecode (polygonCompiledArtifacts.ts) so no
// Solidity compiler is loaded at runtime — the Base44 backend runtime blocks
// WebAssembly, which solc requires, so in-platform compilation is impossible.
// Returns the deployed addresses, which must then be set as
// POLYGON_USERNAME_CONTRACT and POLYGON_CARD_CONTRACT secrets before mint
// functions can run.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const privateKey = secrets.get('POLYGON_PRIVATE_KEY');
    const rpcUrl = secrets.get('POLYGON_RPC_URL');
    if (!privateKey || !rpcUrl) {
      return Response.json(
        { error: 'POLYGON_PRIVATE_KEY and POLYGON_RPC_URL secrets must be set first' },
        { status: 400 },
      );
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Sanity-check the deployer can pay for gas before sending transactions.
    const balance = await provider.getBalance(wallet.address);
    if (balance === 0n) {
      return Response.json(
        { error: 'Deployer wallet has no MATIC for gas. Fund it first.' },
        { status: 400 },
      );
    }

    // 1. Deploy the username (soulbound) contract from pre-compiled bytecode.
    const UsernameFactory = new ethers.ContractFactory(USERNAME_ABI, USERNAME_BYTECODE, wallet);
    const usernameContract = await UsernameFactory.deploy();
    await usernameContract.waitForDeployment();
    const usernameAddress = await usernameContract.getAddress();

    // 2. Deploy the card contract, passing the username contract address as
    //    the constructor argument.
    const CardFactory = new ethers.ContractFactory(CARD_ABI, CARD_BYTECODE, wallet);
    const cardContract = await CardFactory.deploy(usernameAddress);
    await cardContract.waitForDeployment();
    const cardAddress = await cardContract.getAddress();

    return Response.json({
      success: true,
      usernameContract: usernameAddress,
      cardContract: cardAddress,
      usernameAbi: USERNAME_ABI,
      cardAbi: CARD_ABI,
      deployer: wallet.address,
      instructions:
        'Set these addresses as secrets: POLYGON_USERNAME_CONTRACT and POLYGON_CARD_CONTRACT, then mint functions will work.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}