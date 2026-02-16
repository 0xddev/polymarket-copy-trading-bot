# Polymarket Copy Trading Bot - Detailed Workflow

## 📋 Overview

This document explains the complete workflow of the Polymarket Copy Trading Bot, from startup to trade execution.

---

## 🚀 Phase 1: Startup & Initialization

### Step 1.1: Application Start
```
npm start
  ↓
src/index.ts → main()
```

### Step 1.2: Database Connection
- Connects to MongoDB using `MONGO_URI`
- Creates collections for each trader:
  - `user_activities_{traderAddress}` - Stores trade history
  - `user_positions_{traderAddress}` - Stores current positions

### Step 1.3: Health Check
- Verifies MongoDB connection
- Checks RPC endpoint connectivity
- Validates wallet balance (USDC)
- Tests Polymarket API access
- Displays configuration summary

### Step 1.4: CLOB Client Initialization
- Creates Polymarket CLOB client
- Authenticates with API key
- Sets up wallet signing (using `PRIVATE_KEY` and `PROXY_WALLET`)

### Step 1.5: Service Startup
Two services start in parallel:
1. **Trade Monitor** - Watches for new trades
2. **Trade Executor** - Executes detected trades

---

## 👀 Phase 2: Trade Monitoring (tradeMonitor.ts)

### Step 2.1: Initialization (`init()`)
```
1. Count existing trades in database for each trader
2. Fetch YOUR positions (PROXY_WALLET)
   - Calculate your P&L
   - Show top 5 positions
3. Fetch TRADER positions (USER_ADDRESSES)
   - Calculate their P&L
   - Show top 3 positions per trader
4. Display summary dashboard
```

### Step 2.2: First Run Protection
```
If (first run):
  - Mark ALL existing trades as processed
  - Set: bot = true, botExcutedTime = 999
  - Prevents copying old historical trades
```

### Step 2.3: RTDS WebSocket Connection
```
1. Connect to: wss://ws-live-data.polymarket.com
2. Subscribe to 'activity' topic, type 'trades'
3. Listen for real-time trade messages
```

### Step 2.4: Real-Time Trade Detection
```
WebSocket receives message:
  ↓
Check message format:
  - topic === 'activity'
  - type === 'trades'
  - payload exists
  ↓
Extract trader address:
  - activity.proxyWallet
  - activity.wallet
  - activity.user
  - activity.address
  ↓
Filter by USER_ADDRESSES:
  - Normalize to lowercase
  - Check if in monitoring list
  ↓
If match → processTradeActivity()
```

### Step 2.5: Trade Processing (`processTradeActivity()`)
```
1. Check trade age:
   - Skip if older than TOO_OLD_TIMESTAMP hours
   
2. Duplicate check:
   - Query database by transactionHash
   - If exists → skip (already processed)
   
3. Save new trade:
   - Create UserActivity document
   - Set: bot = false, botExcutedTime = 0
   - Store all trade details:
     * asset, conditionId, side (BUY/SELL)
     * price, size, usdcSize
     * transactionHash (for duplicate detection)
     * market info (slug, title, icon, etc.)
   
4. Log detection
```

### Step 2.6: Position Updates (Every 30 seconds)
```
1. For each trader address:
   - Fetch positions from Polymarket API
   - Update database with latest position data
   - Calculate P&L, current value, etc.
```

---

## ⚡ Phase 3: Trade Execution (tradeExecutor.ts)

### Step 3.1: Continuous Monitoring Loop
```
Every 300ms:
  1. Query database for unprocessed trades
  2. Filter: bot = false AND botExcutedTime = 0
  3. Process found trades
```

### Step 3.2: Read Unprocessed Trades (`readTempTrades()`)
```
For each trader:
  - Query UserActivity collection
  - Find: type = 'TRADE', bot = false, botExcutedTime = 0
  - Return array of trades with userAddress
```

### Step 3.3: Trade Aggregation (Optional)
```
If TRADE_AGGREGATION_ENABLED = true:
  
  For each trade:
    If BUY and usdcSize < $1.00:
      → Add to aggregation buffer
      → Wait for more trades in same market
    Else:
      → Execute immediately
      
  Check buffer every loop:
    If aggregation window passed (default 5 min):
      → Combine all trades in buffer
      → Execute as single larger order
```

