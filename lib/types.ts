import type { CheckStep, DecisionPath } from '@/lib/rules'

export type { CheckStep, DecisionPath }

export type PaymentStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'EXECUTING'
  | 'SUCCESS'
  | 'FAILED'
  | 'REJECTED'

export interface MemberDTO {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'MEMBER'
  walletAddress: string
  inAllowlist: boolean
}

export interface ApprovalDTO {
  id: string
  approved: boolean
  createdAt: string
  approver: { id: string; name: string; email: string; role: string }
}

export interface PaymentDTO {
  id: string
  toEmail: string
  toAddress: string
  amount: number
  reason: string
  rawRequest: string
  status: PaymentStatus
  decisionPath: DecisionPath
  decisionLog: CheckStep[]
  rejectReason: string | null
  txHash: string | null
  errorMessage: string | null
  executedAt: string | null
  createdAt: string
  requestedBy: { id: string; name: string; email: string }
  approvals: ApprovalDTO[]
  approvalsNeeded: number
  adminRequired: boolean
  approvalsGiven: number
}

export interface TreasuryDTO {
  treasury: { id: string; name: string; address: string }
  session: { name?: string | null; email?: string | null; image?: string | null }
  onchainBalance: number | null
  gasBalance: number | null
  balanceError: string | null
  needsFunding: boolean
  spentThisMonth: number
  monthlyBudget: number
  available: number
  pendingCount: number
  memberCount: number
  chart: { month: string; amount: number }[]
}

export interface RuleDTO {
  id: string
  autoApproveUnder: number
  requireApprovals: number
  adminOnlyOver: number
  monthlyBudget: number
  dailyLimit: number
  maxSingleTx: number
  allowlistCsv: string
}

export interface RequestOutcome {
  paymentId: string
  decision: DecisionPath
  decisionLog: CheckStep[]
  approvalsNeeded: number
  adminRequired: boolean
  status?: PaymentStatus
  txHash?: string | null
  errorMessage?: string | null
  rejectReason?: string
}
