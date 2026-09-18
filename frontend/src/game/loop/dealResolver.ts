import { HEAT_CONFIG } from '../../utils/heatSystem';
import {
  TIER_CONFIG,
  blockZoneToDrugZone,
  canZoneAssignDrugs,
  type CraftedDrug,
} from '../../stores/useDrugInventory';
import type { BlockPlacement } from '../../types/block.types';
import type { DealReceipt } from './blockLoopTypes';

/**
 * Deterministic deal receipt.
 *
 * demandBonusPct = round(exposureRisk * 0.225)  → curb 80 = +18%
 * heatDelta      = max(1, round(regularHeat * productHeatMult + exposureRisk * 0.0125))
 * exposureDelta  = max(1, round(exposureRisk * 0.0875)) → curb 80 = +7
 * money          = round(units * (90 + quality) * (1 + demandBonusPct/100) * incomeMultiplier)
 * units          = clamp(1..quantity, round(2 + incomeModifier/20))
 */
export function resolveLoopDeal(input: {
  blockId: string;
  dealer: BlockPlacement;
  product: CraftedDrug;
  incomeMultiplier: number;
  shiftIndex?: number;
}): DealReceipt {
  const { dealer, product, incomeMultiplier, blockId } = input;
  const shiftIndex = input.shiftIndex ?? 1;
  const demandBonusPct = Math.round(dealer.exposureRisk * 0.225);
  const tier = TIER_CONFIG[product.tier];
  const heatDelta = Math.max(
    1,
    Math.round(HEAT_CONFIG.DEAL_HEAT.regular * tier.heatMultiplier + dealer.exposureRisk * 0.0125),
  );
  const exposureDelta = Math.max(1, Math.round(dealer.exposureRisk * 0.0875));
  const unitsSold = Math.max(
    1,
    Math.min(product.quantity, Math.round(2 + (dealer.incomePerTick || 40) / 20)),
  );
  const moneyDelta = Math.round(unitsSold * (90 + product.quality) * (1 + demandBonusPct / 100) * incomeMultiplier);
  const leftoverQuantity = Math.max(0, product.quantity - unitsSold);
  const explanation = `Street exposure +${demandBonusPct}% → higher demand, but heat +${heatDelta} and exposure +${exposureDelta}. ${unitsSold} River Cut moved for $${moneyDelta}.`;

  return {
    key: `deal:${blockId}:${dealer.memberId}:${dealer.x}:${dealer.y}:${product.id}:${shiftIndex}`,
    dealerId: dealer.memberId,
    productId: product.id,
    productName: product.name,
    productTier: product.tier,
    cell: {
      x: dealer.x,
      y: dealer.y,
      zoneType: dealer.zoneType,
      exposureRisk: dealer.exposureRisk,
    },
    moneyDelta,
    productDelta: -unitsSold,
    heatDelta,
    exposureDelta,
    reputationDelta: 1,
    demandBonusPct,
    leftoverQuantity,
    explanation,
  };
}

export function canAssignProductToDealer(zoneType: BlockPlacement['zoneType']): boolean {
  return canZoneAssignDrugs(blockZoneToDrugZone(zoneType));
}
