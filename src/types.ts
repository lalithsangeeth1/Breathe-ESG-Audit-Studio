export interface AuditLog {
  id: string;
  recordId: string;
  timestamp: string;
  actor: string;
  action: 'ingested' | 'modified' | 'approved' | 'rejected' | 'flagged';
  notes: string;
  diff: {
    before: Record<string, any>;
    after: Record<string, any>;
  } | null;
}

export interface NormalizationData {
  activityAmount: number;
  activityUnit: string;
  scope: 'Scope 1' | 'Scope 2' | 'Scope 3';
  ghgCategory: string;
  emissionFactor: number;
  co2eTonnes: number;
  startDate: string;
  endDate: string;
}

export interface IngestedRecord {
  id: string;
  tenantId: string;
  facilityId: string | null;
  plantCodeRaw: string;
  sourceType: 'sap' | 'utility' | 'travel';
  sourceFile: string;
  rawPayload: Record<string, any>;
  status: 'pending' | 'approved' | 'flagged' | 'rejected';
  flags: string[];
  normalization: NormalizationData | null;
  receivedAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  industry: string;
  country: string;
  createdAt: string;
}

export interface Facility {
  id: string;
  tenantId: string;
  plantCode: string;
  name: string;
  regionType: string;
  country: string;
}

export interface DashboardStats {
  totalEmissions: number;
  scopes: {
    scope1: number;
    scope2: number;
    scope3: number;
  };
  statuses: {
    total: number;
    approved: number;
    pending: number;
    flagged: number;
    rejected: number;
  };
  sources: {
    sap: number;
    utility: number;
    travel: number;
  };
  timeline: {
    month: string;
    "Scope 1": number;
    "Scope 2": number;
    "Scope 3": number;
    total: number;
  }[];
  facilities: {
    name: string;
    value: number;
  }[];
}
