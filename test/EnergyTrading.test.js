const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GreenGrid P2P Solar Energy Trading Platform", function () {
  let GreenCoin, greenCoin;
  let EnergyTrading, energyTrading;
  let owner, seller, buyer, oracle, other;

  beforeEach(async function () {
    // Get accounts
    [owner, seller, buyer, oracle, other] = await ethers.getSigners();

    // Deploy GreenCoin (ERC-20 Token)
    GreenCoin = await ethers.getContractFactory("GreenCoin");
    greenCoin = await GreenCoin.deploy();
    await greenCoin.waitForDeployment();

    // Deploy EnergyTrading (Escrow & Trading contract)
    EnergyTrading = await ethers.getContractFactory("EnergyTrading");
    energyTrading = await EnergyTrading.deploy(await greenCoin.getAddress(), oracle.address);
    await energyTrading.waitForDeployment();
  });

  describe("GreenCoin Token Unit Tests", function () {
    it("Should set correct name, symbol, and decimals", async function () {
      expect(await greenCoin.name()).to.equal("GreenCoin");
      expect(await greenCoin.symbol()).to.equal("GRN");
      expect(await greenCoin.decimals()).to.equal(18n);
    });

    it("Should allow the owner to mint tokens to any address", async function () {
      const amount = ethers.parseEther("500");
      await greenCoin.mint(seller.address, amount);
      expect(await greenCoin.balanceOf(seller.address)).to.equal(amount);
    });

    it("Should not allow non-owners to mint tokens", async function () {
      const amount = ethers.parseEther("500");
      await expect(
        greenCoin.connect(seller).mint(seller.address, amount)
      ).to.be.revertedWithCustomError(greenCoin, "OwnableUnauthorizedAccount");
    });

    it("Should allow owner to burn tokens from any address", async function () {
      const amount = ethers.parseEther("100");
      await greenCoin.mint(seller.address, amount);
      await greenCoin.burn(seller.address, amount);
      expect(await greenCoin.balanceOf(seller.address)).to.equal(0n);
    });

    it("Should not allow non-owners to burn tokens", async function () {
      const amount = ethers.parseEther("100");
      await greenCoin.mint(seller.address, amount);
      await expect(
        greenCoin.connect(seller).burn(seller.address, amount)
      ).to.be.revertedWithCustomError(greenCoin, "OwnableUnauthorizedAccount");
    });
  });

  describe("EnergyTrading Marketplace Unit Tests", function () {
    const listAmount = ethers.parseEther("10"); // 10 GRN (representing 10 kWh)
    const pricePerToken = ethers.parseEther("0.1"); // 0.1 MATIC per GRN token
    const totalCost = ethers.parseEther("1.0"); // 10 * 0.1 = 1 MATIC

    beforeEach(async function () {
      // Mint tokens to seller and approve the EnergyTrading contract to spend it
      await greenCoin.mint(seller.address, listAmount);
      await greenCoin.connect(seller).approve(await energyTrading.getAddress(), listAmount);
    });

    it("Should allow a seller to list energy for sale", async function () {
      await expect(energyTrading.connect(seller).listEnergy(listAmount, pricePerToken))
        .to.emit(energyTrading, "EnergyListed")
        .withArgs(1n, seller.address, listAmount, pricePerToken);

      const listing = await energyTrading.listings(1n);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.amount).to.equal(listAmount);
      expect(listing.pricePerToken).to.equal(pricePerToken);
      expect(listing.isActive).to.be.true;
      expect(listing.isMatched).to.be.false;
      expect(listing.isSettled).to.be.false;

      // Verify GreenCoins are in escrow
      expect(await greenCoin.balanceOf(await energyTrading.getAddress())).to.equal(listAmount);
      expect(await greenCoin.balanceOf(seller.address)).to.equal(0n);
    });

    it("Should allow a seller to cancel an unmatched listing", async function () {
      await energyTrading.connect(seller).listEnergy(listAmount, pricePerToken);

      await expect(energyTrading.connect(seller).cancelListing(1n))
        .to.emit(energyTrading, "ListingCancelled")
        .withArgs(1n, seller.address);

      const listing = await energyTrading.listings(1n);
      expect(listing.isActive).to.be.false;

      // Verify GreenCoins are returned to the seller
      expect(await greenCoin.balanceOf(seller.address)).to.equal(listAmount);
      expect(await greenCoin.balanceOf(await energyTrading.getAddress())).to.equal(0n);
    });

    it("Should not allow non-sellers to cancel a listing", async function () {
      await energyTrading.connect(seller).listEnergy(listAmount, pricePerToken);
      await expect(
        energyTrading.connect(other).cancelListing(1n)
      ).to.be.revertedWith("Only seller can cancel listing");
    });

    it("Should allow a buyer to match/buy energy by depositing MATIC", async function () {
      await energyTrading.connect(seller).listEnergy(listAmount, pricePerToken);

      await expect(energyTrading.connect(buyer).buyEnergy(1n, { value: totalCost }))
        .to.emit(energyTrading, "EnergyMatched")
        .withArgs(1n, buyer.address, totalCost);

      const listing = await energyTrading.listings(1n);
      expect(listing.buyer).to.equal(buyer.address);
      expect(listing.isActive).to.be.false;
      expect(listing.isMatched).to.be.true;

      // Verify contract holds the MATIC payment
      const provider = ethers.provider;
      expect(await provider.getBalance(await energyTrading.getAddress())).to.equal(totalCost);
    });

    it("Should reject buying with incorrect MATIC amount", async function () {
      await energyTrading.connect(seller).listEnergy(listAmount, pricePerToken);
      await expect(
        energyTrading.connect(buyer).buyEnergy(1n, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("Incorrect payment amount");
    });

    it("Should allow Oracle to confirm delivery and settle trade", async function () {
      await energyTrading.connect(seller).listEnergy(listAmount, pricePerToken);
      await energyTrading.connect(buyer).buyEnergy(1n, { value: totalCost });

      const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);

      // Confirm delivery by Oracle
      await expect(energyTrading.connect(oracle).confirmDelivery(1n))
        .to.emit(energyTrading, "TradeSettled")
        .withArgs(1n, seller.address, buyer.address, listAmount, totalCost);

      const listing = await energyTrading.listings(1n);
      expect(listing.isSettled).to.be.true;

      // Verify buyer received GreenCoins (energy credits)
      expect(await greenCoin.balanceOf(buyer.address)).to.equal(listAmount);

      // Verify seller received MATIC payout
      const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
      expect(sellerBalanceAfter).to.equal(sellerBalanceBefore + totalCost);

      // Verify contract holds 0 MATIC/Tokens for this trade now
      expect(await ethers.provider.getBalance(await energyTrading.getAddress())).to.equal(0n);
      expect(await greenCoin.balanceOf(await energyTrading.getAddress())).to.equal(0n);
    });

    it("Should only allow the designated Oracle to confirm delivery", async function () {
      await energyTrading.connect(seller).listEnergy(listAmount, pricePerToken);
      await energyTrading.connect(buyer).buyEnergy(1n, { value: totalCost });

      await expect(
        energyTrading.connect(other).confirmDelivery(1n)
      ).to.be.revertedWith("Caller is not the authorized oracle");
    });

    it("Should allow Oracle to abort trade and refund both parties", async function () {
      await energyTrading.connect(seller).listEnergy(listAmount, pricePerToken);
      await energyTrading.connect(buyer).buyEnergy(1n, { value: totalCost });

      const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);

      // Oracle aborts trade
      await expect(energyTrading.connect(oracle).abortTrade(1n))
        .to.emit(energyTrading, "TradeAborted")
        .withArgs(1n, seller.address, buyer.address);

      // Verify refunds
      expect(await greenCoin.balanceOf(seller.address)).to.equal(listAmount);
      const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
      expect(buyerBalanceAfter).to.equal(buyerBalanceBefore + totalCost);

      const listing = await energyTrading.listings(1n);
      expect(listing.isMatched).to.be.false;
      expect(listing.isActive).to.be.false;
    });

    it("Should not allow buyer to abort before the 24-hour timeout", async function () {
      await energyTrading.connect(seller).listEnergy(listAmount, pricePerToken);
      await energyTrading.connect(buyer).buyEnergy(1n, { value: totalCost });

      await expect(
        energyTrading.connect(buyer).abortTrade(1n)
      ).to.be.revertedWith("Refund timeout not reached yet");
    });

    it("Should allow buyer to abort after the 24-hour timeout", async function () {
      await energyTrading.connect(seller).listEnergy(listAmount, pricePerToken);
      await energyTrading.connect(buyer).buyEnergy(1n, { value: totalCost });

      // Increase time by 25 hours
      await ethers.provider.send("evm_increaseTime", [25 * 60 * 60]);
      await ethers.provider.send("evm_mine");

      const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);

      // Buyer aborts trade now
      await expect(energyTrading.connect(buyer).abortTrade(1n))
        .to.emit(energyTrading, "TradeAborted")
        .withArgs(1n, seller.address, buyer.address);

      expect(await greenCoin.balanceOf(seller.address)).to.equal(listAmount);
      const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
      expect(buyerBalanceAfter).to.be.above(buyerBalanceBefore);
    });

    it("Should allow owner to change the Oracle address", async function () {
      await expect(energyTrading.connect(owner).setOracleAddress(other.address))
        .to.emit(energyTrading, "OracleAddressChanged")
        .withArgs(oracle.address, other.address);

      expect(await energyTrading.oracleAddress()).to.equal(other.address);
    });

    it("Should prevent non-owner from changing Oracle address", async function () {
      await expect(
        energyTrading.connect(other).setOracleAddress(other.address)
      ).to.be.revertedWithCustomError(energyTrading, "OwnableUnauthorizedAccount");
    });

    it("Should prevent setting Oracle to zero address", async function () {
      await expect(
        energyTrading.connect(owner).setOracleAddress(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid Oracle address");
    });

    it("Should prevent listing energy with zero amount or zero price", async function () {
      await expect(
        energyTrading.connect(seller).listEnergy(0, pricePerToken)
      ).to.be.revertedWith("Amount must be greater than zero");

      await expect(
        energyTrading.connect(seller).listEnergy(listAmount, 0)
      ).to.be.revertedWith("Price per token must be greater than zero");
    });

    it("Should prevent the seller from buying their own energy listing", async function () {
      await energyTrading.connect(seller).listEnergy(listAmount, pricePerToken);
      await expect(
        energyTrading.connect(seller).buyEnergy(1n, { value: totalCost })
      ).to.be.revertedWith("Seller cannot buy their own energy");
    });
  });
});
