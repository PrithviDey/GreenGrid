// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EnergyTrading
 * @dev Handles P2P solar energy listings, payment escrows, matching, and settlement via Oracle.
 */
contract EnergyTrading is Ownable {
    IERC20 public immutable greenCoin;
    address public oracleAddress;

    struct Listing {
        uint256 id;
        address payable seller;
        uint256 amount;          // amount in GreenCoin tokens (1 token = 1 kWh)
        uint256 pricePerToken;   // price per token in Wei (MATIC)
        address buyer;           // address of the buyer matching the listing
        uint256 matchedAt;       // timestamp when matching occurred
        bool isActive;           // true if listed and not matched/cancelled
        bool isMatched;          // true if buyer has deposited funds
        bool isSettled;          // true if delivery confirmed and trade settled
    }

    uint256 public listingCount;
    mapping(uint256 => Listing) public listings;

    event EnergyListed(uint256 indexed listingId, address indexed seller, uint256 amount, uint256 pricePerToken);
    event EnergyMatched(uint256 indexed listingId, address indexed buyer, uint256 depositAmount);
    event TradeSettled(uint256 indexed listingId, address indexed seller, address indexed buyer, uint256 amount, uint256 payout);
    event TradeAborted(uint256 indexed listingId, address indexed seller, address indexed buyer);
    event ListingCancelled(uint256 indexed listingId, address indexed seller);
    event OracleAddressChanged(address indexed oldOracle, address indexed newOracle);

    modifier onlyOracle() {
        require(msg.sender == oracleAddress, "Caller is not the authorized oracle");
        _;
    }

    constructor(address _greenCoinAddress, address _oracleAddress) Ownable(msg.sender) {
        require(_greenCoinAddress != address(0), "Invalid GreenCoin address");
        require(_oracleAddress != address(0), "Invalid Oracle address");
        greenCoin = IERC20(_greenCoinAddress);
        oracleAddress = _oracleAddress;
    }

    /**
     * @dev Set a new Oracle address. Only callable by the owner.
     * @param _newOracle New Oracle wallet address.
     */
    function setOracleAddress(address _newOracle) external onlyOwner {
        require(_newOracle != address(0), "Invalid Oracle address");
        emit OracleAddressChanged(oracleAddress, _newOracle);
        oracleAddress = _newOracle;
    }

    /**
     * @dev Seller lists excess energy. Seller must first approve this contract to spend their GreenCoins.
     * @param amount Amount of GreenCoin tokens (1 token = 1 kWh) to trade.
     * @param pricePerToken Price per GreenCoin token in Wei (MATIC).
     */
    function listEnergy(uint256 amount, uint256 pricePerToken) external {
        require(amount > 0, "Amount must be greater than zero");
        require(pricePerToken > 0, "Price per token must be greater than zero");

        // Escrow GreenCoins into this contract
        require(greenCoin.transferFrom(msg.sender, address(this), amount), "GreenCoin escrow transfer failed");

        listingCount++;
        listings[listingCount] = Listing({
            id: listingCount,
            seller: payable(msg.sender),
            amount: amount,
            pricePerToken: pricePerToken,
            buyer: address(0),
            matchedAt: 0,
            isActive: true,
            isMatched: false,
            isSettled: false
        });

        emit EnergyListed(listingCount, msg.sender, amount, pricePerToken);
    }

    /**
     * @dev Seller cancels an active listing before any buyer matches it.
     */
    function cancelListing(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        require(listing.id == listingId, "Listing does not exist");
        require(msg.sender == listing.seller, "Only seller can cancel listing");
        require(listing.isActive, "Listing is not active");
        require(!listing.isMatched, "Listing already matched");

        listing.isActive = false;

        // Refund GreenCoins back to seller
        require(greenCoin.transfer(listing.seller, listing.amount), "Refund transfer failed");

        emit ListingCancelled(listingId, msg.sender);
    }

    /**
     * @dev Buyer matches a listing and sends MATIC payment to escrow.
     */
    function buyEnergy(uint256 listingId) external payable {
        Listing storage listing = listings[listingId];
        require(listing.id == listingId, "Listing does not exist");
        require(listing.isActive, "Listing is not active");
        require(!listing.isMatched, "Listing already matched");
        require(msg.sender != listing.seller, "Seller cannot buy their own energy");

        uint256 totalCost = (listing.amount * listing.pricePerToken) / 1e18;
        require(msg.value == totalCost, "Incorrect payment amount");

        listing.isActive = false;
        listing.isMatched = true;
        listing.buyer = msg.sender;
        listing.matchedAt = block.timestamp;

        emit EnergyMatched(listingId, msg.sender, msg.value);
    }

    /**
     * @dev Oracle confirms delivery. Releases MATIC to seller and GreenCoins to buyer.
     */
    function confirmDelivery(uint256 listingId) external onlyOracle {
        Listing storage listing = listings[listingId];
        require(listing.id == listingId, "Listing does not exist");
        require(listing.isMatched, "Listing is not matched");
        require(!listing.isSettled, "Listing already settled");

        listing.isSettled = true;

        uint256 payout = (listing.amount * listing.pricePerToken) / 1e18;

        // Transfer MATIC to seller
        listing.seller.transfer(payout);

        // Transfer GreenCoins to buyer (proves they received the energy credit)
        require(greenCoin.transfer(listing.buyer, listing.amount), "GreenCoin delivery transfer failed");

        emit TradeSettled(listingId, listing.seller, listing.buyer, listing.amount, payout);
    }

    /**
     * @dev Oracle or Buyer aborts trade.
     * Buyer can only abort after 24 hours of matching if Oracle hasn't confirmed delivery.
     * Oracle can abort at any time if delivery is determined to have failed.
     */
    function abortTrade(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        require(listing.id == listingId, "Listing does not exist");
        require(listing.isMatched, "Listing is not matched");
        require(!listing.isSettled, "Listing already settled");

        if (msg.sender != oracleAddress) {
            require(msg.sender == listing.buyer, "Only buyer or oracle can abort");
            require(block.timestamp >= listing.matchedAt + 24 hours, "Refund timeout not reached yet");
        }

        listing.isMatched = false;
        listing.isSettled = false;
        listing.isActive = false;

        uint256 refundAmount = (listing.amount * listing.pricePerToken) / 1e18;

        // Refund MATIC to buyer
        payable(listing.buyer).transfer(refundAmount);

        // Return GreenCoins to seller
        require(greenCoin.transfer(listing.seller, listing.amount), "GreenCoin return failed");

        emit TradeAborted(listingId, listing.seller, listing.buyer);
    }
}
