// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GreenCoin
 * @dev ERC-20 token representing Green energy credits (1 token = 1 kWh).
 * Minted to producers upon solar generation and transferred to consumers.
 */
contract GreenCoin is ERC20, Ownable {
    constructor() ERC20("GreenCoin", "GRN") Ownable(msg.sender) {}

    /**
     * @dev Mint new GreenCoins to a user. Only callable by the contract owner (Oracle/Backend).
     * @param to The address receiving the minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Burn GreenCoins from a user. Only callable by the contract owner (Oracle/Backend).
     * @param from The address whose tokens will be burned.
     * @param amount The amount of tokens to burn.
     */
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
}
