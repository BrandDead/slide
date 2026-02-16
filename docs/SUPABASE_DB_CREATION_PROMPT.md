# SUPABASE AI ASSISTANT - DATABASE CREATION PROMPT
## Copy/Paste This Entire Prompt to Supabase AI

---

## PROJECT OVERVIEW

I'm building **DEALT/SLIDE**, an 18+ multiplayer urban warfare RPG mobile game. I need you to create a complete PostgreSQL database schema with all tables, relationships, indexes, RLS policies, triggers, and seed data.

## GAME DESCRIPTION

Players build criminal empires by:
1. **Dealing drugs** (DEALT mode) - Tinder-style swipe mechanics to serve customers
2. **Territory warfare** (SLIDE mode) - Battleship-style grid combat for turf control
3. **Drive-by shooting** (FPS mode) - Parallax side-scroller shooter
4. **Drug crafting** (Alchemy Lab) - Little Alchemy-style combination crafting
5. **Gang management** - Recruit, train, and manage crew members
6. **Real-world territory** - Claim actual city addresses (future feature, design for it)

## CORE ENTITIES NEEDED

### 1. PROFILES (extends auth.users)
```
- id (UUID, references auth.users)
- username (unique, 3-32 chars)
- display_name
- avatar_url
- gang_name, gang_tag (e.g., "[OGK]")
- city_region (enum: nyc, la, miami, chicago, detroit, new_orleans, atlanta, houston)
- cash (bigint, default 1000)
- bank (bigint, default 0)
- reputation (int)
- heat_level (0-100, police attention)
- respect_points
- level (1+), xp
- blocks_owned, members_count, total_deals, total_kills, raids_won, raids_lost (denormalized counters)
- status (enum: active, suspended, banned)
- is_online, is_premium
- settings (jsonb for preferences)
- timestamps
```

### 2. BLOCKS (Territory)
```
- id (UUID)
- address, city, state, zip_code
- region (enum, same as profiles)
- location (geography point for PostGIS - ENABLE POSTGIS)
- bounds (geography polygon)
- owner_id (references profiles, nullable)
- claimed_at
- status (enum: unclaimed, claimed, contested, locked)
- traffic_value (0-100, determines income potential)
- base_income, income_multiplier
- defense_level (1-10)
- trap_count, camera_count
- is_contested, attacker_id, combat_started_at
- block_heat (0-100)
- last_raid_at, police_presence
- asset_hash (for caching generated images)
- satellite_image_url, generated_building_url
- timestamps
```

### 3. GANG_MEMBERS
```
- id (UUID)
- owner_id (references profiles, CASCADE delete)
- name, nickname, avatar_url
- role (enum: soldier, lieutenant, dealer, enforcer, chemist, driver)
- status (enum: active, injured, arrested, dead, defected)
- assigned_block_id (references blocks)
- loyalty (0-100), morale (0-100), experience
- accuracy, toughness, speed, stealth (all 0-100)
- weapon_id, weapon_name, weapon_accuracy_bonus, armor_rating
- weekly_salary, total_earnings, last_paid_at
- kills, deaths, deals_completed
- skills (jsonb array)
- skill_points
- health (0-100)
- injured_until, arrested_until (timestamps)
- recruited_at, updated_at
```

### 4. DRUGS
```
- id (UUID)
- name (unique), street_name, description, icon_url
- rarity (enum: common, uncommon, rare, legendary, mythic)
- base_price (int)
- profit_multiplier, heat_multiplier (decimals)
- addiction_rate (0-100)
- is_craftable (boolean)
- craft_time_minutes
- craft_ingredients (jsonb)
- available_regions (array of region enum)
```

### 5. INVENTORY
```
- id (UUID)
- owner_id (references profiles, CASCADE)
- drug_id (references drugs)
- quantity (int > 0)
- quality (0-100, affects sale price)
- acquired_at, acquired_via, unit_cost
- UNIQUE(owner_id, drug_id, quality)
```

### 6. RECIPES (Alchemy crafting)
```
- id (UUID)
- result_drug_id (references drugs)
- result_quantity, result_quality_bonus
- ingredients (jsonb: [{drug_id, quantity}])
- required_level, required_chemist_skill
- craft_time_seconds, base_success_rate (0-100)
- xp_reward
- is_discovered_by_default
- discovery_hint
```

### 7. PLAYER_RECIPES
```
- id (UUID)
- player_id (references profiles, CASCADE)
- recipe_id (references recipes)
- discovered_at, times_crafted
- UNIQUE(player_id, recipe_id)
```

### 8. TRANSACTIONS (Economy ledger)
```
- id (UUID)
- player_id (references profiles, CASCADE)
- type (enum: deal, theft, raid_gain, raid_loss, craft_cost, craft_gain, mission_reward, casino_win, casino_loss)
- amount (bigint, positive=gain, negative=loss)
- drug_id, block_id (references, nullable)
- client_type (enum: regular, addict, cop, snitch, rich_kid, gang_member, crackhead, karen, dealer, undercover)
- quantity, price_per_unit
- was_risky_deal (boolean)
- balance_after (bigint, for audit)
- created_at
- Generated columns: day_of_week, hour_of_day (for analytics)
```

