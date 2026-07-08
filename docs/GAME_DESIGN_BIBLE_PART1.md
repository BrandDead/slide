Game Systems Explanation (Rewritten)
1. Game Overview
DEALT/SLIDE is a mobile-first urban RPG where players build and manage a street gang. The game combines strategic territory management on a real-world map with action-based mini-games. Players claim city blocks, place gang members in specific roles on those blocks, and engage in drug dealing and combat to generate income and expand influence.

The game contains several interconnected mini-games:

Drive-By Engine — A first-person shooter from inside a moving car
SLIDE — A turn-based tactical game modeled after Battleship, but with cars instead of boats and guns instead of missiles
Dealing Games — Mini-games that determine how successfully a dealer sells product on a block
Block Assault — A top-down tactical attack mode (reminiscent of Clash of Clans or Warcraft) where members exit a car and assault an enemy block
2. Drive-By Engine
2.1 Camera & Perspective
The player views the street from inside a moving car in first-person. The block scrolls past the car windows as the vehicle drives down the street. The player is never the driver — they control shooters seated in the passenger and rear seats.

2.2 Car Seating System
A 4-door car can hold up to 5 members (1 driver + 4 shooters across front passenger and two rear seats)
The player can rotate between any shooter seat in the car at will
The player can assign AI control to any combination of the other shooters
The player may also choose to manually control all shooters by rotating between seats
If AI controls a shooter, that shooter's performance is governed by their stats (see Section 2.5)
2.3 Window & Stealth Mechanics
Each shooter's window is tinted and starts in the rolled-up position
Rolling the window down allows the shooter to fire at targets on the block
If the window is down too long and the block has an enemy lookout/recruit stationed on it, the lookout can identify the car and alert the block's defenders
Once alerted, enemy shooters on the block may begin returning fire at the car
The player must time window rolls: drive → stop → roll down window → shoot → roll up window → drive again
2.4 Target Identification
When the player's car reaches a position on the block where they previously placed one of their own members (e.g., a shooter placed on the middle of the sidewalk), that member is visually present at that exact location
The player must identify and shoot enemy targets while avoiding civilians and pedestrians
Hitting civilians increases heat on every member in the car (see Section 6)
Successfully eliminating enemy members may weaken or clear an opposing gang's hold on that block
2.5 AI Shooter Performance
When the AI controls a shooter:

A highly-rated shooter (high aim/precision stats or proficiency with the equipped weapon) has a high probability of hitting the correct target
A novice shooter has roughly a 50/50 chance of hitting the target — meaning the AI may also make mistakes, hitting pedestrians and generating heat
The AI's accuracy is determined by the member's individual stats: shooting ability, nerve (composure under fire), and weapon proficiency
2.6 Drive-By Outcomes
Outcome	Effect
Eliminate enemy target, no civilian casualties	Success — member levels up in shooting, heat increases moderately
Eliminate enemy target, some civilian casualties	Partial success — member levels up, but heat increases significantly
Miss all targets, no civilian casualties	Failure — no XP gained, minimal heat
Hit civilians, no enemy targets hit	Failure — high heat on all car members, possible police raid on the player's block
2.7 Post-Mission Leveling
After a successful drive-by mission, every member in the car gains XP in their respective role:

Driver → gains Driving XP
Front passenger shooter → gains Shooting XP
Rear seat shooters → gain Shooting XP
Members grow stronger with repeated use, similar to Final Fantasy's individual character progression — the player chooses which members to develop into elite operatives versus which to keep as low-level grunts.

3. Block Assault (Top-Down Attack Mode)
3.1 Overview
When a player wants to take an enemy block by force, they must:

