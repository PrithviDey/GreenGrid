// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EnergyTrading
 * @dev Handles P2P solar energy listings, payment escrows, matching, and settlement via Oracle.
 * Optimized for gas usage using struct packing, custom errors, and secure low-level calls.
 */
contract EnergyTrading is Ownable {
    IERC20 public immutable greenCoin;
    address public oracleAddress;

    // Custom errors for gas efficiency
    error InvalidAddress();
    error ZeroAmount();
    error ZeroPrice();
    error ListingNotFound();
    error ListingNotActive();
    error ListingAlreadyMatched();
    error ListingAlreadySettled();
    error SellerCannotBuy();
    error OnlySeller();
    error OnlyOracle();
    error OnlyBuyerOrOracle();
    error RefundTimeoutNotReached();
    error EscrowTransferFailed();
    error RefundTransferFailed();
    error PayoutTransferFailed();
    error TokenTransferFailed();

    // Struct optimized for slot packing (saves 2 storage slots per listing)
    struct Listing {
        uint256 id;              // Slot 1 (32 bytes)
        uint256 amount;          // Slot 2 (32 bytes) - GreenCoins (18 decimals)
        uint256 pricePerToken;   // Slot 3 (32 bytes) - Wei per token
        address payable seller;  // Slot 4 (20 bytes) \
        bool isActive;           // Slot 4 (1 byte)   | Packed into 23 bytes (1 slot)
        bool isMatched;          // Slot 4 (1 byte)   |
        bool isSettled;          // Slot 4 (1 byte)   /
        address buyer;           // Slot 5 (20 bytes) \ Packed into 28 bytes (1 slot)
        uint64 matchedAt;        // Slot 5 (8 bytes)  /
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
        if (msg.sender != oracleAddress) revert OnlyOracle();
        _;
    }

    constructor(address _greenCoinAddress, address _oracleAddress) Ownable(msg.sender) {
        if (_greenCoinAddress == address(0)) revert InvalidAddress();
        if (_oracleAddress == address(0)) revert InvalidAddress();
        greenCoin = IERC20(_greenCoinAddress);
        oracleAddress = _oracleAddress;
    }

    /**
     * @dev Set a new Oracle address. Only callable by the owner.
     * @param _newOracle New Oracle wallet address.
     */
    function setOracleAddress(address _newOracle) external onlyOwner {
        if (_newOracle == address(0)) revert InvalidAddress();
        emit OracleAddressChanged(oracleAddress, _newOracle);
        oracleAddress = _newOracle;
    }

    /**
     * @dev Seller lists excess energy. Seller must first approve this contract to spend their GreenCoins.
     * @param amount Amount of GreenCoin tokens (1 token = 1 kWh) to trade.
     * @param pricePerToken Price per GreenCoin token in Wei (MATIC).
     */
    function listEnergy(uint256 amount, uint256 pricePerToken) external {
        if (amount == 0) revert ZeroAmount();
        if (pricePerToken == 0) revert ZeroPrice();

        // Escrow GreenCoins into this contract (Checks & Effects)
        if (!greenCoin.transferFrom(msg.sender, address(this), amount)) revert EscrowTransferFailed();

        listingCount++;
        listings[listingCount] = Listing({
            id: listingCount,
            amount: amount,
            pricePerToken: pricePerToken,
            seller: payable(msg.sender),
            isActive: true,
            isMatched: false,
            isSettled: false,
            buyer: address(0),
            matchedAt: 0
        });

        emit EnergyListed(listingCount, msg.sender, amount, pricePerToken);
    }

    /**
     * @dev Seller cancels an active listing before any buyer matches it.
     */
    function cancelListing(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        if (listing.id != listingId) revert ListingNotFound();
        if (msg.sender != listing.seller) revert OnlySeller();
        if (!listing.isActive) revert ListingNotActive();
        if (listing.isMatched) revert ListingAlreadyMatched();

        // Update state before interaction
        listing.isActive = false;

        // Refund GreenCoins back to seller
        if (!greenCoin.transfer(listing.seller, listing.amount)) revert TokenTransferFailed();

        emit ListingCancelled(listingId, msg.sender);
    }

    /**
     * @dev Buyer matches a listing and sends MATIC payment to escrow.
     */
    function buyEnergy(uint256 listingId) external payable {
        Listing storage listing = listings[listingId];
        if (listing.id != listingId) revert ListingNotFound();
        if (!listing.isActive) revert ListingNotActive();
        if (listing.isMatched) revert ListingAlreadyMatched();
        if (msg.sender == listing.seller) revert SellerCannotBuy();

        uint256 totalCost = (listing.amount * listing.pricePerToken) / 1e18;
        if (msg.value != totalCost) revert EscrowTransferFailed();

        // Update state before interaction
        listing.isActive = false;
        listing.isMatched = true;
        listing.buyer = msg.sender;
        listing.matchedAt = uint64(block.timestamp);

        emit EnergyMatched(listingId, msg.sender, msg.value);
    }

    /**
     * @dev Oracle confirms delivery. Releases MATIC to seller and GreenCoins to buyer.
     */
    function confirmDelivery(uint256 listingId) external onlyOracle {
        Listing storage listing = listings[listingId];
        if (listing.id != listingId) revert ListingNotFound();
        if (!listing.isMatched) revert ListingNotActive(); // Or listing not matched
        if (listing.isSettled) revert ListingAlreadySettled();

        // Update state before external transfer (Prevents Reentrancy)
        listing.isSettled = true;

        uint256 payout = (listing.amount * listing.pricePerToken) / 1e18;

        // Transfer MATIC to seller using secure low-level call instead of deprecated transfer()
        (bool success, ) = listing.seller.call{value: payout}("");
        if (!success) revert PayoutTransferFailed();

        // Transfer GreenCoins to buyer (proves they received the energy credit)
        if (!greenCoin.transfer(listing.buyer, listing.amount)) revert TokenTransferFailed();

        emit TradeSettled(listingId, listing.seller, listing.buyer, listing.amount, payout);
    }

    /**
     * @dev Oracle or Buyer aborts trade.
     * Buyer can only abort after 24 hours of matching if Oracle hasn't confirmed delivery.
     * Oracle can abort at any time if delivery is determined to have failed.
     */
    function abortTrade(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        if (listing.id != listingId) revert ListingNotFound();
        if (!listing.isMatched) revert ListingNotActive();
        if (listing.isSettled) revert ListingAlreadySettled();

        if (msg.sender != oracleAddress) {
            if (msg.sender != listing.buyer) revert OnlyBuyerOrOracle();
            if (block.timestamp < listing.matchedAt + 24 hours) revert RefundTimeoutNotReached();
        }

        // Update state before external transfers (Prevents Reentrancy)
        listing.isMatched = false;
        listing.isSettled = false;
        listing.isActive = false;

        uint256 refundAmount = (listing.amount * listing.pricePerToken) / 1e18;

        // Refund MATIC/POL to buyer using secure low-level call instead of deprecated transfer()
        (bool success, ) = payable(listing.buyer).call{value: refundAmount}("");
        if (!success) revert RefundTransferFailed();

        // Return GreenCoins to seller
        if (!greenCoin.transfer(listing.seller, listing.amount)) revert TokenTransferFailed();

        emit TradeAborted(listingId, listing.seller, listing.buyer);
    }
}
