import { ethers } from "ethers";
import config from "../deployed_addresses.json";
import GreenCoinArtifact from "../abi/GreenCoin.json";
import EnergyTradingArtifact from "../abi/EnergyTrading.json";

export const GREEN_COIN_ADDRESS = config.greenCoinAddress;
export const ENERGY_TRADING_ADDRESS = config.energyTradingAddress;
export const GREEN_COIN_ABI = GreenCoinArtifact.abi;
export const ENERGY_TRADING_ABI = EnergyTradingArtifact.abi;
export const RPC_URL = config.rpcUrl;
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";

// Interface for listings fetched from contract
export interface Listing {
  id: number;
  seller: string;
  amount: string;          // in whole GRN/kwh (ether unit representation)
  pricePerToken: string;   // price per GRN in MATIC/POL
  buyer: string;
  matchedAt: number;
  isActive: boolean;
  isMatched: boolean;
  isSettled: boolean;
}

// Get a standard read-only provider connected to the network
export function getJsonRpcProvider() {
  return new ethers.JsonRpcProvider(RPC_URL);
}

// Get the GreenCoin contract (read-only)
export function getGreenCoinContract(providerOrSigner: ethers.Provider | ethers.Signer) {
  return new ethers.Contract(GREEN_COIN_ADDRESS, GREEN_COIN_ABI, providerOrSigner);
}

// Get the EnergyTrading contract (read-only)
export function getEnergyTradingContract(providerOrSigner: ethers.Provider | ethers.Signer) {
  return new ethers.Contract(ENERGY_TRADING_ADDRESS, ENERGY_TRADING_ABI, providerOrSigner);
}

// Switch MetaMask network to Polygon Amoy
export async function switchChainToPolygonAmoy() {
  if (!window.ethereum) return;
  
  const amoyChainId = "0x13882"; // 80002 in hex
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: amoyChainId }],
    });
  } catch (switchError: any) {
    // Error code 4902 indicates that the chain has not been added to MetaMask.
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: amoyChainId,
              chainName: "Polygon Amoy Testnet",
              rpcUrls: ["https://rpc-amoy.polygon.technology"],
              nativeCurrency: {
                name: "POL",
                symbol: "POL",
                decimals: 18,
              },
              blockExplorerUrls: ["https://amoy.polygonscan.com"],
            },
          ],
        });
      } catch (addError) {
        console.error("Failed to add Polygon Amoy chain to MetaMask:", addError);
        throw addError;
      }
    } else {
      console.error("Failed to switch chain:", switchError);
      throw switchError;
    }
  }
}

// Connect MetaMask wallet
export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed. Please install it to use this app.");
  }
  
  // Force MetaMask to use Polygon Amoy testnet
  await switchChainToPolygonAmoy();
  
  const provider = new ethers.BrowserProvider(window.ethereum);
  const accounts = await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  
  return {
    address: accounts[0],
    provider,
    signer
  };
}

// Get GreenCoin balance of an address
export async function getGCBalance(address: string): Promise<string> {
  try {
    const provider = getJsonRpcProvider();
    const contract = getGreenCoinContract(provider);
    const balance = await contract.balanceOf(address);
    return ethers.formatEther(balance);
  } catch (err) {
    console.error("Error fetching balance:", err);
    return "0";
  }
}

// Fetch all listings from the blockchain (utilizes our RPC URL)
export async function getListingsFromChain(): Promise<Listing[]> {
  try {
    const provider = getJsonRpcProvider();
    const contract = getEnergyTradingContract(provider);
    const count = await contract.listingCount();
    const listings: Listing[] = [];
    
    for (let i = 1n; i <= count; i++) {
      const info = await contract.listings(i);
      // listings mapping return values:
      // uint256 id, address payable seller, uint256 amount, uint256 pricePerToken, 
      // address buyer, uint256 matchedAt, bool isActive, bool isMatched, bool isSettled
      if (info[0] !== 0n) {
        listings.push({
          id: Number(info[0]),
          amount: ethers.formatEther(info[1]),
          pricePerToken: ethers.formatEther(info[2]),
          seller: info[3],
          isActive: info[4],
          isMatched: info[5],
          isSettled: info[6],
          buyer: info[7],
          matchedAt: Number(info[8])
        });
      }
    }
    return listings;
  } catch (err) {
    console.error("Error fetching listings from blockchain:", err);
    return [];
  }
}

