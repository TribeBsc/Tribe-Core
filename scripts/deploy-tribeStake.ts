import { TribeStaking__factory } from "./../typechain/factories/TribeStaking__factory";
import { ethers, upgrades, network, run } from "hardhat";

import {
  DeploymentData,
  DeploymentOutput,
  deploymentsFolder,
  getDeploymentData,
  getLogger,
  writeDeploymentData,
} from "../utilities";

import * as fs from "fs";

import {
  hashBytecodeWithoutMetadata,
  Manifest,
} from "@openzeppelin/upgrades-core";
import { Contract } from "ethers";
const logger = getLogger("scripts::deploy-tribe");

/*
    IBEP20 _stakedToken,
    IBEP20 _rewardToken,
    uint256 _annualRewardPerToken,
    uint256 _withdrawFreezeBlocksCount,
    uint256 _startBlock,
    uint256 _bonusEndBlock,
    uint256 _poolLimitPerUser,
    address _admin
*/

const _stakedToken = "0x4187bb1550021c22f9c0691c78f727049317e2b6"; //testnet addresses, change this chunk of parameters depending on what you need
const _rewardToken = "0x4187bb1550021c22f9c0691c78f727049317e2b6";
const _annualRewardPerToken = 10000000000;
const _withdrawFreezeBlocksCount = 1200;
const _startBlock = 0;
const _bonusEndBlock = 23195171;
const _poolLimitPerUser = 0;
const _admin = "0x822D71E46806081FA348aAB60A7b824B91e57825";

interface DeployedContract {
  isUpgradable: boolean;
  instance: Contract;
  version: string;
  date: string;
}

interface UpgradableDeployedContract extends DeployedContract {
  implementationAddress: string;
}

async function main() {
  await run("compile");
  const accounts = await ethers.getSigners();
  const deploymentAccount = accounts[0];

  logger.debug(`Deploying to ${network.name}`);

  logger.debug(
    `'${deploymentAccount.address}' will be used as the deployment account`
  );

  const tribefactory = new TribeStaking__factory(deploymentAccount);

  const bytecodeHash = hashBytecodeWithoutMetadata(tribefactory.bytecode);

  logger.debug(`Implementation version is ${bytecodeHash}`);

  const instance = await tribefactory.deploy(  );
  await instance.deployed();
  await instance.initialize(
    _stakedToken,
    _rewardToken,
    _annualRewardPerToken,
    _withdrawFreezeBlocksCount,
    _startBlock,
    _bonusEndBlock,
    _poolLimitPerUser,
    _admin,
  )

  logger.debug(`Deployed contract to ${instance.address}`);

  const ozUpgradesManifestClient = await Manifest.forNetwork(network.provider);
  const manifest = await ozUpgradesManifestClient.read();
  const implementationContract = manifest.impls[bytecodeHash];

  if (!implementationContract) {
    throw Error(`No implementation contract?`);
  }

  const deploymentData: UpgradableDeployedContract = {
    isUpgradable: true,
    instance,
    implementationAddress: implementationContract.address,
    version: bytecodeHash,
    date: new Date().toISOString(),
  };

  logger.debug(`Saving deployment data...`);
  await saveDeploymentData(
    "tribe",
    deploymentData,
    {
      _stakedToken,
      _rewardToken,
      _annualRewardPerToken,
      _withdrawFreezeBlocksCount,
      _startBlock,
      _bonusEndBlock,
      _poolLimitPerUser,
      _admin,
    },
    "tribe-prod"
  );

  if (deploymentData.implementationAddress) {
    logger.debug(`Waiting for 5 confirmations`);
    await instance.deployTransaction.wait(5);

    logger.debug(`Attempting to verify implementation contract with bscscan`);
    try {
      await run("verify:verify", {
        address: deploymentData.implementationAddress,
        constructorArguments: [],
      });
    } catch (e) {
      logger.error(`Failed to verify contract: ${e}`);
    }
  }
}

const saveDeploymentData = async (
  type: string,
  deployment: DeployedContract | UpgradableDeployedContract,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: { [key: string]: any },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tag?: string
) => {
  let deploymentData: DeploymentOutput = {};

  try {
    const existingData = getDeploymentData(network.name);
    deploymentData = existingData;
  } catch (e) {
    // create folder
    logger.debug(`no existing deployments found, creating folder`);
    fs.mkdirSync(deploymentsFolder, { recursive: true });
  }

  if (!deploymentData[type]) {
    deploymentData[type] = [];
  }

  const deployments = deploymentData[type];

  let implementation: string | undefined;
  let admin: string | undefined;

  // extract extra data if this is an upgradable contract
  if (deployment.isUpgradable) {
    const upgradableDeployment = deployment as UpgradableDeployedContract;
    implementation = upgradableDeployment.implementationAddress;
  }

  const finalTag = tag || "untagged";

  checkUniqueTag(finalTag, deployments);

  logger.debug(`Registering new deployment of ${type} with tag '${finalTag}'`);
  const deploymentInstance: DeploymentData = {
    tag,
    address: deployment.instance.address,
    version: deployment.version,
    date: deployment.date,
    args,
    isUpgradable: deployment.isUpgradable,
    implementation,
  };

  deployments.push(deploymentInstance);

  writeDeploymentData(network.name, deploymentData);
  logger.debug(`Updated ${network.name} deployment file.`);
};

const checkUniqueTag = (tag: string, deployments: DeploymentData[]) => {
  const numMatches = deployments.filter((d) => {
    if (!d.tag) {
      return false;
    }
    return d.tag.toLowerCase() === tag.toLowerCase();
  }).length;

  logger.warn(
    `There are ${numMatches} deployments with the same tag of ${tag}`
  );
};

main();
