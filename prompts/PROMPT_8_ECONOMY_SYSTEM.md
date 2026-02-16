# ECONOMY & TRANSACTION SYSTEM - DEALT/SLIDE
## Assign to: deepseek-v3.1:671b-cloud

---

## PROJECT CONTEXT

DEALT/SLIDE is an 18+ multiplayer urban warfare RPG. The economy system handles all monetary transactions including drug dealing profits, territory income, salaries, crafting costs, and casino winnings.

## TECH STACK
- React 18 + TypeScript
- Zustand for state management
- Supabase (PostgreSQL) for persistence
- Framer Motion for animations

## DATABASE TABLES (Already Created)

```sql
-- profiles table has:
cash BIGINT DEFAULT 1000
bank BIGINT DEFAULT 0
dirty_money BIGINT DEFAULT 0

-- transactions table:
id, player_id, type, amount, balance_after, drug_id, block_id, 
member_id, client_type, quantity, price_per_unit, was_risky_deal,
description, metadata, created_at
```

## ECONOMY RULES

### Income Sources
| Source | Frequency | Calculation |
|--------|-----------|-------------|
| Drug Deals | Per transaction | price × quantity × quality_bonus |
| Block Income | Every 15 min | base_income × traffic_value × (1 - heat/100) × dealer_count |
| Raid Loot | Per combat win | defender_cash × 0.2 + random(100-500) |
| Mission Rewards | On completion | Fixed amount per mission |
| Casino Winnings | Per game | Varies by game type |

### Expense Types
| Expense | Trigger | Calculation |
|---------|---------|-------------|
| Member Salaries | Weekly | sum(member.weekly_salary) |
| Crafting Costs | Per craft | ingredient_costs + lab_fee |
| Bribes | Manual | heat_reduction × 100 |
| Hospital | Member injured | 500 + (injury_severity × 200) |
| Bail | Member arrested | 1000 + (member_level × 500) |
| Block Upgrades | Manual | upgrade_type × defense_level × 1000 |

### Heat Effects on Income
```typescript
function calculateHeatPenalty(heat: number): number {
  if (heat <= 25) return 0;        // No penalty
  if (heat <= 50) return 0.10;     // 10% reduction
  if (heat <= 75) return 0.25;     // 25% reduction
  return 0.50;                      // 50% reduction
}
```

### Dirty Money System
- All drug profits go to `dirty_money` first
- Must be "laundered" to move to `cash`
- Laundering options:
  - Casino (slow, 5% fee)
  - Fake business (medium, 10% fee)
  - Direct transfer (fast, 20% fee)

---

## REQUIRED COMPONENTS

### 1. economyStore.ts (Zustand)

```typescript
interface EconomyState {
  // Balances
  cash: number;
  bank: number;
  dirtyMoney: number;
  
  // Rates
  incomeRate: number;        // $/hour from blocks
  expenseRate: number;       // $/week from salaries
  
  // Pending
  pendingIncome: number;     // Accumulated but not collected
  lastIncomeCollect: Date;
  
  // Transactions
  recentTransactions: Transaction[];
  
  // Loading states
  isLoading: boolean;
  error: string | null;
}

interface EconomyActions {
  // Balance operations
  addCash: (amount: number, type: TransactionType, metadata?: any) => Promise<void>;
  spendCash: (amount: number, type: TransactionType, metadata?: any) => Promise<boolean>;
  
  // Banking
  depositToBank: (amount: number) => Promise<void>;
  withdrawFromBank: (amount: number) => Promise<void>;
  
  // Dirty money
  launderMoney: (amount: number, method: 'casino' | 'business' | 'direct') => Promise<void>;
  
  // Income
  collectBlockIncome: () => Promise<number>;
  calculateIncomeRate: () => number;
  
  // Expenses
  paySalaries: () => Promise<void>;
  payBribe: (amount: number) => Promise<void>;
  payHospital: (memberId: string) => Promise<void>;
  payBail: (memberId: string) => Promise<void>;
  
  // Transactions
  getTransactionHistory: (limit?: number, type?: TransactionType) => Promise<Transaction[]>;
  
  // Sync
  syncWithServer: () => Promise<void>;
  
  // Utils
  formatCurrency: (amount: number) => string;
  canAfford: (amount: number) => boolean;
}
```

