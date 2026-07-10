# DEALT/SLIDE — Attack Mode Systems (Rewritten & Expanded)

---

# PART I — Rewritten Explanation

## 12. Block Attack: Robbery, Vandalism & Defense

### 12.1 Attack Mode Overview

When a player initiates an attack on an opposing player's block, they can send different member types to accomplish different objectives. An attack is not a single mini-game — it is a **multi-role operation** where the player assigns members to specific tasks:

| Member Role | Attack Objective | Behavior on Enemy Block |
|---|---|---|
| **Enforcer** | Rob dealers | Walks the block, targets dealers, steals money/product/jewelry, deals physical damage |
| **Shooter** | Eliminate defenders | Engages enemy shooters and enforcers in gunfire |
| **Recruit** | Vandalize the block | Sprays graffiti or gang signs on walls |
| **Driver** | Transport & getaway | Stays in the car; does not exit; vulnerable to counterattack and raids |

A single attack can include **multiple roles simultaneously** — for example, two enforcers rob dealers while a recruit vandalizes and a shooter provides cover fire.

---

### 12.2 Enforcer Robbery Mechanics

#### 12.2.1 Targeting Dealers

- When an enforcer arrives on an enemy block, they **walk up and down the block** seeking dealers
- The enforcer will approach the **nearest outdoor dealer** and initiate a robbery
- If the block has **no dealers** (all are indoors/in a trap house), the enforcer has nothing to rob and will either:
  - Attempt to break into a trap house (requires enforcer level check vs. trap house door upgrade — see Section C.1)
  - Leave the block empty-handed

#### 12.2.2 Robbery Combat

- The enforcer physically assaults the dealer, dealing damage with each hit
- **Damage dealt** scales with the enforcer's level
- If **multiple enforcers** target a single dealer, their damage stacks — increasing the likelihood of a hospital-worthy injury (20%+ damage in a single encounter)
- Each successful hit on the dealer has a chance to **knock product, cash, or jewelry** from them

#### 12.2.3 Loot from Robbery

| Loot Type | Details |
|---|---|
| **Cash** | Taken from the dealer's current on-hand cash (accumulated sales since last collection) |
| **Product** | Taken from the dealer's current stock (reduces their ability to continue selling) |
| **Jewelry** | A cosmetic/status item that some dealers carry — can be sold for cash or displayed as a trophy |

The amount of loot scales with:
- The enforcer's level (higher level = more efficient robbery)
- The dealer's current stock and cash on hand
- Whether the dealer is outdoor (full loot available) vs. trap house (reduced loot, requires door break)

#### 12.2.4 Robbery Outcome

| Outcome | Condition |
|---|---|
| Dealer robbed, no serious injury | Enforcer level >> dealer level, quick robbery |
| Dealer hospitalized | Multiple enforcers or high-level enforcer deals 20%+ damage |
| Dealer killed | Extreme case — enforcer level vastly exceeds dealer and critical hit occurs (low probability) |
| Robbery failed — enforcer driven off | Block defenders (shooters/enforcers) intervene and overpower the attacker |

---

### 12.3 Block Defense: Enforcer vs. Enforcer

#### 12.3.1 Enforcer Security Role

- If the defending player has **enforcers stationed on the block**, they act as **security**
- Defensive enforcers **patrol the block** and will intercept attacking enforcers

#### 12.3.2 Enforcer Combat Resolution

- When an attacking enforcer encounters a defending enforcer, they engage in **hand-to-hand/melee combat**
- The winner is determined by:
  - **Enforcer level** (primary factor)
  - **Health** (current health at time of encounter)
  - **Morale** (higher morale = small combat bonus)
- The **losing enforcer** takes damage — potentially hospital-worthy (20%+)
- A high-level enforcer can **kill** a much lower-level enforcer in a single encounter
- If the defending enforcer wins, the attacking enforcer is **driven off the block** and the robbery fails
- If the attacking enforcer wins, the defending enforcer is injured (or killed), and the attacker proceeds to rob the dealer

#### 12.3.3 Multiple Enforcer Scenarios

| Scenario | Resolution |
|---|---|
| 1 attacker vs. 1 defender | Level comparison determines winner; loser takes damage |
| 2 attackers vs. 1 defender | Defenders overwhelmed — first defender takes damage from both, likely hospitalized. Attackers proceed to dealers. |
| 1 attacker vs. 2 defenders | Attacker likely overpowered — takes damage from both defenders, likely driven off or hospitalized |
| Multiple vs. multiple | Sequential 1v1 encounters until one side is depleted |

---

### 12.4 Block Defense: Shooters Protecting Dealers