### 9. COMBAT_LOGS
```
- id (UUID)
- attacker_id, defender_id (references profiles)
- block_id (references blocks)
- combat_type (enum: slide, driveby, raid, defense)
- outcome (enum: attacker_win, defender_win, draw, retreat, ongoing)
- attacker_units_start, defender_units_start
- attacker_units_lost, defender_units_lost
- cash_stolen (bigint), drugs_stolen (jsonb)
- xp_gained
- turns (jsonb array for replay)
- started_at, ended_at
- duration_seconds (generated)
```

### 10. MISSIONS
```
- id (UUID)
- title, description, icon_url
- required_level, required_reputation
- objectives (jsonb: [{type, target, description}])
- cash_reward, xp_reward, reputation_reward
- item_rewards (jsonb)
- time_limit_minutes (nullable)
- cooldown_hours
- is_daily, is_weekly (booleans)
- available_regions (array)
```

### 11. PLAYER_MISSIONS
```
- id (UUID)
- player_id (references profiles, CASCADE)
- mission_id (references missions)
- objectives_progress (jsonb, mirrors mission objectives with current values)
- is_completed
- started_at, completed_at, expires_at
- UNIQUE(player_id, mission_id)
```

### 12. NOTIFICATIONS
```
- id (UUID)
- player_id (references profiles, CASCADE)
- type (varchar: raid_incoming, deal_complete, member_arrested, etc.)
- title, message
- data (jsonb for context)
- is_read (boolean)
- created_at, expires_at
```

### 13. PRESENCE (Real-time online tracking)
```
- player_id (PRIMARY KEY, references profiles, CASCADE)
- is_online
- current_block_id (references blocks)
- current_game_mode (varchar: dealt, slide, alchemy, map, etc.)
- last_heartbeat, session_started
```

### 14. LEADERBOARDS (Denormalized for speed)
```
- id (UUID)
- player_id (references profiles, CASCADE)
- region (enum)
- period (varchar: daily, weekly, monthly, alltime)
- period_start (date)
- total_cash, total_deals, total_kills, blocks_captured, raids_won, reputation_earned
- rank (int)
- updated_at
- UNIQUE(player_id, region, period, period_start)
```

## REQUIRED FEATURES

### Enable Extensions
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
```

### Create All Enums First
- user_status, block_status, member_status, member_role
- drug_rarity, transaction_type, combat_type, combat_outcome
- client_type, city_region

### Indexes Needed
- Geospatial: `CREATE INDEX idx_blocks_location ON blocks USING GIST(location);`
- Foreign keys: owner_id on blocks, gang_members
- Status filters: block status, member status
- Time-based: transactions by created_at, combat_logs by started_at
- Leaderboard: region + period + rank

### Row Level Security (RLS)
Enable RLS on ALL tables. Policies:
- profiles: Anyone can SELECT, only owner can UPDATE own row
- blocks: Anyone can SELECT, only owner can UPDATE
- gang_members: Only owner can SELECT/INSERT/UPDATE/DELETE
- inventory: Only owner can access
- transactions: Only player can access their own
- combat_logs: Both attacker and defender can SELECT
- notifications: Only recipient can access
- player_missions, player_recipes: Only player can access

### Triggers Needed
1. **Auto-update updated_at** on profiles, blocks, gang_members
2. **Auto-create profile** when auth.users row is created (handle_new_user function)
3. **Update player cash** after transaction INSERT
4. **Update blocks_owned count** when block owner_id changes
5. **Update members_count** when gang_member is added/removed

### Seed Data Required

**Drugs (15 items):**
- Common: Cannabis/Loud ($20), Tobacco/Loosies ($5), Alcohol/Henny ($15)
- Uncommon: Cocaine/Soft ($80), MDMA/Molly ($60), LSD/Acid ($40), Xanax/Bars ($50), Percocet/Percs ($70)
- Rare (craftable): Crack/Hard ($150), Meth/Ice ($180), Fentanyl/Fetty ($200), PCP/Angel Dust ($120)
- Legendary (craftable): Purple Drank/Lean ($300), Speedball ($400)
- Mythic (craftable): Blue Magic ($1000)

**Starter Missions (6 items):**
- First Blood: Complete 1 deal ($500, 100xp)
- Corner Boy: Complete 10 deals ($2000, 300xp)
- Block Captain: Claim 1 block ($5000, 500xp)
- Squad Up: Recruit 1 member ($1000, 200xp)
- Chemistry 101: Craft 1 item ($3000, 400xp)
- Drive-By Initiation: Win 1 combat ($4000, 500xp)

### Enable Realtime
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE combat_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE presence;
```

## OUTPUT FORMAT

Please generate:
1. Complete SQL schema with all CREATE TABLE statements
2. All enum types
3. All indexes
4. All RLS policies
5. All functions and triggers
6. All seed data INSERT statements
7. Realtime publication setup

Make sure everything is in the correct order (enums before tables, tables before foreign keys, etc.).

## CONSTRAINTS

- Use UUID for all primary keys with uuid_generate_v4()
- Use TIMESTAMPTZ for all timestamps with DEFAULT NOW()
- Use appropriate CHECK constraints (0-100 ranges, positive values)
- Use CASCADE on foreign key deletes where appropriate
- Add helpful comments on complex columns

Generate the complete SQL now.
