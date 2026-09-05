import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import Modal from '../admin/components/Modal'
import { apiGet, apiPut, ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import './ProfilePage.css'

interface CustomerProfile {
  customerId: number
  personId: number
  firstName: string
  lastName: string
  name: string
  email: string
  phone: string
  address: string
  registeredDate: string
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function ProfilePage() {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const loadProfile = useCallback(async () => {
    if (!user) return
    try {
      const data = await apiGet<CustomerProfile>('/api/customers/me')
      setProfile(data)
    } catch {
      // ignore
    }
  }, [user])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfile()
  }, [loadProfile])

  // only signed-in members can open their profile
  if (!user) return <Navigate to="/login" replace state={{ from: '/profile' }} />

  const signOut = () => {
    logout()
    navigate('/', { replace: true })
  }

  const openEditModal = () => {
    setFirstName(profile?.firstName ?? '')
    setLastName(profile?.lastName ?? '')
    setPhone(profile?.phone ?? '')
    setAddress(profile?.address ?? '')
    setError('')
    setIsEditing(true)
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    if (!firstName.trim()) {
      setError('กรุณากรอกชื่อ')
      return
    }
    if (!lastName.trim()) {
      setError('กรุณากรอกนามสกุล')
      return
    }
    setSaving(true)
    setError('')
    try {
      const updated = await apiPut<CustomerProfile>('/api/customers/me', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        address: address.trim(),
      })
      setProfile(updated)
      await refreshUser()
      setIsEditing(false)
      setSuccessMsg('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว')
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  const displayName = profile?.name || user.name
  const displayEmail = profile?.email || user.email

  return (
    <div className="profile page-shell">
      <section className="profile__hero">
        <span className="profile__avatar" aria-hidden="true">
          {initialsOf(displayName)}
        </span>
        <div className="profile__id">
          <h1 className="profile__name">{displayName}</h1>
          <p className="profile__email">{displayEmail}</p>
          <span className="profile__badge">
            <Icon name="check-circle" size={16} />
            BookHaven Member
          </span>
        </div>
      </section>

      <div className="profile__grid">
        <section className="profile__card">
          <h2 className="profile__card-title">
            <Icon name="user" size={20} />
            ข้อมูลบัญชี
          </h2>
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

          <button
            type="button"
            className="btn btn-outline profile__edit"
            onClick={openEditModal}
          >
            <Icon name="edit" size={16} />
            แก้ไขข้อมูลส่วนตัว
          </button>
        </section>

        <section className="profile__card">
          <h2 className="profile__card-title">
            <Icon name="package" size={20} />
            ทางลัด
          </h2>
          <nav className="profile__links">
            <Link to="/orders" className="profile__link">
              <Icon name="clock" size={18} />
              <span>ประวัติการสั่งซื้อ</span>
              <Icon name="arrow-right" size={16} />
            </Link>
            <Link to="/member/points" className="profile__link">
              <Icon name="award" size={18} />
              <span>แต้มสะสมของฉัน</span>
              <Icon name="arrow-right" size={16} />
            </Link>
            <Link to="/member/rewards" className="profile__link">
              <Icon name="gift" size={18} />
              <span>แลกของรางวัล</span>
              <Icon name="arrow-right" size={16} />
            </Link>
            <span
              className="profile__link profile__link--soon"
              aria-disabled="true"
              title="ฟีเจอร์นี้เป็นส่วนของระบบสมาชิก — อยู่นอกขอบเขตต้นแบบนี้"
            >
              <Icon name="heart" size={18} />
              <span>รายการโปรดของฉัน</span>
              <em className="profile__soon">เร็ว ๆ นี้</em>
            </span>
            <span
              className="profile__link profile__link--soon"
              aria-disabled="true"
              title="ฟีเจอร์นี้เป็นส่วนของระบบสมาชิก — อยู่นอกขอบเขตต้นแบบนี้"
            >
              <Icon name="truck" size={18} />
              <span>สมุดที่อยู่จัดส่ง</span>
              <em className="profile__soon">เร็ว ๆ นี้</em>
            </span>
          </nav>
          <button type="button" className="profile__signout" onClick={signOut}>
            <Icon name="log-out" size={18} />
            ออกจากระบบ
          </button>
        </section>
      </div>

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
            {error && (
              <div className="profile-edit-form__error">
                <Icon name="alert-triangle" size={16} />
                <span>{error}</span>
              </div>
            )}
            <div className="profile-edit-form__grid">
              <label className="profile-edit-form__field">
                <span>
                  ชื่อ <span className="text-danger">*</span>
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
                  นามสกุล <span className="text-danger">*</span>
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
