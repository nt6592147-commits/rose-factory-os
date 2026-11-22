import type {
  FactoryOverviewSnapshot,
  ProactiveInsight,
  UserProfile,
  UserRole,
} from '../src/types/rose.ts';

export interface ProductionLineRecord {
  lineId: string;
  lineName: string;
  productSku: string;
  productName: string;
  shift: 'Shift 1' | 'Shift 2' | 'Shift 3';
  dateLabel: 'today' | 'yesterday';
  targetUnits: number;
  actualUnits: number;
  scrapUnits: number;
  oeePct: number;
  notes: string;
}

export interface MaterialInventoryRecord {
  materialId: string;
  name: string;
  sku: string;
  unit: string;
  onHand: number;
  reorderThreshold: number;
  dailyConsumption: number;
  consumedToday: number;
  supplier: string;
  warehouseZone: string;
}

export interface MachineRecord {
  machineId: string;
  name: string;
  lineId: string;
  lineName: string;
  status: 'operational' | 'degraded' | 'maintenance' | 'offline';
  utilizationPct: number;
  temperatureC: number;
  vibrationMmS: number;
  downtimeMinutesToday: number;
  downtimeReason: string | null;
  nextMaintenanceDate: string;
  maintenanceType: string;
  assignedTechnician: string;
}

export interface IncidentRecord {
  incidentId: string;
  machineId: string;
  machineName: string;
  lineName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved';
  reportedAt: string;
  summary: string;
  assignedTo: string;
}

export interface QualityInspectionRecord {
  inspectionId: string;
  batchCode: string;
  lineName: string;
  productName: string;
  inspectedCount: number;
  passedCount: number;
  defectCount: number;
  primaryDefectType: string | null;
  inspector: string;
  timestamp: string;
}

export interface ShiftHandoverRecord {
  handoverId: string;
  shiftFrom: string;
  shiftTo: string;
  outgoingLead: string;
  incomingLead: string;
  timestamp: string;
  keyObservations: string[];
  openActionItems: string[];
}

export interface EmployeeActivityRecord {
  activityId: string;
  employeeName: string;
  roleTitle: string;
  shift: string;
  area: string;
  actionSummary: string;
  timestamp: string;
}

export interface CompanyFactoryDataset {
  companyId: string;
  companyName: string;
  plantLocation: string;
  currentShift: string;
  products: Array<{ sku: string; name: string; cycleTimeSec: number; specStandard: string }>;
  productionRecords: ProductionLineRecord[];
  materials: MaterialInventoryRecord[];
  machines: MachineRecord[];
  incidents: IncidentRecord[];
  qualityInspections: QualityInspectionRecord[];
  shiftHandovers: ShiftHandoverRecord[];
  employeeActivities: EmployeeActivityRecord[];
}

export const FACTORY_USER_PROFILES: UserProfile[] = [
  {
    userId: 'usr_elena_aether',
    name: 'Elena Vance',
    title: 'Plant Director',
    role: 'plant_director',
    companyId: 'comp_aether',
    companyName: 'Aether Precision Robotics',
    plantLocation: 'Munich Facility · Hall B',
    permissions: [
      'read:production',
      'read:inventory',
      'read:machines',
      'read:maintenance',
      'read:incidents',
      'read:quality',
      'read:handover',
      'read:employee_activity',
    ],
  },
  {
    userId: 'usr_marcus_aether',
    name: 'Marcus Sterling',
    title: 'Shift 2 Supervisor',
    role: 'shift_supervisor',
    companyId: 'comp_aether',
    companyName: 'Aether Precision Robotics',
    plantLocation: 'Munich Facility · Hall B',
    permissions: [
      'read:production',
      'read:inventory',
      'read:machines',
      'read:maintenance',
      'read:incidents',
      'read:quality',
      'read:handover',
    ],
  },
  {
    userId: 'usr_liam_aether',
    name: 'Liam O’Connor',
    title: 'Line 2 Operator',
    role: 'line_operator',
    companyId: 'comp_aether',
    companyName: 'Aether Precision Robotics',
    plantLocation: 'Munich Facility · Hall B',
    permissions: ['read:production', 'read:machines', 'read:incidents', 'read:inventory'],
  },
  {
    userId: 'usr_claire_vanguard',
    name: 'Claire Moreau',
    title: 'VP of Operations',
    role: 'operations_manager',
    companyId: 'comp_vanguard',
    companyName: 'Vanguard Aerospace Composites',
    plantLocation: 'Toulouse Plant · Sector 4',
    permissions: [
      'read:production',
      'read:inventory',
      'read:machines',
      'read:maintenance',
      'read:incidents',
      'read:quality',
      'read:handover',
      'read:employee_activity',
    ],
  },
];

