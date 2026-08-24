import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';
import { USERNAME_CONTRACT_SOURCE, CARD_CONTRACT_SOURCE } from '../../shared/polygonContracts.ts';

// Admin-only: compiles and deploys the SwapPulseUsername (soulbound) and
// SwapPulseCardNFT (transferable) contracts to Polygon. Returns the deployed
// addresses which must then be set as POLYGON_USERNAME_CONTRACT and
// POLYGON_CARD_CONTRACT secrets before mint functions can run.
function compile(source: string, contractName: string): { abi: any; bytecode: string } {
  const input = {
    language: 'Solidity',
    sources: { [contractName + '.sol']: { content: source } },
    settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
  };
  // Dynamic import of solc — may not load in all runtimes
  return (globalThis as any).__solcCompile(input, contractName);
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const privateKey = secrets.get('POLYGON_PRIVATE_KEY');
    const rpcUrl = secrets.get('POLYGON_RPC_URL');
    if (!privateKey || !rpcUrl) {
      return Response.json({ error: 'POLYGON_PRIVATE_KEY and POLYGON_RPC_URL secrets must be set first' }, { status: 400 });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Compile contracts using solc
    let solc: any;
    try {
      const solcModule = await import('npm:solc@0.8.26');
      solc = solcModule.default || solcModule;
    } catch (importErr) {
      return Response.json({
        error: 'solc compiler failed to load in this runtime',
        details: importErr.message,
        suggestion: 'Compile the contracts locally with Hardhat/Foundry and deploy manually, then set the addresses as secrets.',
      }, { status: 500 });
    }

    const compileOne = (source: string, contractName: string) => {
      const input = {
        language: 'Solidity',
        sources: { [contractName + '.sol']: { content: source } },
        settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
      };
      const output = JSON.parse(solc.compile(JSON.stringify(input)));
      if (output.errors) {
        const errors = output.errors.filter((e: any) => e.severity === 'error');
        if (errors.length) throw new Error(errors.map((e: any) => e.message).join('; '));
      }
      const contract = output.contracts[contractName + '.sol'][contractName];
      return { abi: contract.abi, bytecode: '0x' + contract.evm.bytecode.object };
    };

    // Deploy username contract
    const usernameCompiled = compileOne(USERNAME_CONTRACT_SOURCE, 'SwapPulseUsername');
    const UsernameFactory = new ethers.ContractFactory(usernameCompiled.abi, usernameCompiled.bytecode, wallet);
    const usernameContract = await UsernameFactory.deploy();
    await usernameContract.waitForDeployment();
    const usernameAddress = await usernameContract.getAddress();

    // Deploy card contract (with username contract address as constructor arg)
    const cardCompiled = compileOne(CARD_CONTRACT_SOURCE, 'SwapPulseCardNFT');
    const CardFactory = new ethers.ContractFactory(cardCompiled.abi, cardCompiled.bytecode, wallet);
    const cardContract = await CardFactory.deploy(usernameAddress);
    await cardContract.waitForDeployment();
    const cardAddress = await cardContract.getAddress();

    return Response.json({
      success: true,
      usernameContract: usernameAddress,
      cardContract: cardAddress,
      usernameAbi: usernameCompiled.abi,
      cardAbi: cardCompiled.abi,
      deployer: wallet.address,
      instructions: 'Set these addresses as secrets: POLYGON_USERNAME_CONTRACT and POLYGON_CARD_CONTRACT, then mint functions will work.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}