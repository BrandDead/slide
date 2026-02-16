# PROMPT 7: Visual Assets, Shared UI Components, and CSS Theme System

**Recommended AI Model:** `qwen3-vl:235b-cloud` (for visual understanding) or `qwen3-coder:480b-cloud` (for code)

**Estimated Complexity:** Medium (reusable components + theme system + animation library)

---

## TASK

Generate a library of shared UI components, a CSS theme system, and animation utilities that all game modes use. This ensures visual consistency across the entire application.

---

## TECH STACK

- React 18 with functional components
- TypeScript (strict mode)
- Tailwind CSS with custom theme configuration
- Framer Motion for animations
- CSS custom properties for theming

---

## FILES TO GENERATE

### 1. Theme System

**`frontend/src/styles/theme.ts`** — Export all theme constants:

```typescript
export const THEME = {
  colors: {
    bg: { primary: '#0a0a0a', secondary: '#1a1a2e', tertiary: '#16213e' },
    accent: { green: '#00ff88', red: '#ff4444', gold: '#ffd700', blue: '#4a90d9', purple: '#9b59b6' },
    glass: { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)', hover: 'rgba(255,255,255,0.15)' },
    text: { primary: '#ffffff', secondary: '#a0a0a0', muted: '#666666' },
    status: { active: '#00ff88', injured: '#ff8800', jailed: '#ff4444', dead: '#666666', awol: '#ffd700' },
    heat: { low: '#00ff88', medium: '#ffd700', high: '#ff8800', critical: '#ff4444' },
    tier: { 1: '#a0a0a0', 2: '#4a90d9', 3: '#9b59b6', 4: '#ff8800', 5: '#ff4444' },
  },
  spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px' },
  borderRadius: { sm: '4px', md: '8px', lg: '12px', xl: '16px', full: '9999px' },
  fontSize: { xs: '10px', sm: '12px', md: '14px', lg: '18px', xl: '24px', xxl: '32px' },
  shadows: {
    glow: (color: string) => `0 0 20px ${color}40, 0 0 40px ${color}20`,
    card: '0 4px 20px rgba(0,0,0,0.5)',
    inset: 'inset 0 2px 4px rgba(0,0,0,0.3)',
  },
} as const;
```

### 2. Shared UI Components

Generate these reusable components in `frontend/src/components/shared/`:

**`GlassCard.tsx`** — A card with glass morphism effect. Props: `children`, `className?`, `onClick?`, `glow?: string` (accent color for glow effect). Styles: semi-transparent background, backdrop-blur, subtle border, hover effect.

**`StatBar.tsx`** — A horizontal progress bar for stats. Props: `value: number` (0-100), `maxValue?: number`, `label: string`, `color: string`, `showValue?: boolean`, `size?: 'sm' | 'md' | 'lg'`. Animated fill with Framer Motion.

**`HeatMeter.tsx`** — A specialized meter for heat level. Props: `heat: number` (0-100). Color transitions: green (0-39) -> yellow (40-64) -> orange (65-84) -> red (85-100). Pulsing animation at high heat. Shows numeric value and label.

**`MoraleBadge.tsx`** — A badge showing morale status. Props: `morale: number`. Uses `getMoraleDescription()` from moraleSystem.ts. Shows colored dot + label.

**`MoneyDisplay.tsx`** — Formatted money display. Props: `amount: number`, `size?: 'sm' | 'md' | 'lg'`, `showSign?: boolean`. Green for positive, red for negative. Animated counting effect when value changes.

**`NotificationToast.tsx`** — A toast notification component. Props: `message: string`, `type: 'success' | 'warning' | 'danger' | 'info'`, `duration?: number`, `onDismiss: () => void`. Slides in from top-right, auto-dismisses.

**`AppIcon.tsx`** — An iOS-style app icon for the OSShell. Props: `icon: string` (emoji), `label: string`, `onClick: () => void`, `badge?: number`, `disabled?: boolean`. Glass morphism card with emoji centered, label below, optional notification badge.

**`LoadingSpinner.tsx`** — A loading spinner. Props: `size?: 'sm' | 'md' | 'lg'`, `color?: string`. Rotating ring animation.

**`ConfirmDialog.tsx`** — A confirmation dialog. Props: `title: string`, `message: string`, `confirmLabel?: string`, `cancelLabel?: string`, `onConfirm: () => void`, `onCancel: () => void`, `variant?: 'danger' | 'warning' | 'default'`. Modal overlay with glass card.

**`RoleBadge.tsx`** — A badge showing a gang member's role. Props: `role: string`. Shows role icon + colored background.

### 3. Animation Utilities

**`frontend/src/utils/animations.ts`** — Framer Motion animation presets:

```typescript
// Page transitions
export const pageTransition = { ... };
// Card hover effects
export const cardHover = { ... };
// Grid cell reveal
export const cellReveal = { ... };
// Hit flash (red pulse)
export const hitFlash = { ... };
// Miss splash (blue ripple)
export const missSplash = { ... };
// Money counting
export const moneyCount = { ... };
// Notification slide-in
export const notificationSlide = { ... };
// Shake effect (for dice, explosions)
export const shakeEffect = { ... };
// Glow pulse
export const glowPulse = { ... };
```

### 4. Custom Hooks

**`frontend/src/hooks/useGameTimer.ts`** — A hook that provides a game timer. Returns `{ elapsed, remaining, isRunning, start, stop, reset }`. Used for crafting timers, mission timers, etc.

**`frontend/src/hooks/useNotifications.ts`** — A hook for managing toast notifications. Returns `{ notifications, addNotification, removeNotification }`. Integrates with the Socket.IO `notification` event.

**`frontend/src/hooks/useSound.ts`** — A hook for playing sound effects. Returns `{ play }`. Accepts a sound name and plays the corresponding audio file. Stub implementation with comments for where to add actual audio files.

---

## DESIGN PRINCIPLES

1. **Consistency**: All components use the same theme constants. No hardcoded colors.
2. **Glass Morphism**: The primary visual style. Semi-transparent backgrounds with backdrop-blur.
3. **Neon Accents**: Green for positive, red for negative, gold for money, blue for info.
4. **Responsive**: All components scale from mobile (375px) to desktop (1920px).
5. **Accessibility**: All interactive elements have focus states and aria labels.
6. **Performance**: Use `React.memo` on components that receive stable props. Use `useMemo` for expensive calculations.