const COMPANY_DATASETS: Record<string, CompanyFactoryDataset> = {
  comp_aether: {
    companyId: 'comp_aether',
    companyName: 'Aether Precision Robotics',
    plantLocation: 'Munich Facility · Hall B',
    currentShift: 'Shift 2 (Afternoon)',
    products: [
      {
        sku: 'ACT-700',
        name: 'Harmonic Drive Actuator Series 7',
        cycleTimeSec: 42,
        specStandard: 'ISO-9283 ±0.012mm',
      },
      {
        sku: 'SRV-410',
        name: 'Brushless Servo Core 410W',
        cycleTimeSec: 36,
        specStandard: 'IEC-60034 Class F',
      },
      {
        sku: 'GRIP-X2',
        name: 'Dual-Axis Pneumatic End Effector',
        cycleTimeSec: 28,
        specStandard: 'DIN-33900',
      },
    ],
    productionRecords: [
      {
        lineId: 'line-1',
        lineName: 'Production Line 1',
        productSku: 'ACT-700',
        productName: 'Harmonic Drive Actuator Series 7',
        shift: 'Shift 2',
        dateLabel: 'today',
        targetUnits: 400,
        actualUnits: 388,
        scrapUnits: 4,
        oeePct: 91.4,
        notes: 'Steady throughput following morning calibration.',
      },
      {
        lineId: 'line-2',
        lineName: 'Production Line 2',
        productSku: 'SRV-410',
        productName: 'Brushless Servo Core 410W',
        shift: 'Shift 2',
        dateLabel: 'today',
        targetUnits: 400,
        actualUnits: 298,
        scrapUnits: 11,
        oeePct: 74.5,
        notes: 'Torque calibration drift on Press 2B slowed cycle speed by 18%.',
      },
      {
        lineId: 'line-3',
        lineName: 'Production Line 3',
        productSku: 'GRIP-X2',
        productName: 'Dual-Axis Pneumatic End Effector',
        shift: 'Shift 2',
        dateLabel: 'today',
        targetUnits: 400,
        actualUnits: 364,
        scrapUnits: 5,
        oeePct: 88.2,
        notes: 'Nominal run; minor feeder pause at 13:15.',
      },
      // Today total: 388 + 298 + 364 = 1050 / 1200 = 87.5%
      {
        lineId: 'line-1',
        lineName: 'Production Line 1',
        productSku: 'ACT-700',
        productName: 'Harmonic Drive Actuator Series 7',
        shift: 'Shift 1',
        dateLabel: 'yesterday',
        targetUnits: 400,
        actualUnits: 394,
        scrapUnits: 3,
        oeePct: 93.1,
        notes: 'Exceeded baseline shift OEE target.',
      },
      {
        lineId: 'line-2',
        lineName: 'Production Line 2',
        productSku: 'SRV-410',
        productName: 'Brushless Servo Core 410W',
        shift: 'Shift 1',
        dateLabel: 'yesterday',
        targetUnits: 400,
        actualUnits: 386,
        scrapUnits: 4,
        oeePct: 90.8,
        notes: 'Completed prior to coil feeder wear alert.',
      },
      {
        lineId: 'line-3',
        lineName: 'Production Line 3',
        productSku: 'GRIP-X2',
        productName: 'Dual-Axis Pneumatic End Effector',
        shift: 'Shift 1',
        dateLabel: 'yesterday',
        targetUnits: 400,
        actualUnits: 378,
        scrapUnits: 5,
        oeePct: 89.5,
        notes: 'Standard output.',
      },
    ],
    materials: [
      {
        materialId: 'mat-ti64',
        name: 'Ti-6Al-4V Titanium Billet Rod',
        sku: 'RAW-TI64-40',
        unit: 'kg',
        onHand: 162,
        reorderThreshold: 150,
        dailyConsumption: 74,
        consumedToday: 58,
        supplier: 'Bavaria Alloy Works',
        warehouseZone: 'Bay A-04',
      },
      {
        materialId: 'mat-ndfeb',
        name: 'Neodymium Magnet Arc Segments (N52)',
        sku: 'CMP-NDFEB-52',
        unit: 'units',
        onHand: 1840,
        reorderThreshold: 1200,
        dailyConsumption: 620,
        consumedToday: 440,
        supplier: 'NordMag Precision',
        warehouseZone: 'Vault C-02',
      },
      {
        materialId: 'mat-cu-wire',
        name: 'Class-F Enamelled Copper Winding Wire',
        sku: 'RAW-CU-180',
        unit: 'spools',
        onHand: 29,
        reorderThreshold: 35,
        dailyConsumption: 14,
        consumedToday: 11,
        supplier: 'RheinMetall Wire GmbH',
        warehouseZone: 'Bay B-11',
      },
    ],
    machines: [
      {
        machineId: 'mch-cnc-01',
        name: '5-Axis CNC Mill Alpha-1',
        lineId: 'line-1',
        lineName: 'Production Line 1',
        status: 'operational',
        utilizationPct: 92.4,
        temperatureC: 54.2,
        vibrationMmS: 1.12,
        downtimeMinutesToday: 8,
        downtimeReason: 'Tool bit verification',
        nextMaintenanceDate: '2026-11-29',
        maintenanceType: 'Spindle bearing lubrication & laser alignment',
        assignedTechnician: 'K. Weber',
      },
      {
        machineId: 'mch-press-2b',
        name: 'Servo Rotor Press 2B',
        lineId: 'line-2',
        lineName: 'Production Line 2',
        status: 'degraded',
        utilizationPct: 68.0,
        temperatureC: 71.8,
        vibrationMmS: 3.45,
        downtimeMinutesToday: 64,
        downtimeReason: 'Torque sensor drift & thermal throttle',
        nextMaintenanceDate: '2026-11-23',
        maintenanceType: 'Urgent servo encoder recalibration & cooling flush',
        assignedTechnician: 'H. Richter',
      },
      {
        machineId: 'mch-wind-2a',
        name: 'Stator Coil Winder 2A',
        lineId: 'line-2',
        lineName: 'Production Line 2',
        status: 'operational',
        utilizationPct: 83.5,
        temperatureC: 58.1,
        vibrationMmS: 1.48,
        downtimeMinutesToday: 18,
        downtimeReason: 'Wire spool changeover',
        nextMaintenanceDate: '2026-12-03',
        maintenanceType: 'Tensioner roller inspection',
        assignedTechnician: 'H. Richter',
      },
      {
        machineId: 'mch-laser-3c',
        name: 'Laser Seam Welder 3C',
        lineId: 'line-3',
        lineName: 'Production Line 3',
        status: 'operational',
        utilizationPct: 89.2,
        temperatureC: 51.0,
        vibrationMmS: 0.94,
        downtimeMinutesToday: 12,
        downtimeReason: 'Optic lens wipe',
        nextMaintenanceDate: '2026-12-01',
        maintenanceType: 'Galvo mirror calibration',
        assignedTechnician: 'S. Lindner',
      },
    ],
    incidents: [
      {
        incidentId: 'INC-2041',
        machineId: 'mch-press-2b',
        machineName: 'Servo Rotor Press 2B',
        lineName: 'Production Line 2',
        severity: 'high',
        status: 'investigating',
        reportedAt: '2026-11-22T11:40:00Z',
        summary: 'Intermittent torque overshoot above 48 Nm triggering safety slow-down.',
        assignedTo: 'H. Richter',
      },
      {
        incidentId: 'INC-2042',
        machineId: 'mch-wind-2a',
        machineName: 'Stator Coil Winder 2A',
        lineName: 'Production Line 2',
        severity: 'medium',
        status: 'open',
        reportedAt: '2026-11-22T12:55:00Z',
        summary: 'Copper spool tension sensor reporting sporadic +6% variance.',
        assignedTo: 'M. Sterling',
      },
      {
        incidentId: 'INC-2039',
        machineId: 'mch-cnc-01',
        machineName: '5-Axis CNC Mill Alpha-1',
        lineName: 'Production Line 1',
        severity: 'low',
        status: 'open',
        reportedAt: '2026-11-22T09:15:00Z',
        summary: 'Coolant reservoir float sensor requires cleaning during next break.',
        assignedTo: 'K. Weber',
      },
    ],
    qualityInspections: [
      {
        inspectionId: 'QC-881',
        batchCode: 'B-261122-L1',
        lineName: 'Production Line 1',
        productName: 'Harmonic Drive Actuator Series 7',
        inspectedCount: 120,
        passedCount: 119,
        defectCount: 1,
        primaryDefectType: 'Surface micro-burr',
        inspector: 'A. Hoffmann',
        timestamp: '2026-11-22T13:30:00Z',
      },
      {
        inspectionId: 'QC-882',
        batchCode: 'B-261122-L2',
        lineName: 'Production Line 2',
        productName: 'Brushless Servo Core 410W',
        inspectedCount: 100,
        passedCount: 93,
        defectCount: 7,
        primaryDefectType: 'Rotor seating eccentricity',
        inspector: 'A. Hoffmann',
        timestamp: '2026-11-22T14:05:00Z',
      },
      {
        inspectionId: 'QC-883',
        batchCode: 'B-261122-L3',
        lineName: 'Production Line 3',
        productName: 'Dual-Axis Pneumatic End Effector',
        inspectedCount: 110,
        passedCount: 108,
        defectCount: 2,
        primaryDefectType: 'Seal seating variance',
        inspector: 'N. Bauer',
        timestamp: '2026-11-22T14:15:00Z',
      },
    ],
    shiftHandovers: [
      {
        handoverId: 'SH-1122-1',
        shiftFrom: 'Shift 1 (Morning)',
        shiftTo: 'Shift 2 (Afternoon)',
        outgoingLead: 'D. Kowalski',
        incomingLead: 'M. Sterling',
        timestamp: '2026-11-22T14:00:00Z',
        keyObservations: [
          'Line 1 and Line 3 operating within nominal thermal and cycle tolerances.',
          'Line 2 Servo Rotor Press 2B began showing elevated vibration (3.45 mm/s) at 11:30.',
          'Class-F Copper Winding Wire stock dropped below the 35-spool reorder threshold.',
        ],
        openActionItems: [
          'Run encoder calibration check on Press 2B before evening peak batch.',
          'Confirm expedited delivery ETA with RheinMetall Wire GmbH.',
        ],
      },
    ],
    employeeActivities: [
      {
        activityId: 'EA-301',
        employeeName: 'H. Richter',
        roleTitle: 'Lead Controls Technician',
        shift: 'Shift 2',
        area: 'Production Line 2',
        actionSummary: 'Attached thermal probe to Servo Rotor Press 2B spindle housing.',
        timestamp: '2026-11-22T14:12:00Z',
      },
      {
        activityId: 'EA-302',
        employeeName: 'A. Hoffmann',
        roleTitle: 'Senior QA Specialist',
        shift: 'Shift 2',
        area: 'Quality Lab B',
        actionSummary: 'Completed CMM concentricity audit on Batch B-261122-L2.',
        timestamp: '2026-11-22T14:05:00Z',
      },
    ],
  },

  comp_vanguard: {
    companyId: 'comp_vanguard',
    companyName: 'Vanguard Aerospace Composites',
    plantLocation: 'Toulouse Plant · Sector 4',
    currentShift: 'Shift 2 (Afternoon)',
    products: [
      {
        sku: 'CF-WING-90',
        name: 'Autoclave Carbon Rib Spar 90',
        cycleTimeSec: 185,
        specStandard: 'AS9100D Rev D',
      },
      {
        sku: 'HON-CORE-12',
        name: 'Nomex Honeycomb Fuselage Panel',
        cycleTimeSec: 110,
        specStandard: 'EN-9100 Class A',
      },
    ],
    productionRecords: [
      {
        lineId: 'vg-line-a',
        lineName: 'Autoclave Bay Alpha',
        productSku: 'CF-WING-90',
        productName: 'Autoclave Carbon Rib Spar 90',
        shift: 'Shift 2',
        dateLabel: 'today',
        targetUnits: 160,
        actualUnits: 156,
        scrapUnits: 1,
        oeePct: 95.8,
        notes: 'Curing cycle holding steady at 180°C / 6.5 bar.',
      },
      {
        lineId: 'vg-line-b',
        lineName: 'Layup Cell Bravo',
        productSku: 'HON-CORE-12',
        productName: 'Nomex Honeycomb Fuselage Panel',
        shift: 'Shift 2',
        dateLabel: 'today',
        targetUnits: 200,
        actualUnits: 192,
        scrapUnits: 2,
        oeePct: 94.1,
        notes: 'Automated tape placement running cleanly.',
      },
      {
        lineId: 'vg-line-a',
        lineName: 'Autoclave Bay Alpha',
        productSku: 'CF-WING-90',
        productName: 'Autoclave Carbon Rib Spar 90',
        shift: 'Shift 1',
        dateLabel: 'yesterday',
        targetUnits: 160,
        actualUnits: 154,
        scrapUnits: 2,
        oeePct: 94.2,
        notes: 'Yesterday Shift 1 completed on schedule.',
      },
    ],
    materials: [
      {
        materialId: 'vg-prepreg',
        name: 'Toray T800S Carbon Prepreg Roll',
        sku: 'VG-T800S-PRE',
        unit: 'rolls',
        onHand: 46,
        reorderThreshold: 20,
        dailyConsumption: 9,
        consumedToday: 6,
        supplier: 'EuroCarbon Composites',
        warehouseZone: 'Cold Vault 1',
      },
      {
        materialId: 'vg-resin',
        name: 'HexFlow RTM6 Aerospace Epoxy',
        sku: 'VG-RTM6-EPX',
        unit: 'liters',
        onHand: 190,
        reorderThreshold: 180,
        dailyConsumption: 65,
        consumedToday: 48,
        supplier: 'AeroChem Lyon',
        warehouseZone: 'Chem Bay 3',
      },
    ],
    machines: [
      {
        machineId: 'vg-auto-1',
        name: 'Composite Autoclave Vessel 1',
        lineId: 'vg-line-a',
        lineName: 'Autoclave Bay Alpha',
        status: 'operational',
        utilizationPct: 96.1,
        temperatureC: 179.4,
        vibrationMmS: 0.42,
        downtimeMinutesToday: 0,
        downtimeReason: null,
        nextMaintenanceDate: '2026-12-08',
        maintenanceType: 'Vacuum seal pressure integrity test',
        assignedTechnician: 'L. Dubois',
      },
      {
        machineId: 'vg-afp-2',
        name: 'Automated Fiber Placement Gantry 2',
        lineId: 'vg-line-b',
        lineName: 'Layup Cell Bravo',
        status: 'operational',
        utilizationPct: 91.8,
        temperatureC: 39.6,
        vibrationMmS: 0.88,
        downtimeMinutesToday: 6,
        downtimeReason: 'Laser tow alignment check',
        nextMaintenanceDate: '2026-11-30',
        maintenanceType: 'Compaction roller resurfacing',
        assignedTechnician: 'J. Martin',
      },
    ],
    incidents: [
      {
        incidentId: 'VG-INC-904',
        machineId: 'vg-afp-2',
        machineName: 'Automated Fiber Placement Gantry 2',
        lineName: 'Layup Cell Bravo',
        severity: 'low',
        status: 'open',
        reportedAt: '2026-11-22T10:20:00Z',
        summary: 'Minor vacuum bag sensor calibration drift on Station 2.',
        assignedTo: 'J. Martin',
      },
    ],
    qualityInspections: [
      {
        inspectionId: 'VG-QC-412',
        batchCode: 'VG-261122-A',
        lineName: 'Autoclave Bay Alpha',
        productName: 'Autoclave Carbon Rib Spar 90',
        inspectedCount: 80,
        passedCount: 80,
        defectCount: 0,
        primaryDefectType: null,
        inspector: 'C. Laurent',
        timestamp: '2026-11-22T13:50:00Z',
      },
    ],
    shiftHandovers: [
      {
        handoverId: 'VG-SH-1122',
        shiftFrom: 'Shift 1',
        shiftTo: 'Shift 2',
        outgoingLead: 'P. Garnier',
        incomingLead: 'C. Moreau',
        timestamp: '2026-11-22T14:00:00Z',
        keyObservations: [
          'Autoclave Vessel 1 achieved 100% ultrasonic NDT pass rate.',
          'HexFlow RTM6 Epoxy is within 10 liters of reorder threshold.',
        ],
        openActionItems: ['Schedule RTM6 replenishment order for Monday morning.'],
      },
    ],
    employeeActivities: [
      {
        activityId: 'VG-EA-108',
        employeeName: 'C. Laurent',
        roleTitle: 'NDT Aerospace Inspector',
        shift: 'Shift 2',
        area: 'Autoclave Bay Alpha',
        actionSummary: 'Completed ultrasonic phased-array scan on Wing Spar lot VG-261122-A.',
        timestamp: '2026-11-22T13:50:00Z',
      },
    ],
  },
};