#### 12.4.1 Shooter Intervention

- If the defending player has **shooters stationed on the block**, they will **fire at attacking enforcers** from their positioned locations
- Shooters engage enforcers at range, dealing **gunfire damage** before the enforcer can reach the dealer
- The shooter's **accuracy and weapon caliber** determine how much damage they deal
- A sufficiently armed and leveled shooter can **eliminate an enforcer** before they reach the dealer

#### 12.4.2 Shooter vs. Shooter Combat

- If the attacking player also sends **shooters** to the block, they engage in **firefights** with the defending shooters
- This creates a **cover system**: while shooters are engaged in firefights, enforcers may have an easier path to the dealers
- The player must decide: send shooters to suppress defenders, or send more enforcers to rob faster?

---

### 12.5 Recruit Vandalism System

#### 12.5.1 Vandalism Mechanics

- Recruits sent to an enemy block during an attack can **vandalize** the block by spraying graffiti
- The player composing the attack can **type a custom message** that the recruit will "write" on the wall
- Messages can range from **disrespectful comments** to **gang signs/tags**
- The recruit **must remain on the block and uninterrupted** for the entire duration to complete the vandalism

#### 12.5.2 Vandalization Types & Duration

| Type | Duration | Visibility |
|---|---|---|
| **Small tag** (quick graffiti) | 15–30 seconds | Small, visible on block view |
| **Medium mural** | 45–75 seconds | Medium, covers a wall section |
| **Large mural** (full wall) | 90–180 seconds | Large, dominates the block's visual |
| **Gang sign** (logo/tag) | 30–60 seconds | Medium, displayed prominently |

#### 12.5.3 Vandalization Persistence

- If the recruit **completes the vandalism** without being stopped, the message **remains on the wall** for a set duration:
  - Small tag: 24 hours
  - Medium mural: 48 hours
  - Large mural: 72 hours
  - Gang sign: 48 hours
- During this time, **any player in the game** who views that block can see the graffiti
- The defending player can **clean the graffiti early** by sending a recruit to paint over it (takes half the original time)
- Graffiti cannot be cleaned during an active attack on the block

#### 12.5.4 Stopping Vandalism

- If a **defending shooter or enforcer** reaches the recruit before the vandalism is complete, the recruit is:
  - **Driven off** (if defender is low-level or recruit escapes)
  - **Injured/hospitalized** (if defender overpowers the recruit)
- The partially completed graffiti **does not persist** — only fully completed vandalism stays on the wall

#### 12.5.5 Recruits as Lookouts (Alert System)

Recruits serve a **dual purpose** on a block:

| Recruit Status | Function |
|---|---|
| **Stationed on own block** | Acts as a **lookout** — alerts the player when their block is under attack |
| **Sent to enemy block** | Acts as a **vandal** — sprays graffiti during an attack |

**Alert notification mechanics:**

- If the player has a **recruit stationed on their block** and an attack occurs, the player receives an **immediate notification**: *"Your dealer on [block address] is being attacked!"*
- If the player has **enforcers but no recruits** on the block, the enforcers will **defend automatically** but the player is **not notified** — the attack may go unnoticed until the player checks the block
- If the player has **no defenders and no recruits** on the block, the attack goes **completely unnoticed** — the player only discovers it when they check the block and find their dealer hospitalized, robbed, or their wall vandalized

This creates a critical strategic decision: **always station a recruit as a lookout** on high-value blocks, or risk losing dealers and product without warning.

---

### 12.6 Driver Vulnerability During Attack Missions

#### 12.6.1 Driver Behavior

- The **driver** stays in the car during the entire attack operation
- The driver **does not exit the vehicle** under any circumstances
- The driver's only role is to **transport members to the block** and **get everyone out safely**

#### 12.6.2 Car Attack Vulnerability

- If the defending player has **shooters on the block** who are not engaged with attacking shooters, they may **target the car**
- If the car takes sufficient damage:
  - **Windows shot out** — driver is exposed to gunfire (can be injured or killed)
  - **Tires shot** — car cannot flee; driver and all members are **stranded on the enemy block**
  - **Engine destroyed** — car is destroyed; driver may be killed; all members must flee on foot
- If the **driver is killed**, the car is **stolen by the defending gang** and added to their inventory

#### 12.6.3 Driver Escape During Raids

If an attack causes the block's heat to exceed the **raid threshold** (heat ≥ 100), police arrive at the block while the attack is in progress:

