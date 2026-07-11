const { ethers, network } = require("hardhat");
const fs = require("fs");
require("dotenv").config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("==================================================");
  console.log("Deploying contracts...");
  console.log("Deployer account:", deployer.address);
  console.log("Network:", network.name);
  console.log("==================================================");

  let oracleAddress;
  let sellerAddress;
  let buyerAddress;
  let oraclePrivateKey = "";
  let sellerPrivateKey = "";
  let buyerPrivateKey = "";

  const isLocalhost = network.name === "localhost" || network.name === "hardhat";

  if (isLocalhost) {
    const signers = await ethers.getSigners();
    const oracle = signers[1];
    const seller = signers[2];
    
    // Define buyer using the designated private key to ensure address alignment on localhost
    buyerPrivateKey = "0x7c852118294e51e653712a81e05800f4191417423a3f084c9594eb2b2e7419e7";
    const buyer = new ethers.Wallet(buyerPrivateKey, ethers.provider);

    oracleAddress = oracle.address;
    sellerAddress = seller.address;
    buyerAddress = buyer.address;
    
    oraclePrivateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
    sellerPrivateKey = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";

    // Fund the buyer account on local network
    console.log("Funding Buyer account with 10.0 ETH...");
    const fundTx = await deployer.sendTransaction({
      to: buyer.address,
      value: ethers.parseEther("10.0")
    });
    await fundTx.wait();
    console.log("✔ Funded Buyer account successfully.");
  } else {
    // Public network (like Amoy)
    oracleAddress = process.env.ORACLE_ADDRESS;
    if (!oracleAddress) {
      throw new Error("Please set ORACLE_ADDRESS in your .env file for public network deployment.");
    }
    sellerAddress = deployer.address; 
    buyerAddress = deployer.address;  
  }

  // 1. Deploy GreenCoin
  const GreenCoin = await ethers.getContractFactory("GreenCoin");
  const greenCoin = await GreenCoin.deploy();
  await greenCoin.waitForDeployment();
  const greenCoinAddress = await greenCoin.getAddress();
  console.log("✔ GreenCoin deployed to:", greenCoinAddress);

  // 2. Deploy EnergyTrading
  const EnergyTrading = await ethers.getContractFactory("EnergyTrading");
  const energyTrading = await EnergyTrading.deploy(greenCoinAddress, oracleAddress);
  await energyTrading.waitForDeployment();
  const energyTradingAddress = await energyTrading.getAddress();
  console.log("✔ EnergyTrading deployed to:", energyTradingAddress);

  // 3. Mint 100 GreenCoin (100 kWh equivalent) to Seller on local network
  if (isLocalhost) {
    const mintAmount = ethers.parseEther("100");
    await greenCoin.mint(sellerAddress, mintAmount);
    console.log(`✔ Minted ${ethers.formatEther(mintAmount)} GRN tokens to Seller (${sellerAddress})`);
  }

  // 4. Save deployment info for Backend/Frontend integration
  const config = {
    rpcUrl: isLocalhost ? "http://127.0.0.1:8545" : process.env.AMOY_RPC_URL || "",
    greenCoinAddress: greenCoinAddress,
    energyTradingAddress: energyTradingAddress,
    oracleAddress: oracleAddress,
    oraclePrivateKey: oraclePrivateKey,
    sellerAddress: sellerAddress,
    sellerPrivateKey: sellerPrivateKey,
    buyerAddress: buyerAddress,
    buyerPrivateKey: buyerPrivateKey
  };

  fs.writeFileSync("deployed_addresses.json", JSON.stringify(config, null, 2));
  console.log("✔ Saved deployment config to deployed_addresses.json");
  console.log("==================================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
