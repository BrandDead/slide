# AI MODEL TASK ASSIGNMENTS - MASTER GUIDE
## DEALT/SLIDE MVP Development

**Last Updated:** December 31, 2025

---

## 🎯 AVAILABLE MODELS & ASSIGNMENTS

Based on your screenshot, here are the optimal task assignments:

| Model | Strengths | Assigned Tasks | Priority |
|-------|-----------|----------------|----------|
| **qwen3-coder:480b-cloud** | Backend code, APIs, complex logic | Backend API, Combat System | P0 |
| **deepseek-v3.1:671b-cloud** | Architecture, databases, systems | Auth System, Economy System | P0 |
| **minimax-m2:cloud** | UI/UX, creative, onboarding | Tutorial System | P1 |
| **gpt-oss:120b-cloud** | Frontend, React components | Real-time UI, Notifications | P1 |
| **qwen3-vl:235b-cloud** | Vision + language | Asset specs (if needed) | P2 |
| **glm-4.6:cloud** | Fast, small tasks | Bug fixes, utilities | P2 |

---

## 📋 TASK STATUS TRACKER

### COMPLETED ✅
- [x] Database Schema (Supabase AI) - **DONE**
- [x] Backend API (qwen3-coder) - **Document 2**
- [x] Real-time Multiplayer (gpt-oss:120b) - **Document 3 + Completion**
- [x] Tutorial System (minimax-m2) - **Document 4**
- [x] Combat System (qwen3-coder) - **Document 5**
- [x] Auth System (deepseek-v3.1) - **Document 7**

### PENDING ⏳
- [ ] Economy System (deepseek-v3.1) - **Use Prompt 03**
- [ ] Integration Testing
- [ ] Bug fixes and polish

---

## 🚀 EXECUTION ORDER

### STEP 1: Run Database (DONE ✅)
Your Supabase database is already created from Document 6.

### STEP 2: Integrate Backend API
Copy code from **Document 2** into your Supabase Edge Functions:
```
supabase/functions/
├── auth/
│   ├── signup/index.ts
│   ├── login/index.ts
│   ├── logout/index.ts
│   └── me/index.ts
├── api/
│   ├── deal/complete/index.ts
│   ├── block/claim/index.ts
│   ├── blocks/index.ts
│   ├── combat/initiate/index.ts
│   ├── combat/[id]/action/index.ts
│   ├── members/index.ts
│   ├── members/recruit/index.ts
│   ├── economy/balance/index.ts
│   ├── economy/transfer/index.ts
│   └── craft/index.ts
└── _shared/
    ├── cors.ts
    ├── utils.ts
    └── supabaseClient.ts
```

### STEP 3: Integrate Auth System
Copy code from **Document 7** into your frontend:
```
src/
├── services/supabase.ts
├── stores/authStore.ts
├── contexts/AuthProvider.tsx
├── components/
│   ├── auth/
│   │   ├── LoginScreen.tsx
│   │   ├── SignupScreen.tsx
│   │   ├── ForgotPasswordScreen.tsx
│   │   └── ProfileScreen.tsx
│   └── ProtectedRoute.tsx
└── types/auth.ts
```

### STEP 4: Integrate Real-time System
Copy code from **Document 3 + Completion file**:
```
src/
├── services/realtimeService.ts
├── hooks/
│   ├── usePresence.ts
│   ├── useRealtime.ts
│   └── useNotifications.ts
├── components/realtime/
│   ├── NotificationToast.tsx
│   ├── NotificationCenter.tsx
│   ├── OnlinePlayersIndicator.tsx
│   ├── ActivityIndicator.tsx
│   └── CombatAlert.tsx
└── types/realtime.types.ts
```

### STEP 5: Integrate Tutorial System
Copy code from **Document 4**:
```
src/
├── stores/tutorialStore.ts
├── components/tutorial/
│   ├── TutorialOverlay.tsx
│   ├── TutorialStep.tsx
│   ├── TutorialManager.tsx
│   └── TutorialContent.ts
└── Tutorial.css
```

### STEP 6: Integrate Combat System
Copy code from **Document 5**:
```
src/
├── services/combatService.ts
├── types/combatTypes.ts
├── utils/combatUtils.ts
└── components/combat/
    └── (integrate with existing SLIDE components)
```

### STEP 7: Run Economy Prompt
Send **Prompt 03 (Economy System)** to **deepseek-v3.1:671b-cloud**

---

## 📁 FILE LOCATIONS IN THIS PACKAGE

```
dealt-slide-master/
├── prompts/
│   ├── 01_SUPABASE_DATABASE_PROMPT.md    ← Database creation (DONE)
│   ├── 02_AI_MODEL_PROMPTS.md            ← All task prompts
│   ├── 03_ECONOMY_SYSTEM_PROMPT.md       ← Economy (RUN THIS)
│   └── 04_REALTIME_MULTIPLAYER_COMPLETION.md ← Completed realtime
├── docs/
│   └── DEVELOPMENT_PLAN.md               ← Full dev plan + timeline
└── codebase/
    └── (compiled code files)
```

---

## 🔧 REMAINING PROMPT TO RUN

### Economy System (deepseek-v3.1:671b-cloud)

Copy the entire contents of `prompts/03_ECONOMY_SYSTEM_PROMPT.md` and send it to deepseek-v3.1:671b-cloud.

Expected deliverables:
- economyStore.ts
- economyService.ts
- EconomyDashboard.tsx
- TransactionHistory.tsx
- CashCounter.tsx
- LaunderMoneyModal.tsx
- TransferModal.tsx
- Background job functions

---

## ⚡ QUICK INTEGRATION CHECKLIST

After all AI outputs are collected:

1. **Backend**
   - [ ] Copy Supabase Edge Functions
   - [ ] Deploy with `supabase functions deploy`
   - [ ] Test auth endpoints
   - [ ] Test game endpoints

2. **Frontend**
   - [ ] Install dependencies: `npm install @supabase/supabase-js zustand framer-motion`
   - [ ] Copy service files
   - [ ] Copy store files
   - [ ] Copy component files
   - [ ] Copy type definitions
   - [ ] Wire up AuthProvider in App.tsx
   - [ ] Wire up TutorialManager in App.tsx

3. **Testing**
   - [ ] Create test account
   - [ ] Complete tutorial
   - [ ] Make a deal
   - [ ] Claim a block
   - [ ] Test real-time presence
   - [ ] Test notifications

4. **Polish**
   - [ ] Fix styling inconsistencies
   - [ ] Add loading states
   - [ ] Add error handling
   - [ ] Performance optimization

---

## 📊 TIMELINE ESTIMATE

| Task | Duration | Dependencies |
|------|----------|--------------|
| Integrate Backend | 1 day | Database done |
| Integrate Auth | 1 day | Backend done |
| Integrate Realtime | 1 day | Auth done |
| Integrate Tutorial | 0.5 day | Auth done |
| Integrate Combat | 1 day | Backend done |
| Run Economy Prompt | 0.5 day | - |
| Integrate Economy | 1 day | Backend done |
| Testing & Fixes | 2-3 days | All above |
| **TOTAL** | **~8-10 days** | |

---

## 🎮 BETA LAUNCH CHECKLIST

Before inviting testers:

- [ ] All core features work
- [ ] No critical bugs
- [ ] Database persists correctly
- [ ] Auth flow complete
- [ ] Tutorial playable
- [ ] At least one game mode works (DEALT recommended)
- [ ] Economy tracks correctly
- [ ] Deployed to production URL
- [ ] Basic error tracking (Sentry)
- [ ] Feedback mechanism in place

---

Good luck with the build! 🔥
