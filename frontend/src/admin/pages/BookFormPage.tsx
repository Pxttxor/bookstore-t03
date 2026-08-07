import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { can } from '../permissions'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import { useToast } from '../components/ToastContext'
import { useBooks, type BookDraft } from '../books/BookContext'
import {
  BOOK_FIELD_LABELS,
  BOOK_STATUS_LABELS,
  REQUIRED_BOOK_FIELDS,
  type BookField,
  type BookStatus,
} from '../books/books'
import { formatBookCode } from '../inventory/inventory'
import '../components/AdminForm.css'
import './BookFormPage.css'

type Values = Record<BookField, string>

// The form seeds its state from the book being edited, so it has to be remounted when
// the route switches to a different id.
export default function BookFormPage() {
  const { id } = useParams()
  return <BookForm key={id ?? 'new'} id={id} />
}

function BookForm({ id }: { id?: string }) {
  const { user } = useAuth()
  const { findById, findByIsbn, categories, add, update } = useBooks()
  const { notify } = useToast()
  const navigate = useNavigate()

  const editing = id !== undefined
  const existing = editing ? findById(Number(id)) : undefined

  const [values, setValues] = useState<Values>({
    isbn: existing?.isbn ?? '',
    title: existing?.title ?? '',
    author: existing?.author ?? '',
    publisher: existing?.publisher ?? '',
    price: existing ? String(existing.price) : '',
    description: existing?.description ?? '',
    categoryId: existing ? String(existing.categoryId) : '',
    status: existing?.status ?? 'ACTIVE',
  })
  const [errors, setErrors] = useState<Partial<Record<BookField, string>>>({})

  if (!can.editBooks(user!.role)) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <EmptyState
            icon="lock"
            title="บทบาทของคุณไม่มีสิทธิ์แก้ไขข้อมูลหนังสือ"
            description="การเพิ่มและแก้ไขข้อมูลหนังสือเป็นสิทธิ์ของพนักงานฝ่ายขายเท่านั้น"
            action={{ label: 'กลับไปหน้ารายการ', onClick: () => navigate('/admin/books') }}
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
            { label: 'ข้อมูลหนังสือ', to: '/admin/books' },
            { label: 'ไม่พบข้อมูล' },
          ]}
        />
        <section className="admin-card">
          <EmptyState
            icon="book"
            title="ไม่พบข้อมูลหนังสือ"
            description="ไม่สามารถเปิดฟอร์มแก้ไขได้เพราะไม่พบรหัสที่ระบุ"
            action={{ label: 'กลับไปหน้ารายการ', onClick: () => navigate('/admin/books') }}
          />
        </section>
      </div>
    )
  }

  const setField = (field: BookField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const validate = () => {
    const found: Partial<Record<BookField, string>> = {}
    for (const field of REQUIRED_BOOK_FIELDS) {
      if (!values[field].trim()) found[field] = `กรุณากรอก${BOOK_FIELD_LABELS[field]}`
    }
    const price = Number(values.price)
    if (values.price.trim() && (!Number.isFinite(price) || price < 0)) {
      found.price = 'ราคาปกต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป'
    }
    setErrors(found)
    return Object.keys(found).length === 0
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    // The flow validates completeness first, then the duplicate ISBN.
    if (!validate()) {
      notify('error', 'กรุณากรอกข้อมูลให้ครบ')
      return
    }

    const duplicate = findByIsbn(values.isbn, existing?.bookId)
    if (duplicate) {
      notify('error', `พบ ISBN ซ้ำ — ${duplicate.isbn} เป็นของ ${duplicate.title}`, {
        label: 'ดูรายการเดิม',
        onClick: () => navigate(`/admin/books/${duplicate.bookId}`),
      })
      return
    }

    const draft: BookDraft = {
      isbn: values.isbn.trim(),
      title: values.title.trim(),
      author: values.author.trim(),
      publisher: values.publisher.trim(),
      price: Number(values.price),
      description: values.description.trim(),
      status: values.status as BookStatus,
      categoryId: Number(values.categoryId),
    }

    if (existing) {
      update(existing.bookId, draft, user!.name)
      notify('success', 'บันทึกเสร็จสิ้น')
      navigate(`/admin/books/${existing.bookId}`)
    } else {
      const created = add(draft)
      notify('success', `บันทึกเสร็จสิ้น (รหัส ${formatBookCode(created.bookId)})`)
      navigate(`/admin/books/${created.bookId}`)
    }
  }

  const title = existing ? 'แก้ไขข้อมูลหนังสือ' : 'เพิ่มหนังสือ'

  return (
    <div className="admin-page">
      <Breadcrumb
        items={[
          { label: 'หน้าหลัก', to: '/admin' },
          { label: 'ข้อมูลหนังสือ', to: '/admin/books' },
          ...(existing ? [{ label: existing.title, to: `/admin/books/${existing.bookId}` }] : []),
          { label: title },
        ]}
      />

      <div className="admin-page__head">
        <div>
          <h1 className="admin-page__title">{title}</h1>
          <p className="admin-page__subtitle">
            {existing
              ? `รหัส ${formatBookCode(existing.bookId)} · ระบบจะบันทึกประวัติการแก้ไขทุกช่องที่เปลี่ยนแปลง`
              : 'ระบบจะออกรหัสหนังสือให้อัตโนมัติ · ISBN ต้องไม่ซ้ำกับเล่มที่มีอยู่'}
          </p>
        </div>
      </div>

      <form className="book-form" onSubmit={submit} noValidate>
        <section className="admin-card book-form__card">
          <h2 className="admin-card__title">ข้อมูลหนังสือ</h2>

          <div className="book-form__grid">
            <label className="admin-field">
              <span className="admin-field__label">
                {BOOK_FIELD_LABELS.isbn} <em>*</em>
              </span>
              <input
                className={'admin-input' + (errors.isbn ? ' admin-input--error' : '')}
                value={values.isbn}
                onChange={(e) => setField('isbn', e.target.value)}
                placeholder="978-616-0000-00"
              />
              {errors.isbn && <span className="admin-field__error">{errors.isbn}</span>}
            </label>

            <label className="admin-field">
              <span className="admin-field__label">
                {BOOK_FIELD_LABELS.categoryId} <em>*</em>
              </span>
              <select
                className={'admin-input' + (errors.categoryId ? ' admin-input--error' : '')}
                value={values.categoryId}
                onChange={(e) => setField('categoryId', e.target.value)}
              >
                <option value="">เลือกหมวดหมู่</option>
                {categories.map((entry) => (
                  <option key={entry.categoryId} value={entry.categoryId}>
                    {entry.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && (
                <span className="admin-field__error">{errors.categoryId}</span>
              )}
            </label>

            <label className="admin-field book-form__wide">
              <span className="admin-field__label">
                {BOOK_FIELD_LABELS.title} <em>*</em>
              </span>
              <input
                className={'admin-input' + (errors.title ? ' admin-input--error' : '')}
                value={values.title}
                onChange={(e) => setField('title', e.target.value)}
              />
              {errors.title && <span className="admin-field__error">{errors.title}</span>}
            </label>

            <label className="admin-field">
              <span className="admin-field__label">
                {BOOK_FIELD_LABELS.author} <em>*</em>
              </span>
              <input
                className={'admin-input' + (errors.author ? ' admin-input--error' : '')}
                value={values.author}
                onChange={(e) => setField('author', e.target.value)}
              />
              {errors.author && <span className="admin-field__error">{errors.author}</span>}
            </label>

            <label className="admin-field">
              <span className="admin-field__label">
                {BOOK_FIELD_LABELS.publisher} <em>*</em>
              </span>
              <input
                className={'admin-input' + (errors.publisher ? ' admin-input--error' : '')}
                value={values.publisher}
                onChange={(e) => setField('publisher', e.target.value)}
              />
              {errors.publisher && <span className="admin-field__error">{errors.publisher}</span>}
            </label>

            <label className="admin-field">
              <span className="admin-field__label">
                {BOOK_FIELD_LABELS.price} (บาท) <em>*</em>
              </span>
              <input
                type="number"
                min={0}
                className={'admin-input' + (errors.price ? ' admin-input--error' : '')}
                value={values.price}
                onChange={(e) => setField('price', e.target.value)}
              />
              {errors.price && <span className="admin-field__error">{errors.price}</span>}
            </label>

            <label className="admin-field">
              <span className="admin-field__label">{BOOK_FIELD_LABELS.status}</span>
              <select
                className="admin-input"
                value={values.status}
                onChange={(e) => setField('status', e.target.value)}
              >
                <option value="ACTIVE">{BOOK_STATUS_LABELS.ACTIVE}</option>
                <option value="INACTIVE">{BOOK_STATUS_LABELS.INACTIVE}</option>
              </select>
              <span className="admin-field__hint">
                หนังสือที่ปิดการขายจะยังอยู่ในคลังแต่ไม่ถูกเสนอขาย
              </span>
            </label>

            <label className="admin-field book-form__wide">
              <span className="admin-field__label">{BOOK_FIELD_LABELS.description}</span>
              <textarea
                rows={3}
                className="admin-input"
                value={values.description}
                onChange={(e) => setField('description', e.target.value)}
              />
            </label>
          </div>
        </section>

        <div className="book-form__actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
            ยกเลิก
          </button>
          <button type="submit" className="btn btn-primary btn-sm">
            บันทึก
          </button>
        </div>
      </form>
    </div>
  )
}
