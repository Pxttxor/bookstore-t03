import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useAuth } from '../../auth/AuthContext'
import { can } from '../permissions'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import { useToast } from '../components/ToastContext'
import { useBooks } from '../books/BookContext'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
import { useSuppliers, type SupplierDraft } from '../suppliers/SupplierContext'
import { formatSupplierCode } from '../suppliers/suppliers'
import './SupplierFormPage.css'

type FieldName =
  | 'companyName'
  | 'contactName'
  | 'phone'
  | 'email'
  | 'address'
  | 'tradeTerms'
  | 'creditTerms'

const REQUIRED: FieldName[] = ['companyName', 'contactName', 'phone', 'email', 'address']

const LABELS: Record<FieldName, string> = {
  companyName: 'ชื่อบริษัท',
  contactName: 'ผู้ติดต่อ',
  phone: 'เบอร์โทร',
  email: 'อีเมล',
  address: 'ที่อยู่',
  tradeTerms: 'เงื่อนไขการค้า',
  creditTerms: 'เงื่อนไขเครดิต',
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// แถวหนึ่งของ supplier_book — ตารางนี้เป็นเจ้าของแค่สามฟิลด์นี้
// ชื่อ / ผู้แต่ง / สำนักพิมพ์ / ISBN เป็นของตาราง book เลือกจากแคตตาล็อกเท่านั้น
// (`SupplierBook "*" --> "1" Book` ใน class diagram · FK supplier_book.book_id -> book)
type BookRow = {
  bookId: number
  supplyPrice: number
  leadTimeDays: number
}

const emptyBook = (bookId: number): BookRow => ({
  bookId,
  supplyPrice: 0,
  leadTimeDays: 0,
})

// ด่าน loading/error ต้องอยู่ที่ตัวห่อ ไม่ใช่ในฟอร์ม เพราะฟอร์มตั้งค่าเริ่มต้นด้วย useState
// ครั้งเดียวตอน mount และตัวกรองรายการหนังสือตอน submit อ้าง catalogue จาก useBooks()
// ถ้าปล่อยให้ฟอร์ม mount ตั้งแต่ catalogue ยังไม่พร้อม การกดบันทึกจะส่ง books ว่าง
// แล้วรายการหนังสือของผู้จัดจำหน่ายรายนั้นถูกลบทั้งชุด
export default function SupplierFormPage() {
  const { id } = useParams()
  const suppliers = useSuppliers()
  const books = useBooks()

  if (suppliers.loading || books.loading) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <LoadingState label="กำลังโหลดข้อมูลผู้จัดจำหน่าย…" />
        </section>
      </div>
    )
  }

  if (suppliers.error || books.error) {
    const message = suppliers.error ?? books.error ?? ''
    const retry = suppliers.error ? suppliers.reload : books.reload
    return (
      <div className="admin-page">
        <section className="admin-card">
          <ErrorState message={message} onRetry={() => void retry()} />
        </section>
      </div>
    )
  }

  return <SupplierForm key={id ?? 'new'} id={id} />
}

