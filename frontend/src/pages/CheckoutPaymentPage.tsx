import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import Icon from '../components/Icon'
import { formatPrice } from '../data/money'
import {
  SHOP_PROMPTPAY_ID,
  SHOP_PROMPTPAY_NAME,
  buildPromptPayPayload,
  formatPromptPayId,
} from '../data/promptpay'
import { useCart } from '../cart/CartContext'
import { useOrders } from '../admin/orders/OrderContext'
import { usePayments } from '../admin/payments/PaymentContext'
import { useToast } from '../admin/components/ToastContext'
import type { Promotion } from '../admin/promotions/promotions'
import { fetchActivePromotions, findBestPromotion } from '../services/promotionService'
import './CheckoutPaymentPage.css'

interface ShippingState {
  customerName?: string
  mobile?: string
  shippingAddress?: string
}

// ข้อจำกัดของไฟล์สลิป ตรงกับที่หน้าจอเขียนไว้ว่า "Supports JPG, PNG, PDF (Max 5MB)"
const MAX_SLIP_BYTES = 5 * 1024 * 1024
const SLIP_PATTERN = /\.(jpe?g|png|pdf)$/i

export default function CheckoutPaymentPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const {
    subtotal,
    lines,
    clear,
    appliedDiscount,
    discountError,
    applyDiscount,
    removeDiscount,
    setDiscountError,
    setDiscountSuccess,
  } = useCart()
  const { placeOrder } = useOrders()
  const toast = useToast()
  const {
    banks,
    loading: banksLoading,
    error: banksError,
    reload: reloadBanks,
  } = usePayments()
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [couponInput, setCouponInput] = useState('')
  const [checkingCoupon, setCheckingCoupon] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [slip, setSlip] = useState<File | null>(null)
  const [slipPreviewUrl, setSlipPreviewUrl] = useState<string>('')
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')
  const [bankId, setBankId] = useState(0)

  useEffect(() => {
    let unmounted = false
    fetchActivePromotions().then((list) => {
      if (!unmounted) setPromotions(list)
    })
    return () => {
      unmounted = true
    }
  }, [])

  const totalQty = useMemo(() => lines.reduce((sum, line) => sum + line.qty, 0), [lines])
  const { promotion: bestPromo, discount } = useMemo(
    () => findBestPromotion(promotions, subtotal, totalQty),
    [promotions, subtotal, totalQty],
  )
  const rewardDiscount = appliedDiscount ? appliedDiscount.discountAmount : 0
  const totalDiscount = Math.min(subtotal, discount + rewardDiscount)
  const netAmount = Math.max(0, subtotal - totalDiscount)
  const amount = netAmount

  // ยอดที่ล็อกไว้ในรหัสคิวอาร์ ต้องเป็นยอดเดียวกับที่โชว์ให้ลูกค้าเห็น
  // ตะกร้าว่างจะยังไม่มียอด จึงยังไม่ล็อกยอดลงในรหัส
  const qrAmount = lines.length ? amount : 0
  // สร้างรหัสใหม่ทุกครั้งที่ยอดเปลี่ยน เช่น ตอนใช้โปรโมชั่นหรือโค้ดส่วนลด
  const qrPayload = useMemo(
    () => buildPromptPayPayload(SHOP_PROMPTPAY_ID, qrAmount),
    [qrAmount],
  )

  const handleApplyCoupon = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    const code = couponInput.trim()
    if (!code || checkingCoupon) return
    setCheckingCoupon(true)
    try {
      const res = await applyDiscount(code)
      setCouponInput('')
      toast.notify(
        'success',
        `ใช้โค้ดส่วนลด "${res.code}" สำเร็จ! ได้รับส่วนลด ${formatPrice(res.discountAmount)} (ใช้ร่วมกับโปรโมชั่นได้)`,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถใช้โค้ดส่วนลดนี้ได้'
      toast.notify('error', `ไม่สามารถใช้โค้ดได้: ${msg}`)
    } finally {
      setCheckingCoupon(false)
    }
  }

  const handleRemoveCoupon = () => {
    const code = appliedDiscount?.code
    removeDiscount()
    setCouponInput('')
    if (code) {
      toast.notify('info', `ยกเลิกการใช้โค้ดส่วนลด "${code}" เรียบร้อยแล้ว`)
    }
  }
  const selectedBankId = bankId || banks[0]?.bankId
  const selectedBank = banks.find((bank) => bank.bankId === selectedBankId)
  const shipping = (state ?? {}) as ShippingState
  const shippingAddress = shipping.shippingAddress?.trim() ?? ''
  const recipient = shipping.customerName?.trim() ?? ''
  const mobile = shipping.mobile?.trim() ?? ''

  // เก็บไฟล์ทั้งก้อนเพื่อตรวจชนิดและขนาดได้ และแปลงเป็น Data URL เพื่อให้หน้าหลังร้านแสดงรูปภาพได้
  const pickSlip = (file: File | undefined) => {
    const reject = (message: string) => {
      setSlip(null)
      setSlipPreviewUrl('')
      setError(message)
      // ล้างค่าใน input ไม่งั้นเลือกไฟล์เดิมซ้ำจะไม่ยิง onChange อีก
      if (fileRef.current) fileRef.current.value = ''
    }
    if (!file) {
      reject('กรุณาแนบหลักฐานการชำระเงิน')
      return
    }
    if (!SLIP_PATTERN.test(file.name)) {
      reject('รองรับเฉพาะไฟล์ JPG, PNG หรือ PDF')
      return
    }
    if (file.size > MAX_SLIP_BYTES) {
      reject('ไฟล์สลิปต้องมีขนาดไม่เกิน 5MB')
      return
    }
    setSlip(file)
    setError('')
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        setSlipPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setSlipPreviewUrl('')
    }
  }

  const confirm = async () => {
    if (placing) return
    if (!selectedBankId || banksLoading) {
      setError('กรุณารอให้ระบบโหลดบัญชีธนาคาร หรือกดลองใหม่')
      return
    }
    if (!slip) {
      setError('กรุณาแนบหลักฐานการชำระเงิน')
      return
    }
    setPlacing(true)
    setError('')
    try {
      // ส่งชื่อผู้รับ ที่อยู่จัดส่ง บัญชีธนาคาร รายการหนังสือ ชื่อไฟล์สลิป และรหัสโปรโมชั่น (ถ้ามี)
      const order = await placeOrder({
        customerName: recipient,
        customerPhone: mobile,
        bankId: selectedBankId,
        shippingAddress,
        items: lines.map((line) => ({ bookId: line.book.bookId, quantity: line.qty })),
        slipFileName: slip.name,
        promotionId: bestPromo?.promotionId,
        discountCode: appliedDiscount?.code,
      })
      if (slipPreviewUrl) {
        try {
          localStorage.setItem(`slip_order_${order.orderId}`, slipPreviewUrl)
          localStorage.setItem(`slip_file_${slip.name}`, slipPreviewUrl)
        } catch {
          // หากเกินโควตา localStorage ให้ละเว้น
        }
      }
      clear()
      navigate(`/order/${order.orderId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'สั่งซื้อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
      setPlacing(false)
    }
  }

  // เข้าหน้านี้ตรง ๆ ทาง URL (หรือรีเฟรช) จะไม่มีที่อยู่ติดมาใน location.state
  // ต้องกลับไปกรอกก่อน ไม่ใช่ปล่อยให้สั่งซื้อโดยไม่มีที่อยู่
  if (!shippingAddress) return <Navigate to="/checkout/shipping" replace />

  const blockedReason = lines.length === 0
    ? 'ตะกร้าสินค้าว่าง ยังสั่งซื้อไม่ได้'
    : !slip
      ? 'กรุณาแนบหลักฐานการชำระเงินก่อนกดยืนยัน'
      : ''

  return (
    <div className="pay page-shell">
      <header className="pay__head">
        <span className="pay__step">ขั้นที่ 2 จาก 2 · ชำระเงิน</span>
        <h1>สแกนเพื่อชำระเงิน</h1>
        <p>ชำระเงินผ่านรหัสคิวอาร์ แล้วแนบหลักฐานการโอนเพื่อให้เจ้าหน้าที่ตรวจสอบ</p>
      </header>

      <section className="pay__ship">
        <Icon name="truck" size={18} />
        <div>
          <strong>
            จัดส่งถึง {recipient}
            {mobile && ` · ${mobile}`}
          </strong>
          <p>{shippingAddress}</p>
        </div>
      </section>

      <div className="pay__grid">
        <section className="pay__card pay__scan">
          <div className="pay__qr">
            {qrPayload ? (
              <QRCodeSVG
                className="pay__qr-svg"
                value={qrPayload}
                size={200}
                level="M"
                marginSize={1}
                bgColor="#ffffff"
                fgColor="#1a1c1c"
                title={
                  qrAmount > 0
                    ? `รหัสคิวอาร์พร้อมเพย์ ยอด ${formatPrice(qrAmount)}`
                    : 'รหัสคิวอาร์พร้อมเพย์'
                }
              />
            ) : (
              <p className="pay__qr-error" role="alert">
                สร้างรหัสคิวอาร์ไม่สำเร็จ กรุณาโอนเข้าบัญชีธนาคารด้านขวาแทน
              </p>
            )}
          </div>

          <div className="pay__promptpay">
            <span className="pay__promptpay-brand">พร้อมเพย์ (PromptPay)</span>
            <strong>{SHOP_PROMPTPAY_NAME}</strong>
            <span className="pay__promptpay-id">{formatPromptPayId(SHOP_PROMPTPAY_ID)}</span>
          </div>

          <p className="pay__scan-note">
            {qrAmount > 0
              ? `สแกนรหัสด้านบนด้วยแอปธนาคาร ยอด ${formatPrice(qrAmount)} จะถูกกรอกให้อัตโนมัติ`
              : 'สแกนรหัสด้านบนด้วยแอปธนาคารเพื่อชำระเงิน'}
          </p>

          {bestPromo && discount > 0 && (
            <div className="pay__promo-banner">
              <Icon name="tag" size={16} />
              <div className="pay__promo-text">
                <span>ใช้โปรโมชั่นอัตโนมัติ</span>
                <strong>{bestPromo.name}</strong>
              </div>
              <span className="pay__promo-discount">-{formatPrice(discount)}</span>
            </div>
          )}

          {appliedDiscount && rewardDiscount > 0 && (
            <div className="pay__promo-banner pay__promo-banner--reward">
              <Icon name="tag" size={16} />
              <div className="pay__promo-text">
                <span>โค้ดส่วนลดจากการแลกแต้ม</span>
                <strong>{appliedDiscount.code} ({appliedDiscount.rewardName})</strong>
              </div>
              <span className="pay__promo-discount">-{formatPrice(rewardDiscount)}</span>
            </div>
          )}

          <div className="pay__coupon-box">
            <div className="pay__coupon-header">
              <span className="pay__coupon-label">
                <Icon name="tag" size={14} />
                โค้ดส่วนลดจากการแลกแต้ม
              </span>
              <span className="pay__coupon-hint">(ใช้ร่วมกับโปรโมชั่นได้)</span>
            </div>

            {appliedDiscount ? (
              <div className="pay__coupon-applied">
                <div className="pay__coupon-applied-info">
                  <Icon name="tag" size={14} />
                  <span>ใช้โค้ด <strong>{appliedDiscount.code}</strong> (-{formatPrice(rewardDiscount)})</span>
                </div>
                <button
                  type="button"
                  className="pay__coupon-remove-btn"
                  onClick={handleRemoveCoupon}
                  title="ยกเลิกการใช้โค้ด"
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
            ) : (
              <div className="pay__coupon-form">
                <input
                  type="text"
                  className={`pay__coupon-input ${discountError ? 'pay__coupon-input--error' : ''}`}
                  placeholder="กรอกโค้ด เช่น RWD00001"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value)
                    if (discountError) setDiscountError(null)
                    setDiscountSuccess(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      e.stopPropagation()
                      void handleApplyCoupon(e)
                    }
                  }}
                  disabled={checkingCoupon}
                />
                <button
                  type="button"
                  className="pay__coupon-btn"
                  disabled={!couponInput.trim() || checkingCoupon}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    void handleApplyCoupon(e)
                  }}
                >
                  {checkingCoupon ? '...' : 'ใช้โค้ด'}
                </button>
              </div>
            )}

            {appliedDiscount && (
              <div className="pay__coupon-feedback pay__coupon-feedback--success" role="status">
                <Icon name="check-circle" size={14} />
                <span>ใช้โค้ดสำเร็จ! ได้รับส่วนลด {formatPrice(appliedDiscount.discountAmount)} (ใช้ร่วมกับโปรโมชั่นร้านได้)</span>
              </div>
            )}

            {discountError && !appliedDiscount && (
              <div className="pay__coupon-feedback pay__coupon-feedback--error" role="alert">
                <Icon name="alert-triangle" size={14} />
                <span>{discountError}</span>
              </div>
            )}
          </div>

          <div className="pay__amount">
            {totalDiscount > 0 ? (
              <div className="pay__amount-breakdown">
                <div className="pay__amount-subrow">
                  <span>รวมค่าสินค้า</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {bestPromo && discount > 0 && (
                  <div className="pay__amount-subrow pay__amount-subrow--discount">
                    <span>ส่วนลดโปรโมชั่น ({bestPromo.name})</span>
                    <span>-{formatPrice(discount)}</span>
                  </div>
                )}
                {appliedDiscount && rewardDiscount > 0 && (
                  <div className="pay__amount-subrow pay__amount-subrow--discount">
                    <span>ส่วนลดโค้ดรางวัล ({appliedDiscount.code})</span>
                    <span>-{formatPrice(rewardDiscount)}</span>
                  </div>
                )}
                {bestPromo && discount > 0 && appliedDiscount && rewardDiscount > 0 && (
                  <div className="pay__amount-subrow pay__amount-subrow--combined">
                    <span>ส่วนลดรวม (ใช้ร่วมกันได้)</span>
                    <span>-{formatPrice(totalDiscount)}</span>
                  </div>
                )}
                <div className="pay__amount-main">
                  <span>ยอดชำระสุทธิ</span>
                  <strong>{formatPrice(lines.length ? amount : 0)}</strong>
                </div>
              </div>
            ) : (
              <>
                <span>ยอดชำระ</span>
                <strong>{formatPrice(lines.length ? amount : 0)}</strong>
              </>
            )}
          </div>
        </section>

        <section className="pay__card pay__verify">
          <span className="pay__label">การตรวจสอบ</span>
          <h2 className="pay__verify-title">แนบหลักฐานการชำระเงิน</h2>

          <label className="pay__bank">
            <span>โอนเข้าธนาคาร</span>
            <select
              value={selectedBankId ?? ''}
              onChange={(event) => setBankId(Number(event.target.value))}
              disabled={banksLoading || banks.length === 0}
            >
              {banks.length === 0 && (
                <option value="">
                  {banksLoading ? 'กำลังโหลดบัญชีธนาคาร…' : 'ไม่พบบัญชีธนาคาร'}
                </option>
              )}
              {banks.map((bank) => (
                <option key={bank.bankId} value={bank.bankId}>
                  {bank.name}
                </option>
              ))}
            </select>
            {selectedBank && (
              <small className="pay__bank-account">เลขบัญชี {selectedBank.accountNo}</small>
            )}
            {banksError && (
              <small className="pay__bank-error">
                {banksError}
                <button type="button" onClick={() => void reloadBanks()}>
                  ลองใหม่
                </button>
              </small>
            )}
          </label>

          <button
            type="button"
            className="pay__drop"
            onClick={() => fileRef.current?.click()}
          >
            {slipPreviewUrl ? (
              <div className="pay__slip-preview">
                <img src={slipPreviewUrl} alt="ตัวอย่างสลิป" className="pay__slip-preview-img" />
                <span className="pay__drop-main">{slip?.name}</span>
                <span className="pay__drop-sub">คลิกเพื่อเปลี่ยนไฟล์รูปสลิป</span>
              </div>
            ) : (
              <>
                <Icon name="upload" size={32} />
                <span className="pay__drop-main">
                  {slip ? (
                    slip.name
                  ) : (
                    <>
                      ลากไฟล์สลิปมาวางที่นี่ หรือ <b>เลือกไฟล์</b>
                    </>
                  )}
                </span>
                <span className="pay__drop-sub">รองรับ JPG, PNG หรือ PDF ขนาดไม่เกิน 5MB</span>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              hidden
              onChange={(e) => pickSlip(e.target.files?.[0])}
            />
          </button>

          <p className="pay__verify-note">
            <Icon name="clock" size={16} />
            เจ้าหน้าที่จะตรวจสอบการชำระเงินภายใน 24 ชั่วโมง และแจ้งผลให้ทราบทางอีเมล
          </p>
        </section>
      </div>

      {error && (
        <p className="pay__error" role="alert">
          <Icon name="help" size={16} />
          {error}
        </p>
      )}

      <button
        className="btn btn-primary pay__confirm"
        onClick={() => void confirm()}
        disabled={blockedReason !== '' || !selectedBankId || banksLoading || placing}
        title={blockedReason || undefined}
      >
        <Icon name="check" size={18} />
        {placing ? 'กำลังสั่งซื้อ…' : 'ยืนยันการชำระเงิน'}
      </button>

      {blockedReason && <p className="pay__hint">{blockedReason}</p>}

      <div className="pay__footer">
        <span className="pay__secure">
          <Icon name="shield" size={16} />
          การชำระเงินที่ปลอดภัย
        </span>
      </div>
    </div>
  )
}