export const ROLE_RESTRICTIONS: Record<UserRole, string[]> = {
  plant_director: [],
  operations_manager: [],
  shift_supervisor: ['employeeActivities'],
  line_operator: ['employeeActivities', 'shiftHandovers'],
};

export type FactoryToolName =
  | 'getProductionSummary'
  | 'getProductionComparison'
  | 'getInventoryStatus'
  | 'getMaterialConsumption'
  | 'getMachineStatus'
  | 'getMachineDowntime'
  | 'getMaintenanceSchedule'
  | 'getIncidentSummary'
  | 'getQualitySummary'
  | 'getShiftHandover'
  | 'getFactoryOverview';

export interface ToolExecutionOutcome {
  ok: boolean;
  companyId: string;
  companyName: string;
  toolName: FactoryToolName;
  summary: string;
  data: Record<string, unknown>;
}

export function getCompanyDataset(companyId: string): CompanyFactoryDataset | null {
  return COMPANY_DATASETS[companyId] ?? null;
}

export function getUserProfileById(userId: string): UserProfile | null {
  return FACTORY_USER_PROFILES.find((p) => p.userId === userId) ?? null;
}

export function computeFactoryOverviewSnapshot(companyId: string): FactoryOverviewSnapshot | null {
  const ds = getCompanyDataset(companyId);
  if (!ds) return null;
  const todayRecords = ds.productionRecords.filter((r) => r.dateLabel === 'today');
  const totalProducedToday = todayRecords.reduce((acc, r) => acc + r.actualUnits, 0);
  const totalTargetToday = todayRecords.reduce((acc, r) => acc + r.targetUnits, 0);
  const productionAchievementPct =
    totalTargetToday > 0 ? Math.round((totalProducedToday / totalTargetToday) * 1000) / 10 : 0;

  const activeMachinesCount = ds.machines.filter((m) => m.status === 'operational').length;
  const unresolvedIncidentsCount = ds.incidents.filter((i) => i.status !== 'resolved').length;
  const lowStockMaterialsCount = ds.materials.filter(
    (m) => m.onHand <= m.reorderThreshold * 1.15
  ).length;

  const totalInspected = ds.qualityInspections.reduce((acc, q) => acc + q.inspectedCount, 0);
  const totalPassed = ds.qualityInspections.reduce((acc, q) => acc + q.passedCount, 0);
  const qualityPassRatePct =
    totalInspected > 0 ? Math.round((totalPassed / totalInspected) * 1000) / 10 : 100;

  return {
    companyId: ds.companyId,
    companyName: ds.companyName,
    plantLocation: ds.plantLocation,
    currentShift: ds.currentShift,
    productionAchievementPct,
    totalProducedToday,
    totalTargetToday,
    activeMachinesCount,
    totalMachinesCount: ds.machines.length,
    unresolvedIncidentsCount,
    lowStockMaterialsCount,
    qualityPassRatePct,
  };
}

