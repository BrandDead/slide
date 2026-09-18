import { RECOVERY_CONFIG } from '../../utils/bailHospitalSystem';
import { applyPlacement, streetVsSafetyPreview, toPlacement, validatePlacement } from './placementRules';
import { canAssignProductToDealer, resolveLoopDeal } from './dealResolver';
import { createDeterministicLoopResult, resolveThreatRoute } from './threatHandoff';
import { createLoopState } from './blockLoopFixture';
import type { LoopCommand, LoopLedgerV1, LoopState } from './blockLoopTypes';
import { BLOCK_LOOP_IDS } from './blockLoopTypes';

function memberById(state: LoopState, memberId: string) {
  return state.members.find((member) => member.id === memberId);
}

function applyLedger(state: LoopState, ledger: LoopLedgerV1): LoopState {
  const grid = state.block.grid.map((row) => row.map((zone) => ({
    ...zone,
    occupantId: ledger.placements.find((placement) => placement.x === zone.x && placement.y === zone.y)?.memberId ?? null,
  })));
  const inventory = state.inventory.map((item, index) => (
    index === 0 ? { ...item, quantity: ledger.productQuantity } : item
  ));
  const downed = new Set(ledger.placements.filter((placement) => placement.health <= 0).map((placement) => placement.memberId));
  const members = state.members.map((member) => {
    const placement = ledger.placements.find((item) => item.memberId === member.id);
    if (!placement) return member;
    return {
      ...member,
      health: placement.health,
      assignment: downed.has(member.id) ? 'wounded' : `${placement.zoneType} ${placement.x},${placement.y}`,
    };
  });
  const dealerPlacement = ledger.placements.find((item) => item.role === 'dealer') ?? ledger.placements[0];
  const shooterPlacement = ledger.placements.find((item) => item.role === 'shooter');
  const lastDeal = ledger.lastDeal
    ?? (ledger.dealKey ? {
      key: ledger.dealKey,
      dealerId: dealerPlacement?.memberId ?? BLOCK_LOOP_IDS.dealerId,
      productId: BLOCK_LOOP_IDS.productId,
      productName: 'River Cut',
      productTier: 'street' as const,
      cell: {
        x: dealerPlacement?.x ?? 0,
        y: dealerPlacement?.y ?? 1,
        zoneType: dealerPlacement?.zoneType ?? 'curb',
        exposureRisk: dealerPlacement?.exposureRisk ?? 80,
      },
      moneyDelta: 0,
      productDelta: 0,
      heatDelta: 0,
      exposureDelta: 0,
      reputationDelta: 0,
      demandBonusPct: 18,
      leftoverQuantity: ledger.productQuantity,
      explanation: ledger.briefing.find((line) => /street exposure/i.test(line)) ?? 'Deal already booked.',
    } : null);
  const lastEncounter = ledger.lastEncounter
    ?? (ledger.encounterKey ? {
      idempotencyKey: ledger.encounterKey,
      outcome: 'overrun' as const,
      crewDown: [BLOCK_LOOP_IDS.dealerId],
      oppositionDown: [],
      objectiveProgress: 0,
      heatDelta: 0,
      moraleDelta: 0,
      pendingIncomeDelta: 0,
      summary: ledger.briefing[0] ?? 'Consequence already booked.',
    } : null);
  const threat = ledger.threatRoute
    ? { route: ledger.threatRoute, reason: `Restored ${ledger.threatRoute} handoff on ${state.block.dnaId}.` }
    : null;
  return {
    ...state,
    phase: ledger.phase,
    money: ledger.money,
    playerHeat: ledger.playerHeat,
    reputation: ledger.reputation,
    assignments: { ...ledger.assignments },
    inventory,
    members,
    selectedDealerId: ledger.selectedDealerId ?? dealerPlacement?.memberId ?? BLOCK_LOOP_IDS.dealerId,
    selectedShooterId: ledger.selectedShooterId ?? shooterPlacement?.memberId ?? BLOCK_LOOP_IDS.shooterId,
    lastDeal,
    lastEncounter,
    threat,
    appliedEncounterKeys: [...ledger.appliedEncounterKeys],
    economyKeys: [...ledger.economyKeys],
    pendingHealthIds: [...ledger.pendingHealthIds],
    briefing: [...ledger.briefing],
    recovery: ledger.recovery,
    rejection: null,
    block: {
      ...state.block,
      grid,
      placements: ledger.placements.map((placement) => ({ ...placement })),
      heat: ledger.blockHeat,
      morale: ledger.blockMorale,
      pendingIncome: ledger.pendingIncome,
      members: ledger.placements.length,
      incomePerTick: ledger.placements.reduce((sum, placement) => sum + placement.incomePerTick, 0),
      appliedEncounterResultKeys: [...ledger.appliedEncounterKeys],
    },
  };
}

