import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBlockStore } from './blockStore';
import type { BlockData } from '../types/block.types';
import type { CombatResult } from '../game/combat/types';
import { apiBlockToBlockData } from '../utils/blockMappers';
import { prepareEncounter } from '../game/combat/prepareEncounter';

const { placeMembersMock } = vi.hoisted(() => ({
  placeMembersMock: vi.fn(),
}));

vi.mock('../services/api.service', () => ({
  blocksApi: { placeMembers: placeMembersMock },
}));

function block(): BlockData {
  return {
    id: 'block-1',
    address: 'Fictional Reference',
    lat: 0,
    lng: 0,
    owner: 'player',
    grid: [[{
      x: 0, y: 0, zoneType: 'sidewalk', incomeModifier: 60, exposureRisk: 50,
      coverScore: 0.3, passable: true, occupantId: 'crew-1',
    }]],
    placements: [{
      memberId: 'crew-1', memberName: 'Scout', role: 'shooter', x: 0, y: 0,
      zoneType: 'sidewalk', incomePerTick: 0, exposureRisk: 50, level: 1, health: 100,
    }],
    incomePerTick: 0,
    heat: 2,
    morale: 70,
    members: 1,
    viewMode: 'topdown',
    pendingIncome: 100,
    liveRevision: 1,
  };
}

const result: CombatResult = {
  idempotencyKey: 'encounter-1:overrun',
  outcome: 'overrun',
  crewDown: ['crew-1'],
  oppositionDown: [],
  objectiveProgress: 0,
  heatDelta: 2,
  moraleDelta: -12,
  pendingIncomeDelta: -50,
  summary: 'The crew was overrun.',
};