| Driver Level | Escape Chance |
|---|---|
| Level 1–2 (Novice) | 20% chance to escape |
| Level 3–5 (Skilled) | 50% chance to escape |
| Level 6–8 (Veteran) | 75% chance to escape |
| Level 9–10 (Elite) | 95% chance to escape |

**If the driver escapes:**
- All members in the car flee with whatever loot was acquired
- The car and all members return to the player's territory safely
- Heat is applied to all members who were on the block

**If the driver fails to escape:**
- The driver is **arrested** (goes to jail, gains a jail strike)
- All **loot acquired during the attack is confiscated**
- All **personal items** (weapons, jewelry) on members in the car are confiscated
- Members in the car may also be arrested (based on individual escape chances — lower-level members have lower escape odds)
- The **car is impounded** (lost permanently unless recovered through a future mission or purchased back)

---

### 12.7 Raid Interruption During Attack

#### 12.7.1 Heat Spike from Attacks

- Attacking an enemy block **generates heat** on that block
- If the attacking members are already hot, and the attack pushes the block's combined heat above 100, a **raid triggers while the attack is in progress**
- This creates a **three-way conflict**: attackers vs. defenders vs. police

#### 12.7.2 Three-Way Conflict Resolution

| Party | Behavior During Raid |
|---|---|
| **Police** | Target ALL armed members on the block (both attacker and defender shooters/enforcers) |
| **Attackers** | Must choose: fight police, flee to car, or flee on foot |
| **Defenders** | May choose to fight police (defending their block) or take cover inside trap house |

- Police will **prioritize shooters** (armed and dangerous) over enforcers and recruits
- If both attacker and defender shooters are on the block, police engage **both sides**
- This can inadvertently **help the attacker** — if police arrest or injure the defending shooters, the attacker's enforcers have a clearer path to the dealers

---

### 12.8 Forfeit / Retreat Mechanic

#### 12.8.1 Calling Members Inside

- The defending player can **call their members inside** (into the trap house) at any time during an attack or raid
- This is a **defensive retreat** — members who go inside are:
  - **Safe from arrest** (police cannot find them inside unless the trap house is breached)
  - **Safe from enforcers** (unless the enforcer breaks through the trap house door)
  - **Unable to defend the block** — dealers outside are left unprotected

#### 12.8.2 Forfeit Consequences

| Effect | Detail |
|---|---|
| **Members saved** | All members who retreat inside avoid arrest and injury |
| **Some product saved** | Indoor product stock is protected; outdoor dealer stock is lost to robbers |
| **Gang morale drops** | Retreating counts as a **forfeit** — all gang members lose morale |
| **Attacking gang morale rises** | The attacking gang gains morale from the successful intimidation |
| **Block reputation drops** | The block's defensive reputation decreases, making it more likely to be targeted again |
| **Graffiti vulnerability** | If the attacker had a recruit vandalizing, the retreat means the recruit completes the vandalism unopposed |

#### 12.8.3 Strategic Considerations

- **When to forfeit**: When the defending force is outmatched and the player would lose more from member injuries/arrests than from stolen product
- **When NOT to forfeit**: When the attacking force is weak (e.g., one low-level enforcer) and the defenders can win; forfeiting to a weak attack is a major morale hit for no good reason
- **Forfeit during raid**: If a raid triggers during an attack, forfeiting (calling members inside) saves them from police but still counts as a morale penalty — however, the morale penalty from a forfeit is **less than** the penalty from having members arrested

---

### 12.9 Attack Composition Strategy

The player must choose how to compose their attacking force:

| Composition | Strategy |
|---|---|
| **All enforcers** | Maximum robbery speed — grab as much product/cash as possible before defenders respond. Weak against block shooters. |
| **Enforcers + shooters** | Shooters suppress defenders while enforcers rob. Balanced but requires more members. |
| **All shooters** | Pure elimination — kill or injure all defenders, then rob at leisure. Slow robbery but thorough. |
| **Enforcers + recruit** | Rob and vandalize simultaneously. The graffiti serves as a taunt even if the robbery yields little. |
| **Single enforcer (hit-and-run)** | Send one high-level enforcer to rob quickly and leave. Low risk, low reward. |
| **Full assault (max members)** | Overwhelm the block with numbers. High reward but high heat — likely triggers a raid. |

---

---

# PART II — Game Design Additions & Expansions

> The following additions build on the attack mode mechanics described above. They introduce new strategic layers, counterplay options, and emergent gameplay scenarios.

---

## O. Jewelry & Status Items System

### O.1 Overview

The brain dump mentions that enforcers can steal **jewelry** from dealers. This system expands jewelry into a full status/economy mechanic.

### O.2 Jewelry Types