export function reduceLoop(state: LoopState, command: LoopCommand): LoopState {
  switch (command.type) {
    case 'select-crew': {
      const dealer = memberById(state, command.dealerId);
      const shooter = memberById(state, command.shooterId);
      if (!dealer || dealer.role !== 'dealer' || !shooter || shooter.role !== 'shooter') {
        return { ...state, rejection: 'Select one dealer and one shooter from this crew.' };
      }
      return {
        ...state,
        phase: 'placement',
        selectedDealerId: dealer.id,
        selectedShooterId: shooter.id,
        rejection: null,
        briefing: [
          `${dealer.name} is the dealer (lv${dealer.level}, morale ${dealer.morale}, health ${dealer.health}).`,
          `${shooter.name} is the shooter (lv${shooter.level}, morale ${shooter.morale}, ${shooter.equipment}).`,
          streetVsSafetyPreview(state.block, dealer.level).explanation,
        ],
      };
    }
    case 'place': {
      const member = memberById(state, command.memberId);
      const result = validatePlacement(state.block, member, command.x, command.y);
      if (!result.ok) {
        return { ...state, rejection: result.message };
      }
      if (!member) {
        return { ...state, rejection: 'Unknown member.' };
      }
      const placement = toPlacement(member, result.zone, state.block.grid, state.block.incomeMultiplier ?? 1);
      const block = applyPlacement(state.block, placement);
      const members = state.members.map((item) => (
        item.id === member.id
          ? { ...item, assignment: `${result.zone.zoneType} ${result.zone.x},${result.zone.y}` }
          : item
      ));
      const dealerPlaced = block.placements.some((item) => item.memberId === state.selectedDealerId);
      const shooterPlaced = block.placements.some((item) => item.memberId === state.selectedShooterId);
      return {
        ...state,
        block,
        members,
        phase: dealerPlaced && shooterPlaced ? 'product' : 'placement',
        rejection: null,
        briefing: [
          `${member.name} holds ${result.zone.zoneType} (${result.zone.x},${result.zone.y}). Income $${placement.incomePerTick}/tick, exposure ${placement.exposureRisk}.`,
        ],
      };
    }
    case 'assign-product': {
      const dealer = state.block.placements.find((item) => item.memberId === command.dealerId);
      const product = state.inventory.find((item) => item.id === command.productId);
      if (!dealer || dealer.role !== 'dealer') {
        return { ...state, rejection: 'Place the dealer before assigning product.' };
      }
      if (!product || product.quantity <= 0) {
        return { ...state, rejection: 'No River Cut remains in the stash.' };
      }
      if (!canAssignProductToDealer(dealer.zoneType)) {
        return { ...state, rejection: 'Deep alley/rooftop cells cannot take product. Move closer to the street.' };
      }
      return {
        ...state,
        phase: 'deal',
        assignments: { ...state.assignments, [dealer.memberId]: product.id },
        members: state.members.map((item) => (
          item.id === dealer.memberId ? { ...item, equipment: product.name, assignment: dealer.zoneType } : item
        )),
        rejection: null,
        briefing: [
          `${product.name} (${product.tier}, potency ${product.quality}, qty ${product.quantity}) is on ${dealer.memberName}.`,
          'Expected demand tracks street exposure. Overdose/heat risk stays on the street-tier table — no real-world recipe.',
        ],
      };
    }
    case 'run-deal': {
      if (state.lastDeal && state.economyKeys.includes(state.lastDeal.key)) {
        return { ...state, rejection: 'That deal ticket is already booked. No second payout.' };
      }
      const dealerId = state.selectedDealerId;
      const dealer = state.block.placements.find((item) => item.memberId === dealerId);
      const productId = dealerId ? state.assignments[dealerId] : undefined;
      const product = state.inventory.find((item) => item.id === productId);
      if (!dealer || !product) {
        return { ...state, rejection: 'Equip product on the placed dealer before dealing.' };
      }
      const receipt = resolveLoopDeal({
        blockId: state.block.id,
        dealer,
        product,
        incomeMultiplier: state.block.incomeMultiplier ?? 1,
      });
      const playerHeat = Math.min(100, state.playerHeat + receipt.heatDelta);
      const threat = resolveThreatRoute({
        playerHeat,
        dealerExposure: dealer.exposureRisk,
      });
      return {
        ...state,
        phase: 'threat',
        money: state.money + receipt.moneyDelta,
        playerHeat,
        reputation: state.reputation + receipt.reputationDelta,
        lastDeal: receipt,
        threat,
        economyKeys: [...state.economyKeys, receipt.key],
        inventory: state.inventory.map((item) => (
          item.id === product.id ? { ...item, quantity: receipt.leftoverQuantity } : item
        )),
        block: {
          ...state.block,
          heat: Math.min(5, state.block.heat + (receipt.heatDelta >= 4 ? 1 : 0)),
        },
        rejection: null,
        briefing: [receipt.explanation, threat.reason],
      };
    }
    case 'begin-encounter': {
      if (!state.threat) {
        return { ...state, rejection: 'Run the deal so heat and exposure can name the threat.' };
      }
      return {
        ...state,
        phase: 'encounter',
        rejection: null,
        briefing: [
          `${state.threat.route === 'raid' ? 'Raid' : 'SLIDE'} opens on ${state.block.dnaId ?? 'this DNA board'}, not a default empty grid.`,
          state.mapFallbackNotice,
        ],
      };
    }
    case 'apply-encounter': {
      const key = command.result.idempotencyKey;
      if (state.appliedEncounterKeys.includes(key) || state.economyKeys.includes(key)) {
        return {
          ...state,
          phase: 'consequence',
          rejection: null,
          briefing: ['Same encounter ticket. Books stay still — no second wound, seizure, or heat spike.'],
        };
      }
      const healthWrite = command.healthWrite ?? 'ok';
      const downed = new Set(command.result.crewDown);
      const placements = state.block.placements.map((placement) => (
        downed.has(placement.memberId) && healthWrite === 'ok'
          ? { ...placement, health: 0 }
          : placement
      ));
      const members = state.members.map((member) => (
        downed.has(member.id) && healthWrite === 'ok'
          ? { ...member, health: 0, assignment: 'wounded' }
          : member
      ));
      const wounded = state.members.find((member) => downed.has(member.id));
      const recovery = wounded
        ? {
            memberId: wounded.id,
            memberName: wounded.name,
            kind: 'hospital' as const,
            cost: RECOVERY_CONFIG.HOSPITAL_BASE_COST,
            affordable: state.money >= RECOVERY_CONFIG.HOSPITAL_BASE_COST,
            waitLabel: 'Rest it off — no cash, morale dips, Dre stays off the board.',
            unpaidLabel: 'Street cash cannot cover hospital. Rest is the only recovery path.',
          }
        : null;
      return {
        ...state,
        phase: 'consequence',
        lastEncounter: command.result,
        appliedEncounterKeys: [...state.appliedEncounterKeys, key],
        economyKeys: [...state.economyKeys, key],
        pendingHealthIds: healthWrite === 'failed' ? command.result.crewDown : [],
        members,
        recovery,
        rejection: null,
        briefing: [
          command.result.summary,
          `Heat ${command.result.heatDelta >= 0 ? '+' : ''}${command.result.heatDelta}, morale ${command.result.moraleDelta}, pending cash ${command.result.pendingIncomeDelta}.`,
          healthWrite === 'failed'
            ? 'Health write failed. Economy already booked; retry only the wound, not the payout.'
            : 'Consequence is on the strip ledger.',
        ],
        block: {
          ...state.block,
          placements,
          heat: Math.max(0, Math.min(5, state.block.heat + command.result.heatDelta)),
          morale: Math.max(0, Math.min(100, state.block.morale + command.result.moraleDelta)),
          pendingIncome: Math.max(0, state.block.pendingIncome + command.result.pendingIncomeDelta),
          appliedEncounterResultKeys: [...(state.block.appliedEncounterResultKeys ?? []), key],
        },
      };
    }
    case 'retry-health': {
      if (state.pendingHealthIds.length === 0) {
        return { ...state, rejection: 'No failed health write to retry.' };
      }
      const pending = new Set(state.pendingHealthIds);
      return {
        ...state,
        pendingHealthIds: [],
        rejection: null,
        members: state.members.map((member) => (
          pending.has(member.id) ? { ...member, health: 0, assignment: 'wounded' } : member
        )),
        block: {
          ...state.block,
          placements: state.block.placements.map((placement) => (
            pending.has(placement.memberId) ? { ...placement, health: 0 } : placement
          )),
        },
        briefing: ['Health write retried. Money, heat, product, and morale were not applied again.'],
      };
    }
    case 'recover': {
      if (!state.recovery) {
        return { ...state, rejection: 'No recovery is pending.' };
      }
      if (command.pay && !state.recovery.affordable) {
        return {
          ...state,
          rejection: state.recovery.unpaidLabel,
          briefing: [state.recovery.unpaidLabel, state.recovery.waitLabel],
        };
      }
      if (command.pay) {
        return {
          ...state,
          money: state.money - state.recovery.cost,
          recovery: null,
          members: state.members.map((member) => (
            member.id === state.recovery?.memberId
              ? { ...member, health: member.maxHealth, assignment: 'active' }
              : member
          )),
          briefing: [`Paid $${state.recovery.cost} hospital. ${state.recovery.memberName} is back on the roster.`],
        };
      }
      return {
        ...state,
        recovery: null,
        members: state.members.map((member) => (
          member.id === state.recovery?.memberId
            ? { ...member, morale: Math.max(0, member.morale - 5), assignment: 'resting' }
            : member
        )),
        block: {
          ...state.block,
          morale: Math.max(0, state.block.morale - 5),
        },
        briefing: [state.recovery.waitLabel],
      };
    }
    case 'return-desktop': {
      return {
        ...state,
        phase: 'returned',
        rejection: null,
        briefing: [
          `Block ${state.block.dnaId} still owns the board.`,
          `Street cash $${state.money}. Heat ${state.playerHeat}. Product ${state.inventory[0]?.quantity ?? 0}.`,
          state.lastEncounter
            ? `Encounter ${state.lastEncounter.idempotencyKey} stays booked.`
            : 'No encounter ticket yet.',
        ],
      };
    }
    case 'hydrate-ledger':
      return applyLedger(state, command.ledger);
    default:
      return state;
  }
}

export function runLoopCommands(commands: LoopCommand[], initial: LoopState = createLoopState()): LoopState {
  return commands.reduce(reduceLoop, initial);
}

export function seededLoopEncounter(state: LoopState) {
  return createDeterministicLoopResult({
    blockId: state.block.id,
    dealerId: state.selectedDealerId ?? BLOCK_LOOP_IDS.dealerId,
    route: state.threat?.route ?? 'slide',
    outcome: 'overrun',
  });
}
