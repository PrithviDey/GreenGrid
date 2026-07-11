import time
import math
import random
import urllib.request
import urllib.error
import json
import argparse
import sys

# ANSI Escape Codes for Rich Terminal Styling
GREEN = "\033[92m"
CYAN = "\033[96m"
YELLOW = "\033[93m"
RED = "\033[91m"
RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"

DEFAULT_ADDRESS = "0x2D00199a2d5cFFd5702457F50aac823a28BE05dC"
BACKEND_URL = "http://127.0.0.1:8000"

def get_consumption(hour: int) -> float:
    # Typical residential load curve:
    # Morning peak (7 AM - 9 AM), evening peak (6 PM - 9 PM), low at night and midday
    if 7 <= hour <= 9:
        base = 3.5
    elif 18 <= hour <= 21:
        base = 5.0
    elif 10 <= hour <= 16:
        base = 1.8
    else:
        base = 0.8
    
    # Add small random noise (-0.25 to +0.25 kWh)
    return max(0.2, base + random.uniform(-0.25, 0.25))

def get_generation(hour: int) -> float:
    # Solar generation curve (peaking around noon, 0 at night)
    if 6 <= hour <= 18:
        # Standard sine wave peak representing daylight hours
        angle = math.pi * (hour - 6) / 12
        base = 8.5 * math.sin(angle)
        
        # Simulate slight cloud cover fluctuation
        cloud_factor = random.choice([1.0, 1.0, 1.0, 0.95, 0.85, 0.60])
        return max(0.0, base * cloud_factor)
    return 0.0

def report_telemetry(to_address: str, amount_kwh: float):
    url = f"{BACKEND_URL}/mint"
    data = json.dumps({
        "to_address": to_address,
        "amount_kwh": round(amount_kwh, 2)
    }).encode("utf-8")
    
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req) as res:
            response_body = res.read().decode("utf-8")
            return json.loads(response_body)
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        try:
            err_json = json.loads(error_body)
            msg = err_json.get("detail", error_body)
        except Exception:
            msg = error_body
        raise Exception(f"HTTP {e.code}: {msg}")
    except urllib.error.URLError as e:
        raise Exception(f"Connection failed: {e.reason}")

def main():
    parser = argparse.ArgumentParser(description="GreenGrid IoT Smart Meter Simulator")
    parser.add_argument(
        "--address",
        type=str,
        default=DEFAULT_ADDRESS,
        help=f"MetaMask wallet address to receive minted GreenCoins (default: {DEFAULT_ADDRESS})"
    )
    parser.add_argument(
        "--speed",
        type=float,
        default=5.0,
        help="Simulation speed in seconds per hour (default: 5.0s)"
    )
    args = parser.parse_args()

    target_address = args.address
    seconds_per_hour = args.speed
    
    print(f"\n{BOLD}{GREEN}===================================================={RESET}")
    print(f"{BOLD}{GREEN}      GreenGrid Smart Meter IoT Simulator Active    {RESET}")
    print(f"{BOLD}{GREEN}===================================================={RESET}")
    print(f"{DIM}Target Wallet Address:{RESET} {BOLD}{CYAN}{target_address}{RESET}")
    print(f"{DIM}FastAPI Backend URL:  {RESET} {BOLD}{BACKEND_URL}{RESET}")
    print(f"{DIM}Simulation Speed:     {RESET} 1 hour = {seconds_per_hour}s real-time")
    print(f"{GREEN}----------------------------------------------------{RESET}\n")
    
    hour = 6  # Start at sunrise (6:00 AM)
    cumulative_excess = 0.0
    cumulative_minted_tokens = 0.0
    
    while True:
        # 1. Format Time String
        ampm = "AM" if hour < 12 else "PM"
        display_hour = hour if hour <= 12 else hour - 12
        if display_hour == 0:
            display_hour = 12
        time_str = f"{display_hour:02d}:00 {ampm}"
        
        # 2. Simulate Generation and Consumption
        generation = get_generation(hour)
        consumption = get_consumption(hour)
        
        # 3. Calculate Surplus/Deficit
        surplus = generation - consumption
        excess = max(0.0, surplus)
        
        # 4. Display Stats
        print(f"[{BOLD}{YELLOW}{time_str}{RESET}]", end=" ")
        
        if excess > 0:
            print(f"{GREEN}☀ GENERATING SURPLUS{RESET}")
            status_color = GREEN
            status_text = f"+{excess:.2f} kWh (Excess)"
        else:
            print(f"{CYAN}🌑 CONSUMING GRID   {RESET}")
            status_color = CYAN
            status_text = f"{surplus:.2f} kWh (Grid)"
            
        print(f"   ├─ Solar Generation:  {BOLD}{generation:.2f} kWh{RESET}")
        print(f"   ├─ Household Load:    {BOLD}{consumption:.2f} kWh{RESET}")
        print(f"   └─ Net Flow:          {status_color}{status_text}{RESET}")
        
        # 5. Report Telemetry if there's surplus
        if excess > 0:
            print(f"   {DIM}⚡ Logging telemetry with Oracle backend...{RESET}", end="", flush=True)
            try:
                tx_info = report_telemetry(target_address, excess)
                cumulative_excess += excess
                cumulative_minted_tokens += excess
                print(f"\r   {GREEN}✔ Oracle Minted: +{excess:.2f} GRN tokens on-chain{RESET} ({tx_info['transactionHash'][:10]}...)")
            except Exception as e:
                print(f"\r   {RED}❌ Oracle Mint Failed: {e}{RESET}")
        
        print(f"   {DIM}📈 Lifetime: {cumulative_excess:.2f} kWh Exported | Total Balance: {cumulative_minted_tokens:.2f} GRN{RESET}")
        print(f"{DIM}----------------------------------------------------{RESET}")
        
        # 6. Increment hour and sleep
        hour = (hour + 1) % 24
        time.sleep(seconds_per_hour)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{YELLOW}Smart Meter simulation terminated.{RESET}")
        sys.exit(0)
