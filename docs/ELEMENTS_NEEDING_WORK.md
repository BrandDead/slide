# DEALT/SLIDE - ELEMENTS STILL NEEDING WORK
## Prioritized Development Checklist

---

## 🔴 CRITICAL (Cannot Launch Beta Without)

### 1. Backend Integration
| Task | Status | Effort | Notes |
|------|--------|--------|-------|
| Supabase project setup | ❌ TODO | 1 hour | Create account, run schema |
| Auth integration | ❌ TODO | 1 day | Login, signup, session management |
| Profile sync | ❌ TODO | 4 hours | Connect profile to game state |
| Game state persistence | ❌ TODO | 2 days | Save/load all game data |

### 2. Data Persistence Layer
| Task | Status | Effort | Notes |
|------|--------|--------|-------|
| Connect DEALT to database | ❌ TODO | 1 day | Save deals, update cash |
| Connect inventory to database | ❌ TODO | 4 hours | Drug storage persistence |
| Connect gang members to database | ❌ TODO | 4 hours | Member CRUD operations |
| Connect blocks/territory to database | ❌ TODO | 1 day | Ownership, claiming |

### 3. User Accounts
| Task | Status | Effort | Notes |
|------|--------|--------|-------|
| Login screen UI | ❌ TODO | 4 hours | Email/password form |
| Signup flow | ❌ TODO | 4 hours | Username selection, onboarding |
| Session management | ❌ TODO | 2 hours | Auto-login, logout |
| Password reset | ❌ TODO | 2 hours | Email flow |

---

## 🟡 HIGH PRIORITY (Should Have for Beta)

### 4. Basic Multiplayer
| Task | Status | Effort | Notes |
|------|--------|--------|-------|
| Presence system | ❌ TODO | 4 hours | Who's online |
| See other players on map | ❌ TODO | 1 day | Territory ownership display |
| Basic notifications | ❌ TODO | 4 hours | When you get raided, etc. |
| Async PvP raids | ❌ TODO | 2 days | Attack offline players |

### 5. Territory System (Non-IRL Mode)
| Task | Status | Effort | Notes |
|------|--------|--------|-------|
| Pre-generated blocks per city | ❌ TODO | 4 hours | 20-50 fake addresses per region |
| Block claiming logic | ❌ TODO | 4 hours | Spend cash to claim |
| Block income generation | ❌ TODO | 4 hours | Passive earnings over time |
| Block upgrade system | ❌ TODO | 1 day | Defense, traps, cameras |

### 6. Onboarding/Tutorial
| Task | Status | Effort | Notes |
|------|--------|--------|-------|
| First-time user detection | ❌ TODO | 1 hour | Check if new account |
| DEALT tutorial | ❌ TODO | 4 hours | Guided first deal |
| Game mode introductions | ❌ TODO | 4 hours | What each app does |
| Tooltips system | ❌ TODO | 4 hours | Contextual help |

---

## 🟢 MEDIUM PRIORITY (Nice for Beta)

### 7. Game Balance & Polish
| Task | Status | Effort | Notes |
|------|--------|--------|-------|
| Client spawn rate tuning | ⚠️ PARTIAL | 2 hours | Balance risk/reward |
| Drug price balancing | ⚠️ PARTIAL | 2 hours | Supply/demand curves |
| Heat decay system | ⚠️ PARTIAL | 2 hours | How fast heat drops |
| Gang member salary system | ❌ TODO | 4 hours | Auto-deduct weekly |
| Loyalty/morale consequences | ❌ TODO | 4 hours | Members leave if unhappy |

### 8. Combat Polish
| Task | Status | Effort | Notes |
|------|--------|--------|-------|
| SLIDE vs AI opponents | ✅ DONE | - | Works locally |
| SLIDE vs real players | ❌ TODO | 2 days | Networked combat |
| Drive-by scoring persist | ❌ TODO | 2 hours | Save high scores |
| Combat rewards distribution | ❌ TODO | 4 hours | XP, cash, territory |

### 9. Alchemy Lab Polish
| Task | Status | Effort | Notes |
|------|--------|--------|-------|
| Recipe discovery system | ⚠️ PARTIAL | 4 hours | Save discovered recipes |
| Crafting success/failure | ⚠️ PARTIAL | 2 hours | RNG with skill modifiers |
| Crafting queue | ❌ TODO | 4 hours | Multiple items at once |
| Chemist skill integration | ❌ TODO | 2 hours | Better rates with skilled member |

