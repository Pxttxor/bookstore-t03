import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import LoadingState from '../admin/components/LoadingState'
import ErrorState from '../admin/components/ErrorState'
import { formatPrice } from '../data/money'
import { useResource } from '../api/useResource'
import {
  PROMOTION_TYPE_LABELS,
  formatPromotionCode,
} from '../admin/promotions/promotions'
import { fetchActivePromotions } from '../services/promotionService'
import './PromotionsPage.css'

export default function PromotionsPage() {
  const { data, loading, error, reload } = useResource(fetchActivePromotions)
  const promotions = data ?? []

  if (loading) {
    return (
      <div className="promos-page page-shell">
        <LoadingState label="กำลังโหลดโปรโมชั่นและส่วนลด…" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="promos-page page-shell">
        <ErrorState message={error} onRetry={() => void reload()} />
      </div>
    )
  }

  return (
    <div className="promos-page page-shell">
      <header className="promos-header">
        <span className="promos-header__tag">
          <Icon name="tag" size={16} /> สิทธิพิเศษและส่วนลด
        </span>
        <h1 className="promos-header__title">โปรโมชั่นสุดพิเศษ (Deals)</h1>
        <p className="promos-header__desc">
          เลือกช้อปหนังสือพร้อมรับส่วนลดสุดคุ้ม
          ระบบจะคำนวณและเลือกโปรโมชั่นที่ให้ส่วนลดสูงสุดแก่คุณโดยอัตโนมัติในขั้นตอนสั่งซื้อ
        </p>
      </header>

      {promotions.length === 0 ? (
        <section className="promos-empty">
          <div className="promos-empty__icon">
            <Icon name="tag" size={48} />
          </div>
          <h2>ขณะนี้ยังไม่มีโปรโมชั่นที่เปิดใช้งาน</h2>
          <p>ติดตามข้อเสนอพิเศษและโปรโมชั่นใหม่ๆ ได้เร็วๆ นี้</p>
          <Link to="/" className="btn btn-primary">
            กลับไปเลือกดูหนังสือ
          </Link>
        </section>
      ) : (
        <section className="promos-grid">
          {promotions.map((promo) => (
            <article key={promo.promotionId} className="promo-card">
              <div className="promo-card__top">
                <span className="promo-card__type">
                  {PROMOTION_TYPE_LABELS[promo.type] ?? 'โปรโมชั่น'}
                </span>
                <span className="promo-card__code">
                  {formatPromotionCode(promo.promotionId)}
                </span>
              </div>

              <div className="promo-card__value">
                {promo.isPercent ? (
                  <>
                    <span className="promo-card__num">{promo.discountValue}</span>
                    <span className="promo-card__unit">% ส่วนลด</span>
                  </>
                ) : (
                  <>
                    <span className="promo-card__prefix">ลด</span>
                    <span className="promo-card__num">{formatPrice(promo.discountValue)}</span>
                  </>
                )}
              </div>

              <h3 className="promo-card__name">{promo.name}</h3>

              {promo.conditionDetail && (
                <p className="promo-card__detail">{promo.conditionDetail}</p>
              )}

              <ul className="promo-card__conditions">
                {promo.minAmount > 0 && (
                  <li>
                    <Icon name="check" size={14} />
                    <span>ซื้อครบ {formatPrice(promo.minAmount)} ขึ้นไป</span>
                  </li>
                )}
                {promo.minQty > 0 && (
                  <li>
                    <Icon name="check" size={14} />
                    <span>ซื้อหนังสือครบ {promo.minQty} เล่มขึ้นไป</span>
                  </li>
                )}
                {promo.minAmount === 0 && promo.minQty === 0 && (
                  <li>
                    <Icon name="check" size={14} />
                    <span>ไม่มีขั้นต่ำในการสั่งซื้อ</span>
                  </li>
                )}
              </ul>

              <div className="promo-card__footer">
                <div className="promo-card__dates">
                  <Icon name="clock" size={13} />
                  <span>ใช้ได้ถึง {promo.endDate}</span>
                </div>
                <span className="promo-card__auto-badge">
                  ✨ ใช้งานอัตโนมัติ
                </span>
              </div>

              <Link to="/" className="promo-card__action">
                <span>เลือกซื้อหนังสือเลย</span>
                <Icon name="arrow-right" size={14} />
              </Link>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
