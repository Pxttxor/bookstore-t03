import { Link, Navigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { useAuth } from '../auth/AuthContext'
import Meter from '../admin/components/Meter'
import ErrorState from '../admin/components/ErrorState'
import LoadingState from '../admin/components/LoadingState'
import StatusBadge from '../admin/components/StatusBadge'
import { formatOrderCode } from '../admin/orders/orders'
import { formatPrice } from '../data/money'
import { useMembership } from '../membership/MembershipContext'
import {
  expiringSoon,
  formatMemberCode,
  formatPoints,
  memberFullName,
  nextTierOf,
  POINT_TXN_TYPE_LABELS,
  POINT_TXN_TYPE_TONES,
} from '../membership/membership'
import './MemberPointsPage.css'

export default function MemberPointsPage() {
  const { user } = useAuth()
  const {
    currentMember: member,
    pointTransactions,
    findTier,
    tiers,
    loading,
    error,
    reload,
  } = useMembership()

  // AccountLayout กันคนไม่ล็อกอินไว้ก่อนแล้ว — เหลือไว้แค่ narrow ชนิด `user` ให้ TS
  if (!user) return <Navigate to="/login" replace state={{ from: '/member/points' }} />
  // เฉพาะบัญชีลูกค้าเท่านั้นที่มีแต้มสะสม — AccountLayout เช็คแค่ล็อกอิน ไม่เช็ค role
  if (user.role !== 'customer') return <Navigate to="/" replace />

  if (loading) {
    return (
      <div className="points">
        <section className="points__panel">
          <LoadingState label="กำลังโหลดแต้มสะสม…" />
        </section>
      </div>
    )
  }

  if (error || !member) {
    return (
      <div className="points">
        <section className="points__panel">
          <ErrorState
            message={error ?? 'ไม่พบข้อมูลสมาชิกของบัญชีนี้'}
            onRetry={() => void reload()}
          />
        </section>
      </div>
    )
  }

  const tier = findTier(member.tierId)
  const next = nextTierOf(tiers, member.totalAccumulatedPurchase)
  const expiring = expiringSoon(pointTransactions)

  // ความคืบหน้าไประดับถัดไป คิดจากยอดสะสมเทียบช่วงระหว่างสองระดับ
  const floor = tier?.minAccumulatedPurchase ?? 0
  const ceiling = next?.minAccumulatedPurchase ?? floor
  const progress = next
    ? ((member.totalAccumulatedPurchase - floor) / (ceiling - floor)) * 100
    : 100

  const history = [...pointTransactions].sort((a, b) =>
    b.earnedDate.localeCompare(a.earnedDate),
  )

  return (
    <div className="points">
      <header className="points__head">
        <div>
          <h1 className="points__title">แต้มสะสมของฉัน</h1>
          <p className="points__subtitle">
            {memberFullName(member)} · รหัสสมาชิก {formatMemberCode(member.memberId)} · สมัครเมื่อ{' '}
            {member.joinDate}
          </p>
        </div>
        <Link to="/member/rewards" className="btn btn-primary btn-sm">
          <Icon name="gift" size={18} />
          แลกของรางวัล
        </Link>
      </header>

      <section className="points__cards">
        <article className="points__card points__card--balance">
          <span className="points__card-label">แต้มคงเหลือ</span>
          <p className="points__balance">{member.pointBalance.toLocaleString('th-TH')}</p>
          <span className="points__card-unit">แต้ม</span>
          {expiring > 0 && (
            <p className="points__expiring">
              <Icon name="clock" size={15} />
              {expiring.toLocaleString('th-TH')} แต้มจะหมดอายุภายใน 90 วัน
            </p>
          )}
        </article>

        <article className="points__card">
          <span className="points__card-label">ระดับสมาชิก</span>
          <p className="points__tier">
            <Icon name="award" size={22} />
            {tier?.name ?? '—'}
          </p>
          <p className="points__benefits">{tier?.benefits}</p>
          <div className="points__progress">
            <Meter
              percent={progress}
              tone="accent"
              label={`ความคืบหน้าไประดับ ${next?.name ?? tier?.name ?? ''}`}
            />
            <p className="points__progress-note">
              {next
                ? `ซื้อครบอีก ${formatPrice(Math.max(0, ceiling - member.totalAccumulatedPurchase))} เลื่อนเป็นระดับ ${next.name}`
                : 'คุณอยู่ในระดับสูงสุดแล้ว'}
            </p>
          </div>
        </article>

        <article className="points__card">
          <span className="points__card-label">ยอดซื้อสะสม</span>
          <p className="points__accumulated">{formatPrice(member.totalAccumulatedPurchase)}</p>
          <dl className="points__account">
            <dt>รหัสสมาชิก</dt>
            <dd>{member.code}</dd>
            <dt>วันที่สมัคร</dt>
            <dd>{member.joinDate}</dd>
            <dt>อัตราสะสมแต้ม</dt>
            <dd>{tier ? `${tier.pointRate} แต้มต่อ 1 หน่วยราคา` : '—'}</dd>
          </dl>
        </article>
      </section>

      <section className="points__panel">
        <h2 className="points__panel-title">ประวัติแต้มสะสม</h2>
        {history.length === 0 ? (
          <p className="points__empty">ยังไม่มีรายการแต้มสะสม</p>
        ) : (
          <ul className="points__history">
            {history.map((txn) => (
              <li key={txn.pointTxnId} className="points__row">
                <div className="points__row-main">
                  <StatusBadge tone={POINT_TXN_TYPE_TONES[txn.type]}>
                    {POINT_TXN_TYPE_LABELS[txn.type]}
                  </StatusBadge>
                  <span className="points__row-source">
                    {txn.orderId ? `จากคำสั่งซื้อ ${formatOrderCode(txn.orderId)}` : 'รายการทั่วไป'}
                  </span>
                </div>
                <div className="points__row-side">
                  <span className="points__row-date">
                    {txn.earnedDate.slice(0, 10)}
                    {txn.expiryDate && ` · หมดอายุ ${txn.expiryDate}`}
                  </span>
                  <span
                    className={
                      'points__row-points' +
                      (txn.points >= 0 ? ' is-positive' : ' is-negative')
                    }
                  >
                    {formatPoints(txn.points)}
                  </span>
                  <span className="points__row-balance">
                    คงเหลือ {txn.balanceAfter.toLocaleString('th-TH')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
