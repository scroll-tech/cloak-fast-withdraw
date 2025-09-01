import { getAddress } from 'ethers';

export function eq(addr1: string, addr2: string) {
  try {
    return getAddress(addr1) === getAddress(addr2);
  } catch {
    return false; // invalid address
  }
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
