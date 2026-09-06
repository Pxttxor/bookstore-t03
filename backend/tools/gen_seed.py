# gen_seed.py — อ่านข้อมูลตั้งต้นจาก TypeScript ของ frontend แล้วสร้าง seed_data.go
#
#   python tools/gen_seed.py     (รันจากโฟลเดอร์ backend/)
#
# ทำเป็นสคริปต์แทนการพิมพ์มือ เพราะข้อความไทย (ที่อยู่/เงื่อนไขการค้า/ชื่อหนังสือ) ยาวและพิมพ์ผิดง่าย
# รันซ้ำได้เมื่อ SEED_* ฝั่ง frontend เปลี่ยน
import io, json, os, re, subprocess

# หา repo จากตำแหน่งของสคริปต์เอง (tools/ อยู่ใต้ backend/) ไม่ผูกกับ path ของเครื่องใดเครื่องหนึ่ง
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FE = os.path.join(REPO, "frontend", "src", "admin")
OUT = os.path.join(REPO, "backend", "internal", "database", "seed_data.go")

STR = r"'((?:[^'\\]|\\.)*)'"          # สตริงเดี่ยวของ TS รองรับ \' ข้างใน
NUM = r"([\d.]+)"

def read(path):
    return io.open(path, encoding="utf-8").read()

def unq(s):
    return s.replace("\\'", "'")

books_ts = read(os.path.join(FE, "books", "books.ts"))
sup_ts = read(os.path.join(FE, "suppliers", "suppliers.ts"))
inv_ts = read(os.path.join(FE, "inventory", "inventory.ts"))
pur_ts = read(os.path.join(FE, "purchasing", "purchasing.ts"))
promo_ts = read(os.path.join(FE, "promotions", "promotions.ts"))

# ── หมวดหมู่ ─────────────────────────────────────────────────────────────
cat_re = re.compile(r"\{ categoryId: (\d+), name: " + STR + r", description: " + STR + r" \}")
categories = [(int(m[0]), unq(m[1]), unq(m[2]))
              for m in cat_re.findall(books_ts[books_ts.index("SEED_CATEGORIES"):])]
assert len(categories) == 6, len(categories)

# ── หนังสือ ─────────────────────────────────────────────────────────────
seed = books_ts[books_ts.index("SEED_BOOKS"):]


def calls(source, name):
    """ตัด `name(...)` ออกมาทีละก้อนโดยนับวงเล็บ

    regex เดียวจับ argument ท้าย ๆ ที่เป็นค่าไม่บังคับ (status, changeLogs) ไม่ไหว
    เพราะบางเล่มมีคอมเมนต์คั่นและบางเล่มไม่มี argument นั้นเลย
    """
    out, i, opener = [], 0, name + "("
    while True:
        j = source.find(opener, i)
        if j < 0:
            return out
        if j > 0 and (source[j - 1].isalnum() or source[j - 1] in "_."):
            i = j + len(opener)
            continue
        depth, k, in_str, esc = 0, j + len(name), False, False
        while k < len(source):
            ch = source[k]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == "'":
                    in_str = False
            elif ch == "'":
                in_str = True
            elif ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
                if depth == 0:
                    out.append(source[j:k + 1])
                    break
            k += 1
        i = k + 1


book_re = re.compile(r"book\(\s*(\d+),\s*" + STR + r",\s*" + STR + r",\s*" + STR +
                     r",\s*" + STR + r",\s*" + NUM + r",\s*(\d+),\s*" + STR)