function SupplierForm({ id }: { id?: string }) {
  const { user } = useAuth()
  const { findById, findByCompanyName, add, update } = useSuppliers()
  const { books: catalogue } = useBooks()
  const { notify } = useToast()
  const navigate = useNavigate()

  const editing = id !== undefined
  const existing = editing ? findById(Number(id)) : undefined

  const [values, setValues] = useState<Record<FieldName, string>>({
    companyName: existing?.companyName ?? '',
    contactName: existing?.contactName ?? '',
    phone: existing?.phone ?? '',
    email: existing?.email ?? '',
    address: existing?.address ?? '',
    tradeTerms: existing?.tradeTerms ?? '',
    creditTerms: existing?.creditTerms ?? '',
  })
  const [books, setBooks] = useState<BookRow[]>(
    () =>
      existing?.books.map((book) => ({
        bookId: book.bookId,
        supplyPrice: book.supplyPrice,
        leadTimeDays: book.leadTimeDays,
      })) ?? [],
  )
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [saving, setSaving] = useState(false)

  if (!can.editSuppliers(user!.role)) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <EmptyState
            icon="lock"
            title="บทบาทของคุณไม่มีสิทธิ์แก้ไขข้อมูลผู้จัดจำหน่าย"
            description="การเพิ่มและแก้ไขข้อมูลเป็นสิทธิ์ของพนักงานคลังสินค้าเท่านั้น"
            action={{ label: 'กลับไปหน้ารายการ', onClick: () => navigate('/admin/suppliers') }}
          />
        </section>
      </div>
    )
  }

  if (editing && !existing) {
    return (
      <div className="admin-page">
        <Breadcrumb
          items={[
            { label: 'หน้าหลัก', to: '/admin' },
            { label: 'ผู้จัดจำหน่าย', to: '/admin/suppliers' },
            { label: 'ไม่พบข้อมูล' },
          ]}
        />
        <section className="admin-card">
          <EmptyState
            icon="building"
            title="ไม่พบข้อมูลผู้จัดจำหน่าย"
            description="ไม่สามารถเปิดฟอร์มแก้ไขได้เพราะไม่พบรหัสที่ระบุ"
            action={{ label: 'กลับไปหน้ารายการ', onClick: () => navigate('/admin/suppliers') }}
          />
        </section>
      </div>
    )
  }

  const setField = (field: FieldName, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const setBookField = <K extends keyof BookRow>(index: number, field: K, value: BookRow[K]) => {
    setBooks((current) =>
      current.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    )
  }

  // เล่มที่ยังไม่ถูกเลือกในฟอร์มนี้ — ใช้ปิดปุ่ม "เพิ่มรายการ" เมื่อเลือกครบแล้ว
  const availableBooks = catalogue.filter(
    (book) => !books.some((row) => row.bookId === book.bookId),
  )

  // รายละเอียดที่ตาราง book เป็นเจ้าของ แสดงอย่างเดียว แก้ที่หน้าข้อมูลหนังสือ
  const bookMeta = (bookId: number) => {
    const book = catalogue.find((entry) => entry.bookId === bookId)
    if (!book) return 'ไม่พบเล่มนี้ในแคตตาล็อก'
    return `${book.author} · ${book.publisher} · ISBN ${book.isbn}`
  }

  const validate = () => {
    const found: Partial<Record<FieldName, string>> = {}
    for (const field of REQUIRED) {
      if (!values[field].trim()) found[field] = `กรุณากรอก${LABELS[field]}`
    }
    if (values.email.trim() && !EMAIL_PATTERN.test(values.email.trim())) {
      found.email = 'รูปแบบอีเมลไม่ถูกต้อง'
    }
    setErrors(found)
    return Object.keys(found).length === 0
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    if (!validate()) return

    const duplicate = findByCompanyName(values.companyName, existing?.supplierId)
    if (duplicate) {
      notify('error', `พบข้อมูลซ้ำ: ${duplicate.companyName} มีอยู่ในระบบแล้ว`, {
        label: 'ดูรายการเดิม',
        onClick: () => navigate(`/admin/suppliers/${duplicate.supplierId}`),
      })
      return
    }

    const draft: SupplierDraft = {
      companyName: values.companyName.trim(),
      contactName: values.contactName.trim(),
      phone: values.phone.trim(),
      email: values.email.trim(),
      address: values.address.trim(),
      tradeTerms: values.tradeTerms.trim(),
      creditTerms: values.creditTerms.trim(),
      // ส่งเฉพาะเล่มที่มีอยู่จริงในแคตตาล็อก — FK supplier_book.book_id -> book บังคับไว้
      books: books
        .filter((row) => catalogue.some((book) => book.bookId === row.bookId))
        .map((row) => ({
          bookId: row.bookId,
          supplyPrice: row.supplyPrice,
          leadTimeDays: row.leadTimeDays,
          // SupplierBook ฝั่ง TS ยังประกาศสี่ฟิลด์นี้เพราะ DTO ขาออกส่งกลับมาด้วย
          // ส่วนขาเข้า toBody() ใน SupplierContext ตัดทิ้งก่อนยิง API
          isbn: '',
          title: '',
          author: '',
          publisher: '',
        })),
    }

    setSaving(true)
    try {
      if (existing) {
        // ผู้แก้ไขมาจาก JWT ฝั่งเซิร์ฟเวอร์ ไม่ต้องส่ง user.name ไปแล้ว
        await update(existing.supplierId, draft)
        notify('success', `บันทึกการแก้ไข ${draft.companyName} เรียบร้อยแล้ว`)
        navigate(`/admin/suppliers/${existing.supplierId}`)
      } else {
        const created = await add(draft)
        notify(
          'success',
          `เพิ่มผู้จัดจำหน่ายสำเร็จ (รหัส ${formatSupplierCode(created.supplierId)})`,
        )
        navigate(`/admin/suppliers/${created.supplierId}`)
      }
    } catch (err) {
      // ข้อความจาก backend เป็นภาษาไทยอยู่แล้ว (ชื่อบริษัทซ้ำ ฯลฯ)
      notify('error', err instanceof Error ? err.message : 'บันทึกข้อมูลไม่สำเร็จ')
      setSaving(false)
    }
  }

  const title = existing ? 'แก้ไขผู้จัดจำหน่าย' : 'เพิ่มผู้จัดจำหน่าย'

  return (
    <div className="admin-page">
      <Breadcrumb
        items={[
          { label: 'หน้าหลัก', to: '/admin' },
          { label: 'ผู้จัดจำหน่าย', to: '/admin/suppliers' },
          ...(existing
            ? [{ label: existing.companyName, to: `/admin/suppliers/${existing.supplierId}` }]
            : []),
          { label: title },
        ]}
      />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">{title}</h1>
          <p className="admin-page__subtitle">
            {existing
              ? `รหัส ${formatSupplierCode(existing.supplierId)} · ระบบจะบันทึกประวัติการแก้ไขทุกครั้ง`
              : 'ระบบจะออกรหัสผู้จัดจำหน่ายและตั้งสถานะเป็น "ใช้งาน" ให้อัตโนมัติ'}
          </p>
        </div>
      </div>

      <form className="supplier-form" onSubmit={submit} noValidate>
        <section className="admin-card supplier-form__card">
          <h2 className="admin-card__title">ข้อมูลทั่วไป</h2>

          <div className="supplier-form__grid">
            <label className="admin-field supplier-form__wide">
              <span className="admin-field__label">
                {LABELS.companyName} <em>*</em>
              </span>
              <input
                className={'admin-input' + (errors.companyName ? ' admin-input--error' : '')}
                value={values.companyName}
                onChange={(e) => setField('companyName', e.target.value)}
              />
              {errors.companyName && (
                <span className="admin-field__error">{errors.companyName}</span>
              )}
            </label>

            <label className="admin-field">
              <span className="admin-field__label">
                {LABELS.contactName} <em>*</em>
              </span>
              <input
                className={'admin-input' + (errors.contactName ? ' admin-input--error' : '')}
                value={values.contactName}
                onChange={(e) => setField('contactName', e.target.value)}
              />
              {errors.contactName && (
                <span className="admin-field__error">{errors.contactName}</span>
              )}
            </label>

            <label className="admin-field">
              <span className="admin-field__label">
                {LABELS.phone} <em>*</em>
              </span>
              <input
                className={'admin-input' + (errors.phone ? ' admin-input--error' : '')}
                value={values.phone}
                onChange={(e) => setField('phone', e.target.value)}
                placeholder="081-234-5678"
              />
              {errors.phone && <span className="admin-field__error">{errors.phone}</span>}
            </label>

            <label className="admin-field">
              <span className="admin-field__label">
                {LABELS.email} <em>*</em>
              </span>
              <input
                type="email"
                className={'admin-input' + (errors.email ? ' admin-input--error' : '')}
                value={values.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="contact@example.co.th"
              />
              {errors.email && <span className="admin-field__error">{errors.email}</span>}
            </label>

            <label className="admin-field supplier-form__wide">
              <span className="admin-field__label">
                {LABELS.address} <em>*</em>
              </span>
              <textarea
                rows={2}
                className={'admin-input' + (errors.address ? ' admin-input--error' : '')}
                value={values.address}
                onChange={(e) => setField('address', e.target.value)}
              />
              {errors.address && <span className="admin-field__error">{errors.address}</span>}
            </label>

            <label className="admin-field">
              <span className="admin-field__label">{LABELS.tradeTerms}</span>
              <input
                className="admin-input"
                value={values.tradeTerms}
                onChange={(e) => setField('tradeTerms', e.target.value)}
                placeholder="ส่วนลดหน้าปก 30%"
              />
            </label>

            <label className="admin-field">
              <span className="admin-field__label">{LABELS.creditTerms}</span>
              <input
                className="admin-input"
                value={values.creditTerms}
                onChange={(e) => setField('creditTerms', e.target.value)}
                placeholder="เครดิต 30 วัน"
              />
            </label>
          </div>
        </section>

        <section className="admin-card supplier-form__card">
          <div className="supplier-form__books-head">
            <h2 className="admin-card__title">รายการหนังสือที่จำหน่าย</h2>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={availableBooks.length === 0}
              title={
                availableBooks.length === 0
                  ? 'เลือกครบทุกเล่มในแคตตาล็อกแล้ว'
                  : undefined
              }
              onClick={() =>
                setBooks((current) => {
                  const taken = new Set(current.map((row) => row.bookId))
                  const next = catalogue.find((book) => !taken.has(book.bookId))
                  return next ? [...current, emptyBook(next.bookId)] : current
                })
              }
            >
              <Icon name="plus" size={16} />
              เพิ่มรายการ
            </button>
          </div>

          {books.length === 0 ? (
            <p className="admin-field__hint">
              ยังไม่มีรายการหนังสือ กด &quot;เพิ่มรายการ&quot; เพื่อระบุหนังสือที่รับจากผู้จัดจำหน่ายรายนี้
            </p>
          ) : (
            <ul className="supplier-form__books">
              {books.map((row, index) => (
                <li key={row.bookId} className="supplier-form__book">
                  <label className="admin-field">
                    <span className="admin-field__label">หนังสือ</span>
                    <select
                      className="admin-input"
                      value={row.bookId}
                      onChange={(e) =>
                        setBookField(index, 'bookId', Number(e.target.value))
                      }
                    >
                      {catalogue.map((book) => (
                        <option
                          key={book.bookId}
                          value={book.bookId}
                          // กันเลือกเล่มเดียวกันสองแถว — PK ผสม (supplier_id, book_id)
                          disabled={
                            book.bookId !== row.bookId &&
                            books.some((other) => other.bookId === book.bookId)
                          }
                        >
                          {book.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="admin-field">
                    <span className="admin-field__label">รายละเอียดจากแคตตาล็อก</span>
                    <p className="admin-field__hint supplier-form__book-meta">
                      {bookMeta(row.bookId)}
                    </p>
                  </div>
                  <label className="admin-field">
                    <span className="admin-field__label">ราคาส่ง (บาท)</span>
                    <input
                      type="number"
                      min={0}
                      className="admin-input"
                      value={row.supplyPrice}
                      onChange={(e) =>
                        setBookField(index, 'supplyPrice', Number(e.target.value))
                      }
                    />
                  </label>
                  <label className="admin-field">
                    <span className="admin-field__label">ระยะเวลาส่ง (วัน)</span>
                    <input
                      type="number"
                      min={0}
                      className="admin-input"
                      value={row.leadTimeDays}
                      onChange={(e) =>
                        setBookField(index, 'leadTimeDays', Number(e.target.value))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="icon-btn supplier-form__remove"
                    title="ลบรายการนี้"
                    onClick={() => setBooks((current) => current.filter((_, i) => i !== index))}
                  >
                    <Icon name="trash" size={17} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {existing && existing.editHistory.length > 0 && (
          <section className="admin-card supplier-form__card">
            <h2 className="admin-card__title">ประวัติการแก้ไข</h2>
            <ul className="supplier-form__history">
              {[...existing.editHistory].reverse().map((log) => (
                <li key={log.at}>
                  <span className="supplier-form__history-when">
                    {new Date(log.at).toLocaleString('th-TH')}
                  </span>
                  <span>{log.summary}</span>
                  <span className="supplier-form__history-who">โดย {log.by}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="supplier-form__actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => navigate(-1)}
          >
            ยกเลิก
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            บันทึก
          </button>
        </div>
      </form>
    </div>
  )
}