### 2. economyService.ts

```typescript
// API calls to Supabase
class EconomyService {
  async getBalance(userId: string): Promise<{cash: number, bank: number, dirty: number}>;
  async recordTransaction(tx: TransactionInput): Promise<Transaction>;
  async getTransactions(userId: string, options: QueryOptions): Promise<Transaction[]>;
  async calculateBlockIncome(userId: string): Promise<number>;
  async processIncome(userId: string): Promise<void>;
  async transferFunds(userId: string, amount: number, direction: 'to_bank' | 'from_bank'): Promise<void>;
}
```

### 3. EconomyDashboard.tsx

Full-screen dashboard showing:
- **Cash Counter** (animated rolling numbers)
- **Bank Balance** with deposit/withdraw buttons
- **Dirty Money** with launder options
- **Income Rate** ($/hour)
- **Expense Rate** ($/week)
- **Net Worth** calculation
- **Quick Actions** (collect income, pay salaries)

```tsx
// Component structure
<EconomyDashboard>
  <BalanceHeader>
    <CashDisplay value={cash} />
    <BankDisplay value={bank} />
    <DirtyMoneyDisplay value={dirtyMoney} />
  </BalanceHeader>
  
  <RatesSection>
    <IncomeRate rate={incomeRate} />
    <ExpenseRate rate={expenseRate} />
    <NetWorthCard total={cash + bank + dirtyMoney} />
  </RatesSection>
  
  <QuickActions>
    <CollectIncomeButton pending={pendingIncome} />
    <PaySalariesButton due={salariesDue} />
    <LaunderMoneyModal />
    <TransferModal />
  </QuickActions>
  
  <TransactionHistory transactions={recent} />
</EconomyDashboard>
```

### 4. TransactionHistory.tsx

Scrollable list of transactions with:
- Filter by type (income/expense/transfer)
- Group by day
- Color coding (green = income, red = expense)
- Transaction details on tap

### 5. CashCounter.tsx

Animated counter that:
- Rolls numbers up/down smoothly
- Flashes green on income
- Flashes red on expense
- Shows +/- delta briefly

### 6. LaunderMoneyModal.tsx

Modal for converting dirty money:
- Slider to select amount
- Method selection with fee display
- Confirmation with final amount
- Progress animation

---

## STYLING SPECIFICATIONS

Use the established iOS dark theme:

```typescript
const Colors = {
  background: '#0A0A0A',
  surface: '#1A1A1A',
  card: '#2A2A2A',
  primary: '#00D4FF',      // Cyan
  secondary: '#FF00FF',    // Magenta
  success: '#00FF88',      // Green (income)
  error: '#FF4444',        // Red (expense)
  warning: '#FFD700',      // Gold (dirty money)
  text: '#FFFFFF',
  textSecondary: '#888888',
};
```

### Cash Display Style
```css
.cash-display {
  font-family: 'SF Mono', monospace;
  font-size: 48px;
  font-weight: bold;
  color: #00FF88;
  text-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
}

.cash-delta {
  position: absolute;
  animation: floatUp 1s ease-out forwards;
  color: #00FF88; /* or #FF4444 for negative */
}

@keyframes floatUp {
  0% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-30px); }
}
```

---

## BACKGROUND JOBS

### Income Generation (Every 15 minutes)

