import { getAddress } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const UINT256_MAX = (1n << 256n) - 1n;

function getEnv(key: string): string {
  const value = process.env[key];
  if (typeof value !== 'string' || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function parseTokenWhitelist(envVar?: string) {
  if (!envVar) return {};
  return Object.fromEntries(
    envVar.split(',').map((entry) => {
      const [address, limitStr] = entry.split(':');
      return [
        address,
        {
          allowed: true,
          limit: limitStr === 'MAX' ? UINT256_MAX : limitStr,
        },
      ];
    }),
  );
}

const eip721 = {
  domain: {
    name: 'FastWithdrawVault',
    version: '1',
    chainId: Number(getEnv('HOST_CHAIN_ID')),
    verifyingContract: getAddress(getEnv('HOST_FAST_WITHDRAW_VAULT')),
  },

  types: {
    Withdraw: [
      { name: 'l1Token', type: 'address' },
      { name: 'l2Token', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'messageHash', type: 'bytes32' },
    ],
  },
};

export const config = {
  endpoints: {
    host: getEnv('HOST_ENDPOINT'),
    validium: getEnv('VALIDIUM_ENDPOINT'),
  },

  contracts: {
    hostFastWithdrawVault: getAddress(getEnv('HOST_FAST_WITHDRAW_VAULT')),
    validiumMessageQueue: getAddress(getEnv('VALIDIUM_MESSAGE_QUEUE')),
    validiumERC20Gateway: getAddress(getEnv('VALIDIUM_ERC20_GATEWAY')),
  },

  tokenWhitelist: {
    host: parseTokenWhitelist(process.env.TOKEN_WHITELIST_HOST),
    validium: parseTokenWhitelist(process.env.TOKEN_WHITELIST_VALIDIUM),
  },

  db: {
    client: getEnv('DB_CLIENT'),
    pg_connection: getEnv('PG_CONNECTION'),
    sqlite_filename: getEnv('SQLITE_FILENAME'),
  },

  signers: {
    permit: getEnv('PERMIT_SIGNER_PRIVATE_KEY'),
    host: getEnv('HOST_SIGNER_PRIVATE_KEY'),
  },

  eip721,
};