### Step 3.4: Execute Trade (`doTrading()` or `doAggregatedTrading()`)
```
For each trade:
  1. Mark as processing:
     - Set botExcutedTime = 1 (prevents duplicate processing)
  
  2. Fetch current positions:
     - Your positions (PROXY_WALLET)
     - Trader positions (trader address)
     - Find matching position by conditionId
     
  3. Get balances:
     - Your USDC balance
     - Trader's portfolio value (sum of position values)
     
  4. Determine trade type:
     - BUY: Trader is buying
     - SELL: Trader is selling
     - MERGE: Special case for position merging
     
  5. Call postOrder() with all context
```

---

## 💰 Phase 4: Order Execution (postOrder.ts)

### Step 4.1: Determine Strategy
```
Based on trade side:
  - BUY → Calculate order size
  - SELL → Calculate sell amount
  - MERGE → Merge position
```

### Step 4.2: BUY Strategy

#### 4.2.1: Calculate Order Size
```
1. Get copy strategy config:
   - PERCENTAGE: Copy X% of trader's trade
   - FIXED: Copy fixed USD amount
   - ADAPTIVE: Adjust based on trade size
   
2. Apply tiered multipliers (if configured):
   - Small trades (<$X) → multiplier 1.0x
   - Medium trades ($X-$Y) → multiplier 1.5x
   - Large trades (>$Y) → multiplier 2.0x
   
3. Calculate final amount:
   - Apply copy percentage/size
   - Apply multiplier
   - Check min/max limits
   - Check position limits
   - Check daily volume limits
   
4. Validate:
   - Must be >= $1.00 (minimum order size)
   - Must have sufficient balance
   - Must not exceed position limits
```

#### 4.2.2: Execute BUY Order
```
While remaining > 0 and retries < limit:
  1. Get order book for asset
  2. Find best ask (lowest price)
  3. Calculate order size:
     - Min(remaining, available in order book)
     - Ensure >= $1.00 minimum
  4. Check balance sufficient
  5. Create market order (FOK - Fill or Kill)
  6. Post order to Polymarket
  7. If success:
     - Update remaining amount
     - Track tokens bought
     - Update balance
  8. If failure:
     - Retry (up to RETRY_LIMIT)
     - Check for insufficient balance/allowance
     - Abort if funds issue
     
After completion:
  - Mark trade as processed: bot = true
  - Save myBoughtSize for future sell calculations
```

### Step 4.3: SELL Strategy

#### 4.3.1: Calculate Sell Amount
```
1. Check if you have position:
   - If no position → skip
   
2. Get tracked purchases:
   - Query previous BUY trades for this asset
   - Sum myBoughtSize values
   
3. Calculate sell percentage:
   - If trader sold entire position:
     → Sell 100% of your position
   - If trader sold partial:
     → Calculate: trader_sell_size / trader_position_before
     → Apply same percentage to your position
     
4. Apply multiplier (same as BUY):
   - Use tiered multipliers based on trader's order size
   
5. Calculate final sell amount:
   - baseSellSize = trackedTokens × sellPercentage
   - finalAmount = baseSellSize × multiplier
   - Cap to available position size
```

#### 4.3.2: Execute SELL Order
```
While remaining > 0 and retries < limit:
  1. Get order book for asset
  2. Find best bid (highest price)
  3. Calculate sell amount:
     - Min(remaining, available in order book)
     - Ensure >= 1.0 token minimum
  4. Create market order (FOK)
  5. Post order to Polymarket
  6. If success:
     - Update remaining amount
     - Track tokens sold
  7. If failure:
     - Retry (up to RETRY_LIMIT)
     
After completion:
  - Mark trade as processed: bot = true
  - Update purchase tracking:
    * If sold 100% → Clear all myBoughtSize
    * If partial → Reduce myBoughtSize proportionally
```

### Step 4.4: MERGE Strategy
```
1. Check if you have position
2. Get order book
3. Find best bid price
4. Sell entire position at best bid
5. Mark as processed
```

---

## 🔄 Phase 5: Continuous Operations

### Step 5.1: Trade Monitor Loop
```
While running:
  - Listen to WebSocket messages
  - Process incoming trades
  - Update positions every 30 seconds
  - Handle reconnections if WebSocket disconnects
```