# `bookId` ไม่บังคับ: BookChangeLog ฝั่ง TS ประกาศไว้ให้หน้าประวัติรวมใช้ แต่ที่นี่ไม่ต้องอ่าน
# เพราะเลขเล่มมาจาก `book(...)` ที่ครอบอยู่แล้ว · ต้องเป็น (?:...) ไม่ใช่ (...) ไม่งั้นเลขกลุ่ม
# 1–6 ที่บรรทัดอ่านค่าใช้แบบตำแหน่งจะเลื่อนทั้งแถว
log_re = re.compile(r"logId: (\d+),\s*(?:bookId: \d+,\s*)?changedField: " + STR +
                    r",\s*oldValue: " + STR +
                    r",\s*newValue: " + STR + r",\s*changedDate: " + STR +
                    r",\s*changedBy: " + STR)

books = []
for block in calls(seed, "book"):
    m = book_re.match(block)
    if not m:
        continue
    rest = block[m.end():]
    status = re.search(r"'(ACTIVE|INACTIVE)'", rest)
    books.append(dict(
        id=int(m.group(1)), isbn=unq(m.group(2)), title=unq(m.group(3)),
        author=unq(m.group(4)), publisher=unq(m.group(5)), price=float(m.group(6)),
        category=int(m.group(7)), description=unq(m.group(8)),
        status=status.group(1) if status else "ACTIVE",
        logs=[(int(x[0]), unq(x[1]), unq(x[2]), unq(x[3]), unq(x[4]), unq(x[5]))
              for x in log_re.findall(rest)]))
assert len(books) == 23, len(books)
# เล่ม 118 ปิดการขายอยู่ฝั่งหน้าจอ — ก่อนหน้านี้สคริปต์ไม่ได้อ่าน status เลยจึงเขียน ACTIVE ให้ทุกเล่ม
assert [b["id"] for b in books if b["status"] == "INACTIVE"] == [118], \
    [b["id"] for b in books if b["status"] == "INACTIVE"]
assert sum(len(b["logs"]) for b in books) == 1, "คาดว่ามีประวัติการแก้ไขตั้งต้น 1 แถว"

# ── ผู้จัดจำหน่าย ────────────────────────────────────────────────────────
sseed = sup_ts[sup_ts.index("SEED_SUPPLIERS"):]
offer_re = re.compile(r"book\(\s*(\d+),\s*" + STR + r",\s*" + STR + r",\s*" + STR +
                      r",\s*" + STR + r",\s*" + NUM + r",\s*(\d+)\)")
suppliers = []
for block in re.split(r"\n  \{\n", sseed)[1:]:
    def field(key):
        m = re.search(r"\n    " + key + r": " + STR, block)
        return unq(m.group(1)) if m else ""
    deact = None
    d = re.search(r"deactivation: \{(.*?)\n    \}", block, re.S)
    if d:
        t = d.group(1)
        deact = {k: unq(re.search(k + r": " + STR, t).group(1))
                 for k in ("reason", "note", "at", "by")}
    suppliers.append(dict(
        id=int(re.search(r"supplierId: (\d+)", block).group(1)),
        company=field("companyName"), contact=field("contactName"),
        phone=field("phone"), email=field("email"), address=field("address"),
        trade=field("tradeTerms"), credit=field("creditTerms"),
        status=re.search(r"status: '(\w+)'", block).group(1),
        offers=[(int(o[0]), float(o[5]), int(o[6])) for o in offer_re.findall(block)],
        deact=deact))
assert len(suppliers) == 12, len(suppliers)

# ── สินค้าคงคลัง ─────────────────────────────────────────────────────────
inventory = re.findall(r"item\((\d+), (\d+), (\d+), (\d+|undefined)\)", inv_ts)
assert len(inventory) == 23, len(inventory)
# หมายเหตุ: ไม่อ่าน SEED_STOCK_TRANSACTIONS จาก frontend อีกแล้ว
# ฝั่ง frontend ถูกลบจนเหลือ [] การสร้างต่อจึงเท่ากับลบข้อมูลแปดแถวทิ้งเงียบ ๆ
# ข้อมูลย้ายไปอยู่ที่ internal/database/seed_inventory.go ซึ่งเขียนด้วยมือ

