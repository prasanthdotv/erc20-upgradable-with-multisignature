// scripts/propose-upgrade.js
const { defender, upgrades } = require('hardhat');

require('dotenv').config();

const { EXISTING_ADDRESS } = process.env;

async function main() {
  const proxyAddress = EXISTING_ADDRESS;

  //In case if the deployment details are lost
  // const MyToken = await ethers.getContractFactory('MyToken');
  // await upgrades.forceImport(proxyAddress, MyToken);

  const MyTokenV2 = await ethers.getContractFactory('MyTokenV2');
  console.log('Preparing proposal...');
  const proposal = await defender.proposeUpgrade(proxyAddress, MyTokenV2);
  console.log('Upgrade proposal created at:', proposal.url);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