```typescript
// Supabase Edge Function or Cron Job
async function generateBlockIncome() {
  // Get all owned blocks with active dealers
  const { data: blocks } = await supabase
    .from('blocks')
    .select(`
      id, owner_id, base_income, traffic_value, block_heat,
      gang_members!inner(id, role)
    `)
    .not('owner_id', 'is', null)
    .eq('gang_members.role', 'dealer')
    .eq('gang_members.status', 'active');

  for (const block of blocks) {
    const dealerCount = block.gang_members.length;
    const heatPenalty = calculateHeatPenalty(block.block_heat);
    
    const income = Math.floor(
      block.base_income * 
      (block.traffic_value / 100) * 
      (1 - heatPenalty) * 
      dealerCount
    );
    
    // Add to dirty money (drug income is dirty)
    await supabase
      .from('profiles')
      .update({ dirty_money: supabase.raw(`dirty_money + ${income}`) })
      .eq('id', block.owner_id);
    
    // Record transaction
    await supabase.from('transactions').insert({
      player_id: block.owner_id,
      type: 'block_income',
      amount: income,
      block_id: block.id,
      description: `Block income from ${dealerCount} dealer(s)`
    });
  }
}
```

### Salary Payment (Weekly)

```typescript
async function paySalaries() {
  const { data: players } = await supabase
    .from('profiles')
    .select('id, cash');

  for (const player of players) {
    // Get total salaries owed
    const { data: members } = await supabase
      .from('gang_members')
      .select('id, name, weekly_salary')
      .eq('owner_id', player.id)
      .eq('status', 'active');

    const totalSalary = members.reduce((sum, m) => sum + m.weekly_salary, 0);
    
    if (player.cash >= totalSalary) {
      // Pay salaries
      await supabase
        .from('profiles')
        .update({ cash: player.cash - totalSalary })
        .eq('id', player.id);
      
      // Update last_paid_at for all members
      await supabase
        .from('gang_members')
        .update({ last_paid_at: new Date().toISOString() })
        .eq('owner_id', player.id);
      
      // Record transaction
      await supabase.from('transactions').insert({
        player_id: player.id,
        type: 'salary_payment',
        amount: -totalSalary,
        description: `Weekly salary for ${members.length} member(s)`
      });
    } else {
      // Can't afford - trigger morale penalty
      await supabase
        .from('gang_members')
        .update({ 
          morale: supabase.raw('GREATEST(0, morale - 10)'),
          loyalty: supabase.raw('GREATEST(0, loyalty - 5)')
        })
        .eq('owner_id', player.id);
      
      // Send notification
      await supabase.from('notifications').insert({
        user_id: player.id,
        type: 'salary_missed',
        title: 'Payroll Failed',
        message: `Couldn't pay $${totalSalary} in salaries. Crew morale is dropping!`
      });
    }
  }
}
```

---

## DELIVERABLES

1. **src/stores/economyStore.ts** - Complete Zustand store
2. **src/services/economyService.ts** - Supabase API service
3. **src/components/economy/EconomyDashboard.tsx** - Main dashboard
4. **src/components/economy/TransactionHistory.tsx** - Transaction list
5. **src/components/economy/CashCounter.tsx** - Animated counter
6. **src/components/economy/LaunderMoneyModal.tsx** - Money laundering UI
7. **src/components/economy/TransferModal.tsx** - Bank transfer UI
8. **src/components/economy/TransactionRow.tsx** - Single transaction item
9. **src/hooks/useEconomy.ts** - Custom hook for economy access
10. **src/types/economy.types.ts** - Type definitions
11. **supabase/functions/generate-income/index.ts** - Income generation job
12. **supabase/functions/pay-salaries/index.ts** - Salary payment job

---

## INTEGRATION NOTES

The economy system integrates with:

1. **DEALT Mode**: Drug deals call `economyStore.addCash()` with type 'deal_profit'
2. **SLIDE Mode**: Combat wins/losses update balances
3. **Alchemy**: Crafting costs deducted via `economyStore.spendCash()`
4. **Gang Management**: Salaries auto-deducted weekly
5. **Territory**: Block income accumulated and collected

```typescript
// Example integration in DEALT mode
const completeDeal = async (deal: Deal) => {
  const profit = deal.price * deal.quantity;
  
  await economyStore.addCash(profit, 'deal_profit', {
    drug_id: deal.drug_id,
    client_type: deal.client_type,
    quantity: deal.quantity,
    price_per_unit: deal.price
  });
  
  // Also update heat
  await heatStore.addHeat(deal.heat_generated);
};
```

Generate all components with complete implementations and the iOS dark mode styling.
