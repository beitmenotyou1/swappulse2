import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';
import { authorizeDeployment } from '../../shared/deploymentAuthority.ts';
import {
  USERNAME_ABI,
  USERNAME_BYTECODE,
  CARD_ABI,
  CARD_BYTECODE,
} from '../../shared/polygonCompiledArtifacts.ts';
import { upsertContract } from '../../shared/contractRegistry.ts';

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
    const auth = await authorizeDeployment(req, 'polygon');
    if (!auth.ok) return auth.response;
    const { base44, wallet, provider } = auth.authority;

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

    // Persist deployed addresses so they survive page refreshes.
    const polygonExplorer = secrets.get('POLYGON_EXPLORER_URL') || 'https://amoy.polygonscan.com';
    await upsertContract(base44, {
      chain: 'polygon', contract_key: 'polygon_username', contract_name: 'SwapPulseUsername',
      address: usernameAddress, deployed_by: wallet.address,
      explorer_url: `${polygonExplorer}/address/${usernameAddress}`,
    });
    await upsertContract(base44, {
      chain: 'polygon', contract_key: 'polygon_card', contract_name: 'SwapPulseCardNFT',
      address: cardAddress, deployed_by: wallet.address,
      explorer_url: `${polygonExplorer}/address/${cardAddress}`,
    });

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