// eslint-disable-next-line @typescript-eslint/no-var-requires
require("dotenv").config();
import { task, HardhatUserConfig } from "hardhat/config";
import "@typechain/hardhat";
import "@openzeppelin/hardhat-upgrades";
import "@nomiclabs/hardhat-ethers";
import "solidity-coverage";
import "@nomiclabs/hardhat-etherscan";

task("accounts", "Prints the list of accounts", async (args, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.4",
        settings: {
          outputSelection: {
            "*": {
              "*": ["storageLayout"],
            },
          },
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
  },
  networks: {
    hardhat: {
      forking: {
        url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      },
    },
    mainnet: {
      accounts: { mnemonic: process.env.MAINNET_MNEMONIC || "" },
      url: `https://bsc-dataseed.binance.org/`,
    },
    testnet: {
      gas: "auto",
      gasPrice: "auto",
      accounts: { mnemonic: process.env.TESTNET_MNEMONIC || "" },
      url: `https://data-seed-prebsc-1-s1.binance.org:8545/`,
    },
    localhost: {
      gas: "auto",
      gasPrice: "auto",
      gasMultiplier: 1,
      url: "http://127.0.0.1:8545",
      chainId: 1776,
      accounts: {
        mnemonic: "test test test test test test test test test test test test",
      },
    },
  },
};
export default config;