export function computeProactiveInsights(companyId: string): ProactiveInsight[] {
  const ds = getCompanyDataset(companyId);
  if (!ds) return [];
  const insights: ProactiveInsight[] = [];

  // 1. Production comparison today vs yesterday
  const today = ds.productionRecords.filter((r) => r.dateLabel === 'today');
  const yesterday = ds.productionRecords.filter((r) => r.dateLabel === 'yesterday');
  const todayPct =
    today.reduce((s, r) => s + r.actualUnits, 0) /
    Math.max(1, today.reduce((s, r) => s + r.targetUnits, 0));
  const yestPct =
    yesterday.reduce((s, r) => s + r.actualUnits, 0) /
    Math.max(1, yesterday.reduce((s, r) => s + r.targetUnits, 0));

  if (todayPct < yestPct - 0.03) {
    const worstLine = [...today].sort(
      (a, b) => a.actualUnits / a.targetUnits - b.actualUnits / b.targetUnits
    )[0];
    insights.push({
      id: `${companyId}-prod-dip`,
      category: 'production',
      severity: 'warning',
      title: 'Shift Throughput Below Prior Benchmark',
      message: `Production is at ${(todayPct * 100).toFixed(1)}% of target, down from ${(
        yestPct * 100
      ).toFixed(1)}% yesterday. ${worstLine?.lineName ?? 'Primary line'} accounts for the largest gap.`,
      suggestedPrompt: 'How is production doing today and which line is behind?',
      metricLabel: `${(todayPct * 100).toFixed(1)}% Target`,
    });
  }

  // 2. Inventory reorder alerts
  for (const mat of ds.materials) {
    if (mat.onHand <= mat.reorderThreshold * 1.12) {
      const below = mat.onHand <= mat.reorderThreshold;
      insights.push({
        id: `${companyId}-inv-${mat.materialId}`,
        category: 'inventory',
        severity: below ? 'critical' : 'warning',
        title: below ? `${mat.name} Below Reorder Point` : `${mat.name} Approaching Threshold`,
        message: `${mat.onHand} ${mat.unit} on hand against a configured threshold of ${mat.reorderThreshold} ${mat.unit}.`,
        suggestedPrompt: `Check inventory status for ${mat.name}.`,
        metricLabel: `${mat.onHand} / ${mat.reorderThreshold} ${mat.unit}`,
      });
    }
  }

  // 3. Unresolved incidents
  const unresolved = ds.incidents.filter((i) => i.status !== 'resolved');
  if (unresolved.length > 0) {
    const hasHigh = unresolved.some((i) => i.severity === 'high' || i.severity === 'critical');
    insights.push({
      id: `${companyId}-inc-open`,
      category: 'incidents',
      severity: hasHigh ? 'critical' : 'info',
      title: `${unresolved.length} Unresolved Operational Incident${unresolved.length > 1 ? 's' : ''}`,
      message: `${unresolved[0].machineName}: ${unresolved[0].summary}`,
      suggestedPrompt: 'Summarize all unresolved incidents right now.',
      metricLabel: `${unresolved.length} Open`,
    });
  }

  return insights;
}

