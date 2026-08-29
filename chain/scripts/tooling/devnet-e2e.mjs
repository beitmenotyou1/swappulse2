import { Buffer } from 'node:buffer';
import { spawnDevnet } from './devnet-process.mjs';
import { Account, ec, hash } from 'starknet';
import { loadArtifacts, normalizeHex, declareClass, wait } from './common.mjs';

const devnet = await spawnDevnet();
try {
  const provider = new (await import('starknet')).RpcProvider({ nodeUrl: devnet.url });
  const [predeployed] = await devnet.getPredeployedAccounts();
  if (!predeployed) throw new Error('Devnet returned no predeployed account');

  const deployer = new Account({
    provider,
    address: predeployed.address,
    signer: predeployed.private_key,
  });
  const loaded = await loadArtifacts();
  const registryDeclaration = await declareClass(deployer, provider, loaded.registrySierra, loaded.registryCasm);
  const accountDeclaration = await declareClass(deployer, provider, loaded.accountSierra, loaded.accountCasm);

  const registryDeployment = await deployer.deployContract({
    classHash: registryDeclaration.class_hash,
    constructorCalldata: [deployer.address],
  });
  await wait(provider, registryDeployment.transaction_hash);
  const registryAddress = normalizeHex(registryDeployment.contract_address);

  const userPrivateKey = `0x${Buffer.from(ec.starkCurve.utils.randomPrivateKey()).toString('hex')}`;
  const userPublicKey = normalizeHex(ec.starkCurve.getStarkKey(userPrivateKey), 'user public key');
  const userAccountAddress = normalizeHex(
    hash.calculateContractAddressFromHash(
      userPublicKey,
      accountDeclaration.class_hash,
      [userPublicKey],
      0,
    ),
    'user account address',
  );

  await devnet.mint(userAccountAddress, 10n ** 20n, 'FRI');
  const userAccount = new Account({ provider, address: userAccountAddress, signer: userPrivateKey });
  const accountDeployment = await userAccount.deployAccount({
    classHash: accountDeclaration.class_hash,
    constructorCalldata: [userPublicKey],
    addressSalt: userPublicKey,
    contractAddress: userAccountAddress,
  });
  await wait(provider, accountDeployment.transaction_hash);

  const recoveryController = normalizeHex(deployer.address);
  const recoveryDelay = 172800;
  const recoveryConfig = await userAccount.execute([
    {
      contractAddress: userAccountAddress,
      entrypoint: 'set_recovery_controller',
      calldata: [recoveryController],
    },
    {
      contractAddress: userAccountAddress,
      entrypoint: 'set_recovery_delay',
      calldata: [recoveryDelay.toString()],
    },
  ]);
  await wait(provider, recoveryConfig.transaction_hash);

  const identityId = '0x123456789abcdef';
  const registration = await deployer.execute({
    contractAddress: registryAddress,
    entrypoint: 'register_identity',
    calldata: [identityId, userAccountAddress],
  });
  await wait(provider, registration.transaction_hash);

  const [identityRead, reverseRead, controllerRead, delayRead, registryHashAt, accountHashAt] = await Promise.all([
    provider.callContract({ contractAddress: registryAddress, entrypoint: 'get_identity', calldata: [identityId] }),
    provider.callContract({ contractAddress: registryAddress, entrypoint: 'get_identity_by_account', calldata: [userAccountAddress] }),
    provider.callContract({ contractAddress: userAccountAddress, entrypoint: 'get_recovery_controller', calldata: [] }),
    provider.callContract({ contractAddress: userAccountAddress, entrypoint: 'get_recovery_delay', calldata: [] }),
    provider.getClassHashAt(registryAddress),
    provider.getClassHashAt(userAccountAddress),
  ]);

  const ok = normalizeHex(identityRead[0]) === userAccountAddress
    && normalizeHex(identityRead[1]) === '0x1'
    && normalizeHex(identityRead[2]) === normalizeHex(identityId)
    && normalizeHex(reverseRead[0]) === normalizeHex(identityId)
    && normalizeHex(controllerRead[0]) === recoveryController
    && BigInt(delayRead[0]) === BigInt(recoveryDelay)
    && normalizeHex(registryHashAt) === registryDeclaration.class_hash
    && normalizeHex(accountHashAt) === accountDeclaration.class_hash;

  if (!ok) throw new Error('Devnet E2E state verification failed');

  console.log(JSON.stringify({
    ok: true,
    chain_id: normalizeHex(await provider.getChainId()),
    identity_registry_class_hash: registryDeclaration.class_hash,
    account_class_hash: accountDeclaration.class_hash,
    identity_registry_address: registryAddress,
    user_account_address: userAccountAddress,
    identity_id: normalizeHex(identityId),
    recovery_delay_seconds: recoveryDelay,
    transactions: {
      account_deploy: accountDeployment.transaction_hash,
      recovery_config: recoveryConfig.transaction_hash,
      identity_register: registration.transaction_hash,
    },
    note: 'Ephemeral devnet only. The generated test private key remains in process memory and is never printed or persisted.',
  }, null, 2));
} finally {
  await devnet.stop();
}
