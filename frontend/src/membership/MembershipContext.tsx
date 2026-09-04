import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { apiGet, apiPost, apiPut } from '../api/client'
import { useResource } from '../api/useResource'
import { useAuth } from '../auth/AuthContext'
import type {
  Member,
  MembershipTier,
  PointTransaction,
  Redemption,
  Reward,
} from './membership'

const loadTiers = () => apiGet<MembershipTier[]>('/api/membership-tiers')
const loadRewards = () => apiGet<Reward[]>('/api/rewards')
const loadMembers = () => apiGet<Member[]>('/api/members')
const loadMyMember = () => apiGet<Member>('/api/members/me')
const loadRedemptions = () => apiGet<Redemption[]>('/api/redemptions')

export type TierDraft = Omit<MembershipTier, 'tierId'>

interface MembershipValue {
  members: Member[]
  currentMember: Member | undefined
  tiers: MembershipTier[]
  rewards: Reward[]
  pointTransactions: PointTransaction[]
  redemptions: Redemption[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  findTier: (tierId: number) => MembershipTier | undefined
  findReward: (rewardId: number) => Reward | undefined
  countByTier: (tierId: number) => number
  redeemReward: (rewardId: number) => Promise<Redemption>
  saveTier: (draft: TierDraft, tierId?: number) => Promise<MembershipTier>
}

const MembershipContext = createContext<MembershipValue | null>(null)

export function MembershipProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const isCustomer = user?.role === 'customer'
  const mayViewMembers = user?.role === 'sales' || user?.role === 'manager'
  const usesMembership = isCustomer || mayViewMembers

  const tierResource = useResource(loadTiers, usesMembership)
  const rewardResource = useResource(loadRewards, usesMembership)
  const memberResource = useResource(loadMembers, mayViewMembers)
  const myMemberResource = useResource(loadMyMember, isCustomer)
  const redemptionResource = useResource(loadRedemptions, isCustomer)

  const memberId = myMemberResource.data?.memberId ?? 0
  const loadPointTransactions = useCallback(
    () => apiGet<PointTransaction[]>(`/api/members/${memberId}/point-transactions`),
    [memberId],
  )
  const pointResource = useResource(loadPointTransactions, isCustomer && memberId > 0)

  const value = useMemo<MembershipValue>(() => {
    const members = mayViewMembers
      ? memberResource.data ?? []
      : myMemberResource.data
        ? [myMemberResource.data]
        : []

    const reload = async () => {
      const tasks: Promise<void>[] = []
      if (usesMembership) tasks.push(tierResource.reload(), rewardResource.reload())
      if (mayViewMembers) tasks.push(memberResource.reload())
      if (isCustomer) {
        tasks.push(myMemberResource.reload(), redemptionResource.reload())
        if (memberId > 0) tasks.push(pointResource.reload())
      }
      await Promise.all(tasks)
    }

    const redeemReward = async (rewardId: number) => {
      const redemption = await apiPost<Redemption>(`/api/rewards/${rewardId}/redeem`)
      redemptionResource.apply((current) => [redemption, ...current])
      await Promise.all([myMemberResource.reload(), pointResource.reload()])
      return redemption
    }

    const saveTier = async (draft: TierDraft, tierId?: number) => {
      const saved = tierId
        ? await apiPut<MembershipTier>(`/api/membership-tiers/${tierId}`, draft)
        : await apiPost<MembershipTier>('/api/membership-tiers', draft)
      tierResource.apply((current) => {
        const exists = current.some((tier) => tier.tierId === saved.tierId)
        return exists
          ? current.map((tier) => (tier.tierId === saved.tierId ? saved : tier))
          : [...current, saved]
      })
      if (mayViewMembers) await memberResource.reload()
      return saved
    }

    return {
      members,
      currentMember: myMemberResource.data,
      tiers: tierResource.data ?? [],
      rewards: rewardResource.data ?? [],
      pointTransactions: pointResource.data ?? [],
      redemptions: redemptionResource.data ?? [],
      loading:
        (usesMembership && (tierResource.loading || rewardResource.loading)) ||
        (mayViewMembers && memberResource.loading) ||
        (isCustomer &&
          (myMemberResource.loading ||
            redemptionResource.loading ||
            (memberId > 0 && pointResource.loading))),
      error:
        tierResource.error ??
        rewardResource.error ??
        memberResource.error ??
        myMemberResource.error ??
        redemptionResource.error ??
        pointResource.error,
      reload,
      findTier: (tierId) => tierResource.data?.find((tier) => tier.tierId === tierId),
      findReward: (rewardId) => rewardResource.data?.find((reward) => reward.rewardId === rewardId),
      countByTier: (tierId) => members.filter((member) => member.tierId === tierId).length,
      redeemReward,
      saveTier,
    }
  }, [
    isCustomer,
    mayViewMembers,
    usesMembership,
    memberId,
    tierResource,
    rewardResource,
    memberResource,
    myMemberResource,
    redemptionResource,
    pointResource,
  ])

  return <MembershipContext.Provider value={value}>{children}</MembershipContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMembership(): MembershipValue {
  const ctx = useContext(MembershipContext)
  if (!ctx) throw new Error('useMembership must be used within a MembershipProvider')
  return ctx
}