# ── เอกสารจัดซื้อ ────────────────────────────────────────────────────────
def obj_blocks(source, marker):
    body = source[source.index(marker):]
    # ข้าม "[]" ที่เป็นชนิดของตัวแปร (เช่น PurchaseOrder[]) ไปหา "= [" ที่เป็นค่าจริง
    body = body[body.index("= [") + 2:]
    depth, start, out = 0, None, []
    for i, ch in enumerate(body):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                out.append(body[start:i + 1])
        elif ch == "]" and depth == 0:
            break
    return out

def items_of(block, fn):
    return re.findall(fn, block)

# ── โปรโมชั่น ────────────────────────────────────────────────────────────
promotions = []
for b in obj_blocks(promo_ts, "SEED_PROMOTIONS"):
    promotions.append(dict(
        id=int(re.search(r"promotionId: (\d+)", b).group(1)),
        name=unq(re.search(r"name: " + STR, b).group(1)),
        type=re.search(r"type: '(\w+)'", b).group(1),
        detail=unq(re.search(r"conditionDetail: " + STR, b).group(1)),
        value=float(re.search(r"discountValue: " + NUM, b).group(1)),
        percent=re.search(r"isPercent: (true|false)", b).group(1) == "true",
        minQty=int(re.search(r"minQty: (\d+)", b).group(1)),
        minAmount=float(re.search(r"minAmount: " + NUM, b).group(1)),
        start=re.search(r"startDate: " + STR, b).group(1),
        end=re.search(r"endDate: " + STR, b).group(1),
        status=re.search(r"status: '(\w+)'", b).group(1)))
assert len(promotions) >= 4, len(promotions)

# ── เอกสารจัดซื้อ (ต่อ) ──────────────────────────────────────────────────
requisitions = []
for b in obj_blocks(pur_ts, "SEED_REQUISITIONS"):
    requisitions.append(dict(
        prId=int(re.search(r"prId: (\d+)", b).group(1)),
        supplierId=int(re.search(r"supplierId: (\d+)", b).group(1)),
        createdDate=re.search(r"createdDate: " + STR, b).group(1),
        status=re.search(r"status: '(\w+)'", b).group(1),
        items=[(int(x[0]), int(x[1]), float(x[2]))
               for x in items_of(b, r"prItem\((\d+), (\d+), ([\d.]+)\)")]))

orders = []
for b in obj_blocks(pur_ts, "SEED_PURCHASE_ORDERS"):
    pr = re.search(r"prId: (\d+)", b)
    sent = re.search(r"sentAt: " + STR, b)
    conf = re.search(r"confirmedAt: " + STR, b)
    orders.append(dict(
        poId=int(re.search(r"poId: (\d+)", b).group(1)),
        prId=int(pr.group(1)) if pr else None,
        supplierId=int(re.search(r"supplierId: (\d+)", b).group(1)),
        orderDate=re.search(r"orderDate: " + STR, b).group(1),
        expected=re.search(r"expectedDeliveryDate: " + STR, b).group(1),
        status=re.search(r"status: '(\w+)'", b).group(1),
        sentAt=sent.group(1) if sent else None,
        confirmedAt=conf.group(1) if conf else None,
        items=[(int(x[0]), int(x[1]), float(x[2]), int(x[3]) if x[3] else 0)
               for x in items_of(b, r"poItem\((\d+), (\d+), ([\d.]+)(?:, (\d+))?\)")]))

receipts = []
for b in obj_blocks(pur_ts, "SEED_GOODS_RECEIPTS"):
    lines = re.findall(
        r"bookId: (\d+),\s*orderedQty: (\d+),\s*receivedQty: (\d+),\s*condition: '(\w+)',\s*note: " + STR,
        b, re.S)
    receipts.append(dict(
        grId=int(re.search(r"grId: (\d+)", b).group(1)),
        poId=int(re.search(r"poId: (\d+)", b).group(1)),
        receivedDate=re.search(r"receivedDate: " + STR, b).group(1),
        status=re.search(r"status: '(\w+)'", b).group(1),
        deliveryNoteNo=re.search(r"deliveryNoteNo: " + STR, b).group(1),
        items=[(int(x[0]), int(x[1]), int(x[2]), x[3], unq(x[4])) for x in lines]))