export function executeFactoryTool(
  user: UserProfile,
  toolName: FactoryToolName,
  args: Record<string, unknown> = {}
): ToolExecutionOutcome {
  // STRICT company isolation: always resolve dataset from authenticated user.companyId,
  // ignoring any companyId/tenant parameter passed by LLM or client args.
  const ds = getCompanyDataset(user.companyId);
  if (!ds) {
    return {
      ok: false,
      companyId: user.companyId,
      companyName: user.companyName,
      toolName,
      summary: 'Authenticated company workspace not found.',
      data: { error: 'COMPANY_NOT_FOUND' },
    };
  }

  const requirePermission = (perm: string): boolean => user.permissions.includes(perm);

  switch (toolName) {
    case 'getProductionSummary': {
      if (!requirePermission('read:production')) {
        return deniedResult(user, ds, toolName, 'read:production');
      }
      const dateFilter = args.date === 'yesterday' ? 'yesterday' : 'today';
      const lineQuery = typeof args.lineName === 'string' ? args.lineName.toLowerCase() : '';
      const records = ds.productionRecords.filter(
        (r) =>
          r.dateLabel === dateFilter &&
          (!lineQuery || r.lineName.toLowerCase().includes(lineQuery) || r.lineId.toLowerCase() === lineQuery)
      );
      const totalTarget = records.reduce((s, r) => s + r.targetUnits, 0);
      const totalActual = records.reduce((s, r) => s + r.actualUnits, 0);
      const totalScrap = records.reduce((s, r) => s + r.scrapUnits, 0);
      const achievementPct = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 1000) / 10 : 0;
      const lines = records.map((r) => ({
        lineId: r.lineId,
        lineName: r.lineName,
        productSku: r.productSku,
        productName: r.productName,
        shift: r.shift,
        targetUnits: r.targetUnits,
        actualUnits: r.actualUnits,
        achievementPct: Math.round((r.actualUnits / r.targetUnits) * 1000) / 10,
        shortfallUnits: Math.max(0, r.targetUnits - r.actualUnits),
        scrapUnits: r.scrapUnits,
        oeePct: r.oeePct,
        notes: r.notes,
      }));
      return {
        ok: true,
        companyId: ds.companyId,
        companyName: ds.companyName,
        toolName,
        summary: `Retrieved ${dateFilter} production (${achievementPct}% of target across ${lines.length} lines)`,
        data: {
          companyName: ds.companyName,
          date: dateFilter,
          totalTargetUnits: totalTarget,
          totalActualUnits: totalActual,
          totalScrapUnits: totalScrap,
          achievementPct,
          lines,
          productsCatalog: ds.products,
        },
      };
    }

    case 'getProductionComparison': {
      if (!requirePermission('read:production')) {
        return deniedResult(user, ds, toolName, 'read:production');
      }
      const today = ds.productionRecords.filter((r) => r.dateLabel === 'today');
      const yesterday = ds.productionRecords.filter((r) => r.dateLabel === 'yesterday');
      const todayUnits = today.reduce((s, r) => s + r.actualUnits, 0);
      const todayTarget = today.reduce((s, r) => s + r.targetUnits, 0);
      const yestUnits = yesterday.reduce((s, r) => s + r.actualUnits, 0);
      const yestTarget = yesterday.reduce((s, r) => s + r.targetUnits, 0);
      const todayPct = todayTarget > 0 ? Math.round((todayUnits / todayTarget) * 1000) / 10 : 0;
      const yestPct = yestTarget > 0 ? Math.round((yestUnits / yestTarget) * 1000) / 10 : 0;
      const deltaPctPoints = Math.round((todayPct - yestPct) * 10) / 10;

      const byLine = today.map((t) => {
        const prev = yesterday.find((y) => y.lineId === t.lineId);
        const tPct = Math.round((t.actualUnits / t.targetUnits) * 1000) / 10;
        const pPct = prev ? Math.round((prev.actualUnits / prev.targetUnits) * 1000) / 10 : null;
        return {
          lineName: t.lineName,
          todayUnits: t.actualUnits,
          todayPct: tPct,
          yesterdayUnits: prev?.actualUnits ?? null,
          yesterdayPct: pPct,
          deltaPctPoints: pPct !== null ? Math.round((tPct - pPct) * 10) / 10 : null,
        };
      });

      return {
        ok: true,
        companyId: ds.companyId,
        companyName: ds.companyName,
        toolName,
        summary: `Compared today (${todayPct}%) vs yesterday (${yestPct}%)`,
        data: {
          companyName: ds.companyName,
          today: { units: todayUnits, target: todayTarget, achievementPct: todayPct },
          yesterday: { units: yestUnits, target: yestTarget, achievementPct: yestPct },
          deltaPctPoints,
          lineBreakdown: byLine,
        },
      };
    }

    case 'getInventoryStatus': {
      if (!requirePermission('read:inventory')) {
        return deniedResult(user, ds, toolName, 'read:inventory');
      }
      const query = typeof args.materialName === 'string' ? args.materialName.toLowerCase() : '';
      const filtered = ds.materials.filter(
        (m) =>
          !query ||
          m.name.toLowerCase().includes(query) ||
          m.sku.toLowerCase().includes(query)
      );
      const items = filtered.map((m) => {
        const daysRemaining =
          m.dailyConsumption > 0 ? Math.round((m.onHand / m.dailyConsumption) * 10) / 10 : null;
        const status =
          m.onHand <= m.reorderThreshold
            ? 'below_threshold'
            : m.onHand <= m.reorderThreshold * 1.15
              ? 'approaching_threshold'
              : 'healthy';
        return {
          materialId: m.materialId,
          name: m.name,
          sku: m.sku,
          onHand: m.onHand,
          unit: m.unit,
          reorderThreshold: m.reorderThreshold,
          daysOfCoverRemaining: daysRemaining,
          status,
          supplier: m.supplier,
          warehouseZone: m.warehouseZone,
        };
      });
      return {
        ok: true,
        companyId: ds.companyId,
        companyName: ds.companyName,
        toolName,
        summary: `Checked ${items.length} inventory item(s)`,
        data: { companyName: ds.companyName, materials: items },
      };
    }

    case 'getMaterialConsumption': {
      if (!requirePermission('read:inventory')) {
        return deniedResult(user, ds, toolName, 'read:inventory');
      }
      const items = ds.materials.map((m) => ({
        name: m.name,
        sku: m.sku,
        unit: m.unit,
        consumedToday: m.consumedToday,
        dailyAverageConsumption: m.dailyConsumption,
        varianceVsDailyAvgPct:
          m.dailyConsumption > 0
            ? Math.round(((m.consumedToday - m.dailyConsumption) / m.dailyConsumption) * 1000) / 10
            : 0,
      }));
      return {
        ok: true,
        companyId: ds.companyId,
        companyName: ds.companyName,
        toolName,
        summary: `Retrieved material consumption for ${items.length} materials`,
        data: { companyName: ds.companyName, consumption: items },
      };
    }

    case 'getMachineStatus': {
      if (!requirePermission('read:machines')) {
        return deniedResult(user, ds, toolName, 'read:machines');
      }
      const query = typeof args.machineOrLine === 'string' ? args.machineOrLine.toLowerCase() : '';
      const machines = ds.machines.filter(
        (m) =>
          !query ||
          m.name.toLowerCase().includes(query) ||
          m.lineName.toLowerCase().includes(query) ||
          m.machineId.toLowerCase() === query
      );
      return {
        ok: true,
        companyId: ds.companyId,
        companyName: ds.companyName,
        toolName,
        summary: `Checked status of ${machines.length} machine(s)`,
        data: { companyName: ds.companyName, machines },
      };
    }

    case 'getMachineDowntime': {
      if (!requirePermission('read:machines')) {
        return deniedResult(user, ds, toolName, 'read:machines');
      }
      const totalDowntimeMinutes = ds.machines.reduce((s, m) => s + m.downtimeMinutesToday, 0);
      const breakdown = ds.machines
        .filter((m) => m.downtimeMinutesToday > 0)
        .sort((a, b) => b.downtimeMinutesToday - a.downtimeMinutesToday)
        .map((m) => ({
          machineId: m.machineId,
          machineName: m.name,
          lineName: m.lineName,
          downtimeMinutesToday: m.downtimeMinutesToday,
          reason: m.downtimeReason,
          status: m.status,
        }));
      return {
        ok: true,
        companyId: ds.companyId,
        companyName: ds.companyName,
        toolName,
        summary: `Total downtime today: ${totalDowntimeMinutes} minutes`,
        data: {
          companyName: ds.companyName,
          totalDowntimeMinutesToday: totalDowntimeMinutes,
          machinesWithDowntime: breakdown,
        },
      };
    }

    case 'getMaintenanceSchedule': {
      if (!requirePermission('read:maintenance')) {
        return deniedResult(user, ds, toolName, 'read:maintenance');
      }
      const schedule = [...ds.machines]
        .sort((a, b) => a.nextMaintenanceDate.localeCompare(b.nextMaintenanceDate))
        .map((m) => ({
          machineId: m.machineId,
          machineName: m.name,
          lineName: m.lineName,
          currentStatus: m.status,
          nextMaintenanceDate: m.nextMaintenanceDate,
          maintenanceType: m.maintenanceType,
          assignedTechnician: m.assignedTechnician,
        }));
      return {
        ok: true,
        companyId: ds.companyId,
        companyName: ds.companyName,
        toolName,
        summary: `Loaded ${schedule.length} scheduled maintenance tasks`,
        data: { companyName: ds.companyName, schedule },
      };
    }

    case 'getIncidentSummary': {
      if (!requirePermission('read:incidents')) {
        return deniedResult(user, ds, toolName, 'read:incidents');
      }
      const includeResolved = args.includeResolved === true;
      const incidents = includeResolved
        ? ds.incidents
        : ds.incidents.filter((i) => i.status !== 'resolved');
      return {
        ok: true,
        companyId: ds.companyId,
        companyName: ds.companyName,
        toolName,
        summary: `Found ${incidents.length} ${includeResolved ? 'total' : 'unresolved'} incident(s)`,
        data: {
          companyName: ds.companyName,
          unresolvedCount: ds.incidents.filter((i) => i.status !== 'resolved').length,
          incidents,
        },
      };
    }

    case 'getQualitySummary': {
      if (!requirePermission('read:quality')) {
        return deniedResult(user, ds, toolName, 'read:quality');
      }
      const totalInspected = ds.qualityInspections.reduce((s, q) => s + q.inspectedCount, 0);
      const totalPassed = ds.qualityInspections.reduce((s, q) => s + q.passedCount, 0);
      const passRatePct =
        totalInspected > 0 ? Math.round((totalPassed / totalInspected) * 1000) / 10 : 100;
      return {
        ok: true,
        companyId: ds.companyId,
        companyName: ds.companyName,
        toolName,
        summary: `Quality pass rate: ${passRatePct}% across ${totalInspected} units`,
        data: {
          companyName: ds.companyName,
          overallPassRatePct: passRatePct,
          totalInspected,
          totalPassed,
          totalDefects: totalInspected - totalPassed,
          inspections: ds.qualityInspections,
        },
      };
    }

    case 'getShiftHandover': {
      if (!requirePermission('read:handover')) {
        return deniedResult(user, ds, toolName, 'read:handover');
      }
      return {
        ok: true,
        companyId: ds.companyId,
        companyName: ds.companyName,
        toolName,
        summary: `Retrieved latest shift handover (${ds.currentShift})`,
        data: {
          companyName: ds.companyName,
          currentShift: ds.currentShift,
          handovers: ds.shiftHandovers,
        },
      };
    }

    case 'getFactoryOverview': {
      const snapshot = computeFactoryOverviewSnapshot(ds.companyId);
      const insights = computeProactiveInsights(ds.companyId);
      const canReadEmployeeActivity = requirePermission('read:employee_activity');
      return {
        ok: true,
        companyId: ds.companyId,
        companyName: ds.companyName,
        toolName,
        summary: `Loaded factory overview for ${ds.companyName}`,
        data: {
          overview: snapshot,
          proactiveInsights: insights,
          recentEmployeeActivities: canReadEmployeeActivity
            ? ds.employeeActivities
            : 'Restricted by user role permissions',
        },
      };
    }
  }
}

function deniedResult(
  user: UserProfile,
  ds: CompanyFactoryDataset,
  toolName: FactoryToolName,
  requiredPermission: string
): ToolExecutionOutcome {
  return {
    ok: false,
    companyId: ds.companyId,
    companyName: ds.companyName,
    toolName,
    summary: `Access denied for role ${user.role} (requires ${requiredPermission})`,
    data: {
      error: 'FORBIDDEN_BY_ROLE',
      requiredPermission,
      userRole: user.role,
      message: `Your current role (${user.title}) does not have permission to access ${requiredPermission}.`,
    },
  };
}
