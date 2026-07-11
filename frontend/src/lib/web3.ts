import { ethers } from "ethers";
import config from "../deployed_addresses.json";
import GreenCoinArtifact from "../abi/GreenCoin.json";
import EnergyTradingArtifact from "../abi/EnergyTrading.json";

export const GREEN_COIN_ADDRESS = config.greenCoinAddress;
export const ENERGY_TRADING_ADDRESS = config.energyTradingAddress;
export const GREEN_COIN_ABI = GreenCoinArtifact.abi;
export const ENERGY_TRADING_ABI = EnergyTradingArtifact.abi;
export const RPC_URL = config.rpcUrl;
export const BACKEND_URL = "http://127.0.0.1:8000";

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

// Connect MetaMask wallet
export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed. Please install it to use this app.");
  }
  
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
          seller: info[1],
          amount: ethers.formatEther(info[2]),
          pricePerToken: ethers.formatEther(info[3]),
          buyer: info[4],
          matchedAt: Number(info[5]),
          isActive: info[6],
          isMatched: info[7],
          isSettled: info[8]
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
    const minGasPrice = ethers.parseUnits("30", "gwei");
    
    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
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
        maxPriorityFeePerGas: maxPriority
      };
    } else {
      let gasPrice = feeData.gasPrice || minGasPrice;
      if (gasPrice < minGasPrice) {
        gasPrice = minGasPrice;
      }
      return { gasPrice };
    }
  } catch (e) {
    console.warn("Failed to fetch gas data, using 35 Gwei default override:", e);
    return {
      gasPrice: ethers.parseUnits("35", "gwei")
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
  const valueWei = ethers.parseEther(totalCostMatic);
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