| Item | Cost | Effect | Notes |
|---|---|---|---|
| **Gold Chain** | $2,000 | +5 morale to the member wearing it | Visible on member avatar |
| **Diamond Chain** | $10,000 | +10 morale, +5% dealing bonus if worn by dealer | Prestige item |
| **Gold Watch** | $3,000 | +3 morale, dealer sells 5% faster | Practical + status |
| **Diamond Ring** | $8,000 | +8 morale, enforcer deals +5% robbery damage | Combat-oriented |
| **Platinum Grill** | $5,000 | +5 morale, shooter gains +3% accuracy | Intimidation factor |
| **Crown Pendant** | $25,000 | +15 morale to wearer, +3 morale to all members on same block | Gang leader flex |

### O.3 Jewelry as Loot

- When an enforcer robs a dealer, there is a **chance to steal jewelry** based on:
  - Enforcer level (higher = better at finding and grabbing valuables)
  - Dealer's equipped jewelry (must be wearing it to be stolen)
  - Random chance (some dealers hide jewelry; some don't)
- Stolen jewelry goes to the **attacking player's inventory** and can be:
  - **Equipped** on their own members (morale + stat bonuses)
  - **Sold** at a pawn shop for 50% of purchase value
  - **Displayed** in a trophy case (purely cosmetic, visible to other players who visit your profile)

### O.4 Jewelry Risk

- Jewelry is **visible** — a dealer wearing a diamond chain is a **bigger target** for robbery
- Wearing expensive jewelry **slightly increases heat** (flashy = attention)
- If a member is arrested while wearing jewelry, the jewelry is **confiscated** (lost permanently)
- If a member is hospitalized while wearing jewelry, the jewelry is **kept** (but the hospital bill increases slightly — "they saw the chain")

### O.5 Trophy Wall

- The player's profile has a **Trophy Wall** displaying:
  - Stolen jewelry from rival gangs (with the original owner's gang name tagged)
  - Graffiti photos captured from successful vandalism missions
  - Kill confirmations (name and gang of eliminated members)
- Other players can view your trophy wall — it serves as a **reputation display** and psychological warfare tool

---

## P. Block Alarm & Surveillance System

### P.1 Alarm Upgrades

Expanding on the trap house upgrade system, alarms can be installed **on the block** (not just the trap house):

| Upgrade | Cost | Effect |
|---|---|---|
| **Tripwire Alarm** | $1,000 | Notifies the player when any enemy member steps onto the block (one-time use, must be reset manually) |
| **Motion Sensor** | $3,000 | Persistent — notifies the player when any enemy member enters the block. Can be disabled by a high-level recruit (sabotage). |
| **Lookout Post** | $2,500 | Automatically stations a recruit NPC as a permanent lookout (doesn't take up a roster slot, but can be injured/killed during attacks) |
| **Police Scanner** | $5,000 | Detects incoming raids 30 seconds earlier than normal warning system — gives more time to call members inside |

### P.2 Alarm Sabotage

- A **recruit sent during an attack** can be assigned to **sabotage alarms** instead of vandalizing
- Sabotaging a motion sensor takes 10 seconds and disables it for the duration of the attack
- If the recruit is stopped before sabotage is complete, the alarm remains functional
- A high-level recruit sabotages faster; a low-level recruit takes longer and is more likely to be spotted

### P.3 Silent vs. Loud Attacks

| Attack Type | Condition | Alarm Behavior |
|---|---|---|
| **Silent attack** | All attacking members have **stealth** stat above a threshold | Block alarms do not trigger; lookout has reduced detection chance; heat gain is 50% lower |
| **Loud attack** | Any attacking member has low stealth, or gunfire breaks out | All alarms trigger immediately; full heat gain; lookout alerts player |

This creates a **stealth-based attack path** where high-stealth members can operate undetected — at the cost of sending your best stealth members into enemy territory (risk of loss if caught).

---

## Q. Block Morale & Intimidation System

### Q.1 Block Morale

Each block has a **Block Morale** stat (0–100) that is separate from individual member morale:

| Block Morale | Effect |
|---|---|
| 80–100 (Fortified) | Defenders fight with +10% effectiveness; dealers sell 10% faster (confidence) |
| 50–79 (Stable) | Normal gameplay |
| 20–49 (Shaken) | Dealers sell 15% slower (nervous); defenders fight with -5% effectiveness |
| 0–19 (Demoralized) | Dealers sell 30% slower; defenders may **flee** during attacks (20% chance per defender to abandon the block instead of fighting) |

### Q.2 What Affects Block Morale

| Event | Block Morale Change |
|---|---|
| Successful defense (attack repelled) | +15 |
| Graffiti/vandalism completed on the block | -10 |
| Dealer robbed on the block | -5 |
| Dealer hospitalized on the block | -10 |
| Defender killed on the block | -20 |
| Block taken by enemy | Reset to 50 (under new owner) |
| Member called inside (forfeit) | -15 |
| Police raid on the block | -20 |
| Trap house upgrade installed | +5 |
| High-morale members stationed | +1 per tick (passive recovery) |
| Rival graffiti cleaned | +5 |

### Q.3 Intimidation Mechanics

- When an attacking force is **visibly overwhelming** (e.g., 5 members vs. 1 defender), the block's **defenders may intimidate-flee** before combat begins
- Intimidation flee chance is based on:
  - Force ratio (attackers vs. defenders)
  - Average level difference
  - Block morale (low morale = higher flee chance)
  - Individual member nerve stat (low nerve = higher flee chance)
- Fleeing defenders **retreat inside** the trap house and the block is **temporarily undefended** — attackers have free access to dealers and walls for a limited window (60 seconds) before defenders regroup

---

## R. Escort & Convoy System

### R.1 Protecting Your Dealers

The brain dump mentions that a player can **send a shooter or enforcer to protect a dealer** that's being attacked. This expands into a full escort system:

- Players can **assign escorts** to specific dealers — a shooter or enforcer that is permanently paired with that dealer
- An escort **stays near the dealer** and **automatically defends** them during attacks
- Escorts **reduce robbery success** by 50% (the enforcer must deal with the escort before reaching the dealer)
- Escorts have their own health and can be injured/killed during defense

### R.2 Convoy Missions

When the player needs to **move product or cash between blocks** (e.g., restocking a dealer from a central supply), they must run a **convoy**:

- The player selects a **driver + escort members** to transport goods
- The convoy travels along a route — this is a **mini-game** where:
  - The player must avoid police patrols (based on route heat)
  - Rival gangs may **ambush** the convoy (especially if they have a rivalry with the player)
  - The player can choose a **safe route** (longer, lower risk) or a **fast route** (shorter, higher risk)
- If the convoy is **ambushed**, the escort members must defend the cargo in a combat mini-game
- If the convoy is **intercepted by police**, the driver's level determines escape chance (same as Section 12.6.3)
- **Losing a convoy** means losing all transported product/cash AND the escort members may be arrested/injured

### R.3 Product Distribution Network

| Storage Location | Capacity | Access |
|---|---|---|
| **Trap House (per block)** | 500 units | Only dealers on that block can access |
| **Central Stash (player's HQ block)** | 5,000 units | All blocks can request convoys from here |
| **Supplier pickup** | Unlimited | Must be transported via convoy to central stash |

This creates a **logistics layer** — the player can't just teleport product to dealers. High-traffic blocks need frequent convoys, which means more convoy missions, which means more risk.

---

## S. Retaliation & Revenge System Expansion

### S.1 Revenge Timer

- After an attack on the player's block, a **Revenge Window** opens (lasts 1 hour)
- During this window, the player can launch a **counterattack** on the attacking gang's block with:
  - 25% reduced car cost (free if the player's car was stolen in the original attack — "borrowed" from an ally)
  - +15% combat effectiveness for all members (angry = motivated)
  - The attacking gang **cannot call members inside** for the first 30 seconds of the counterattack (caught off guard)

### S.2 Grudge Tracking

- The game tracks a **Grudge History** between gangs:
  - Each attack, robbery, vandalism, and kill is logged
  - The player can review the full history of conflicts with any specific gang
  - A long-standing grudge (10+ interactions) unlocks a **Blood Feud** state:
    - All combat between the two gangs has +20% damage on both sides (mutually destructive)
    - Truces cost 3x normal amount
    - NPC gangs may take sides, refusing to deal with one of the feuding gangs

### S.3 Grief Reporting

- Graffiti messages written by recruits are **visible to all players**
- Messages that violate community guidelines can be **reported** by other players
- A reported message is **auto-removed** and the writing player receives a **warning**
- Repeated violations result in **graffiti privilege suspension** (recruits can only use pre-approved tag templates)

---

## T. Member Assignment & Block Layout (Tactical Map)

### T.1 Block Grid System

Each block has a **tactical grid** (8×4 or similar) where the player places members:

```
┌────┬────┬────┬────┬────┬────┬────┬────┐
│    │    │    │    │    │    │    │    │  ← Back wall (trap house entrance)
├────┼────┼────┼────┼────┼────┼────┼────┤
│    │    │    │    │    │    │    │    │  ← Mid-block (alley, cover)
├────┼────┼────┼────┼────┼────┼────┼────┤
│    │    │    │    │    │    │    │    │  ← Sidewalk (dealer zone)
├────┼────┼────┼────┼────┼────┼────┼────┤
│ 🚗 │    │    │    │    │    │    │    │  ← Street (car drop-off zone)
└────┴────┴────┴────┴────┴────┴────┴────┘
```

- Members are placed on specific grid cells
- During a drive-by, the car moves along the bottom row — members placed in the sidewalk row are visible from the car
- During a block assault, attacking members enter from the street row and move upward
- **Placement matters**: a shooter placed in the alley row has cover (+defense) but reduced line of sight to the street. A shooter on the sidewalk has full line of sight but no cover.

### T.2 Placement Effects

| Grid Zone | Cover | Line of Sight | Best For |
|---|---|---|---|
| Back wall | High (full cover) | Low (can only see adjacent) | Trap house defenders, last-resort shooters |
| Mid-block | Medium (partial cover) | Medium | Shooters with scoped weapons (range compensates for cover) |
| Sidewalk | Low (no cover) | High (full street view) | Dealers (need visibility for customers), lookout recruits |
| Street | None | Full | Car drop-off zone only — no defensive placement |

### T.3 Dynamic Placement During Attacks

- During a block assault, the player can **reposition defenders** in real-time (drag and drop on the grid)
- Repositioning takes **3 seconds** (member moves between cells) — during which the member **cannot attack or defend**
- This creates a real-time tactical layer: pull shooters back to cover when enforcers rush, push enforcers forward to intercept

---

## U. Economy Impact of Robbery & Vandalism

### U.1 Economic Damage from Attacks

| Attack Result | Economic Impact on Defender |
|---|---|
| Dealer robbed (cash stolen) | Direct cash loss — money the dealer had accumulated since last collection |
| Dealer robbed (product stolen) | Product loss — must re-up; income gap until restocked |
| Dealer hospitalized | No income from that dealer until released; hospital bill |
| Dealer killed | Permanent loss of that dealer's accumulated dealing XP; must recruit and train a replacement |
| Jewelry stolen | Material loss (jewelry cost) + morale hit to the dealer who was wearing it |
| Graffiti completed | Block morale -10; reputation hit; visual blight |
| Block taken | Total economic loss of that block's income stream |

### U.2 Economic Gain from Attacks

| Attack Result | Economic Gain for Attacker |
|---|---|
| Cash stolen from dealer | Direct cash gain (dirty cash — must be laundered) |
| Product stolen | Added to attacker's inventory (can be sold by their own dealers) |
| Jewelry stolen | Can be equipped, sold at pawn shop (50% value), or displayed |
| Graffiti completed | Reputation gain (+5); morale boost to participating recruit (+10) |
| Block taken | Full income access to the block; trap house and upgrades seized |

### U.3 Insurance System (New)

- Players can purchase **Block Insurance** for a weekly premium
- Insurance covers:
  - 50% of stolen cash value (reimbursed after 24 hours)
  - 30% of stolen product value (reimbursed after 24 hours)
  - Hospital bills reduced by 25% for members injured during attacks on insured blocks
- Insurance does **not** cover:
  - Stolen jewelry
  - Lost blocks
  - Members arrested during defense (bail not covered)
  - Graffiti cleanup costs
- Insurance premium scales with the block's income potential (higher income blocks = higher premium)
- Insurance is **voided** if the player initiates an attack from that block within the coverage period (can't insure a block you're using as a staging ground for violence)

---

## V. Expanded Notification System for Attacks

### V.1 Attack-Related Notifications

| Notification | Trigger | Severity | Requires Recruit? |
|---|---|---|---|
| "Your block is under attack!" | Any enemy member enters your block | Critical | Yes (lookout) |
| "Your dealer on [address] is being robbed!" | Enforcer initiates robbery on dealer | Critical | Yes (lookout) |
| "Your dealer has been hospitalized!" | Dealer takes 20%+ damage from enforcer | Critical | No (auto-notification) |
| "Your member has been killed!" | Any member dies during defense | Critical | No (auto-notification) |
| "Graffiti has been spray-painted on your block!" | Vandalism completed on your block | Warning | No (visible on block view) |
| "Your car has been stolen!" | Driver killed, car taken by enemy | Critical | No (auto-notification) |
| "Convoy ambushed!" | Convoy intercepted during transport | Critical | No (auto-notification) |
| "Police raid during your attack!" | Heat exceeded 100 during your own attack | Critical | No (auto-notification to attacker) |
| "Your enforcer was driven off [address]" | Your attacking enforcer was repelled by defenders | Warning | No (auto-notification to attacker) |
| "Robbery successful — loot acquired" | Your enforcer successfully robbed a dealer | Info | No (auto-notification to attacker) |
| "Graffiti completed on [address]" | Your recruit finished vandalizing | Info | No (auto-notification to attacker) |
| "Alarm triggered on [address]" | Motion sensor or tripwire detected an intruder | Warning | No (alarm-triggered) |

### V.2 Unnoticed Attacks

If the defending player has **no lookout (recruit)** and **no alarm system** on the block:

- The player receives **no real-time notification** during the attack
- The player discovers the attack aftermath when they:
  - **Open the block view** — sees graffiti, missing product, hospitalized members
  - **Check member profiles** — sees injury/robbery logs
  - **Check economy logs** — sees cash/product deduction with reason "robbed"
- This is the **core risk of not stationing a recruit** — you lose the ability to respond in real-time

---

## W. Implementation Notes: New Data Model

### W.1 New Tables

```sql
-- jewelry inventory
CREATE TABLE jewelry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'gold_chain', 'diamond_chain', 'gold_watch', etc.
  equipped_member_id UUID REFERENCES gang_members(id),
  is_stolen BOOLEAN DEFAULT FALSE,
  stolen_from_gang TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- block alarms
CREATE TABLE block_alarms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID REFERENCES blocks(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'tripwire', 'motion_sensor', 'lookout_post', 'police_scanner'
  is_active BOOLEAN DEFAULT TRUE,
  installed_at TIMESTAMPTZ DEFAULT NOW()
);

-- block morale
ALTER TABLE blocks ADD COLUMN IF NOT EXISTS block_morale INTEGER DEFAULT 50;

-- graffiti
CREATE TABLE graffiti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID REFERENCES blocks(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- 'small_tag', 'medium_mural', 'large_mural', 'gang_sign'
  painted_by_gang TEXT NOT NULL,
  painted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_cleaned BOOLEAN DEFAULT FALSE,
  cleaned_at TIMESTAMPTZ
);

-- convoys
CREATE TABLE convoys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES gang_members(id),
  escort_ids UUID[] DEFAULT '{}',
  origin_block_id UUID REFERENCES blocks(id),
  destination_block_id UUID REFERENCES blocks(id),
  cargo_type TEXT NOT NULL, -- 'product', 'cash'
  cargo_amount INTEGER NOT NULL,
  status TEXT DEFAULT 'in_transit', -- 'in_transit', 'completed', 'ambushed', 'intercepted', 'lost'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- block insurance
CREATE TABLE block_insurance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID REFERENCES blocks(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  weekly_premium INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- grudge history
CREATE TABLE grudge_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  rival_gang_name TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'attack', 'robbery', 'vandalism', 'kill', 'block_taken', 'truce'
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- trophy case
CREATE TABLE trophies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  trophy_type TEXT NOT NULL, -- 'stolen_jewelry', 'graffiti_photo', 'kill_confirmation', 'stolen_car'
  trophy_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### W.2 Field Additions to gang_members

```sql
ALTER TABLE gang_members ADD COLUMN IF NOT EXISTS
  equipped_jewelry_id UUID REFERENCES jewelry(id);
ALTER TABLE gang_members ADD COLUMN IF NOT EXISTS
  escort_for_dealer_id UUID REFERENCES gang_members(id);
ALTER TABLE gang_members ADD COLUMN IF NOT EXISTS
  grid_x INTEGER; -- tactical grid position
ALTER TABLE gang_members ADD COLUMN IF NOT EXISTS
  grid_y INTEGER; -- tactical grid position
ALTER TABLE gang_members ADD COLUMN IF NOT EXISTS
  intimidation_flee_chance REAL DEFAULT 0.0; -- calculated dynamically
```

### W.3 Field Additions to blocks

```sql
ALTER TABLE blocks ADD COLUMN IF NOT EXISTS
  block_morale INTEGER DEFAULT 50;
ALTER TABLE blocks ADD COLUMN IF NOT EXISTS
  has_insurance BOOLEAN DEFAULT FALSE;
ALTER TABLE blocks ADD COLUMN IF NOT EXISTS
  revenge_window_active BOOLEAN DEFAULT FALSE;
ALTER TABLE blocks ADD COLUMN IF NOT EXISTS
  revenge_window_expires_at TIMESTAMPTZ;
```

---

## X. Updated System Interconnection Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                      DEALT / SLIDE — ATTACK MODE                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ATTACKER                          DEFENDER                          │
│  ┌──────────┐                      ┌──────────┐                       │
│  │ Compose  │                      │  Block   │                        │
│  │ Attack   │───────drive─────────►│  Grid    │                        │
│  │ Force    │                      │  Layout  │                        │
│  └──┬───┬───┘                      └──┬───┬──┘                        │
│     │   │                             │   │                           │
│     │   ├─ Enforcers ──► Rob Dealers ◄─┤   ├─ Dealers (targets)        │
│     │   │                             │   │                           │
│     │   ├─ Shooters ───► Fight ◄──────┤   ├─ Shooters (defenders)     │
│     │   │               Shooters      │   │                           │
│     │   │                             │   │                           │
│     │   ├─ Recruits ───► Vandalize ◄──┤   ├─ Enforcers (security)     │
│     │   │               Sabotage     │   │                           │
│     │   │               Alarms       │   ├─ Recruits (lookouts)      │
│     │   │                             │   │                           │
│     │   └─ Driver ─────► Stay in car  │   └─ Alarms (detection)       │
│     │                               └──┬──┘                           │
│     │                                  │                               │
│     │           HEAT SPIKE             │                               │
│     │               │                  │                               │
│     │               ▼                  ▼                               │
│     │     ┌────────────────┐   ┌──────────────┐                      │
│     │     │ If heat ≥ 100  │──►│ POLICE RAID  │                      │
│     │     │ Raid triggers  │   │ (3-way fight)│                      │
│     │     └────────────────┘   └──────┬───────┘                      │
│     │                                 │                               │
│     │                          Defender choice:                       │
│     │                          ┌──────┴──────┐                        │
│     │                          │             │                         │
│     │                     ◄── FIGHT ──►  ◄── FORFEIT ──►               │
│     │                     (resist)        (call inside)                │
│     │                                     │                            │
│     │                               Members saved                      │
│     │                               Product partially saved            │
│     │                               Gang morale ─                      │
│     │                               Attacker morale ++                │
│     │                                                               │
│     ▼                                                               │
│  OUTCOMES                                                           │
│  ┌─────────────────────────────────────────────────┐                 │
│  │ Loot: cash, product, jewelry → attacker inventory│                │
│  │ Damage: dealers/enforcers/shooters injured      │                 │
│  │ Graffiti: stays on wall (if completed)           │                 │
│  │ Driver escape: based on driving level           │                 │
│  │ If caught: loot confiscated, driver jailed      │                 │
│  │ If driver killed: car stolen by defender         │                 │
│  └─────────────────────────────────────────────────┘                 │
│                                                                      │
│  ┌─────────────────────────────────────────────────┐                 │
│  │ POST-ATTACK                                      │                 │
│  │  • Defender: Revenge Window opens (1 hour)       │                 │
│  │  • Grudge history updated                        │                 │
│  │  • Block morale adjusted                         │                 │
│  │  • Block insurance claim (if insured)            │                 │
│  │  • Notifications sent (if lookout/alarm present)  │                 │
│  │  • Trophy case updated (jewelry, graffiti, kills) │                 │
│  └─────────────────────────────────────────────────┘                 │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Y. Revised Implementation Priority

| Priority | System | Status |
|---|---|---|
| P0 (Critical) | Auth, Block Claiming, Member Roster, Basic Economy, Heat, Morale, Jail/Hospital | ✅ Migrations 001–004 + Prompts 1–7 |
| P0 (Critical) | Block Attack: Enforcer Robbery, Shooter Defense, Recruit Lookouts | 🔲 Next sprint |
| P0 (Critical) | Block Grid Placement System | 🔲 Next sprint |
| P1 (High) | Drive-By Engine, Block Assault, Dealing Mini-Game, Weapon System, Vehicle System | 🔲 Next sprint |
| P1 (High) | Raid Warning System, Trap Houses, Product/Supply Chain, Graffiti/Vandalism | 🔲 Next sprint |
| P1 (High) | Driver Escape Mechanics, Forfeit/Retreat System | 🔲 Next sprint |
| P2 (Medium) | Jewelry & Trophy System, Block Alarms, Convoy System, Block Insurance | 🔲 Future sprint |
| P2 (Medium) | SLIDE (Battleship), Weather/Time, Member Traits, Reputation/Rivalry, Bounties | 🔲 Future sprint |
| P2 (Medium) | Grudge History, Revenge Window, Intimidation Mechanics | 🔲 Future sprint |
| P3 (Low) | Smuggling Mini-Game, Onboarding Tutorial, Daily Engagement, Escort System | 🔲 Future sprint |