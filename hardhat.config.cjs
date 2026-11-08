require("dotenv").config({ path: ".env.local" });
require("@nomicfoundation/hardhat-toolbox");

const testnetAccounts = process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [];
const mainnetKey = process.env.MAINNET_DEPLOYER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
const mainnetAccounts = mainnetKey ? [mainnetKey] : [];

/** @type {import("hardhat/config").HardhatUserConfig} */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  paths: {
    sources: "./contracts",
    tests: "./contracts/test",
    cache: "./.hardhat/cache",
    artifacts: "./.hardhat/artifacts",
  },
  networks: {
    hardhat: { chainId: 31337 },
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC || "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: testnetAccounts,
    },
    bsc: {
      url: process.env.BSC_RPC_URL || "https://bsc-dataseed.bnbchain.org",
      chainId: 56,
      accounts: mainnetAccounts,
    },
  },
};