### Step 5.2: Trade Executor Loop
```
While running:
  - Check database every 300ms
  - Process new trades
  - Handle aggregation buffer
  - Display waiting status
```

### Step 5.3: Error Handling
```
- Network errors → Retry with exponential backoff
- Insufficient balance → Mark trade, log warning
- Order failures → Retry up to RETRY_LIMIT
- WebSocket disconnects → Auto-reconnect (up to 10 attempts)
```

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    POLYMARKET RTDS                            │
│              (Real-Time Data Stream)                          │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        │ Trade messages
                        ↓
┌─────────────────────────────────────────────────────────────┐
│              Trade Monitor (tradeMonitor.ts)                 │
│  • WebSocket connection                                      │
│  • Filter by USER_ADDRESSES                                  │
│  • Check duplicates (transactionHash)                        │
│  • Save to MongoDB (bot=false, botExcutedTime=0)            │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        │ New trades in DB
                        ↓
┌─────────────────────────────────────────────────────────────┐
│              Trade Executor (tradeExecutor.ts)               │
│  • Query DB every 300ms                                      │
│  • Find: bot=false, botExcutedTime=0                        │
│  • Mark as processing (botExcutedTime=1)                    │
│  • Calculate order size                                      │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        │ Execute order
                        ↓
┌─────────────────────────────────────────────────────────────┐
│              Order Execution (postOrder.ts)                   │
│  • Get order book                                            │
│  • Calculate size/price                                      │
│  • Create signed order                                       │
│  • Post to Polymarket CLOB                                   │
│  • Mark as processed (bot=true)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 Key State Transitions

### Trade State Machine
```
NEW TRADE DETECTED
  ↓
bot = false, botExcutedTime = 0
  ↓
EXECUTOR PICKS UP
  ↓
botExcutedTime = 1 (processing)
  ↓
ORDER EXECUTED
  ↓
bot = true (completed)
```

### Database Collections
```
user_activities_{traderAddress}
  - All trades detected
  - Fields: bot, botExcutedTime, transactionHash, etc.

user_positions_{traderAddress}
  - Current positions
  - Updated every 30 seconds
```

---

## ⚙️ Configuration Variables

### Critical Settings
- `USER_ADDRESSES` - Traders to copy
- `PROXY_WALLET` - Your wallet address
- `PRIVATE_KEY` - Your wallet private key
- `COPY_STRATEGY` - PERCENTAGE, FIXED, or ADAPTIVE
- `COPY_SIZE` - Copy percentage or fixed amount
- `TRADE_MULTIPLIER` - Global multiplier (or tiered)
- `TRADE_AGGREGATION_ENABLED` - Enable/disable aggregation
- `FETCH_INTERVAL` - Not used (RTDS is real-time)
- `TOO_OLD_TIMESTAMP` - Skip trades older than X hours

---

## 🛡️ Safety Features

1. **Duplicate Prevention**: Uses `transactionHash` to prevent processing same trade twice
2. **First Run Protection**: Marks all historical trades as processed
3. **Age Filtering**: Skips trades older than configured threshold
4. **Balance Checks**: Validates sufficient funds before orders
5. **Minimum Order Size**: Enforces $1.00 minimum for BUY, 1.0 token for SELL
6. **Retry Limits**: Prevents infinite retry loops
7. **Error Handling**: Graceful degradation on failures
8. **Position Tracking**: Accurate tracking of purchases for sell calculations

---

## 📝 Logging & Monitoring

### What Gets Logged
- Trade detection events
- Order execution attempts
- Success/failure status
- Balance information
- Position updates
- Error messages
- Aggregation status

### How to Monitor
- Watch console output for real-time status
- Check MongoDB collections for trade history
- Use `npm run check-stats` for performance metrics
- Use `npm run check-activity` for recent activity

---

## 🔄 Reconnection Logic

### WebSocket Reconnection
```
Disconnect detected
  ↓
Wait 5 seconds (with exponential backoff)
  ↓
Attempt reconnect (up to 10 times)
  ↓
If successful → Resume monitoring
If failed → Log error, stop monitoring
```

---

This workflow ensures reliable, real-time copy trading with proper error handling and state management.