# ── สร้างไฟล์ Go ─────────────────────────────────────────────────────────
def q(s):
    """สตริง Go แบบมี escape ครบ (ใช้กฎเดียวกับ JSON ซึ่ง Go อ่านได้ตรง)"""
    return json.dumps(s, ensure_ascii=False)

L = []
w = L.append
w("// Code generated by tools/gen_seed.py — ห้ามแก้ด้วยมือ")
w("//")
w("// ข้อมูลตั้งต้นคัดมาจาก SEED_* ของ frontend ตรง ๆ (suppliers.ts, books.ts, inventory.ts,")
w("// purchasing.ts) เพื่อให้ backend กับหน้าจอเห็นข้อมูลชุดเดียวกันตอนต่อ API")
w("")
w("package database")
w("")
w('import "bookstore-t03/internal/model"')
w("")

w("// seedCategories — หมวดหมู่หนังสือ · ต้องใส่ก่อน seedBooks เพราะ book.category_id อ้างถึง")
w("var seedCategories = []model.Category{")
for c in categories:
    w("\t{CategoryID: %d, Name: %s, Description: %s}," % (c[0], q(c[1]), q(c[2])))
w("}")
w("")

w("// seedBooks — หนังสือ 23 เล่ม รหัส 101–123")
w("var seedBooks = []model.Book{")
for b in books:
    w("\t{BookID: %d, ISBN: %s, Title: %s, Author: %s, Publisher: %s, Price: %s, Description: %s, CategoryID: %d, Status: model.BookStatus%s},"
      % (b["id"], q(b["isbn"]), q(b["title"]), q(b["author"]), q(b["publisher"]),
         repr(b["price"]), q(b["description"]), b["category"],
         "Active" if b["status"] == "ACTIVE" else "Inactive"))
w("}")
w("")

w("// seedPromotions — โปรโมชั่นตั้งต้น · EXPIRED คำนวณจากวันสิ้นสุด ไม่ได้เก็บในคอลัมน์ status")
w("var seedPromotions = []model.Promotion{")
for p in promotions:
    w("\t{PromotionID: %d, Name: %s, Type: model.PromotionType(%s), ConditionDetail: %s,"
      % (p["id"], q(p["name"]), q(p["type"]), q(p["detail"])))
    w("\t\tDiscountValue: %s, IsPercent: %s, MinQty: %d, MinAmount: %s,"
      % (repr(p["value"]), "true" if p["percent"] else "false", p["minQty"], repr(p["minAmount"])))
    w("\t\tStartDate: mustDate(%s), EndDate: mustDate(%s), Status: model.PromotionStatus(%s)},"
      % (q(p["start"]), q(p["end"]), q(p["status"])))
w("}")
w("")

w("// seedBookChangeLogs — ประวัติการแก้ไขตั้งต้น ให้แท็บประวัติมีข้อมูลให้ดูตั้งแต่เปิดครั้งแรก")
w("var seedBookChangeLogs = []model.BookChangeLog{")
for b in books:
    for lg in b["logs"]:
        w("\t{LogID: %d, BookID: %d, ChangedField: %s, OldValue: %s, NewValue: %s, ChangedDate: mustTime(%s), ChangedBy: %s},"
          % (lg[0], b["id"], q(lg[1]), q(lg[2]), q(lg[3]), q(lg[4]), q(lg[5])))
w("}")
w("")

