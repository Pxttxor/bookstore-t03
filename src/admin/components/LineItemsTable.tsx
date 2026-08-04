import Icon from '../../components/Icon'
import { documentTotal, lineTotal } from '../purchasing/purchasing'
import { formatBaht, type SupplierBook } from '../suppliers/suppliers'
import { formatBookCode } from '../inventory/inventory'
import './LineItemsTable.css'

export interface LineRow {
  bookId: number
  quantity: number
  unitPrice: number
}

interface LineItemsTableProps {
  lines: LineRow[]
  /** The chosen supplier's catalogue — supplies both the titles and the ＋เพิ่ม picker. */
  books: SupplierBook[]
  readOnly?: boolean
  onChange?: (lines: LineRow[]) => void
  /** Shown under the table when a price no longer matches the supplier's terms. */
  priceWarning?: string
}

export default function LineItemsTable({
  lines,
  books,
  readOnly,
  onChange,
  priceWarning,
}: LineItemsTableProps) {
  const titleOf = (bookId: number) =>
    books.find((book) => book.bookId === bookId)?.title ?? formatBookCode(bookId)

  const update = (index: number, patch: Partial<LineRow>) =>
    onChange?.(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)))

  const remove = (index: number) => onChange?.(lines.filter((_, i) => i !== index))

  const addable = books.filter((book) => !lines.some((line) => line.bookId === book.bookId))

  const add = (bookId: number) => {
    const book = books.find((entry) => entry.bookId === bookId)
    if (!book) return
    onChange?.([...lines, { bookId, quantity: 1, unitPrice: book.supplyPrice }])
  }

  return (
    <div className="lines">
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>หนังสือ</th>
              <th className="lines__num">จำนวน</th>
              <th className="lines__num">ราคา/หน่วย</th>
              <th className="lines__num">รวม</th>
              {!readOnly && <th aria-label="ลบรายการ" />}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line.bookId}>
                <td className="data-table__strong">
                  <span className="lines__code">{formatBookCode(line.bookId)}</span>
                  {titleOf(line.bookId)}
                </td>
                <td className="lines__num">
                  {readOnly ? (
                    line.quantity
                  ) : (
                    <input
                      type="number"
                      min={1}
                      className="admin-input lines__input"
                      value={line.quantity}
                      onChange={(e) =>
                        update(index, { quantity: Math.max(1, Number(e.target.value) || 0) })
                      }
                    />
                  )}
                </td>
                <td className="lines__num">
                  {readOnly ? (
                    formatBaht(line.unitPrice)
                  ) : (
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="admin-input lines__input"
                      value={line.unitPrice}
                      onChange={(e) =>
                        update(index, { unitPrice: Math.max(0, Number(e.target.value) || 0) })
                      }
                    />
                  )}
                </td>
                <td className="lines__num data-table__strong">{formatBaht(lineTotal(line))}</td>
                {!readOnly && (
                  <td className="lines__num">
                    <button
                      type="button"
                      className="icon-btn"
                      title="ลบรายการ"
                      onClick={() => remove(index)}
                    >
                      <Icon name="trash" size={17} />
                    </button>
                  </td>
                )}
              </tr>
            ))}

            {lines.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 4 : 5} className="lines__blank">
                  ยังไม่มีรายการหนังสือ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <label className="lines__add">
          <Icon name="plus" size={16} />
          <span>เพิ่ม</span>
          <select
            className="admin-input"
            value=""
            disabled={addable.length === 0}
            onChange={(e) => {
              add(Number(e.target.value))
              e.target.value = ''
            }}
          >
            <option value="">
              {addable.length ? 'เลือกหนังสือ' : 'เพิ่มครบทุกเล่มแล้ว'}
            </option>
            {addable.map((book) => (
              <option key={book.bookId} value={book.bookId}>
                {formatBookCode(book.bookId)} · {book.title} · {formatBaht(book.supplyPrice)}
              </option>
            ))}
          </select>
        </label>
      )}

      {priceWarning && (
        <p className="lines__warning">
          <Icon name="alert-triangle" size={16} />
          {priceWarning}
        </p>
      )}

      <p className="lines__total">
        ยอดรวม <strong>฿ {formatBaht(documentTotal(lines))}</strong>
      </p>
    </div>
  )
}
