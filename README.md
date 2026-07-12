# GreenGrid — P2P Solar Energy Trading Platform

GreenGrid is a decentralized peer-to-peer (P2P) solar energy trading platform built on the **Polygon Amoy Testnet**. It enables houses with solar panels (producers) to list and sell their excess electricity directly to local neighbors (consumers) through secure smart contracts and an automated IoT Oracle backend.

---

## 🏗 System Architecture

The application consists of three main components:
1. **Smart Contracts (EVM / Solidity)**:
   - `GreenCoin.sol`: An ERC-20 token representing energy credits (**1 GRN = 1 kWh**).
   - `EnergyTrading.sol`: Escrow and P2P marketplace contract. Manages listings, MATIC/POL deposits, and delivery confirmations.
2. **Backend & Oracle (FastAPI / Web3.py)**:
   - Monitors physical energy transfer from smart meters, mints tokens to producers, and validates/settles on-chain trades upon energy delivery.
3. **Frontend (Vite / React / Tailwind)**:
   - Premium dark-mode dashboard displaying live telemetry, dynamic animated energy grid flow, a self-contained Quick Trade panel, and a verified merchant marketplace.

---

## ✨ Features

- 🔐 **Secure Auth & MetaMask Auto-Sync**: Multi-profile login system (`seller_pro` / `buyer_eco`) locked to MetaMask addresses with automatic user session switching on MetaMask account changes.
- 🗺 **Dynamic Grid Visuals**: Interactive SVG topology showing energy flow animations (cyan particles for importing, neon green for exporting) with no emojis and clean geometric paths.
- ⚡ **Self-Contained Quick Trade**: Sell tab for listing energy with balance checks, and a Buy tab that filters listings, auto-selects the cheapest seller, and initiates on-chain purchase instantly.
- 📊 **Real-time Telemetry & Ledger**: Live solar generation vs consumption sparklines, active blockchain transaction logs, and environmental offset calculations.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Python 3.9+](https://www.python.org/)
- [MetaMask Extension](https://metamask.io/) connected to the **Polygon Amoy Testnet**

---

### 1. Installation & Environment Setup

Clone the repository and install dependencies:
```bash
# Install root Hardhat & tool dependencies
npm install

# Install Frontend dependencies
cd frontend
npm install
cd ..

# Create Python virtual environment and install backend requirements
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file at the root:
```env
AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
PRIVATE_KEY=0x_YOUR_DEVELOPER_ORACLE_PRIVATE_KEY
ORACLE_ADDRESS=0x_YOUR_ORACLE_WALLET_ADDRESS
```

---

### 2. Smart Contract Deployment

To deploy contracts to the Polygon Amoy Testnet:
```bash
npx hardhat run scripts/deploy.js --network amoy
```
This updates `deployed_addresses.json` with the deployed contract addresses automatically.

---

### 3. Running the Backend Oracle Server

The backend uvicorn server runs the oracle settlement endpoints:
```bash
# Activate virtual environment
source .venv/bin/activate

# Run FastAPI server
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

---

### 4. Running the Frontend Dev Server

To run the React dashboard locally:
```bash
cd frontend
npm run dev
```
Open [http://localhost:8080](http://localhost:8080) in your browser.

---

## 💳 Polygon Amoy Testnet POL Faucets

To list or buy energy, you need testnet **POL** (Polygon Gas tokens). Get free tokens here:
- **Alchemy Faucet**: [alchemy.com/faucets/polygon-amoy](https://www.alchemy.com/faucets/polygon-amoy)
- **Official Polygon Faucet**: [faucet.polygon.technology](https://faucet.polygon.technology/)
- **Chainlink Faucet**: [faucets.chain.link/polygon-amoy](https://faucets.chain.link/polygon-amoy)

---

## 📝 User Testing Guide

1. **Log In**: Use user `seller_pro` or `buyer_eco` with password `password123`.
2. **Connect Wallet**: Click **"Connect Wallet"**. The app will automatically prompt MetaMask to switch/add the **Polygon Amoy Testnet** (Chain ID `80002`).
3. **Mint Credits (Seller)**: Go to the **Contracts** tab and mint simulated energy generation to receive GreenCoins (**GRN**).
4. **List Energy (Seller)**: Under **Quick Trade**, go to **Sell Energy**, enter amount & price, and click **"List Energy for Sale"**. Approve the spend and list transactions in MetaMask.
5. **Purchase Energy (Buyer)**: Log in as `buyer_eco`. Switch your MetaMask wallet in the Navbar `(Switch)` to the buyer's account. Go to **Quick Trade** -> **Buy Energy**, select the seller listing, and click **"Purchase Energy"** to deposit MATIC/POL to the escrow contract.
6. **Settle Trade**: Click **"Simulate Delivery"** in the Marketplace panel at the bottom to trigger the Oracle API to verify physical transfer and release payments.
