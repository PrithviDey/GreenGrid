import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from web3 import Web3
from eth_account import Account
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="GreenGrid Backend & Oracle Server")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load configuration from deployed_addresses.json
config_path = os.path.join(os.path.dirname(__file__), "..", "deployed_addresses.json")
if not os.path.exists(config_path):
    config_path = "deployed_addresses.json"

try:
    with open(config_path, "r") as f:
        config = json.load(f)
except Exception as e:
    raise RuntimeError(f"Could not load deployment configuration: {e}")

# RPC and Address configs
RPC_URL = config.get("rpcUrl", "http://127.0.0.1:8545")
w3 = Web3(Web3.HTTPProvider(RPC_URL))

if not w3.is_connected():
    print(f"WARNING: Could not connect to Web3 provider at {RPC_URL}")

GREEN_COIN_ADDRESS = Web3.to_checksum_address(config["greenCoinAddress"])
ENERGY_TRADING_ADDRESS = Web3.to_checksum_address(config["energyTradingAddress"])

# Secure Key derivation strictly from Env (not flat config files)
ORACLE_PRIVATE_KEY = os.environ.get("ORACLE_PRIVATE_KEY") or os.environ.get("PRIVATE_KEY")
if not ORACLE_PRIVATE_KEY:
    raise RuntimeError("Critical: Missing ORACLE_PRIVATE_KEY or PRIVATE_KEY in env variables")

try:
    oracle_account = Account.from_key(ORACLE_PRIVATE_KEY)
    ORACLE_ADDRESS = Web3.to_checksum_address(oracle_account.address)
except Exception as e:
    raise RuntimeError(f"Failed to load Oracle Account from private key: {e}")

DEPLOYER_PRIVATE_KEY = os.environ.get("PRIVATE_KEY")
if not DEPLOYER_PRIVATE_KEY:
    raise RuntimeError("Critical: Missing PRIVATE_KEY (Deployer) in env variables")

try:
    deployer_account = Account.from_key(DEPLOYER_PRIVATE_KEY)
    DEPLOYER_ADDRESS = Web3.to_checksum_address(deployer_account.address)
except Exception as e:
    raise RuntimeError(f"Failed to load Deployer Account from private key: {e}")


# Load ABIs
def load_abi(contract_name: str):
    abi_path = os.path.join(
        os.path.dirname(__file__), 
        "..", 
        "artifacts", 
        "contracts", 
        f"{contract_name}.sol", 
        f"{contract_name}.json"
    )
    if not os.path.exists(abi_path):
        abi_path = f"artifacts/contracts/{contract_name}.sol/{contract_name}.json"
    
    with open(abi_path, "r") as f:
        artifact = json.load(f)
        return artifact["abi"]

try:
    GREEN_COIN_ABI = load_abi("GreenCoin")
    ENERGY_TRADING_ABI = load_abi("EnergyTrading")
except Exception as e:
    raise RuntimeError(f"Could not load contract ABIs: {e}")

green_coin_contract = w3.eth.contract(address=GREEN_COIN_ADDRESS, abi=GREEN_COIN_ABI)
energy_trading_contract = w3.eth.contract(address=ENERGY_TRADING_ADDRESS, abi=ENERGY_TRADING_ABI)


# EIP-1559 Dynamic Gas Fee Estimator
def get_eip1559_gas_params():
    """
    Dynamically fetches gas parameters. Estimates base fee and priority fee for
    EIP-1559 compliant transactions, falling back to legacy gasPrice if necessary.
    """
    try:
        latest_block = w3.eth.get_block('latest')
        base_fee = latest_block.get('baseFeePerGas')
        
        # If network doesn't support EIP-1559, fall back to legacy gas pricing
        if base_fee is None:
            return {
                'gasPrice': w3.eth.gas_price,
                'chainId': w3.eth.chain_id
            }
        
        # Query recommended max priority fee (miner tip)
        priority_fee = w3.eth.max_priority_fee
        
        # Max fee = (2 * base fee) + priority fee
        max_fee = (2 * base_fee) + priority_fee
        
        return {
            'maxFeePerGas': max_fee,
            'maxPriorityFeePerGas': priority_fee,
            'chainId': w3.eth.chain_id
        }
    except Exception as e:
        print(f"EIP-1559 dynamic estimation failed, falling back to legacy gasPrice: {e}")
        try:
            return {
                'gasPrice': w3.eth.gas_price,
                'chainId': w3.eth.chain_id
            }
        except Exception:
            # Absolute fallback
            return {
                'gasPrice': w3.to_wei(25, 'gwei'),
                'chainId': 80002 # Polygon Amoy default
            }


class SettleRequest(BaseModel):
    listing_id: int

class AbortRequest(BaseModel):
    listing_id: int

class MintRequest(BaseModel):
    to_address: str
    amount_kwh: float

@app.get("/")
def read_root():
    return {
        "status": "GreenGrid Backend & Oracle Server running",
        "rpcUrl": RPC_URL,
        "greenCoinAddress": GREEN_COIN_ADDRESS,
        "energyTradingAddress": ENERGY_TRADING_ADDRESS,
        "oracleAddress": ORACLE_ADDRESS,
        "web3Connected": w3.is_connected()
    }