describe('blockStore unified encounter outcomes', () => {
  beforeEach(() => {
    placeMembersMock.mockReset();
    useBlockStore.setState({
      blocks: { 'block-1': block() },
      selectedBlockId: 'block-1',
      activeDriveBys: {},
      isPlacementMode: false,
      pendingPlacementMemberId: null,
      pendingPlacementMember: null,
    });
  });

  it('projects a result exactly once and persists crew-down health through the placement queue', async () => {
    placeMembersMock.mockResolvedValueOnce({
      success: true,
      liveRevision: 2,
      incomePerTick: 0,
      placements: [{
        memberId: 'crew-1', memberName: 'Server Scout', role: 'shooter', gridX: 0, gridY: 0,
        zoneType: 'sidewalk', incomePerTick: 0, exposureRisk: 50, level: 1, health: 0,
      }],
    });
    useBlockStore.getState().applyEncounterResult('block-1', result);
    useBlockStore.getState().applyEncounterResult('block-1', result);

    await vi.waitFor(() => expect(placeMembersMock).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => {
      expect(useBlockStore.getState().blocks['block-1'].placements[0]).toMatchObject({
        health: 0,
        memberName: 'Server Scout',
      });
    });
    const resolved = useBlockStore.getState().blocks['block-1'];

    expect(resolved.placements[0].health).toBe(0);
    expect(resolved.heat).toBe(4);
    expect(resolved.morale).toBe(58);
    expect(resolved.pendingIncome).toBe(50);
    expect(resolved.appliedEncounterResultKeys).toEqual(['encounter-1:overrun']);
    expect(placeMembersMock.mock.calls[0][1][0].health).toBe(0);
  });

  it('does not reapply a consequence after its persisted receipt is reloaded', () => {
    const reloaded = apiBlockToBlockData({
      id: 'block-1',
      address: 'Fictional Reference',
      lat: 25.7752,
      lng: -80.1748,
      dnaId: 'harbor-spur',
      heat: 4,
      morale: 58,
      pendingIncome: 50,
      lastEncounterResultKey: result.idempotencyKey,
      placements: [{
        memberId: 'crew-1', memberName: 'Scout', role: 'shooter', x: 0, y: 2,
        zoneType: 'parking', incomePerTick: 0, exposureRisk: 40, level: 1, health: 0,
      }],
    });
    useBlockStore.setState({ blocks: { 'block-1': reloaded } });

    useBlockStore.getState().applyEncounterResult('block-1', result);
    const afterRetry = useBlockStore.getState().blocks['block-1'];

    expect(afterRetry).toEqual(reloaded);
    expect(afterRetry.placements[0].health).toBe(0);
    expect(afterRetry.appliedEncounterResultKeys).toEqual(['encounter-1:overrun']);
  });

  it('retries failed crew-health persistence without replaying economy deltas', async () => {
    placeMembersMock
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({
        success: true,
        liveRevision: 2,
        incomePerTick: 0,
        placements: [{
          memberId: 'crew-1', memberName: 'Recovered Scout', role: 'shooter', gridX: 0, gridY: 0,
          zoneType: 'sidewalk', incomePerTick: 0, exposureRisk: 50, level: 1, health: 0,
        }],
      });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    useBlockStore.getState().applyEncounterResult('block-1', result);
    await vi.waitFor(() => {
      expect(useBlockStore.getState().blocks['block-1'].placements[0].health).toBe(100);
    });
    const afterFailure = useBlockStore.getState().blocks['block-1'];
    expect(afterFailure).toMatchObject({ heat: 4, morale: 58, pendingIncome: 50 });

    useBlockStore.getState().applyEncounterResult('block-1', result);
    await vi.waitFor(() => expect(placeMembersMock).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => {
      expect(useBlockStore.getState().blocks['block-1'].placements[0]).toMatchObject({
        health: 0,
        memberName: 'Recovered Scout',
      });
    });
    expect(useBlockStore.getState().blocks['block-1']).toMatchObject({
      heat: 4,
      morale: 58,
      pendingIncome: 50,
      appliedEncounterResultKeys: ['encounter-1:overrun'],
    });
    warning.mockRestore();
  });

  it('unions encounter receipts in either hydration order without replacing the later block', () => {
    const flaskBlock = block();
    const supabaseBlock = {
      ...block(),
      address: 'Partial projection',
      appliedEncounterResultKeys: ['encounter-0:secured', result.idempotencyKey],
    };

    useBlockStore.setState({ blocks: {} });
    useBlockStore.getState().upsertBlock(flaskBlock);
    useBlockStore.getState().upsertBlock(supabaseBlock);
    expect(useBlockStore.getState().blocks['block-1'].appliedEncounterResultKeys).toEqual([
      'encounter-0:secured', result.idempotencyKey,
    ]);

    useBlockStore.setState({ blocks: {} });
    useBlockStore.getState().upsertBlock(supabaseBlock);
    useBlockStore.getState().upsertBlock(flaskBlock);
    const hydrated = useBlockStore.getState().blocks['block-1'];
    expect(hydrated.address).toBe(flaskBlock.address);
    expect(hydrated.appliedEncounterResultKeys).toEqual([
      'encounter-0:secured', result.idempotencyKey,
    ]);

    useBlockStore.getState().applyEncounterResult('block-1', { ...result, crewDown: [] });
    expect(useBlockStore.getState().blocks['block-1']).toEqual(hydrated);
  });

  it('retains the current receipt when a full stale hydration ledger arrives', () => {
    const currentKey = 'encounter-current:secured';
    const staleKeys = Array.from({ length: 24 }, (_, index) => `encounter-old-${index}:secured`);
    useBlockStore.setState({
      blocks: { 'block-1': { ...block(), appliedEncounterResultKeys: [currentKey] } },
    });

    useBlockStore.getState().upsertBlock({
      ...block(),
      appliedEncounterResultKeys: staleKeys,
    });

    const keys = useBlockStore.getState().blocks['block-1'].appliedEncounterResultKeys ?? [];
    expect(keys).toHaveLength(24);
    expect(keys).toContain(currentKey);
    expect(keys).not.toContain(staleKeys[0]);
  });

  it('accepts a hydration ledger that extends the full current history', () => {
    const currentKeys = Array.from({ length: 24 }, (_, index) => `encounter-${index}:secured`);
    const newestKey = 'encounter-24:secured';
    useBlockStore.setState({
      blocks: { 'block-1': { ...block(), appliedEncounterResultKeys: currentKeys } },
    });

    useBlockStore.getState().upsertBlock({
      ...block(),
      appliedEncounterResultKeys: [...currentKeys.slice(1), newestKey],
    });

    const keys = useBlockStore.getState().blocks['block-1'].appliedEncounterResultKeys ?? [];
    expect(keys).toHaveLength(24);
    expect(keys).toContain(newestKey);
    expect(keys).not.toContain(currentKeys[0]);
  });

  it('does not let a pre-result hydration restore consumed economy or crew health', () => {
    const current = {
      ...block(),
      heat: 4,
      morale: 58,
      pendingIncome: 50,
      placements: [{ ...block().placements[0], health: 0 }],
      appliedEncounterResultKeys: [result.idempotencyKey],
    };
    useBlockStore.setState({ blocks: { 'block-1': current } });

    const stale = {
      ...block(),
      placements: [],
      incomePerTick: 999,
      members: 0,
    };
    useBlockStore.getState().upsertBlock(stale);

    const afterStaleHydration = useBlockStore.getState().blocks['block-1'];
    expect(afterStaleHydration).toMatchObject({
      heat: 4,
      morale: 58,
      pendingIncome: 50,
      appliedEncounterResultKeys: [result.idempotencyKey],
    });
    expect(afterStaleHydration.placements[0].health).toBe(0);
    expect(afterStaleHydration).toMatchObject({ incomePerTick: 0, members: 1 });
  });

  it('reconciles optimistic placement with server-preserved member health', async () => {
    placeMembersMock.mockResolvedValueOnce({
      success: true,
      liveRevision: 2,
      incomePerTick: 0,
      placements: [{
        memberId: 'crew-1', memberName: 'Scout', role: 'shooter', gridX: 0, gridY: 0,
        zoneType: 'sidewalk', incomePerTick: 0, exposureRisk: 50, level: 1, health: 0,
      }],
    });

    useBlockStore.getState().placeMember('block-1', {
      ...block().placements[0],
      health: 100,
    });

    await vi.waitFor(() => {
      expect(useBlockStore.getState().blocks['block-1'].placements[0].health).toBe(0);
    });
    expect(useBlockStore.getState().blocks['block-1'].grid[0][0].occupantId).toBe('crew-1');
  });

  it('persists member removal through the same authoritative replacement queue', async () => {
    placeMembersMock.mockResolvedValueOnce({
      success: true,
      liveRevision: 2,
      incomePerTick: 0,
      placements: [],
    });

    useBlockStore.getState().removeMemberFromBlock('block-1', 'crew-1');

    await vi.waitFor(() => expect(placeMembersMock).toHaveBeenCalledWith('block-1', []));
    await vi.waitFor(() => {
      expect(useBlockStore.getState().blocks['block-1'].placements).toEqual([]);
    });
    expect(useBlockStore.getState().blocks['block-1'].grid[0][0].occupantId).toBeNull();
  });

  it('keeps the backend-free seeded demo locally playable', () => {
    const demo = { ...block(), id: 'demo-block-las-olas' };
    useBlockStore.setState({ blocks: { [demo.id]: demo } });

    useBlockStore.getState().removeMemberFromBlock(demo.id, 'crew-1');

    expect(useBlockStore.getState().blocks[demo.id].placements).toEqual([]);
    expect(placeMembersMock).not.toHaveBeenCalled();
  });

  it('serializes repeated placement snapshots so the newest request persists last', async () => {
    type PlacementReply = {
      success: boolean;
      liveRevision: number;
      incomePerTick: number;
      placements: Record<string, unknown>[];
    };
    let resolveFirst!: (reply: PlacementReply) => void;
    let resolveSecond!: (reply: PlacementReply) => void;
    placeMembersMock
      .mockImplementationOnce(() => new Promise<PlacementReply>((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise<PlacementReply>((resolve) => { resolveSecond = resolve; }));
    const initial = block();
    initial.grid = [[
      initial.grid[0][0],
      { ...initial.grid[0][0], x: 1, occupantId: null },
    ]];
    useBlockStore.setState({ blocks: { 'block-1': initial } });

    useBlockStore.getState().placeMember('block-1', { ...initial.placements[0], x: 1 });
    useBlockStore.getState().placeMember('block-1', { ...initial.placements[0], x: 0 });
    await vi.waitFor(() => expect(placeMembersMock).toHaveBeenCalledTimes(1));

    resolveFirst({
      success: true,
      liveRevision: 2,
      incomePerTick: 0,
      placements: [{ ...initial.placements[0], gridX: 1, gridY: 0 }],
    });
    await vi.waitFor(() => expect(placeMembersMock).toHaveBeenCalledTimes(2));
    resolveSecond({
      success: true,
      liveRevision: 3,
      incomePerTick: 0,
      placements: [{ ...initial.placements[0], gridX: 0, gridY: 0 }],
    });

    await vi.waitFor(() => {
      expect(useBlockStore.getState().blocks['block-1'].placements[0].x).toBe(0);
    });
    expect(useBlockStore.getState().blocks['block-1'].grid[0][0].occupantId).toBe('crew-1');
    expect(useBlockStore.getState().blocks['block-1'].grid[0][1].occupantId).toBeNull();
  });

  it('lets the newest identical replacement reconcile after an older failure', async () => {
    type PlacementReply = {
      success: boolean;
      liveRevision: number;
      incomePerTick: number;
      placements: Record<string, unknown>[];
    };
    let rejectFirst!: (error: Error) => void;
    let resolveSecond!: (reply: PlacementReply) => void;
    placeMembersMock
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject; }))
      .mockImplementationOnce(() => new Promise<PlacementReply>((resolve) => { resolveSecond = resolve; }));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const requested = { ...block().placements[0], memberName: 'Requested Scout' };

    useBlockStore.getState().placeMember('block-1', requested);
    useBlockStore.getState().placeMember('block-1', requested);
    await vi.waitFor(() => expect(placeMembersMock).toHaveBeenCalledTimes(1));
    rejectFirst(new Error('older write failed'));
    await vi.waitFor(() => expect(placeMembersMock).toHaveBeenCalledTimes(2));
    expect(useBlockStore.getState().blocks['block-1'].placements[0].memberName).toBe('Requested Scout');
    resolveSecond({
      success: true,
      liveRevision: 3,
      incomePerTick: 0,
      placements: [{
        ...requested,
        memberName: 'Server Scout',
        gridX: 0,
        gridY: 0,
      }],
    });

    await vi.waitFor(() => {
      expect(useBlockStore.getState().blocks['block-1'].placements[0].memberName).toBe('Server Scout');
    });
    warning.mockRestore();
  });

  it('reconciles placement occupants onto a newer hydrated grid', async () => {
    type PlacementReply = {
      success: boolean;
      liveRevision: number;
      incomePerTick: number;
      placements: Record<string, unknown>[];
    };
    let resolvePlacement!: (reply: PlacementReply) => void;
    placeMembersMock.mockImplementationOnce(() => new Promise<PlacementReply>(
      (resolve) => { resolvePlacement = resolve; },
    ));
    const initial = block();
    initial.grid = [[{ ...initial.grid[0][0], passable: false, occupantId: null }]];
    useBlockStore.setState({ blocks: { 'block-1': initial } });
    const requested = { ...initial.placements[0], memberName: 'Requested Scout' };
    useBlockStore.getState().placeMember('block-1', requested);
    await vi.waitFor(() => expect(placeMembersMock).toHaveBeenCalledTimes(1));

    const hydrated = useBlockStore.getState().blocks['block-1'];
    useBlockStore.getState().upsertBlock({
      ...hydrated,
      grid: [[{
        ...hydrated.grid[0][0],
        zoneType: 'alley',
        coverScore: 0.8,
        passable: true,
      }]],
    });
    resolvePlacement({
      success: true,
      liveRevision: 2,
      incomePerTick: 0,
      placements: [{ ...requested, memberName: 'Server Scout', gridX: 0, gridY: 0 }],
    });

    await vi.waitFor(() => {
      expect(useBlockStore.getState().blocks['block-1'].placements[0].memberName).toBe('Server Scout');
    });
    expect(useBlockStore.getState().blocks['block-1'].grid[0][0]).toMatchObject({
      zoneType: 'alley',
      coverScore: 0.8,
      occupantId: 'crew-1',
    });
  });

  it('prepares encounters from the last server-confirmed placement snapshot', async () => {
    type PlacementReply = {
      success: boolean;
      liveRevision: number;
      incomePerTick: number;
      placements: Record<string, unknown>[];
    };
    let resolvePlacement!: (reply: PlacementReply) => void;
    placeMembersMock.mockImplementationOnce(() => new Promise<PlacementReply>(
      (resolve) => { resolvePlacement = resolve; },
    ));
    const initial = block();
    initial.grid = [[
      initial.grid[0][0],
      { ...initial.grid[0][0], x: 1, occupantId: null },
    ]];
    useBlockStore.setState({ blocks: { 'block-1': initial } });
    useBlockStore.getState().placeMember('block-1', {
      ...initial.placements[0],
      memberId: 'crew-2',
      memberName: 'Pending Crew',
      x: 1,
    });
    await vi.waitFor(() => expect(placeMembersMock).toHaveBeenCalledTimes(1));

    expect(prepareEncounter(useBlockStore.getState().blocks['block-1']).crew.map(
      (member) => member.id,
    )).toEqual(['crew-1']);

    resolvePlacement({
      success: true,
      liveRevision: 2,
      incomePerTick: 0,
      placements: [
        { ...initial.placements[0], gridX: 0, gridY: 0 },
        {
          ...initial.placements[0], memberId: 'crew-2', memberName: 'Server Crew',
          gridX: 1, gridY: 0,
        },
      ],
    });
    await vi.waitFor(() => {
      expect(useBlockStore.getState().blocks['block-1'].placements).toHaveLength(2);
    });
    expect(prepareEncounter(useBlockStore.getState().blocks['block-1']).crew.map(
      (member) => member.id,
    )).toEqual(['crew-1', 'crew-2']);
  });

  it('keeps an optimistic replacement through stale hydration and rejects it after revision advances', async () => {
    type PlacementReply = {
      success: boolean;
      liveRevision: number;
      incomePerTick: number;
      placements: Record<string, unknown>[];
    };
    let resolvePlacement!: (reply: PlacementReply) => void;
    placeMembersMock.mockImplementationOnce(() => new Promise<PlacementReply>(
      (resolve) => { resolvePlacement = resolve; },
    ));
    const initial = block();
    initial.grid = [[
      initial.grid[0][0],
      { ...initial.grid[0][0], x: 1, occupantId: null },
    ]];
    useBlockStore.setState({ blocks: { 'block-1': initial } });

    const pendingCrew = {
      ...initial.placements[0], memberId: 'crew-2', memberName: 'Pending Crew', x: 1,
    };
    useBlockStore.getState().placeMember('block-1', pendingCrew);
    await vi.waitFor(() => expect(placeMembersMock).toHaveBeenCalledTimes(1));

    useBlockStore.getState().upsertBlock(initial);
    expect(useBlockStore.getState().blocks['block-1'].placements.map(
      (placement) => placement.memberId,
    )).toEqual(['crew-1', 'crew-2']);

    resolvePlacement({
      success: true,
      liveRevision: 2,
      incomePerTick: 0,
      placements: [
        { ...initial.placements[0], gridX: 0, gridY: 0 },
        { ...pendingCrew, memberName: 'Server Crew', gridX: 1, gridY: 0 },
      ],
    });
    await vi.waitFor(() => {
      expect(useBlockStore.getState().blocks['block-1']).toMatchObject({ liveRevision: 2 });
      expect(useBlockStore.getState().blocks['block-1'].placements).toHaveLength(2);
    });
    await Promise.resolve();
    await Promise.resolve();

    useBlockStore.getState().upsertBlock(initial);
    const afterLateHydration = useBlockStore.getState().blocks['block-1'];
    expect(afterLateHydration.liveRevision).toBe(2);
    expect(afterLateHydration.placements.map((placement) => placement.memberId)).toEqual([
      'crew-1', 'crew-2',
    ]);
    expect(afterLateHydration.grid[0][1].occupantId).toBe('crew-2');
  });

  it('serializes a downed confirmed defender after their removal was still pending', async () => {
    type PlacementReply = {
      success: boolean;
      liveRevision: number;
      incomePerTick: number;
      placements: Record<string, unknown>[];
    };
    let resolveRemoval!: (reply: PlacementReply) => void;
    let resolveConsequence!: (reply: PlacementReply) => void;
    placeMembersMock
      .mockImplementationOnce(() => new Promise<PlacementReply>(
        (resolve) => { resolveRemoval = resolve; },
      ))
      .mockImplementationOnce(() => new Promise<PlacementReply>(
        (resolve) => { resolveConsequence = resolve; },
      ));

    useBlockStore.getState().removeMemberFromBlock('block-1', 'crew-1');
    await vi.waitFor(() => expect(placeMembersMock).toHaveBeenCalledTimes(1));
    const encounter = prepareEncounter(useBlockStore.getState().blocks['block-1']);
    expect(encounter.crew.map((member) => member.id)).toEqual(['crew-1']);

    useBlockStore.getState().applyEncounterResult('block-1', result);
    expect(useBlockStore.getState().blocks['block-1'].placements[0]).toMatchObject({
      memberId: 'crew-1', health: 0,
    });
    resolveRemoval({
      success: true, liveRevision: 2, incomePerTick: 0, placements: [],
    });
    await vi.waitFor(() => expect(placeMembersMock).toHaveBeenCalledTimes(2));
    expect(placeMembersMock.mock.calls[1][1]).toEqual([
      expect.objectContaining({ memberId: 'crew-1', health: 0 }),
    ]);
    resolveConsequence({
      success: true,
      liveRevision: 3,
      incomePerTick: 0,
      placements: [{ ...block().placements[0], gridX: 0, gridY: 0, health: 0 }],
    });

    await vi.waitFor(() => {
      expect(useBlockStore.getState().blocks['block-1']).toMatchObject({ liveRevision: 3 });
      expect(useBlockStore.getState().blocks['block-1'].placements[0]).toMatchObject({
        memberId: 'crew-1', health: 0,
      });
    });
  });

  it('keeps split encounter state coherent through same-receipt stale hydration', async () => {
    type PlacementReply = {
      success: boolean;
      liveRevision: number;
      incomePerTick: number;
      placements: Record<string, unknown>[];
    };
    let resolveConsequence!: (reply: PlacementReply) => void;
    placeMembersMock.mockImplementationOnce(() => new Promise<PlacementReply>(
      (resolve) => { resolveConsequence = resolve; },
    ));

    useBlockStore.getState().applyEncounterResult('block-1', result);
    await vi.waitFor(() => expect(placeMembersMock).toHaveBeenCalledTimes(1));
    useBlockStore.getState().upsertBlock({
      ...block(),
      appliedEncounterResultKeys: [result.idempotencyKey],
    });
    expect(useBlockStore.getState().blocks['block-1']).toMatchObject({
      heat: 4,
      morale: 58,
      pendingIncome: 50,
      placements: [expect.objectContaining({ health: 0 })],
    });

    resolveConsequence({
      success: true,
      liveRevision: 2,
      incomePerTick: 0,
      placements: [{ ...block().placements[0], gridX: 0, gridY: 0, health: 0 }],
    });
    await vi.waitFor(() => {
      expect(useBlockStore.getState().blocks['block-1'].liveRevision).toBe(2);
    });
    useBlockStore.getState().upsertBlock({
      ...block(),
      appliedEncounterResultKeys: [result.idempotencyKey],
    });
    expect(useBlockStore.getState().blocks['block-1']).toMatchObject({
      liveRevision: 2,
      heat: 4,
      morale: 58,
      pendingIncome: 50,
      placements: [expect.objectContaining({ health: 0 })],
    });
  });

  it('rolls dependent rejected snapshots back to the last server-confirmed placement state', async () => {
    let rejectFirst!: (error: Error) => void;
    let rejectSecond!: (error: Error) => void;
    placeMembersMock
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject; }))
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSecond = reject; }));
    const initial = block();
    initial.grid = [[
      initial.grid[0][0],
      { ...initial.grid[0][0], x: 1, occupantId: null },
      { ...initial.grid[0][0], x: 2, occupantId: null },
    ]];
    useBlockStore.setState({ blocks: { 'block-1': initial } });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    useBlockStore.getState().placeMember('block-1', {
      ...initial.placements[0], memberId: 'unowned-2', memberName: 'Rejected Two', x: 1,
    });
    useBlockStore.getState().placeMember('block-1', {
      ...initial.placements[0], memberId: 'unowned-3', memberName: 'Rejected Three', x: 2,
    });
    await vi.waitFor(() => expect(placeMembersMock).toHaveBeenCalledTimes(1));

    rejectFirst(new Error('unowned member'));
    await vi.waitFor(() => expect(placeMembersMock).toHaveBeenCalledTimes(2));
    expect(placeMembersMock.mock.calls[1][1]).toHaveLength(3);
    rejectSecond(new Error('dependent snapshot rejected'));

    await vi.waitFor(() => {
      expect(useBlockStore.getState().blocks['block-1'].placements).toEqual(initial.placements);
    });
    expect(useBlockStore.getState().blocks['block-1'].grid).toEqual(initial.grid);
    expect(warning).toHaveBeenCalledTimes(2);
    warning.mockRestore();
  });

  it('rolls back an optimistic placement when the server rejects it', async () => {
    const previous = block();
    useBlockStore.setState({ blocks: { 'block-1': previous } });
    placeMembersMock.mockRejectedValueOnce(new Error('invalid placement'));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    useBlockStore.getState().placeMember('block-1', {
      ...previous.placements[0],
      memberId: 'crew-2',
      memberName: 'New Recruit',
    });

    await vi.waitFor(() => {
      expect(useBlockStore.getState().blocks['block-1'].placements).toEqual(previous.placements);
    });
    expect(useBlockStore.getState().blocks['block-1'].grid).toEqual(previous.grid);
    expect(warning).toHaveBeenCalledWith(
      '[blockStore] place sync skipped:',
      expect.any(Error),
    );
    warning.mockRestore();
  });

  it('keeps claim, placement, encounter terrain, consequence, and reload coherent', async () => {
    const zoneLayout = ['street', 'curb', 'sidewalk', 'storefront', 'alley', 'parking', 'rooftop', 'building'];
    const tiles = zoneLayout.map((type, y) => Array.from({ length: 8 }, (_, x) => ({
      x,
      y,
      type,
      cover: y === 3 ? 0.72 : 0.25,
      visibility: y === 3 ? 0.18 : 0.65,
      deployable: !['street', 'building'].includes(type),
    })));
    const claimPayload = {
      id: 'connected-block',
      address: 'Fictional Connected Block',
      lat: 25.7617,
      lng: -80.1918,
      dnaSnapshot: {
        dnaId: 'brickell-highrise',
        catalogVersion: 'v2',
        zoneLayout,
        incomeMultiplier: 2.1,
        heatDecayMultiplier: 0.7,
        globalCoverBonus: 0.12,
        startingMorale: 72,
        maxMembers: 5,
      },
      gridData: {
        grid: { width: 8, height: 8, tiles },
        metadata: { gridContract: {
          name: 'block-dna-grid', version: 1,
          layoutSource: 'block-dna-snapshot', globalCoverBonusApplied: true,
        } },
      },
      heatLevel: 2,
      pendingIncome: 100,
      placements: [{
        memberId: 'crew-1', memberName: 'Scout', role: 'shooter', gridX: 2, gridY: 3,
        zoneType: 'storefront', incomePerTick: 40, exposureRisk: 18, level: 1, health: 100,
      }],
    };
    const claimed = apiBlockToBlockData(claimPayload);
    const encounter = prepareEncounter(claimed);

    expect(claimed.gridSource).toBe('server');
    expect(claimed.placements[0]).toMatchObject({ x: 2, y: 3, zoneType: 'storefront' });
    expect(encounter.crew[0].position).toEqual({ x: 2, y: 3 });
    expect(encounter.terrain[3][2]).toMatchObject({ cover: 0.72, exposure: 0.18 });

    useBlockStore.setState({ blocks: { 'connected-block': claimed } });
    placeMembersMock.mockResolvedValueOnce({
      success: true,
      liveRevision: 2,
      incomePerTick: 0,
      placements: [{
        ...claimPayload.placements[0],
        memberName: 'Server Scout',
        health: 0,
      }],
    });
    useBlockStore.getState().applyEncounterResult('connected-block', result);
    await vi.waitFor(() => expect(placeMembersMock).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => {
      expect(useBlockStore.getState().blocks['connected-block'].placements[0]).toMatchObject({
        health: 0,
        memberName: 'Server Scout',
      });
    });
    const resolved = useBlockStore.getState().blocks['connected-block'];
    const reloaded = apiBlockToBlockData({
      ...claimPayload,
      heatLevel: resolved.heat,
      morale: resolved.morale,
      pendingIncome: resolved.pendingIncome,
      lastEncounterResultKey: result.idempotencyKey,
      placements: resolved.placements,
    });

    expect(reloaded.dnaId).toBe(claimed.dnaId);
    expect(reloaded.grid[3][2]).toMatchObject({ coverScore: 0.72, exposureRisk: 18 });
    expect(reloaded.placements[0].health).toBe(0);
    expect(reloaded).toMatchObject({ heat: 4, morale: 60, pendingIncome: 50 });

    useBlockStore.setState({ blocks: { 'connected-block': reloaded } });
    useBlockStore.getState().applyEncounterResult('connected-block', result);
    expect(useBlockStore.getState().blocks['connected-block']).toEqual(reloaded);
  });
});