Acquire a car (if they don't already own one) via the Bip and Dip game (a lower-tier income mini-game)
Load members into the car (up to 5 for a 4-door vehicle)
Drive to the target block
The game transitions to a top-down tactical view (similar to Clash of Clans or Warcraft)
3.2 Tactical Combat
Members exit the car and are directed by the player to attack specific enemy members
The player can assign target priority — which enemy to attack first
Combat resolution depends on:
Member Level (accuracy, composure, experience)
Weapon Caliber (damage per hit)
Quantity of Shooters (multiple low-level shooters can overwhelm a single high-level defender)
3.3 Quality vs. Quantity Strategy
Strategy	Description
Quality	A few high-level, well-armed members. High accuracy, high damage, low casualty risk per engagement. Expensive to maintain.
Quantity	Many low-level members. Lower individual performance but can overwhelm through numbers. Cheaper but higher individual casualty risk.
A high-level attacker vs. a low-level defender will generally win a 1v1 shootout. However, if the defender's block has multiple low-level shooters, their combined firepower can overcome the level gap.

3.4 Weapon System
Gun Type / Caliber = Damage potential per hit
Shooter Level / Ability = Accuracy and hit probability
Combination	Result
High ability + Low caliber (e.g., .22)	Many hits, low damage per hit — targets may survive with injuries
Low ability + High caliber (e.g., .45)	Few hits but devastating damage — wasted potential due to missed shots
High ability + High caliber	Optimal — high hit rate + high damage
Low ability + Low caliber	Worst — frequent misses, negligible damage
4. Health & Injury System
4.1 Damage Thresholds
Damage Taken	Effect
5% – 15%	Minor injury — member stays on the block at reduced health, higher risk of dying in next attack
20%+ (single shot/engagement)	Automatic hospital admission
Cumulative health reaches 0%	Member dies
4.2 Injury Treatment
Minor injuries (under 20%) can be left untreated — the member remains active at lower health
Minor injuries can be treated for a fee — restores health and provides a small morale boost to that member
Leaving injuries untreated does not reduce morale, but treating them does increase morale slightly
4.3 Hospital System
Rule	Detail
Auto-admit	Any single hit dealing 20%+ damage sends the member to the hospital
Hospital bill	Player can pay to release the member early
No payment	Member is eventually released at full health but incurs a hospital strike
Strike limit	5 hospital strikes = automatic death
Morale effect	Members in the hospital lose morale; overall gang morale also drops
Return	After the hospital stay (paid or unpaid), member returns at full health with slightly lower morale
Heat persistence	If a hot member (high heat) is sent to the hospital, their heat level is unchanged upon release, whether the bill is paid or not
5. Jail & Bail System
5.1 Arrest Mechanics
Members accumulate heat through violent actions (see Section 6)
When heat gets too high, the police raid the member's block
Raids can result in:
Arrests of hot members (especially shooters)
Seizure of product if dealers are caught outside during the raid
Loss of block control if too many members are arrested
5.2 Bail & Sentencing
Rule	Detail
Bail	Player can pay cash to release a member from jail immediately
Bail effect	Paying bail clears the member's heat to 0 and releases them immediately
Jail strikes	Each arrest adds a jail strike to the member's record
Strike limit	3 jail strikes = life sentence — member is permanently unplayable
Morale	Members in jail lose morale; gang morale drops while they're incarcerated
Return	After serving time (if not bailed), member returns with reduced morale but heat reset to a lower level
5.3 Bribe Police (Heat Reduction)
The player can bribe police to reduce a member's heat level without waiting for natural decay
This is a proactive measure to prevent raids before they happen
Cost scales with the member's current heat level
6. Heat System
6.1 How Heat Accumulates
Heat is a per-member stat (0–100) representing police attention:

Action	Heat Increase
Rolling window down during drive-by	Small per-second increase
Shooting during drive-by	Moderate increase per shot fired
Hitting civilians	Large increase per civilian hit
Killing civilians	Very large increase
Enemy lookout identifies car	Spike in heat for all car members
Being present on a block during a raid	Additional heat if survived
6.2 Heat Consequences
High heat → police raid on the block where the hot member is stationed
Raids can arrest members and seize product
A high-level shooter with max heat is a liability — every time they're on a block, cops raid it
This creates a risk/reward tension: your strongest shooters are also your hottest
6.3 Heat Decay
Heat naturally decays over time (passive reduction per tick)
Bribing police accelerates heat reduction for a cost
Getting arrested and serving time resets heat to a lower baseline
Paying bail resets heat to 0 immediately
7. Drug Dealing System
7.1 Dealer Placement
Players place dealers on blocks in specific locations
Dealers generate income by selling product
The traffic flow of a block determines how fast product moves
7.2 Dealing Mini-Games
Players (or AI) play dealing mini-games to determine deal success rates
High success rate → fast traffic flow → product moves quickly → more income
Low success rate → slow traffic flow → product moves slowly → less income
7.3 Product & Re-Up
Dealers can only sell product they have in stock
The player sets a target amount — when the dealer hits that sales target, they automatically re-up (restock)
If product runs out before re-up, the dealer stops generating income until restocked
7.4 Dealer Leveling
Successful deals raise the dealer's dealing level
Higher dealing level → better performance in dealing mini-games → faster traffic flow
Dealers also have a hustle stat that affects their base income rate
7.5 Raid Impact on Dealers
If a raid occurs while a dealer is outside on the block, the dealer may be arrested and product may be seized
If the dealer is inside a trap house, they are safer from raids (but may generate slightly less income)
This creates a strategic choice: outdoor dealing (higher income, higher risk) vs. trap house dealing (lower income, safer)
8. Morale System
8.1 Morale Drivers
Event	Morale Effect
Member sent to jail	-morale for that member + gang morale drops
Member sent to hospital	-morale for that member + gang morale drops
Successful mission	+morale for participating members
Bail paid (early release)	+morale for that member
Injury treated	Small +morale for that member
Salary paid on time	Morale maintained
Salary not paid	-15 morale for ALL active members
Member dies	Significant -morale for entire gang
Member sentenced to life	Significant -morale for entire gang
8.2 Morale Recovery
Morale recovers naturally over time at a fixed rate
Being released from jail/hospital and returning to active duty restores morale gradually
Successful missions accelerate morale recovery
9. SLIDE (Battleship Remake)
A tactical turn-based game modeled after Battleship
Instead of boats: cars placed on a grid
Instead of missiles: guns fired at grid coordinates
Used as a method for attacking enemy territory or defending your own
(Detailed mechanics TBD — this is a lower-priority system)
10. Member Contact System & UI
10.1 Member Status Emojis
Status	Emoji	Meaning
Active — Dealer (outdoor)	💼	Currently selling on the block
Active — Dealer (trap house)	🏠	Selling from inside a trap house
Active — Shooter (on block)	🔫	Stationed on the block outdoors
Active — Shooter (trap house)	🏠	Stationed inside a trap house
In Jail	⛓️	Arrested — shows bail amount + jail strike tally
In Hospital	🏥	Injured — shows hospital bill + hospital strike tally
Serving Life	⛓️🔒	3 jail strikes — permanently unplayable
Dead	👼	5 hospital strikes or killed in action — permanently gone
10.2 Member Profile Data
Each member's profile displays:

Role: Shooter, Dealer, Enforcer, Lookout, Driver
Level & Stats: Shooting, Dealing, Nerve, Hustle, Stealth, Driving
Health: Current health % (if injured)
Heat: Current heat level (0–100)
Morale: Current morale level
Weapon: Equipped gun type and caliber
Jail strikes: Tally (e.g., ⛓️ ⛓️ — 2 of 3)
Hospital strikes: Tally (e.g., 🏥 🏥 🏥 — 3 of 5)
Sales log (dealers): Total drugs sold, total money made
Kill log (shooters): Total enemies shot, specific enemies killed (with names/gang affiliation)
Status indicators: Current emoji status, applicable bail/hospital costs
10.3 Graveyard / Archive
Members who die or receive life sentences are greyed out in the contacts list
Their stats, kill logs, and sales logs are preserved for historical reference
They cannot be used in any game activity
11. Progression Philosophy
11.1 Final Fantasy-Style Individual Growth
Each member levels up individually based on the missions they participate in
The player decides which members to invest in — creating elite specialists or maintaining a large roster of average members
This mirrors Final Fantasy's approach where the player can power-level specific characters
11.2 Risk of Over-Leveling
A highly-leveled shooter becomes devastating in combat but accumulates dangerous heat levels
The player must manage the tension between power and heat
Over-leveled members with high heat become raid magnets, potentially costing the player product, money (bail), and morale
Strategic rotation of members — cycling hot members off active duty to let heat decay — is essential
11.3 Quantity vs. Quality
Quality strategy: Few members, heavily invested, elite stats, expensive maintenance (bail, bribes, salaries, weapons)
Quantity strategy: Many members, low investment, disposable, cheap but higher casualty rates
Both strategies are viable; the player's playstyle determines which is more effective