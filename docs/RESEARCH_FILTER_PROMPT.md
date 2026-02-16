# DEALT/SLIDE - RESEARCH FILTER PROMPT
## Add This When Searching for New Game Ideas/Features

---

**COPY THIS PREFIX WHEN RESEARCHING NEW IDEAS:**

---

# COMPATIBILITY FILTER FOR DEALT/SLIDE

I'm researching ideas for a mobile game. Only suggest options that meet ALL of these technical and design requirements:

## TECHNICAL REQUIREMENTS

### Must Be Implementable In:
- **React 18** with TypeScript
- **Browser-based** (no native mobile features required)
- **Canvas/WebGL optional** (Phaser 3 available but not required)
- **Real-time multiplayer** via WebSockets (Supabase Realtime)
- **PostgreSQL** database with Supabase

### Must NOT Require:
- Native mobile APIs (camera, GPS tracking, accelerometer)
- AR/VR capabilities
- Blockchain/NFT integration
- Complex 3D rendering (Three.js heavy scenes)
- Machine learning inference on-device
- Peer-to-peer networking
- Custom game servers (we use Supabase)
- Unity/Unreal Engine
- Platform-specific features (iOS-only, Android-only)

### Performance Constraints:
- Must run at 60fps on mid-range phones (2020+)
- Initial load under 5MB (lazy load additional assets)
- No more than 100 simultaneous WebSocket connections per user
- Database queries must be optimizable with indexes

## DESIGN REQUIREMENTS

### Must Fit Theme:
- **Urban/street culture** aesthetic
- **18+ mature content** (drugs, violence, crime)
- **Competitive multiplayer** elements
- **Progression systems** (leveling, unlocks, upgrades)
- **Economy-driven** (earning and spending in-game currency)

### Game Feel:
- **Mobile-first** touch interactions
- **Session-based** (5-15 minute play sessions)
- **Idle/passive** income components welcome
- **PvP and/or PvE** modes
- **Risk/reward** decision making

### Must Integrate With Existing Systems:
- **Cash economy** (players earn/spend game currency)
- **Heat system** (risky actions increase police attention)
- **Gang members** (crew can be assigned to tasks)
- **Territory** (tied to block ownership)
- **Reputation/XP** (progression affects unlocks)

## EXISTING GAME MODES (Don't Duplicate)

Already built:
1. **DEALT** - Tinder-style drug dealing swipe game
2. **SLIDE** - Battleship-style grid combat
3. **Drive-By** - Side-scrolling shooter
4. **Alchemy Lab** - Little Alchemy crafting
5. **Territory Map** - Claim and manage blocks
6. **Gang Management** - Recruit and upgrade crew
7. **Mission Control** - Objectives and challenges

Looking for ideas that **complement** these, not replace them.

## UI/UX CONSTRAINTS

### Visual Style (Must Match):
- Dark theme with glassmorphism
- iOS-style cards and interactions
- Neon accent colors
- Rounded corners, subtle shadows
- Smooth 60fps animations

### Interaction Patterns:
- Touch-friendly (44px minimum tap targets)
- Swipe gestures welcome
- Drag-and-drop okay
- No complex multi-touch (pinch-zoom difficult)
- Single-hand operation preferred

## MONETIZATION COMPATIBILITY

Ideas should support:
- **Free-to-play** with optional purchases
- **Rewarded ads** (watch ad for bonus)
- **Premium currency** (paid cash vs. earned cash)
- **Battle pass** style progression
- **Cosmetic upgrades** (skins, customization)

## OUTPUT FORMAT

For each idea you suggest, include:

1. **Name**: Catchy game mode name
2. **One-liner**: What is it?
3. **Core mechanic**: How does it play?
4. **Session length**: How long per play?
5. **Integration points**: How does it connect to existing systems?
6. **Technical feasibility**: Why it works with our stack
7. **Monetization angle**: How could it generate revenue?
8. **Similar games**: What's the proven model?

---

**NOW, SEARCH FOR / SUGGEST:**

[YOUR RESEARCH QUERY HERE]

Examples:
- "casino mini-games that work well in mobile RPGs"
- "territory control mechanics in multiplayer games"
- "idle income systems for crime games"
- "PvP game modes that don't require real-time synchronization"
- "crafting systems beyond simple recipe combining"
