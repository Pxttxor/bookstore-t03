import { useState } from 'react'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import { formatPrice } from '../../data/books'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import Modal from '../components/Modal'
import StatTile from '../components/StatTile'
import { useToast } from '../components/ToastContext'
import { can } from '../permissions'
import { useMembership } from '../../membership/MembershipContext'
import {
  formatMemberCode,
  memberFullName,
  type MembershipTier,
} from '../../membership/membership'
import '../components/AdminForm.css'
import '../components/DataTable.css'
import './MemberTierListPage.css'

interface TierForm {
  name: string
  minAccumulatedPurchase: string
  pointRate: string
  benefits: string
}

const EMPTY_FORM: TierForm = {
  name: '',
  minAccumulatedPurchase: '',
  pointRate: '',
  benefits: '',
}

const toForm = (tier: MembershipTier): TierForm => ({
  name: tier.name,
  minAccumulatedPurchase: String(tier.minAccumulatedPurchase),
  pointRate: String(tier.pointRate),
  benefits: tier.benefits,
})

export default function MemberTierListPage() {
  const { user } = useAuth()
  const { tiers, members, rewards, countByTier, saveTier, loading, error, reload } = useMembership()
  const { notify } = useToast()

  const [editing, setEditing] = useState<MembershipTier | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<TierForm>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof TierForm, string>>>({})
  const [saving, setSaving] = useState(false)

  const role = user!.role
  const mayManage = can.manageMemberTier(role)

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setErrors({})
    setEditing(null)
    setCreating(true)
  }

  const openEdit = (tier: MembershipTier) => {
    setForm(toForm(tier))
    setErrors({})
    setCreating(false)
    setEditing(tier)
  }

  const closeModal = () => {
    setCreating(false)
    setEditing(null)
  }

  const submit = async () => {
    const next: Partial<Record<keyof TierForm, string>> = {}
    if (!form.name.trim()) next.name = 'กรุณากรอกชื่อระดับสมาชิก'
    const min = Number(form.minAccumulatedPurchase)
    if (form.minAccumulatedPurchase === '' || Number.isNaN(min) || min < 0) {
      next.minAccumulatedPurchase = 'กรุณากรอกยอดซื้อสะสมขั้นต่ำเป็นตัวเลขไม่ติดลบ'
    }
    const rate = Number(form.pointRate)
    if (form.pointRate === '' || Number.isNaN(rate) || rate <= 0) {
      next.pointRate = 'กรุณากรอกอัตราสะสมแต้มมากกว่า 0'
    }
    if (!form.benefits.trim()) next.benefits = 'กรุณากรอกสิทธิประโยชน์ของระดับนี้'

    setErrors(next)
    if (Object.keys(next).length > 0) return

    const draft = {
      name: form.name.trim(),
      minAccumulatedPurchase: min,
      pointRate: rate,
      benefits: form.benefits.trim(),
    }
    setSaving(true)
    try {
      const saved = await saveTier(draft, editing?.tierId)
      closeModal()
      notify('success', editing ? `แก้ไขระดับ ${saved.name} แล้ว` : `เพิ่มระดับ ${saved.name} แล้ว`)
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'บันทึกระดับสมาชิกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const totalPoints = members.reduce((sum, m) => sum + m.pointBalance, 0)
  const sortedTiers = [...tiers].sort(
    (a, b) => a.minAccumulatedPurchase - b.minAccumulatedPurchase,
  )

  const field = (key: keyof TierForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  if (loading) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <LoadingState label="กำลังโหลดข้อมูลสมาชิก…" />
        </section>
      </div>
    )
  }

  if (error) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <ErrorState message={error} onRetry={() => void reload()} />
        </section>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <Breadcrumb items={[{ label: 'หน้าหลัก', to: '/admin' }, { label: 'สมาชิกและแต้มสะสม' }]} />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">สมาชิกและแต้มสะสม</h1>
          <p className="admin-page__subtitle">
            กำหนดระดับสมาชิกและอัตราสะสมแต้ม พร้อมดูแต้มคงเหลือของสมาชิกทุกคน
          </p>
        </div>
        <div className="admin-page__actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={openCreate}
            disabled={!mayManage}
            title={mayManage ? undefined : 'เฉพาะผู้จัดการร้านที่กำหนดระดับสมาชิกได้'}
          >
            <Icon name="plus" size={18} />
            เพิ่มระดับสมาชิก
          </button>
        </div>
      </div>

      <section className="tiers__stats">
        <StatTile label="สมาชิกทั้งหมด" value={members.length} note="บัญชีที่สมัครสะสมแต้ม" icon="user" />
        <StatTile
          label="แต้มคงเหลือรวม"
          value={totalPoints.toLocaleString('th-TH')}
          note="ภาระแต้มที่ร้านต้องรองรับ"
          icon="award"
          tone="accent"
        />
        <StatTile label="ของรางวัลในระบบ" value={rewards.length} note="รายการที่เปิดให้แลก" icon="gift" />
      </section>

      <section className="admin-card tiers__panel">
        <h2 className="tiers__panel-title">ระดับสมาชิก</h2>
        <div className="tiers__grid">
          {sortedTiers.map((tier) => (
            <article key={tier.tierId} className="tiers__card">
              <header className="tiers__card-head">
                <h3 className="tiers__card-name">
                  <Icon name="award" size={20} />
                  {tier.name}
                </h3>
                {mayManage && (
                  <button
                    type="button"
                    className="icon-btn"
                    title="แก้ไขระดับสมาชิก"
                    onClick={() => openEdit(tier)}
                  >
                    <Icon name="edit" size={17} />
                  </button>
                )}
              </header>
              <dl className="tiers__card-dl">
                <dt>ยอดซื้อสะสมขั้นต่ำ</dt>
                <dd>{formatPrice(tier.minAccumulatedPurchase)}</dd>
                <dt>อัตราสะสมแต้ม</dt>
                <dd>{tier.pointRate} แต้ม / 1 หน่วยราคา</dd>
                <dt>สมาชิกในระดับนี้</dt>
                <dd>{countByTier(tier.tierId)} คน</dd>
              </dl>
              <p className="tiers__card-benefits">{tier.benefits}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-card tiers__panel">
        <h2 className="tiers__panel-title">สมาชิกและแต้มคงเหลือ</h2>
        {members.length === 0 ? (
          <EmptyState
            icon="user"
            title="ยังไม่มีสมาชิก"
            description="ลูกค้าจะปรากฏที่นี่เมื่อสมัครสมาชิกสะสมแต้มจากหน้าร้าน"
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>รหัสสมาชิก</th>
                  <th>ชื่อ-สกุล</th>
                  <th>ระดับ</th>
                  <th>วันที่สมัคร</th>
                  <th className="tiers__num">ยอดซื้อสะสม</th>
                  <th className="tiers__num">แต้มคงเหลือ</th>
                </tr>
              </thead>
              <tbody>
                {[...members]
                  .sort((a, b) => b.pointBalance - a.pointBalance)
                  .map((member) => (
                    <tr key={member.memberId}>
                      <td className="data-table__code">{formatMemberCode(member.memberId)}</td>
                      <td className="data-table__strong">{memberFullName(member)}</td>
                      <td>{member.tierName}</td>
                      <td>{member.joinDate}</td>
                      <td className="tiers__num">
                        {formatPrice(member.totalAccumulatedPurchase)}
                      </td>
                      <td className="tiers__num">
                        {member.pointBalance.toLocaleString('th-TH')}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(creating || editing) && (
        <Modal
          title={editing ? `แก้ไขระดับ ${editing.name}` : 'เพิ่มระดับสมาชิก'}
          onClose={closeModal}
          footer={
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeModal}>
                ยกเลิก
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => void submit()}
                disabled={saving}
              >
                บันทึก
              </button>
            </>
          }
        >
          <label className="admin-field">
            <span className="admin-field__label">
              ชื่อระดับ <em>*</em>
            </span>
            <input
              className={'admin-input' + (errors.name ? ' admin-input--error' : '')}
              value={form.name}
              placeholder="เช่น Platinum"
              onChange={(e) => field('name', e.target.value)}
            />
            {errors.name && <span className="admin-field__error">{errors.name}</span>}
          </label>

          <label className="admin-field">
            <span className="admin-field__label">
              ยอดซื้อสะสมขั้นต่ำ <em>*</em>
            </span>
            <input
              className={
                'admin-input' + (errors.minAccumulatedPurchase ? ' admin-input--error' : '')
              }
              type="number"
              min={0}
              step="0.01"
              value={form.minAccumulatedPurchase}
              onChange={(e) => field('minAccumulatedPurchase', e.target.value)}
            />
            {errors.minAccumulatedPurchase && (
              <span className="admin-field__error">{errors.minAccumulatedPurchase}</span>
            )}
          </label>

          <label className="admin-field">
            <span className="admin-field__label">
              อัตราสะสมแต้ม (แต้มต่อ 1 หน่วยราคา) <em>*</em>
            </span>
            <input
              className={'admin-input' + (errors.pointRate ? ' admin-input--error' : '')}
              type="number"
              min={0}
              step="0.001"
              value={form.pointRate}
              onChange={(e) => field('pointRate', e.target.value)}
            />
            {errors.pointRate && <span className="admin-field__error">{errors.pointRate}</span>}
          </label>

          <label className="admin-field">
            <span className="admin-field__label">
              สิทธิประโยชน์ <em>*</em>
            </span>
            <textarea
              className={'admin-input' + (errors.benefits ? ' admin-input--error' : '')}
              rows={3}
              value={form.benefits}
              placeholder="เช่น ส่งฟรีทุกคำสั่งซื้อ และคูปองวันเกิด"
              onChange={(e) => field('benefits', e.target.value)}
            />
            {errors.benefits && <span className="admin-field__error">{errors.benefits}</span>}
          </label>
        </Modal>
      )}
    </div>
  )
}
