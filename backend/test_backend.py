import os
import json
import time
import subprocess
import requests
from web3 import Web3

def run_tests():
    # 1. Load deployment config
    config_path = "deployed_addresses.json"
    if not os.path.exists(config_path):
        config_path = "../deployed_addresses.json"
        
    with open(config_path, "r") as f:
        config = json.load(f)

    rpc_url = config["rpcUrl"]
    green_coin_addr = Web3.to_checksum_address(config["greenCoinAddress"])
    energy_trading_addr = Web3.to_checksum_address(config["energyTradingAddress"])
    
    seller_addr = Web3.to_checksum_address(config["sellerAddress"])
    seller_key = config["sellerPrivateKey"]
    
    buyer_addr = Web3.to_checksum_address(config["buyerAddress"])
    buyer_key = config["buyerPrivateKey"]

    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        print("❌ Cannot connect to local Hardhat node.")
        return

    print("✔ Connected to Hardhat node.")

    # Load EnergyTrading ABI
    abi_path = "artifacts/contracts/EnergyTrading.sol/EnergyTrading.json"
    if not os.path.exists(abi_path):
        abi_path = "../artifacts/contracts/EnergyTrading.sol/EnergyTrading.json"
        
    with open(abi_path, "r") as f:
        energy_trading_abi = json.load(f)["abi"]

    # Load GreenCoin ABI
    gc_abi_path = "artifacts/contracts/GreenCoin.sol/GreenCoin.json"
    if not os.path.exists(gc_abi_path):
        gc_abi_path = "../artifacts/contracts/GreenCoin.sol/GreenCoin.json"
        
    with open(gc_abi_path, "r") as f:
        green_coin_abi = json.load(f)["abi"]

    energy_trading = w3.eth.contract(address=energy_trading_addr, abi=energy_trading_abi)
    green_coin = w3.eth.contract(address=green_coin_addr, abi=green_coin_abi)

    # 2. Start FastAPI Server
    print("🚀 Starting FastAPI Server in background...")
    cmd = [".venv/bin/python", "-m", "uvicorn", "backend.main:app", "--port", "8000"]
    server_process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    
    # Wait for server to boot
    time.sleep(3)
    
    try:
        # Test server root
        res = requests.get("http://127.0.0.1:8000/")
        assert res.status_code == 200, "Server root is not reachable"
        print("✔ FastAPI Server is running.")

        # Test 1: Mint tokens via FastAPI /mint
        print("\n--- Test 1: Minting tokens via FastAPI ---")
        mint_res = requests.post("http://127.0.0.1:8000/mint", json={
            "to_address": seller_addr,
            "amount_kwh": 50.0
        })
        assert mint_res.status_code == 200, f"Minting failed: {mint_res.text}"
        print(f"✔ Mint API Success: {mint_res.json()['message']}")
        
        balance = green_coin.functions.balanceOf(seller_addr).call()
        print(f"Seller GreenCoin balance: {w3.from_wei(balance, 'ether')} GRN")

        # Test 2: Seller lists energy (using Web3 directly to simulate client-side Metamask tx)
        print("\n--- Test 2: Seller lists energy ---")
        list_amount = w3.to_wei(10, 'ether') # 10 kWh
        price_per_token = w3.to_wei(0.1, 'ether') # 0.1 MATIC per kWh
        
        # Approve EnergyTrading contract
        nonce = w3.eth.get_transaction_count(seller_addr)
        approve_tx = green_coin.functions.approve(energy_trading_addr, list_amount).build_transaction({
            'from': seller_addr,
            'nonce': nonce,
            'gas': 300000,
            'gasPrice': w3.eth.gas_price
        })
        signed_approve = w3.eth.account.sign_transaction(approve_tx, seller_key)
        w3.eth.send_raw_transaction(signed_approve.raw_transaction)
        w3.eth.wait_for_transaction_receipt(signed_approve.hash)
        print("✔ Seller approved EnergyTrading contract to spend GreenCoins.")

        # Call listEnergy
        nonce = w3.eth.get_transaction_count(seller_addr)
        list_tx = energy_trading.functions.listEnergy(list_amount, price_per_token).build_transaction({
            'from': seller_addr,
            'nonce': nonce,
            'gas': 500000,
            'gasPrice': w3.eth.gas_price
        })
        signed_list = w3.eth.account.sign_transaction(list_tx, seller_key)
        w3.eth.send_raw_transaction(signed_list.raw_transaction)
        w3.eth.wait_for_transaction_receipt(signed_list.hash)
        
        listing_count = energy_trading.functions.listingCount().call()
        print(f"✔ Energy listed on-chain. Current listing ID: {listing_count}")

        # Test 3: Buyer buys/matches energy (Web3)
        print("\n--- Test 3: Buyer matches/buys listing ---")
        total_cost = int((list_amount * price_per_token) / 10**18)
        
        nonce = w3.eth.get_transaction_count(buyer_addr)
        buy_tx = energy_trading.functions.buyEnergy(listing_count).build_transaction({
            'from': buyer_addr,
            'value': total_cost,
            'nonce': nonce,
            'gas': 500000,
            'gasPrice': w3.eth.gas_price
        })
        signed_buy = w3.eth.account.sign_transaction(buy_tx, buyer_key)
        w3.eth.send_raw_transaction(signed_buy.raw_transaction)
        w3.eth.wait_for_transaction_receipt(signed_buy.hash)
        print("✔ Buyer matched listing and deposited MATIC in escrow.")

        # Test 4: Retrieve listing details from FastAPI
        print("\n--- Test 4: Verify listing state via FastAPI GET ---")
        get_res = requests.get(f"http://127.0.0.1:8000/listing/{listing_count}")
        assert get_res.status_code == 200, "Failed to get listing info"
        listing_info = get_res.json()
        print(f"Listing details from API: {json.dumps(listing_info, indent=2)}")
        assert listing_info["is_matched"] is True, "Listing should be marked as matched"
        assert listing_info["is_settled"] is False, "Listing should not be settled yet"

        # Test 5: Settle trade via FastAPI /settle (Oracle confirmed delivery)
        print("\n--- Test 5: Oracle settles trade via FastAPI POST ---")
        seller_bal_before = w3.eth.get_balance(seller_addr)
        buyer_tokens_before = green_coin.functions.balanceOf(buyer_addr).call()

        settle_res = requests.post("http://127.0.0.1:8000/settle", json={
            "listing_id": listing_count
        })
        assert settle_res.status_code == 200, f"Settlement failed: {settle_res.text}"
        print(f"✔ Settle API Success: {settle_res.json()['message']}")

        # Verify on-chain results
        seller_bal_after = w3.eth.get_balance(seller_addr)
        buyer_tokens_after = green_coin.functions.balanceOf(buyer_addr).call()
        
        # Seller should receive MATIC payout
        payout_matic = w3.from_wei(seller_bal_after - seller_bal_before, 'ether')
        # Buyer should receive GreenCoins
        received_tokens = w3.from_wei(buyer_tokens_after - buyer_tokens_before, 'ether')
        
        print(f"Seller payout received: {payout_matic} MATIC")
        print(f"Buyer tokens received: {received_tokens} GRN")
        
        assert received_tokens == 10.0, "Buyer did not receive correct token amount"
        
        # Verify settled state on API
        get_res_after = requests.get(f"http://127.0.0.1:8000/listing/{listing_count}")
        assert get_res_after.json()["is_settled"] is True, "Listing should be marked as settled"
        print("✔ Escrow settled successfully and verified via API.")

        print("\n🎉 ALL BACKEND API INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉")

    finally:
        # Shut down backend server
        print("🔌 Shutting down FastAPI server...")
        server_process.terminate()
        server_process.wait()
        print("✔ Server stopped.")

if __name__ == "__main__":
    run_tests()
