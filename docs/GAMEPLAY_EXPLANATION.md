# DEALT/SLIDE: The Complete Gameplay Guide
**Author:** Manus AI
**Date:** July 8, 2026

This document explains the entire gameplay loop from start to finish, how the different mini-games connect to each other, how real-world map locations work, and what is still needed to bring the graphics up to a modern, high-fidelity standard.

---

## 1. The Core Loop: How to Play

DEALT/SLIDE is an urban warfare RPG where you manage a street gang, claim territory, and fight rival players. The entire game is managed through an iOS-style "phone" interface.

### Step 1: Recruiting & Equipping (Contacts App)
You start by recruiting members. Every member has a specific role:
*   **Recruits:** Start here. They hold knives and tasers. They steal cars and scout enemy blocks.
*   **Dealers:** Upgraded from Recruits. They hold drugs and armor. They stand on the block and make money.
*   **Shooters:** Upgraded from Recruits. They hold guns and armor. They protect the block and ride in cars during drive-bys. As they level up, they unlock better weapon accessories (scopes, extended mags, auto-switches).
*   **Enforcers:** Upgraded from Recruits. They hold melee weapons (bats, brass knuckles). They patrol the block, strong-arm for small cash, and reduce police heat.
*   **Chemists:** Upgraded from Dealers. They stay in the lab and craft drugs (Weed → Coke → Crack → Meth).

You equip your members through the **Contacts App**. You give your Dealer the drugs you cooked, and you give your Shooter the best gun you can afford.

### Step 2: Claiming Territory (Map App)
You open the **Map App** and search for a real-world address (e.g., *1208 W Las Olas Blvd, Fort Lauderdale*). 
*   **Accurate Locations:** The game uses the Mapbox API to show the real-world street map. If you know the area, you will recognize the streets and intersections.
*   **The Block Grid:** Once you claim an address, the game generates an 8x8 tactical grid for that block. 
*   **Deployment:** You place your equipped members on this grid. You put your Dealer on the Sidewalk (Row 2) because being closer to the street makes more money. You put your Shooter in the Alley (Row 4) so they have cover if a drive-by happens. You put a Recruit on the Rooftop (Row 7) to act as a lookout.

### Step 3: Generating Demand (DEALT Mini-Game)
Placing a Dealer on the block generates *passive* income, but to really make money, you play the **DEALT** mini-game.
*   This is a Tinder-style swipe game. You are presented with customer profile cards.
*   You swipe right to sell, left to reject.
*   **The Catch:** Some customers are undercover cops. If you sell to a cop, your Heat spikes and you might get raided.
*   **The Connection:** Playing DEALT successfully increases the "Traffic Flow" of your block. High traffic means your Dealers on the map sell their product much faster, filling your Shoebox with cash. If you don't play DEALT, traffic slows down.

### Step 4: Combat & Expansion (SLIDE Mini-Game)
When you want to take over another player's block, you initiate a **SLIDE** (drive-by).
*   **The Vehicle:** You need a Driver and a stolen car (provided by your Recruits). A 4-door car holds 5 people. The Driver cannot shoot. The center back-seat passenger cannot shoot. You load the remaining 3 seats with your best Shooters.
*   **The Battleship Mechanic:** The car arrives at the enemy block. The game switches to the 8x8 tactical grid.
    *   **Attacker:** You pick 1-3 squares on the Street (Row 0) to stop the car. From there, you pick squares on the block (Rows 1-7) to shoot at, hoping to hit the enemy's Dealers and Shooters.
    *   **Defender:** The enemy's Shooters fire back at the Street (Row 0), trying to guess where your car stopped.
*   **Shot Spotter & Spinning:** After a round of shooting, the Shot Spotter reveals the general area where shots were fired. You (the attacker) must decide: do you **Spin the Block** (go again, costing more ammo and generating more heat), or do you retreat?
*   **The Connection:** The positions you chose in Step 2 (Dealer on Sidewalk, Shooter in Alley) are the *exact* positions used in this combat game.

### Step 5: Consequences (Heat, Jail, Hospital)
*   Shooting guns and selling to cops generates **Heat**.
*   If Heat reaches 100, the police raid your block. Your members might be arrested (sent to Jail) or your product confiscated.
*   If members are shot during a SLIDE, they go to the Hospital.
*   You must use the cash in your **Shoebox** to pay bail and hospital bills. If you run out of money and can't pay your members' weekly salaries, their **Morale** drops, and they might flee during the next attack.

---

## 2. What's Still Needed: Graphics & Assets

Currently, the game logic is fully functional, but the graphics are using basic CSS grids and emojis (pixel-style placeholders). To achieve the **GTA-style, semi-realistic cel-shaded look**, we need a major visual overhaul.

### The Target Aesthetic
*(See the attached concept art for `1208_w_las_olas_block.png`, `member_card_ui.png`, and `dealt_customers.png`)*

### What Needs to be Built

**1. The PixiJS Rendering Engine**
We need to replace the HTML/CSS grid with **PixiJS**, a high-performance 2D WebGL engine. This allows us to render high-resolution textures, dynamic lighting (neon signs reflecting on wet asphalt), and smooth 60fps animations on mobile browsers.

**2. Top-Down Block Environments**
We cannot manually draw every block in the world. Instead, we need to use AI to generate **modular environmental tiles**.
*   **How it works:** We use the Mapbox API to determine the zoning of the claimed address (e.g., Commercial vs. Residential). 
*   **The Assets:** We need AI-generated top-down tiles for: cracked asphalt streets, concrete sidewalks, brick storefront roofs, alleyways with dumpsters, and chain-link parking lots. PixiJS will stitch these tiles together to create the 8x8 board.

**3. Character Sprites & Portraits**
We need to move away from emojis to realistic characters.
*   **The Assets:** We need an AI pipeline (using tools like Nano Banana Pro or Scenario.com) to generate consistent character art.
*   **Portraits:** High-res bust portraits for the Member Cards and the DEALT customer swipe game (addicts, undercover cops, wealthy buyers).
*   **Top-Down Sprites:** We need top-down views of these characters to place on the block grid. These need simple idle and shooting animations.
*   **Custom Faces:** We will integrate an API that allows players to upload a photo of themselves or their friends. The AI will apply the "GTA cel-shaded" filter and generate a custom Member Card portrait and top-down sprite for them to play with.

**4. Matter.js Physics for SLIDE**
For the drive-by game to feel impactful, we need to integrate **Matter.js** (a 2D physics engine) into PixiJS.
*   **The Assets:** We need top-down vehicle sprites (sedans, SUVs, vans) with separate damage states (shattered glass, blown tires).
*   **The Physics:** When a shooter fires, the bullet should be a physical object. If it hits a car, sparks fly and the car's HP drops. If it hits a character, ragdoll physics should throw them backward.

### Summary of Missing Libraries
To execute this visual upgrade, we must install and integrate:
1.  **PixiJS** (for 2D WebGL rendering)
2.  **Matter.js** (for 2D bullet and vehicle physics)
3.  **Scenario.com API / Replicate API** (for on-demand AI generation of custom player faces and customer portraits)
