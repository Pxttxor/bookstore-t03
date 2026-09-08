import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import Icon from '../components/Icon'
import Modal from '../admin/components/Modal'
import LoadingState from '../admin/components/LoadingState'
import ErrorState from '../admin/components/ErrorState'
import { apiPut, ApiError } from '../api/client'
import { useResource } from '../api/useResource'
import { loadMyProfile, type MyProfile } from '../data/profile'
import { useAuth } from '../auth/AuthContext'
import './ProfilePage.css'

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const { pathname } = useLocation()

  // เรียก hook ก่อน early return เสมอ — ถ้าย้ายลงล่าง useResource จะไม่ทำงานตอน user เป็น null
  // enabled กันพนักงานที่หลุดเข้ามา (AccountLayout เช็คแค่ล็อกอิน ไม่เช็ค role) ยิง
  // /api/customers/me แล้วได้ 403 เงียบ ๆ — เส้นทางนี้เป็นของลูกค้าเท่านั้น
  const { data: profile, loading, error, apply, reload } = useResource(
    loadMyProfile,
    user?.role === 'customer',
  )

  const [isEditing, setIsEditing] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // AccountLayout กันคนไม่ล็อกอินไว้ก่อนแล้ว — เหลือไว้แค่ narrow ชนิด `user` ให้ TS
  if (!user) return <Navigate to="/login" replace state={{ from: pathname }} />

  const openEditModal = () => {
    if (!profile) return
    setFirstName(profile.firstName)
    setLastName(profile.lastName)
    setPhone(profile.phone)
    setAddress(profile.address)
    setFormError('')
    setIsEditing(true)
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    if (!firstName.trim()) {
      setFormError('กรุณากรอกชื่อ')
      return
    }
    if (!lastName.trim()) {
      setFormError('กรุณากรอกนามสกุล')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const updated = await apiPut<MyProfile>('/api/customers/me', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        address: address.trim(),
      })
      apply(() => updated)
      await refreshUser()
      setIsEditing(false)
      setSuccessMsg('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว')
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
      )
    } finally {
      setSaving(false)
    }
  }

  const displayName = profile?.name || user.name
  const displayEmail = profile?.email || user.email

  return (
    <div className="profile">
      <h1 className="profile__title">ข้อมูลสมาชิก</h1>

      <section className="profile__card">
        <header className="profile__card-head">
          <h2 className="profile__card-title">
            <Icon name="user" size={20} />
            ข้อมูลบัญชี
          </h2>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={openEditModal}
            disabled={!profile}
            title={
              profile
                ? undefined
                : user.role !== 'customer'
                  ? 'แก้ไขข้อมูลส่วนตัวได้เฉพาะบัญชีลูกค้า'
                  : 'กำลังโหลดข้อมูลบัญชี'
            }
          >
            <Icon name="edit" size={16} />
            แก้ไขข้อมูลส่วนตัว
          </button>
        </header>

        {loading && <LoadingState label="กำลังโหลดข้อมูลบัญชี…" />}

        {!loading && error && (
          <ErrorState message={error} onRetry={() => void reload()} />
        )}

        {!loading && !error && (
          <>
            <dl className="profile__details">
              <div className="profile__row">
                <dt>ชื่อ-นามสกุล</dt>
                <dd>{displayName}</dd>
              </div>
              <div className="profile__row">
                <dt>อีเมล</dt>
                <dd>{displayEmail}</dd>
              </div>
              <div className="profile__row">
                <dt>เบอร์โทรศัพท์</dt>
                <dd>{profile?.phone || '—'}</dd>
              </div>
              <div className="profile__row">
                <dt>ที่อยู่จัดส่ง</dt>
                <dd>{profile?.address || '—'}</dd>
              </div>
              <div className="profile__row">
                <dt>รหัสผ่าน</dt>
                <dd>••••••••</dd>
              </div>
            </dl>

            {successMsg && (
              <p className="profile__success-msg">
                <Icon name="check-circle" size={16} /> {successMsg}
              </p>
            )}
          </>
        )}
      </section>

      {isEditing && (
        <Modal
          title="แก้ไขข้อมูลส่วนตัว"
          onClose={() => setIsEditing(false)}
          footer={
            <div className="profile-modal__footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setIsEditing(false)}
                disabled={saving}
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                form="profile-edit-form"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? 'กำลังบันทึก…' : 'บันทึกข้อมูล'}
              </button>
            </div>
          }
        >
          <form id="profile-edit-form" onSubmit={handleSave} className="profile-edit-form">
            {formError && (
              <div className="profile-edit-form__error">
                <Icon name="alert-triangle" size={16} />
                <span>{formError}</span>
              </div>
            )}
            <div className="profile-edit-form__grid">
              <label className="profile-edit-form__field">
                <span>
                  ชื่อ <span className="profile-edit-form__required">*</span>
                </span>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="กรอกชื่อ"
                />
              </label>
              <label className="profile-edit-form__field">
                <span>
                  นามสกุล <span className="profile-edit-form__required">*</span>
                </span>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="กรอกนามสกุล"
                />
              </label>
            </div>
            <label className="profile-edit-form__field">
              <span>เบอร์โทรศัพท์</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="เช่น 0812345678"
              />
            </label>
            <label className="profile-edit-form__field">
              <span>ที่อยู่จัดส่ง</span>
              <textarea
                rows={3}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์"
              />
            </label>
          </form>
        </Modal>
      )}
    </div>
  )
}
