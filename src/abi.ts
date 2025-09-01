export const abi = [
  // L2StandardERC20Gateway
  'event WithdrawERC20(address indexed hostToken, address indexed validiumToken, address indexed from, address to, uint256 amount, bytes payload)',

  // L2MessageQueue
  'event AppendMessage(uint256 index, bytes32 messageHash)',

  // FastWithdrawVault
  'function claimFastWithdraw(address l1Token, address to, uint256 amount, bytes32 messageHash, bytes memory signature)',
  'error ErrorWithdrawAlreadyProcessed()',
];