### 10. Mission System
| Task | Status | Effort | Notes |
|------|--------|--------|-------|
| Mission tracking backend | ❌ TODO | 4 hours | Progress persistence |
| Mission completion rewards | ❌ TODO | 2 hours | Auto-grant rewards |
| Daily/weekly mission rotation | ❌ TODO | 4 hours | Scheduled refresh |
| Mission UI completion flow | ⚠️ PARTIAL | 2 hours | Celebration screen |

---

## 🔵 LOW PRIORITY (Post-Beta)

### 11. Real-World Location System
| Task | Status | Effort | Notes |
|------|--------|--------|-------|
| Mapbox API integration | ❌ TODO | 1 day | Geocoding, satellite |
| Address validation | ❌ TODO | 4 hours | Real address checker |
| Block generation from address | ❌ TODO | 1 day | Create block from geocode |
| Satellite imagery display | ❌ TODO | 4 hours | Show real location |

### 12. AI Asset Generation
| Task | Status | Effort | Notes |
|------|--------|--------|-------|
| Banana Nano integration | ❌ TODO | 1 day | API setup |
| Building image generation | ❌ TODO | 1 day | Prompts, caching |
| Asset hash caching | ❌ TODO | 4 hours | Don't regenerate |

### 13. Social Features
| Task | Status | Effort | Notes |
|------|--------|--------|-------|
| Player profile viewing | ❌ TODO | 4 hours | See other players |
| Leaderboard display | ❌ TODO | 4 hours | Rankings UI |
| Gang alliances | ❌ TODO | 2 days | Multi-player gangs |
| Chat system | ❌ TODO | 2 days | In-game messaging |

### 14. Monetization
| Task | Status | Effort | Notes |
|------|--------|--------|-------|
| Premium account system | ❌ TODO | 1 day | Extra features |
| In-app purchase integration | ❌ TODO | 2 days | App store setup |
| Ad integration | ❌ TODO | 1 day | Rewarded ads |

### 15. Casino Games
| Task | Status | Effort | Notes |
|------|--------|--------|-------|
| Blackjack engine | ❌ TODO | 1 day | Card game logic |
| Craps engine | ❌ TODO | 1 day | Dice game logic |
| Casino backend | ❌ TODO | 4 hours | Bet tracking, fairness |

### 16. Voice Chat
| Task | Status | Effort | Notes |
|------|--------|--------|-------|
| Agora SDK integration | ❌ TODO | 2 days | Voice infrastructure |
| Block-based voice rooms | ❌ TODO | 1 day | Territory holders can chat |
| Push-to-talk UI | ❌ TODO | 4 hours | Mobile UX |

---

## 📊 SUMMARY BY STATUS

| Status | Count | Description |
|--------|-------|-------------|
| ✅ DONE | ~15 | Core engines, UI shell, types |
| ⚠️ PARTIAL | ~8 | Started but needs completion |
| ❌ TODO | ~45 | Not started |

## 🎯 RECOMMENDED SPRINT PLAN

### Week 1: Foundation
- Day 1-2: Supabase setup, auth integration
- Day 3-4: Profile sync, basic persistence
- Day 5: Login/signup UI

### Week 2: Core Loop
- Day 1-2: DEALT + Inventory database sync
- Day 3-4: Territory claiming (fake blocks)
- Day 5: Basic presence system

### Week 3: Beta Polish
- Day 1-2: Onboarding tutorial
- Day 3: Notifications
- Day 4-5: Bug fixes, testing

### Week 4: Beta Launch
- Day 1-2: Load testing
- Day 3: Final polish
- Day 4: Invite beta testers
- Day 5: Monitor & hotfix

---

## 🚦 BETA LAUNCH GATE

**Minimum requirements to call it "Beta":**
- [ ] Users can create accounts
- [ ] Users can log in and out
- [ ] Game state persists across sessions
- [ ] DEALT deals save to database
- [ ] Inventory persists
- [ ] Gang members persist
- [ ] Territory can be claimed
- [ ] Basic tutorial exists
- [ ] No critical bugs that block gameplay

**Everything else is enhancement.**