w("// seedSupplierOffer — หนังสือหนึ่งเล่มที่ผู้จัดจำหน่ายรายหนึ่งเสนอขาย")
w("type seedSupplierOffer struct {")
w("\tBookID       int")
w("\tSupplyPrice  float64")
w("\tLeadTimeDays int")
w("}")
w("")
w("// seedSupplierRow — ผู้จัดจำหน่ายหนึ่งรายพร้อมรายการหนังสือและข้อมูลการปิดใช้งาน")
w("type seedSupplierRow struct {")
w("\tSupplier     model.Supplier")
w("\tOffers       []seedSupplierOffer")
w("\tDeactivation *model.SupplierDeactivation")
w("}")
w("")
w("// seedSuppliers — ผู้จัดจำหน่าย 12 ราย (รหัส 8 และ 10 ถูกปิดใช้งานพร้อมเหตุผล)")
w("var seedSuppliers = []seedSupplierRow{")
for s in suppliers:
    status = "model.SupplierStatusActive" if s["status"] == "ACTIVE" else "model.SupplierStatusCancelled"
    w("\t{")
    w("\t\tSupplier: model.Supplier{")
    w("\t\t\tSupplierID: %d, CompanyName: %s," % (s["id"], q(s["company"])))
    w("\t\t\tContactName: %s, Phone: %s, Email: %s," % (q(s["contact"]), q(s["phone"]), q(s["email"])))
    w("\t\t\tAddress: %s," % q(s["address"]))
    w("\t\t\tTradeTerms: %s, CreditTerms: %s," % (q(s["trade"]), q(s["credit"])))
    w("\t\t\tStatus: %s," % status)
    w("\t\t},")
    if s["offers"]:
        w("\t\tOffers: []seedSupplierOffer{")
        for o in s["offers"]:
            w("\t\t\t{BookID: %d, SupplyPrice: %s, LeadTimeDays: %d}," % (o[0], repr(o[1]), o[2]))
        w("\t\t},")
    if s["deact"]:
        d = s["deact"]
        w("\t\tDeactivation: &model.SupplierDeactivation{")
        w("\t\t\tSupplierID: %d, Reason: %s, Note: %s," % (s["id"], q(d["reason"]), q(d["note"])))
        w("\t\t\tAt: mustTime(%s), By: %s," % (q(d["at"]), q(d["by"])))
        w("\t\t},")
    w("\t},")
w("}")
w("")

w("// seedInventoryRow — ยอดคงเหลือตั้งต้น (reorderPoint เป็น nil = ยังไม่ตั้งจุดสั่งซื้อ)")
w("type seedInventoryRow struct {")
w("\tInventoryID    int")
w("\tBookID         int")
w("\tQuantityOnHand int")
w("\tReorderPoint   *int")
w("}")
w("")
w("var seedInventory = []seedInventoryRow{")
for inv in inventory:
    rp = "nil" if inv[3] == "undefined" else "intPtr(%s)" % inv[3]
    w("\t{InventoryID: %s, BookID: %s, QuantityOnHand: %s, ReorderPoint: %s},"
      % (inv[0], inv[1], inv[2], rp))
w("}")
w("")

w("// seedRequisitions — ใบขอสั่งซื้อ 3 ใบ สถานะรออนุมัติ เพื่อให้หน้าอนุมัติมีของตั้งแต่เข้าระบบครั้งแรก")
w("var seedRequisitions = []model.PurchaseRequisition{")
for r in requisitions:
    w("\t{")
    w("\t\tPRID: %d, SupplierID: %d, CreatedDate: mustDate(%s)," % (r["prId"], r["supplierId"], q(r["createdDate"])))
    w("\t\tStatus: model.PRStatus(%s), RequestedBy: seedWarehouseName, RequestedByID: seedWarehouseID," % q(r["status"]))
    w("\t\tItems: []model.PurchaseRequisitionItem{")
    for it in r["items"]:
        w("\t\t\t{PRID: %d, BookID: %d, Quantity: %d, UnitPrice: %s}," % (r["prId"], it[0], it[1], repr(it[2])))
    w("\t\t},")
    w("\t},")
