import { useState } from 'react'
import { useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import RatingStars from '../components/RatingStars'
import { getBook, formatPrice } from '../data/books'
import { useOrders } from '../admin/orders/OrderContext'
import {
  formatOrderCode,
  milestoneOf,
  ORDER_STATUS_LABELS,
  type CustomerOrder,
} from '../admin/orders/orders'
import './OrderTrackingPage.css'

type StepStatus = 'done' | 'current' | 'todo'

const STEP_LABELS = ['Order Placed', 'Payment Confirmed', 'Processing', 'Shipped', 'Delivered']

function ReviewForm({ id }: { id: string }) {
  const book = getBook(id)
  const [rating, setRating] = useState(0)
  const [sent, setSent] = useState(false)
  if (!book) return null

  return (
    <div className="track-review">
      <div className="track-review__book">
        <img src={book.cover} alt={book.title} loading="lazy" decoding="async" />
        <h4>{book.title}</h4>
      </div>
      {sent ? (
        <p className="track-review__thanks">
          <Icon name="check-circle" size={18} /> ขอบคุณสำหรับรีวิว!
        </p>
      ) : (
        <>
          <div className="track-review__rate">
            <span>Rating</span>
            <RatingStars value={rating} interactive size={22} onChange={setRating} />
          </div>
          <label className="track-review__field">
            <span>Write a review</span>
            <textarea rows={3} placeholder="What did you think of this book?" />
          </label>
          <button
            className="btn btn-primary track-review__submit"
            onClick={() => setSent(true)}
          >
            Submit Review
          </button>
        </>
      )}
    </div>
  )
}

// Drives the five-step storefront tracker from the order's real status and timeline.
function buildSteps(order: CustomerOrder): { label: string; date: string; status: StepStatus }[] {
  const current = milestoneOf(order.status)
  const dateFor = (milestone: number) => {
    const entry = order.timeline.find((t) => milestoneOf(t.status) === milestone)
    return entry ? `${entry.changedDate.slice(0, 10)} ${entry.changedDate.slice(11, 16)}` : ''
  }
  return STEP_LABELS.map((label, i) => {
    const status: StepStatus =
      order.status === 'DELIVERED' || i < current ? 'done' : i === current ? 'current' : 'todo'
    return { label, date: status === 'todo' ? '' : dateFor(i) || '—', status }
  })
}

export default function OrderTrackingPage() {
  const { id } = useParams()
  const { findOrder } = useOrders()
  const order = findOrder(Number(id))

  if (order) return <RealOrderView order={order} />
  return <StaticDemoView orderNo={id ?? 'BK-94821'} />
}

function RealOrderView({ order }: { order: CustomerOrder }) {
  const steps = buildSteps(order)
  const activeIndex = Math.max(0, steps.findIndex((s) => s.status === 'current'))
  const progress =
    order.status === 'DELIVERED' ? 100 : (activeIndex / (steps.length - 1)) * 100
  const cancelled = order.status === 'CANCELLED' || order.status === 'REJECTED'

  return (
    <div className="track page-shell">
      <header className="track__head">
        <div>
          <h1>Order #{formatOrderCode(order.orderId)}</h1>
          <p>สั่งซื้อเมื่อ {order.orderDate}</p>
        </div>
        <button className="btn btn-ghost track__help">
          <Icon name="help" size={18} />
          Need Help?
        </button>
      </header>

      <section className="track__status">
        <h2>สถานะ: {ORDER_STATUS_LABELS[order.status]}</h2>
        {cancelled ? (
          <p className="track__cancelled">
            <Icon name="alert-triangle" size={18} /> คำสั่งซื้อนี้{ORDER_STATUS_LABELS[order.status]}
          </p>
        ) : (
          <div className="track__steps">
            <div className="track__line" />
            <div className="track__line track__line--active" style={{ width: `${progress}%` }} />
            {steps.map((s) => (
              <div key={s.label} className={`track__step is-${s.status}`}>
                <span className="track__dot">
                  {s.status === 'done' ? (
                    <Icon name="check" size={16} />
                  ) : s.status === 'current' ? (
                    <Icon name="truck" size={16} />
                  ) : (
                    <Icon name="package" size={16} />
                  )}
                </span>
                <span className="track__step-label">{s.label}</span>
                <span className="track__step-date">{s.date}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="track__grid">
        <div className="track__col">
          <section className="track__panel">
            <h3 className="track__panel-title">
              <Icon name="truck" size={18} /> Shipping Details
            </h3>
            <dl className="track__dl">
              <dt>DELIVERY ADDRESS</dt>
              <dd>
                {order.customerName}
                <br />
                {order.shippingAddress}
              </dd>
              <dt>CARRIER</dt>
              <dd>{order.shipment?.carrier ?? 'รอจัดส่ง'}</dd>
              <dt>TRACKING NUMBER</dt>
              <dd className="track__tracking">
                {order.shipment ? (
                  <span className="track__mono">{order.shipment.trackingNumber}</span>
                ) : (
                  <span className="track__mono">—</span>
                )}
              </dd>
            </dl>
          </section>

          <section className="track__panel">
            <h3 className="track__panel-title">
              <Icon name="package" size={18} /> Order Summary
            </h3>
            <div className="track__totals">
              <div className="track__row">
                <span>Subtotal</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="track__row track__row--discount">
                  <span>Discount</span>
                  <span>-{formatPrice(order.discountAmount)}</span>
                </div>
              )}
              <div className="track__row track__row--total">
                <span>Total</span>
                <span>{formatPrice(order.netAmount)}</span>
              </div>
            </div>
          </section>
        </div>

        <div className="track__col track__col--wide">
          <section className="track__panel">
            <h3 className="track__panel-title">Items Ordered</h3>
            <ul className="track__items">
              {order.items.map((line) => {
                const book = getBook(line.bookId)
                return (
                  <li key={line.bookId} className="track__item">
                    {book && (
                      <img src={book.cover} alt={line.title} loading="lazy" decoding="async" />
                    )}
                    <div className="track__item-info">
                      <strong>{line.title}</strong>
                      {book && <span>{book.author}</span>}
                      <span className="track__format">จำนวน {line.quantity}</span>
                    </div>
                    <span className="track__item-price">
                      {formatPrice(line.unitPrice * line.quantity)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>

          {order.status === 'DELIVERED' && (
            <section className="track__panel">
              <h3 className="track__panel-title">
                <Icon name="star" size={18} filled /> Review &amp; Rate
              </h3>
              <div className="track__reviews">
                {order.items.map((line) => (
                  <ReviewForm key={line.bookId} id={line.bookId} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

/* The original static prototype, shown when the id does not resolve to a stored order
   (e.g. the seeded demo link /order/BK-94821). */
const DEMO_STEPS: { label: string; date: string; status: StepStatus }[] = [
  { label: 'Order Placed', date: 'Oct 24, 09:00 AM', status: 'done' },
  { label: 'Payment Confirmed', date: 'Oct 24, 09:15 AM', status: 'done' },
  { label: 'Processing', date: 'Oct 25, 11:30 AM', status: 'done' },
  { label: 'Shipped', date: 'In transit', status: 'current' },
  { label: 'Delivered', date: 'Oct 26, 14:30 PM', status: 'todo' },
]

const DEMO_ITEMS = [
  { id: 'the-midnight-library', format: 'Hardcover', price: 24.99 },
  { id: 'dune', format: 'Paperback', price: 23.99 },
]

function StaticDemoView({ orderNo }: { orderNo: string }) {
  const activeIndex = DEMO_STEPS.findIndex((s) => s.status === 'current')
  const progress = (activeIndex / (DEMO_STEPS.length - 1)) * 100

  return (
    <div className="track page-shell">
      <header className="track__head">
        <div>
          <h1>Order #{orderNo}</h1>
          <p>Placed on October 24, 2023</p>
        </div>
        <button className="btn btn-ghost track__help">
          <Icon name="help" size={18} />
          Need Help?
        </button>
      </header>

      <section className="track__status">
        <h2>Tracking Status</h2>
        <div className="track__steps">
          <div className="track__line" />
          <div className="track__line track__line--active" style={{ width: `${progress}%` }} />
          {DEMO_STEPS.map((s) => (
            <div key={s.label} className={`track__step is-${s.status}`}>
              <span className="track__dot">
                {s.status === 'done' ? (
                  <Icon name="check" size={16} />
                ) : s.status === 'current' ? (
                  <Icon name="truck" size={16} />
                ) : (
                  <Icon name="package" size={16} />
                )}
              </span>
              <span className="track__step-label">{s.label}</span>
              <span className="track__step-date">{s.date}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="track__grid">
        <div className="track__col">
          <section className="track__panel">
            <h3 className="track__panel-title">
              <Icon name="truck" size={18} /> Shipping Details
            </h3>
            <dl className="track__dl">
              <dt>DELIVERY ADDRESS</dt>
              <dd>
                Eleanor Vance
                <br />
                123 Hill House Drive
                <br />
                Boston, MA 02108
                <br />
                United States
              </dd>
              <dt>CARRIER</dt>
              <dd>DHL Express</dd>
              <dt>TRACKING NUMBER</dt>
              <dd className="track__tracking">
                <span className="track__mono">DHL-9876543210</span>
                <button className="track__track-link">
                  Track <Icon name="arrow-right" size={14} />
                </button>
              </dd>
            </dl>
          </section>

          <section className="track__panel">
            <h3 className="track__panel-title">
              <Icon name="package" size={18} /> Order Summary
            </h3>
            <div className="track__totals">
              <div className="track__row">
                <span>Subtotal (2 items)</span>
                <span>$48.98</span>
              </div>
              <div className="track__row">
                <span>Shipping</span>
                <span>$5.99</span>
              </div>
              <div className="track__row track__row--discount">
                <span>Discount (WELCOME10)</span>
                <span>-$4.90</span>
              </div>
              <div className="track__row track__row--total">
                <span>Total</span>
                <span>$50.07</span>
              </div>
            </div>
          </section>
        </div>

        <div className="track__col track__col--wide">
          <section className="track__panel">
            <h3 className="track__panel-title">Items Ordered</h3>
            <ul className="track__items">
              {DEMO_ITEMS.map((it) => {
                const book = getBook(it.id)
                if (!book) return null
                return (
                  <li key={it.id} className="track__item">
                    <img src={book.cover} alt={book.title} loading="lazy" decoding="async" />
                    <div className="track__item-info">
                      <strong>{book.title}</strong>
                      <span>{book.author}</span>
                      <span className="track__format">{it.format}</span>
                    </div>
                    <span className="track__item-price">{formatPrice(it.price)}</span>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="track__panel">
            <h3 className="track__panel-title">
              <Icon name="star" size={18} filled /> Review &amp; Rate
            </h3>
            <div className="track__reviews">
              {DEMO_ITEMS.map((it) => (
                <ReviewForm key={it.id} id={it.id} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