@app.get("/listings/count")
def get_listing_count():
    try:
        count = energy_trading_contract.functions.listingCount().call()
        return {"listingCount": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch listing count: {str(e)}")

@app.get("/listing/{listing_id}")
def get_listing(listing_id: int):
    try:
        listing_info = energy_trading_contract.functions.listings(listing_id).call()
        
        if listing_info[0] == 0:
            raise HTTPException(status_code=404, detail="Listing not found")
            
        return {
            "id": listing_info[0],
            "seller": listing_info[3],
            "amount_kwh": float(w3.from_wei(listing_info[1], 'ether')),
            "price_per_kwh_matic": float(w3.from_wei(listing_info[2], 'ether')),
            "buyer": listing_info[7],
            "matched_at": listing_info[8],
            "is_active": listing_info[4],
            "is_matched": listing_info[5],
            "is_settled": listing_info[6]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching listing: {str(e)}")

@app.get("/listings")
def get_all_listings():
    try:
        count = energy_trading_contract.functions.listingCount().call()
        all_listings = []
        for i in range(1, count + 1):
            listing_info = energy_trading_contract.functions.listings(i).call()
            if listing_info[0] != 0:
                all_listings.append({
                    "id": listing_info[0],
                    "seller": listing_info[3], # seller is index 3 in Solidity packed order? Wait, let's verify!
                    "amount_kwh": float(w3.from_wei(listing_info[1], 'ether')),
                    "price_per_kwh_matic": float(w3.from_wei(listing_info[2], 'ether')),
                    "buyer": listing_info[7],
                    "matched_at": listing_info[8],
                    "is_active": listing_info[4],
                    "is_matched": listing_info[5],
                    "is_settled": listing_info[6]
                })
        return all_listings
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch listings: {str(e)}")

@app.post("/settle")
def settle_trade(req: SettleRequest):
    """
    Oracle settlement endpoint. Relays physical meter proof and settles trade on blockchain.
    Signs confirmDelivery using EIP-1559 dynamic gas parameters.
    """
    try:
        # Check listing state
        listing_info = energy_trading_contract.functions.listings(req.listing_id).call()
        if listing_info[0] == 0:
            raise HTTPException(status_code=404, detail="Listing not found")
        # index 5 is isMatched, index 6 is isSettled in struct
        if not listing_info[5]: 
            raise HTTPException(status_code=400, detail="Listing is not matched by a buyer yet")
        if listing_info[6]: 
            raise HTTPException(status_code=400, detail="Listing is already settled")

        # Build transaction
        nonce = w3.eth.get_transaction_count(ORACLE_ADDRESS)
        tx_fields = {
            'from': ORACLE_ADDRESS,
            'gas': 150000,
            'nonce': nonce,
        }
        tx_fields.update(get_eip1559_gas_params())

        tx = energy_trading_contract.functions.confirmDelivery(req.listing_id).build_transaction(tx_fields)
        
        # Sign transaction
        signed_tx = w3.eth.account.sign_transaction(tx, private_key=ORACLE_PRIVATE_KEY)
        
        # Send raw transaction
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        
        # Wait for receipt
        tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        if tx_receipt.status != 1:
            raise HTTPException(status_code=500, detail="Transaction reverted on blockchain")

        return {
            "success": True,
            "transactionHash": tx_hash.hex(),
            "message": f"Oracle successfully settled trade for listing {req.listing_id}",
            "blockNumber": tx_receipt.blockNumber
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Oracle settlement failed: {str(e)}")

@app.post("/abort")
def abort_trade(req: AbortRequest):
    """
    Oracle abort endpoint. Cancels matched but unfulfilled energy delivery.
    """
    try:
        listing_info = energy_trading_contract.functions.listings(req.listing_id).call()
        if listing_info[0] == 0:
            raise HTTPException(status_code=404, detail="Listing not found")
        if not listing_info[5]:
            raise HTTPException(status_code=400, detail="Listing is not matched")
        if listing_info[6]:
            raise HTTPException(status_code=400, detail="Listing is already settled")

        # Build transaction
        nonce = w3.eth.get_transaction_count(ORACLE_ADDRESS)
        tx_fields = {
            'from': ORACLE_ADDRESS,
            'gas': 120000,
            'nonce': nonce,
        }
        tx_fields.update(get_eip1559_gas_params())

        tx = energy_trading_contract.functions.abortTrade(req.listing_id).build_transaction(tx_fields)
        
        # Sign transaction
        signed_tx = w3.eth.account.sign_transaction(tx, private_key=ORACLE_PRIVATE_KEY)
        
        # Send raw transaction
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        if tx_receipt.status != 1:
            raise HTTPException(status_code=500, detail="Abort transaction reverted")

        return {
            "success": True,
            "transactionHash": tx_hash.hex(),
            "message": f"Oracle successfully aborted trade for listing {req.listing_id}",
            "blockNumber": tx_receipt.blockNumber
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Oracle abort failed: {str(e)}")

@app.post("/mint")
def mint_energy_credits(req: MintRequest):
    """
    Simulated Smart Meter endpoint. Mint GreenCoins to seller address.
    """
    try:
        to_chk = w3.to_checksum_address(req.to_address)
        wei_amount = w3.to_wei(req.amount_kwh, 'ether')
        
        nonce = w3.eth.get_transaction_count(DEPLOYER_ADDRESS)
        tx_fields = {
            'from': DEPLOYER_ADDRESS,
            'gas': 100000,
            'nonce': nonce,
        }
        tx_fields.update(get_eip1559_gas_params())

        tx = green_coin_contract.functions.mint(to_chk, wei_amount).build_transaction(tx_fields)
        
        signed_tx = w3.eth.account.sign_transaction(tx, private_key=DEPLOYER_PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        if tx_receipt.status != 1:
            raise HTTPException(status_code=500, detail="Mint transaction reverted")
            
        return {
            "success": True,
            "transactionHash": tx_hash.hex(),
            "message": f"Minted {req.amount_kwh} GRN (kWh) to {to_chk}",
            "new_balance": float(w3.from_wei(green_coin_contract.functions.balanceOf(to_chk).call(), 'ether'))
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Minting failed: {str(e)}")
