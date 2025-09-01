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
    host: {
      '0x38cb00e044D3cdD3c9f90B7efDE61ef62e38fdf3': {
        allowed: true,
        limit: UINT256_MAX,
      },
    },
    validium: {
      '0x928a1909DB63ae7813E6318D098fd17439eC0a49': {
        allowed: true,
        limit: UINT256_MAX,
      },
    },
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