// Helper to get gas overrides with a safety minimum of 30 Gwei for Polygon Amoy
async function getGasOverrides(signer: ethers.Signer) {
  try {
    const provider = signer.provider;
    if (!provider) throw new Error("No provider found on signer");
    const feeData = await provider.getFeeData();
    const network = await provider.getNetwork();
    const minGasPrice = ethers.parseUnits("30", "gwei");
    
    // Check if on a local test network (Hardhat/Localhost) to skip EIP-1559 and avoid MetaMask fee inconsistencies
    const isLocal = network.chainId === 31337n || network.chainId === 1337n;
    
    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas && !isLocal) {
      let maxFee = feeData.maxFeePerGas;
      let maxPriority = feeData.maxPriorityFeePerGas;
      if (maxFee < minGasPrice) {
        maxFee = minGasPrice;
      }
      if (maxPriority < minGasPrice) {
        maxPriority = minGasPrice;
      }
      return {
        maxFeePerGas: maxFee,
        maxPriorityFeePerGas: maxPriority,
        gasLimit: 250000 // Explicitly set gasLimit to bypass pre-flight estimateGas check
      };
    } else {
      let gasPrice = feeData.gasPrice || minGasPrice;
      if (gasPrice < minGasPrice) {
        gasPrice = minGasPrice;
      }
      return { 
        gasPrice,
        gasLimit: 250000 // Explicitly set gasLimit to bypass pre-flight estimateGas check
      };
    }
  } catch (e) {
    console.warn("Failed to fetch gas data, using 35 Gwei default override:", e);
    return {
      gasPrice: ethers.parseUnits("35", "gwei"),
      gasLimit: 250000 // Explicitly set gasLimit to bypass pre-flight estimateGas check
    };
  }
}

// Seller lists energy
export async function createListing(signer: ethers.Signer, amountKwh: string, pricePerKwh: string) {
  const gcContract = new ethers.Contract(GREEN_COIN_ADDRESS, GREEN_COIN_ABI, signer);
  const tradingContract = new ethers.Contract(ENERGY_TRADING_ADDRESS, ENERGY_TRADING_ABI, signer);
  
  const amountWei = ethers.parseEther(amountKwh);
  const priceWei = ethers.parseEther(pricePerKwh);
  
  const overrides = await getGasOverrides(signer);
  
  // 1. Approve EnergyTrading contract to spend GreenCoins
  const approveTx = await gcContract.approve(ENERGY_TRADING_ADDRESS, amountWei, overrides);
  await approveTx.wait();
  
  // 2. Call listEnergy
  const listTx = await tradingContract.listEnergy(amountWei, priceWei, overrides);
  const receipt = await listTx.wait();
  return receipt;
}

// Seller cancels listing
export async function cancelEnergyListing(signer: ethers.Signer, listingId: number) {
  const contract = new ethers.Contract(ENERGY_TRADING_ADDRESS, ENERGY_TRADING_ABI, signer);
  const overrides = await getGasOverrides(signer);
  const tx = await contract.cancelListing(BigInt(listingId), overrides);
  const receipt = await tx.wait();
  return receipt;
}

// Buyer matches order and deposits MATIC/POL in escrow
export async function buyEnergyListing(signer: ethers.Signer, listingId: number, totalCostMatic: string) {
  const contract = new ethers.Contract(ENERGY_TRADING_ADDRESS, ENERGY_TRADING_ABI, signer);
  
  let valueWei: bigint;
  if (listingId >= 101) {
    // Simulated/mock listing: use the totalCostMatic from frontend
    valueWei = ethers.parseEther(totalCostMatic);
  } else {
    // On-chain listing: Fetch parameters from the contract to match expected Wei exactly
    const info = await contract.listings(BigInt(listingId));
    const amount = info[2];          // uint256 amount
    const pricePerToken = info[3];   // uint256 pricePerToken
    
    // Solidity math: (amount * pricePerToken) / 10^18
    valueWei = (amount * pricePerToken) / 10n**18n;
  }
  
  const overrides = await getGasOverrides(signer);
  const tx = await contract.buyEnergy(BigInt(listingId), { ...overrides, value: valueWei });
  const receipt = await tx.wait();
  return receipt;
}

// API Call: Trigger Oracle Settlement
export async function settleListingViaOracle(listingId: number) {
  const response = await fetch(`${BACKEND_URL}/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listing_id: listingId }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Oracle settlement failed");
  }
  return response.json();
}

// API Call: Trigger Oracle Abort/Refund
export async function abortListingViaOracle(listingId: number) {
  const response = await fetch(`${BACKEND_URL}/abort`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listing_id: listingId }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Oracle abort failed");
  }
  return response.json();
}

// API Call: Simulated Smart Meter Minting
export async function mintCreditsViaOracle(toAddress: string, amountKwh: number) {
  const response = await fetch(`${BACKEND_URL}/mint`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to_address: toAddress, amount_kwh: amountKwh }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Minting failed");
  }
  return response.json();
}
