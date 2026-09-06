import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiGetBlob, ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { can } from '../permissions'
import Breadcrumb from '../components/Breadcrumb'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import LoadingState from '../components/LoadingState'
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
import { useInventory } from '../inventory/InventoryContext'
import BookCover from '../../components/BookCover'
import '../components/AdminForm.css'
import './BookFormPage.css'

type Values = Record<BookField, string>

// The form seeds its state from the book being edited, so it has to be remounted when
// the route switches to a different id.
export default function BookFormPage() {
  const { id } = useParams()
  const { loading, error, reload } = useBooks()

  // ต้องกันไว้ที่ตัวห่อ ไม่ใช่ในฟอร์ม — ฟอร์มตั้งค่าเริ่มต้นของช่องกรอกด้วย useState
  // ซึ่งอ่านค่าครั้งเดียวตอน mount · ถ้าปล่อยให้ mount ตั้งแต่ยังโหลดไม่เสร็จ
  // หน้าแก้ไขจะเปิดมาเป็นช่องว่างทั้งใบและไม่เติมค่าให้ทีหลัง
  if (loading) {
    return (
      <div className="admin-page">
        <section className="admin-card">
          <LoadingState label="กำลังโหลดข้อมูลหนังสือ…" />
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

  return <BookForm key={id ?? 'new'} id={id} />
}

function BookForm({ id }: { id?: string }) {
  const { user } = useAuth()
  const { findById, findByIsbn, categories, add, update, uploadCover, deleteCover } = useBooks()
  // เพิ่มหนังสือหนึ่งเล่ม เซิร์ฟเวอร์เปิดแถว inventory_item ยอด 0 ให้ในทรานแซกชันเดียวกัน
  // (composition Book *-- InventoryItem) หน้าจอสต็อกจึงต้องรู้ด้วย ไม่งั้นเล่มใหม่จะหาย
  // จากยอดคงเหลือจนกว่าจะรีเฟรชทั้งหน้า · BookProvider อยู่นอก InventoryProvider
  // จึงเรียกข้ามกันเองไม่ได้ ต้องสั่งจากหน้าจอที่อยู่ในทั้งสองตัว
  const { reload: reloadInventory } = useInventory()
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
  const [saving, setSaving] = useState(false)
  const [coverUrl, setCoverUrl] = useState<string>()
  const [coverFile, setCoverFile] = useState<File>()
  const [coverRemoved, setCoverRemoved] = useState(false)
  const [coverError, setCoverError] = useState<string>()
  const coverInput = useRef<HTMLInputElement>(null)
  const coverObjectUrl = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!existing) return
    let active = true
    let objectUrl: string | undefined
    void apiGetBlob(`/api/books/${existing.bookId}/cover`)
      .then((blob) => {
        if (!active || coverObjectUrl.current) return
        objectUrl = URL.createObjectURL(blob)
        setCoverUrl(objectUrl)
      })
      .catch((err: unknown) => {
        if (active && (!(err instanceof ApiError) || err.status !== 404)) {
          setCoverError(err instanceof Error ? err.message : 'โหลดรูปปกไม่สำเร็จ')
        }
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [existing])

  useEffect(() => {
    return () => {
      if (coverObjectUrl.current) URL.revokeObjectURL(coverObjectUrl.current)
    }
  }, [])

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

  const submit = async (e: FormEvent) => {
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

    setSaving(true)
    try {
      if (existing) {
        // ผู้แก้ไขมาจาก JWT · เซิร์ฟเวอร์เขียน book_change_log ให้เองทีละฟิลด์ที่เปลี่ยนจริง
        await update(existing.bookId, draft)
        if (coverFile) await uploadCover(existing.bookId, coverFile)
        else if (coverRemoved) await deleteCover(existing.bookId)
        notify('success', 'บันทึกเสร็จสิ้น')
        navigate(`/admin/books/${existing.bookId}`)
      } else {
        const created = await add(draft)
        if (coverFile) await uploadCover(created.bookId, coverFile)
        await reloadInventory()
        notify('success', `บันทึกเสร็จสิ้น (รหัส ${formatBookCode(created.bookId)})`)
        navigate(`/admin/books/${created.bookId}`)
      }
    } catch (err) {
      // ข้อความไทยจาก backend เช่น ISBN ซ้ำ (เซิร์ฟเวอร์ตรวจอีกชั้นเสมอ)
      notify('error', err instanceof Error ? err.message : 'บันทึกข้อมูลไม่สำเร็จ')
      setSaving(false)
    }
  }

  const chooseCover = (file: File | undefined) => {
    setCoverError(undefined)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setCoverError('กรุณาเลือกไฟล์รูปภาพ')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setCoverError('รูปปกต้องมีขนาดไม่เกิน 5 MB')
      return
    }
    if (coverObjectUrl.current) URL.revokeObjectURL(coverObjectUrl.current)
    coverObjectUrl.current = URL.createObjectURL(file)
    setCoverUrl(coverObjectUrl.current)
    setCoverFile(file)
    setCoverRemoved(false)
  }

  const removeCover = () => {
    if (coverObjectUrl.current) {
      URL.revokeObjectURL(coverObjectUrl.current)
      coverObjectUrl.current = undefined
    }
    setCoverFile(undefined)
    setCoverUrl(undefined)
    setCoverRemoved(true)
    setCoverError(undefined)
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

        {can.editBooks(user!.role) && (
          <section className="admin-card book-form__card book-cover-editor">
            <div>
              <h2 className="admin-card__title">รูปปกหนังสือ</h2>
              <p className="admin-field__hint">
                ไฟล์รูปภาพต้องมีขนาดไม่เกิน 5 MB
                {!existing && ' · รูปปกจะถูกบันทึกพร้อมหนังสือ'}
              </p>
            </div>
            <div className="book-cover-editor__body">
              <div className="book-cover-editor__preview">
                {coverRemoved ? (
                  <span className="book-cover-editor__empty">รูปปกจะถูกลบเมื่อกดบันทึก</span>
                ) : coverUrl ? (
                  <img src={coverUrl} alt={`ปก ${existing?.title ?? values.title}`} />
                ) : existing ? (
                  <BookCover bookId={existing.bookId} title={existing.title} size="md" />
                ) : (
                  <span className="book-cover-editor__empty">ยังไม่มีรูปปก</span>
                )}
              </div>
              <div className="book-cover-editor__controls">
                <input
                  ref={coverInput}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => chooseCover(event.target.files?.[0])}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => coverInput.current?.click()}
                  disabled={saving}
                >
                  เลือกรูปปก
                </button>
                {(coverFile || (existing && coverUrl) || coverRemoved) ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={removeCover}
                    disabled={saving}
                  >
                    ล้างรูปปก
                  </button>
                ) : null}
                {coverFile && (
                  <span className="book-cover-editor__filename">เลือกแล้ว: {coverFile.name}</span>
                )}
                {coverRemoved && (
                  <span className="book-cover-editor__filename">รูปปกจะถูกลบเมื่อกดบันทึก</span>
                )}
                {coverError && <span className="admin-field__error">{coverError}</span>}
              </div>
            </div>
          </section>
        )}

        <div className="book-form__actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
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
