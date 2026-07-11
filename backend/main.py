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

RPC_URL = config.get("rpcUrl", "http://127.0.0.1:8545")
w3 = Web3(Web3.HTTPProvider(RPC_URL))

if not w3.is_connected():
    print(f"WARNING: Could not connect to Web3 provider at {RPC_URL}")

GREEN_COIN_ADDRESS = Web3.to_checksum_address(config["greenCoinAddress"])
ENERGY_TRADING_ADDRESS = Web3.to_checksum_address(config["energyTradingAddress"])

# Oracle Key Fallbacks: config JSON -> ORACLE_PRIVATE_KEY -> PRIVATE_KEY
ORACLE_PRIVATE_KEY = config.get("oraclePrivateKey") or os.environ.get("ORACLE_PRIVATE_KEY") or os.environ.get("PRIVATE_KEY")
ORACLE_ADDRESS = Web3.to_checksum_address(config["oracleAddress"])

# Deployer key for minting permissions
DEPLOYER_PRIVATE_KEY = os.environ.get("PRIVATE_KEY") or "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
if DEPLOYER_PRIVATE_KEY:
    try:
        DEPLOYER_ADDRESS = Account.from_key(DEPLOYER_PRIVATE_KEY).address
    except Exception:
        DEPLOYER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
else:
    DEPLOYER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

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
            "seller": listing_info[1],
            "amount_kwh": float(w3.from_wei(listing_info[2], 'ether')), 
            "price_per_kwh_matic": float(w3.from_wei(listing_info[3], 'ether')),
            "buyer": listing_info[4],
            "matched_at": listing_info[5],
            "is_active": listing_info[6],
            "is_matched": listing_info[7],
            "is_settled": listing_info[8]
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
                    "seller": listing_info[1],
                    "amount_kwh": float(w3.from_wei(listing_info[2], 'ether')),
                    "price_per_kwh_matic": float(w3.from_wei(listing_info[3], 'ether')),
                    "buyer": listing_info[4],
                    "matched_at": listing_info[5],
                    "is_active": listing_info[6],
                    "is_matched": listing_info[7],
                    "is_settled": listing_info[8]
                })
        return all_listings
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch listings: {str(e)}")

@app.post("/settle")
def settle_trade(req: SettleRequest):
    """
    Oracle settlement endpoint. Relays physical meter proof and settles trade on blockchain.
    Signs the confirmDelivery transaction using the Oracle's private key.
    """
    try:
        # Check listing state
        listing_info = energy_trading_contract.functions.listings(req.listing_id).call()
        if listing_info[0] == 0:
            raise HTTPException(status_code=404, detail="Listing not found")
        if not listing_info[7]: 
            raise HTTPException(status_code=400, detail="Listing is not matched by a buyer yet")
        if listing_info[8]: 
            raise HTTPException(status_code=400, detail="Listing is already settled")

        # Build transaction
        nonce = w3.eth.get_transaction_count(ORACLE_ADDRESS)
        tx = energy_trading_contract.functions.confirmDelivery(req.listing_id).build_transaction({
            'from': ORACLE_ADDRESS,
            'gas': 150000,
            'gasPrice': w3.eth.gas_price,
            'nonce': nonce,
        })
        
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
    Refunds the buyer and returns tokens to the seller.
    """
    try:
        listing_info = energy_trading_contract.functions.listings(req.listing_id).call()
        if listing_info[0] == 0:
            raise HTTPException(status_code=404, detail="Listing not found")
        if not listing_info[7]:
            raise HTTPException(status_code=400, detail="Listing is not matched")
        if listing_info[8]:
            raise HTTPException(status_code=400, detail="Listing is already settled")

        # Build transaction
        nonce = w3.eth.get_transaction_count(ORACLE_ADDRESS)
        tx = energy_trading_contract.functions.abortTrade(req.listing_id).build_transaction({
            'from': ORACLE_ADDRESS,
            'gas': 120000,
            'gasPrice': w3.eth.gas_price,
            'nonce': nonce,
        })
        
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
    Simulated Smart Meter endpoint. Mint GreenCoins to seller address when excess generation occurs.
    Usually triggered by the IoT Oracle backend.
    """
    try:
        to_chk = w3.to_checksum_address(req.to_address)
        wei_amount = w3.to_wei(req.amount_kwh, 'ether')
        
        nonce = w3.eth.get_transaction_count(DEPLOYER_ADDRESS)
        tx = green_coin_contract.functions.mint(to_chk, wei_amount).build_transaction({
            'from': DEPLOYER_ADDRESS,
            'gas': 100000,
            'gasPrice': w3.eth.gas_price,
            'nonce': nonce,
        })
        
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