w("}")
w("")

w("// seedOrders — ใบสั่งซื้อ 10 ใบ ครอบคลุมทุกสถานะที่หน้าจอต้องแสดง")
w("var seedOrders = []model.PurchaseOrder{")
for o in orders:
    w("\t{")
    w("\t\tPOID: %d, SupplierID: %d," % (o["poId"], o["supplierId"]))
    if o["prId"] is not None:
        w("\t\tPRID: intPtr(%d)," % o["prId"])
    w("\t\tOrderDate: mustDate(%s), ExpectedDeliveryDate: mustDate(%s)," % (q(o["orderDate"]), q(o["expected"])))
    w("\t\tStatus: model.POStatus(%s)," % q(o["status"]))
    if o["sentAt"]:
        w("\t\tSentAt: timePtr(mustTime(%s))," % q(o["sentAt"]))
    if o["confirmedAt"]:
        w("\t\tConfirmedAt: timePtr(mustTime(%s))," % q(o["confirmedAt"]))
    w("\t\tItems: []model.PurchaseOrderItem{")
    for it in o["items"]:
        w("\t\t\t{POID: %d, BookID: %d, Quantity: %d, UnitPrice: %s, ReceivedQty: %d},"
          % (o["poId"], it[0], it[1], repr(it[2]), it[3]))
    w("\t\t},")
    w("\t},")
w("}")
w("")

w("// seedReceipts — ใบรับสินค้าที่ทำให้ PO-2429 อยู่สถานะรับบางส่วน")
w("var seedReceipts = []model.GoodsReceipt{")
for g in receipts:
    w("\t{")
    w("\t\tGRID: %d, POID: %d, ReceivedDate: mustDate(%s)," % (g["grId"], g["poId"], q(g["receivedDate"])))
    w("\t\tStatus: model.GRStatus(%s), DeliveryNoteNo: %s, ReceivedBy: seedWarehouseName,"
      % (q(g["status"]), q(g["deliveryNoteNo"])))
    w("\t\tItems: []model.GoodsReceiptItem{")
    for it in g["items"]:
        w("\t\t\t{GRID: %d, BookID: %d, OrderedQty: %d, ReceivedQty: %d, Condition: model.ItemCondition(%s), Note: %s},"
          % (g["grId"], it[0], it[1], it[2], q(it[3]), q(it[4])))
    w("\t\t},")
    w("\t},")
w("}")
w("")

# seedStockTransactions ย้ายไปอยู่ใน seed_inventory.go ที่เขียนด้วยมือแล้ว
# ถ้าหลุดกลับมาที่นี่ จะประกาศตัวแปรซ้ำ (คอมไพล์ไม่ผ่าน) หรือทับข้อมูลแปดแถวนั้นทิ้ง
assert "seedStockTransactions" not in "\n".join(L), \
    "seedStockTransactions ต้องไม่ถูกสร้างจากสคริปต์นี้ — ดู internal/database/seed_inventory.go"

io.open(OUT, "w", encoding="utf-8", newline="\n").write("\n".join(L) + "\n")
subprocess.run(["gofmt", "-w", OUT], check=True)  # ให้ผ่าน `gofmt -l .` ตั้งแต่สร้างเสร็จ
print("wrote", OUT)
print("categories=%d books=%d changeLogs=%d promotions=%d suppliers=%d inventory=%d PR=%d PO=%d GR=%d"
      % (len(categories), len(books), sum(len(b["logs"]) for b in books), len(promotions),
         len(suppliers), len(inventory), len(requisitions), len(orders), len(receipts)))
print("offers/supplier:", [len(s["offers"]) for s in suppliers])
print("deactivated:", [s["id"] for s in suppliers if s["deact"]])
print("PO items:", [len(o["items"]) for o in orders])
