export type AmountMode = 'single' | 'debe-haber';

export type ExtractMapping = {
  amountMode: AmountMode;
  dateCol: string;
  conceptCol: string;
  amountCol: string;
  debeCol: string;
  haberCol: string;
};

export type SystemMapping = {
  amountMode: AmountMode;
  issueDateCol: string;
  dueDateCol: string;
  descriptionCol: string;
  amountCol: string;
  debeCol: string;
  haberCol: string;
};

export type RunPayload = {
  title?: string | null;
  bankName?: string;
  accountRef?: string;
  company?: string;
  windowDays?: number;
  cutDate?: string;
  enabledCategoryIds?: string[];
  extract: {
    rows: Record<string, unknown>[];
    mapping: ExtractMapping;
    excludeConcepts?: string[];
  };
  system: {
    rows: Record<string, unknown>[];
    mapping: SystemMapping;
  };
};

export type RunSummary = {
  runId: string;
  matched: number;
  onlyExtract: number;
  systemOverdue: number;
  systemDeferred: number;
};

export type RunStatus = 'OPEN' | 'CLOSED';

export type ReconciliationRun = {
  id: string;
  title?: string | null;
  bankName?: string | null;
  accountRef?: string | null;
  company?: string | null;
  windowDays: number;
  cutDate?: string | null;
  status?: RunStatus;
  createdAt: string;
  createdById: string;
};

export type ReconciliationQualityIssue = {
  runId: string;
  severity: 'warning';
  code: string;
  message: string;
  fields: Array<'company' | 'bankName' | 'accountRef' | 'cutDate'>;
  createdAt: string | Date;
  company: string | null;
  bankName: string | null;
  accountRef: string | null;
  cutDate: string | Date | null;
};

export type ReconciliationQualityDiagnostics = {
  summary: {
    totalRuns: number;
    totalIssues: number;
    warningIssues: number;
    errorIssues: number;
  };
  issues: ReconciliationQualityIssue[];
};

export type ExpenseRule = {
  id: string;
  pattern: string;
  isRegex: boolean;
  caseSensitive: boolean;
};

export type ExpenseCategory = {
  id: string;
  name: string;
  rules: ExpenseRule[];
};

export type Message = {
  id: string;
  body: string;
  createdAt: string;
  author: { email: string };
};

export type ExtractLine = {
  id: string;
  date: string | null;
  concept: string | null;
  amount: number;
  excluded?: boolean;
  category?: { id: string; name: string } | null;
};

export type SystemLine = {
  id: string;
  issueDate: string | null;
  dueDate: string | null;
  amount: number;
  description?: string | null;
};

export type Match = {
  extractLineId: string;
  systemLineId: string;
  deltaDays: number;
  manual?: boolean;
  matchGroupId?: string | null;
};

export type UnmatchedExtract = {
  extractLineId: string;
};

export type UnmatchedSystem = {
  systemLineId: string;
  status: 'OVERDUE' | 'DEFERRED';
};

export type PendingItem = {
  id: string;
  area: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  resolvedAt?: string | null;
  note?: string | null;
  systemLineId?: string | null;
  systemLine?: SystemLine | null;
  /** Identifies the run that carried this pending item into the current run. */
  sourceRunId?: string | null;
  /** Original pending-item identifier, retained across carryovers. */
  originPendingItemId?: string | null;
  /** Timestamp at which the pending item was carried into this run. */
  carriedAt?: string | null;
  /** Backend deduplication identity for the linked system line. */
  fingerprint?: string | null;
};

export const hasCarryoverContext = (pending: PendingItem) => Boolean(
  pending.sourceRunId || pending.originPendingItemId || pending.carriedAt,
);

export type IssueComment = {
  id: string;
  body: string;
  createdAt: string;
  author: { email: string };
};

export type ExcludedSummaryRow = {
  concept: string;
  category: string;
  count: number;
  total: number;
};

export type Issue = {
  id: string;
  title: string;
  body: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { email: string };
  comments: IssueComment[];
};

export type RunDetail = {
  id: string;
  title?: string | null;
  bankName?: string | null;
  accountRef?: string | null;
  company?: string | null;
  windowDays?: number;
  status?: RunStatus;
  createdById?: string;
  excludeConcepts?: string[];
  excludedSummary?: ExcludedSummaryRow[];
  enabledCategoryIds?: string[];
  createdAt: string;
  extractLines: ExtractLine[];
  systemLines: SystemLine[];
  matches: Match[];
  unmatchedExtract: UnmatchedExtract[];
  unmatchedSystem: UnmatchedSystem[];
  messages: Message[];
  members: Array<{
    id: string;
    userId: string;
    role: string;
    user: { email: string };
  }>;
  pendingItems?: PendingItem[];
  issues?: Issue[];
};
