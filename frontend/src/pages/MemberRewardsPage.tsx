import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import Icon from '../components/Icon'
import ErrorState from '../admin/components/ErrorState'
import LoadingState from '../admin/components/LoadingState'
import { useAuth } from '../auth/AuthContext'
import { formatPrice } from '../data/money'
import { useMembership } from '../membership/MembershipContext'
import { REWARD_TYPE_LABELS, type Redemption } from '../membership/membership'
import './MemberRewardsPage.css'

export default function MemberRewardsPage() {
  const { user } = useAuth()
  const {
    currentMember: member,
    findReward,
    rewards,
    redemptions,
    redeemReward,
    loading,
    error: loadError,
    reload,
  } = useMembership()

  const [justRedeemed, setJustRedeemed] = useState<Redemption | null>(null)
  const [error, setError] = useState('')
  const [redeemingId, setRedeemingId] = useState<number | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    })
  }

  if (!user) return <Navigate to="/login" replace state={{ from: '/member/rewards' }} />
  if (user.role !== 'customer') return <Navigate to="/" replace />

  if (loading) {
    return (
      <div className="rewards page-shell">
        <section className="rewards__panel">
          <LoadingState label="กำลังโหลดของรางวัล…" />
        </section>
      </div>
    )
  }

  if (loadError || !member) {
    return (
      <div className="rewards page-shell">
        <section className="rewards__panel">
          <ErrorState
            message={loadError ?? 'ไม่พบข้อมูลสมาชิกของบัญชีนี้'}
            onRetry={() => void reload()}
          />
        </section>
      </div>
    )
  }

  const redeem = async (rewardId: number) => {
    if (redeemingId !== null) return
    setRedeemingId(rewardId)
    try {
      const redemption = await redeemReward(rewardId)
      setJustRedeemed(redemption)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'แลกของรางวัลไม่สำเร็จ')
      setJustRedeemed(null)
    } finally {
      setRedeemingId(null)
    }
  }

  // ของรางวัลที่แลกได้ด้วยแต้มปัจจุบันขึ้นก่อน แล้วเรียงตามแต้มที่ใช้
  const catalogue = [...rewards].sort(
    (a, b) =>
      Number(b.pointCost <= member.pointBalance) - Number(a.pointCost <= member.pointBalance) ||
      a.pointCost - b.pointCost,
  )

  const myCoupons = [...redemptions].sort((a, b) =>
    b.redeemedDate.localeCompare(a.redeemedDate),
  )

  return (
    <div className="rewards page-shell">
      <header className="rewards__head">
        <div>
          <h1 className="rewards__title">แลกของรางวัล</h1>
          <p className="rewards__subtitle">
            ใช้แต้มสะสมแลกส่วนลดและของรางวัลจาก BookHaven
          </p>
        </div>
        <div className="rewards__balance">
          <span>แต้มคงเหลือ</span>
          <strong>{member.pointBalance.toLocaleString('th-TH')}</strong>
        </div>
      </header>

      {justRedeemed && (
        <p className="rewards__banner rewards__banner--ok">
          <Icon name="check-circle" size={20} />
          แลก{justRedeemed.rewardName} สำเร็จ · รหัสคูปองของคุณคือ{' '}
          <strong>{justRedeemed.couponCode}</strong>
        </p>
      )}
      {error && (
        <p className="rewards__banner rewards__banner--error">
          <Icon name="alert-triangle" size={20} />
          {error}
        </p>
      )}

      <section className="rewards__grid">
        {catalogue.map((reward) => {
          const affordable = member.pointBalance >= reward.pointCost
          return (
            <article
              key={reward.rewardId}
              className={'rewards__card' + (affordable ? '' : ' is-locked')}
            >
              <span className="rewards__type">
                <Icon name={reward.type === 'DISCOUNT' ? 'credit-card' : 'gift'} size={16} />
                {REWARD_TYPE_LABELS[reward.type]}
              </span>
              <h2 className="rewards__name">{reward.name}</h2>
              {reward.type === 'DISCOUNT' && (
                <p className="rewards__value">มูลค่า {formatPrice(reward.discountValue)}</p>
              )}
              <p className="rewards__cost">
                <strong>{reward.pointCost.toLocaleString('th-TH')}</strong> แต้ม
              </p>
              <button
                type="button"
                className="btn btn-primary btn-sm rewards__btn"
                disabled={!affordable || redeemingId !== null}
                title={affordable ? undefined : 'แต้มสะสมของคุณยังไม่พอแลกรางวัลนี้'}
                onClick={() => void redeem(reward.rewardId)}
              >
                {affordable ? 'แลกเลย' : `ขาดอีก ${reward.pointCost - member.pointBalance} แต้ม`}
              </button>
            </article>
          )
        })}
      </section>

      <section className="rewards__panel">
        <h2 className="rewards__panel-title">คูปองของฉัน</h2>
        {myCoupons.length === 0 ? (
          <p className="rewards__empty">ยังไม่เคยแลกของรางวัล — เลือกจากรายการด้านบนได้เลย</p>
        ) : (
          <ul className="rewards__coupons">
            {myCoupons.map((redemption) => (
              <li
                key={redemption.redemptionId}
                className={`rewards__coupon ${redemption.isUsed ? 'rewards__coupon--used' : ''}`}
              >
                <div>
                  <div className="rewards__coupon-title-row">
                    <p className="rewards__coupon-name">
                      {redemption.rewardName || findReward(redemption.rewardId)?.name || 'ของรางวัล'}
                    </p>
                    <span
                      className={`rewards__coupon-badge ${
                        redemption.isUsed
                          ? 'rewards__coupon-badge--used'
                          : 'rewards__coupon-badge--available'
                      }`}
                    >
                      {redemption.isUsed ? 'ใช้งานแล้ว' : 'ยังไม่ได้ใช้'}
                    </span>
                  </div>
                  <p className="rewards__coupon-meta">
                    แลกเมื่อ {redemption.redeemedDate.slice(0, 10)} · ใช้{' '}
                    {redemption.pointsUsed.toLocaleString('th-TH')} แต้ม
                    {!redemption.isUsed && ' · นำโค้ดนี้ไปกรอกในหน้าสั่งซื้อเพื่อรับส่วนลด'}
                  </p>
                </div>
                <div className="rewards__coupon-actions">
                  <span
                    className={`rewards__coupon-code ${
                      redemption.isUsed ? 'rewards__coupon-code--used' : ''
                    }`}
                  >
                    {redemption.couponCode}
                  </span>
                  {!redemption.isUsed && (
                    <button
                      type="button"
                      className="rewards__copy-btn"
                      onClick={() => copyCode(redemption.couponCode)}
                    >
                      {copiedCode === redemption.couponCode ? 'คัดลอกแล้ว!' : 'คัดลอกรหัส'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link to="/member/points" className="rewards__back">
        <Icon name="arrow-left" size={18} />
        กลับไปหน้าแต้มสะสม
      </Link>
    </div>
  )
}
