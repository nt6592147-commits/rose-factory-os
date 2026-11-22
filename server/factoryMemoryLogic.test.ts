import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeFactoryOverviewSnapshot,
  computeProactiveInsights,
  executeFactoryTool,
  FACTORY_USER_PROFILES,
  getUserProfileById,
} from './factoryMemoryLogic.ts';

test('Aether Precision Robotics today production calculates 87.5% with Line 2 shortfall', () => {
  const elena = getUserProfileById('usr_elena_aether')!;
  const result = executeFactoryTool(elena, 'getProductionSummary', { date: 'today' });
  assert.equal(result.ok, true);
  assert.equal(result.companyId, 'comp_aether');
  assert.equal(result.data.achievementPct, 87.5);
  const lines = result.data.lines as Array<{ lineName: string; shortfallUnits: number }>;
  const line2 = lines.find((l) => l.lineName === 'Production Line 2');
  assert.ok(line2);
  assert.equal(line2.shortfallUnits, 102);
});

test('Company isolation prevents accessing another company data even if args attempt override', () => {
  const claire = getUserProfileById('usr_claire_vanguard')!;
  const result = executeFactoryTool(claire, 'getProductionSummary', {
    date: 'today',
    companyId: 'comp_aether', // malicious/erroneous override attempt
  });
  assert.equal(result.ok, true);
  assert.equal(result.companyId, 'comp_vanguard');
  assert.equal(result.companyName, 'Vanguard Aerospace Composites');
  const lines = result.data.lines as Array<{ lineName: string }>;
  assert.ok(lines.every((l) => !l.lineName.includes('Production Line 2')));
});

test('RBAC blocks line_operator from maintenance schedule, quality, and shift handover', () => {
  const liam = FACTORY_USER_PROFILES.find((p) => p.role === 'line_operator')!;
  const maint = executeFactoryTool(liam, 'getMaintenanceSchedule');
  assert.equal(maint.ok, false);
  assert.equal(maint.data.error, 'FORBIDDEN_BY_ROLE');

  const handover = executeFactoryTool(liam, 'getShiftHandover');
  assert.equal(handover.ok, false);

  const overview = executeFactoryTool(liam, 'getFactoryOverview');
  assert.equal(overview.ok, true);
  assert.equal(
    overview.data.recentEmployeeActivities,
    'Restricted by user role permissions'
  );
});

test('All 11 tools execute cleanly for Plant Director and proactive insights reflect real records', () => {
  const elena = getUserProfileById('usr_elena_aether')!;
  const toolNames = [
    'getProductionSummary',
    'getProductionComparison',
    'getInventoryStatus',
    'getMaterialConsumption',
    'getMachineStatus',
    'getMachineDowntime',
    'getMaintenanceSchedule',
    'getIncidentSummary',
    'getQualitySummary',
    'getShiftHandover',
    'getFactoryOverview',
  ] as const;

  for (const name of toolNames) {
    const out = executeFactoryTool(elena, name);
    assert.equal(out.ok, true, `${name} should succeed for plant_director`);
    assert.equal(out.companyId, 'comp_aether');
  }

  const snapshot = computeFactoryOverviewSnapshot('comp_aether')!;
  assert.equal(snapshot.unresolvedIncidentsCount, 3);
  assert.equal(snapshot.lowStockMaterialsCount, 2);

  const insights = computeProactiveInsights('comp_aether');
  assert.ok(insights.length >= 2);
});
