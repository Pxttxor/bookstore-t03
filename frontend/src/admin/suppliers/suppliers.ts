// Types follow the Supplier / SupplierBook classes in the analysis class diagram of
// the team project. PurchaseOrder lives in ../purchasing/purchasing.ts — an order is
// owned by the purchasing subsystem, and orders for one supplier are read through
// usePurchasing().ordersForSupplier().

export type SupplierStatus = 'ACTIVE' | 'CANCELLED'

export interface SupplierBook {
  bookId: number
  isbn: string
  title: string
  author: string
  publisher: string
  supplyPrice: number
  leadTimeDays: number
}

export interface EditLog {
  at: string
  by: string
  summary: string
}

export interface Deactivation {
  reason: string
  note: string
  at: string
  by: string
}

export interface Supplier {
  supplierId: number
  companyName: string
  contactName: string
  phone: string
  email: string
  address: string
  tradeTerms: string
  creditTerms: string
  status: SupplierStatus
  books: SupplierBook[]
  editHistory: EditLog[]
  deactivation?: Deactivation
}

export const SUPPLIER_STATUS_LABELS: Record<SupplierStatus, string> = {
  ACTIVE: 'ใช้งาน',
  CANCELLED: 'ยกเลิก',
}

export function formatSupplierCode(supplierId: number) {
  return `SUP${String(supplierId).padStart(2, '0')}`
}

// Inventory and the purchasing documents only carry bookId, so screens that need a
// title or a supply price join back through here.
export interface SupplierBookRef {
  supplier: Supplier
  book: SupplierBook
}

export function findSupplierBook(
  suppliers: Supplier[],
  bookId: number,
): SupplierBookRef | undefined {
  for (const supplier of suppliers) {
    const book = supplier.books.find((entry) => entry.bookId === bookId)
    if (book) return { supplier, book }
  }
  return undefined
}

export function formatBaht(amount: number) {
  return amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const DEACTIVATION_REASONS = [
  'เลิกกิจการ',
  'จัดส่งล่าช้าบ่อยครั้ง',
  'เปลี่ยนไปใช้ผู้จัดจำหน่ายรายอื่น',
  'คุณภาพสินค้าไม่ผ่านเกณฑ์',
]

function book(
  bookId: number,
  isbn: string,
  title: string,
  author: string,
  publisher: string,
  supplyPrice: number,
  leadTimeDays: number,
): SupplierBook {
  return { bookId, isbn, title, author, publisher, supplyPrice, leadTimeDays }
}

export const SEED_SUPPLIERS: Supplier[] = [
  {
    supplierId: 1,
    companyName: 'สำนักพิมพ์ก้าวหน้า',
    contactName: 'สมศักดิ์ ทองดี',
    phone: '081-234-5678',
    email: 'contact@kaonah-press.co.th',
    address: '128/5 ถนนพระราม 4 แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110',
    tradeTerms: 'ส่วนลดหน้าปก 35% สั่งขั้นต่ำ 20 เล่ม',
    creditTerms: 'เครดิต 30 วัน',
    status: 'ACTIVE',
    books: [
      book(101, '978-616-0001-01', 'Atomic Habits', 'James Clear', 'สำนักพิมพ์ก้าวหน้า', 285, 7),
      book(102, '978-616-0001-02', 'The Alchemist', 'Paulo Coelho', 'สำนักพิมพ์ก้าวหน้า', 240, 7),
      book(103, '978-616-0001-03', 'Circe', 'Madeline Miller', 'สำนักพิมพ์ก้าวหน้า', 310, 10),
    ],
    editHistory: [],
  },
  {
    supplierId: 2,
    companyName: 'สำนักพิมพ์ปัญญาชน',
    contactName: 'วราภรณ์ ศรีสุข',
    phone: '082-889-1245',
    email: 'order@panyachon.co.th',
    address: '45 ซอยลาดพร้าว 71 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพฯ 10230',
    tradeTerms: 'ส่วนลดหน้าปก 30%',
    creditTerms: 'เครดิต 45 วัน',
    status: 'ACTIVE',
    books: [
      book(104, '978-616-0002-01', 'Project Hail Mary', 'Andy Weir', 'สำนักพิมพ์ปัญญาชน', 355, 14),
      book(105, '978-616-0002-02', 'Klara and the Sun', 'Kazuo Ishiguro', 'สำนักพิมพ์ปัญญาชน', 320, 14),
    ],
    editHistory: [],
  },
  {
    supplierId: 3,
    companyName: 'บริษัท บุ๊คเน็ต ดิสทริบิวชั่น จำกัด',
    contactName: 'ธนกร ปิยะวัฒน์',
    phone: '02-561-8890',
    email: 'sales@booknet.co.th',
    address: '299 อาคารบุ๊คเน็ต ถนนวิภาวดีรังสิต แขวงจตุจักร เขตจตุจักร กรุงเทพฯ 10900',
    tradeTerms: 'ส่วนลดหน้าปก 40% รับคืนสินค้าค้างสต็อกได้ภายใน 90 วัน',
    creditTerms: 'เครดิต 60 วัน',
    status: 'ACTIVE',
    books: [
      book(106, '978-616-0003-01', 'Dune', 'Frank Herbert', 'บุ๊คเน็ต', 420, 21),
      book(107, '978-616-0003-02', 'A Little Life', 'Hanya Yanagihara', 'บุ๊คเน็ต', 480, 21),
      book(108, '978-616-0003-03', 'Normal People', 'Sally Rooney', 'บุ๊คเน็ต', 265, 18),
      book(109, '978-616-0003-04', 'The Midnight Library', 'Matt Haig', 'บุ๊คเน็ต', 290, 18),
    ],
    editHistory: [],
  },
  {
    supplierId: 4,
    companyName: 'สำนักพิมพ์แสงตะวัน',
    contactName: 'พิมพ์ชนก อารีย์',
    phone: '086-771-0022',
    email: 'info@sangtawan.co.th',
    address: '77/12 ถนนนิมมานเหมินท์ ตำบลสุเทพ อำเภอเมือง เชียงใหม่ 50200',
    tradeTerms: 'ส่วนลดหน้าปก 32%',
    creditTerms: 'เครดิต 30 วัน',
    status: 'ACTIVE',
    books: [
      book(110, '978-616-0004-01', 'The Song of Achilles', 'Madeline Miller', 'แสงตะวัน', 275, 12),
      book(111, '978-616-0004-02', 'Crying in H Mart', 'Michelle Zauner', 'แสงตะวัน', 295, 12),
    ],
    editHistory: [],
  },
  {
    supplierId: 5,
    companyName: 'บริษัท เอเชีย บุ๊คส์ ซัพพลาย จำกัด',
    contactName: 'กิตติพงศ์ เจริญสุข',
    phone: '02-715-9000',
    email: 'purchase@asiabookssupply.com',
    address: '5 อาคารเอเชีย ถนนสุขุมวิท 21 แขวงคลองเตยเหนือ เขตวัฒนา กรุงเทพฯ 10110',
    tradeTerms: 'ส่วนลดหน้าปก 38% สำหรับหนังสือนำเข้า',
    creditTerms: 'เครดิต 45 วัน',
    status: 'ACTIVE',
    books: [
      book(112, '978-616-0005-01', 'Lessons in Chemistry', 'Bonnie Garmus', 'Asia Books', 385, 25),
      book(113, '978-616-0005-02', 'The Seven Husbands of Evelyn Hugo', 'Taylor Jenkins Reid', 'Asia Books', 360, 25),
      book(114, '978-616-0005-03', 'Where the Crawdads Sing', 'Delia Owens', 'Asia Books', 340, 25),
    ],
    editHistory: [],
  },
  {
    supplierId: 6,
    companyName: 'สำนักพิมพ์ใบไม้',
    contactName: 'ชลธิชา แก้วประเสริฐ',
    phone: '089-445-6677',
    email: 'baimai.books@gmail.com',
    address: '19/3 ถนนศรีจันทร์ ตำบลในเมือง อำเภอเมือง ขอนแก่น 40000',
    tradeTerms: 'ส่วนลดหน้าปก 28%',
    creditTerms: 'ชำระเงินสดเมื่อรับสินค้า',
    status: 'ACTIVE',
    books: [book(115, '978-616-0006-01', 'บันทึกใบไม้ผลิ', 'ชลธิชา แก้วประเสริฐ', 'ใบไม้', 180, 5)],
    editHistory: [],
  },
  {
    supplierId: 7,
    companyName: 'บริษัท สยามเปเปอร์แบ็ค จำกัด',
    contactName: 'อนุชา ตั้งใจดี',
    phone: '02-448-1200',
    email: 'contact@siampaperback.co.th',
    address: '212 ถนนจรัญสนิทวงศ์ แขวงบางอ้อ เขตบางพลัด กรุงเทพฯ 10700',
    tradeTerms: 'ส่วนลดหน้าปก 33% ค่าขนส่งฟรีเมื่อสั่งเกิน 50 เล่ม',
    creditTerms: 'เครดิต 30 วัน',
    status: 'ACTIVE',
    books: [
      book(116, '978-616-0007-01', 'เงาในกระจก', 'ปกรณ์ ทองใบ', 'สยามเปเปอร์แบ็ค', 195, 9),
      book(117, '978-616-0007-02', 'ทางกลับบ้าน', 'สุนิสา วงษ์คำ', 'สยามเปเปอร์แบ็ค', 210, 9),
    ],
    editHistory: [],
  },
  {
    supplierId: 8,
    companyName: 'สำนักพิมพ์ดวงดาว',
    contactName: 'ภูริช สมบูรณ์',
    phone: '084-220-3311',
    email: 'duangdao.press@outlook.com',
    address: '88/9 ถนนมิตรภาพ ตำบลในเมือง อำเภอเมือง นครราชสีมา 30000',
    tradeTerms: 'ส่วนลดหน้าปก 30%',
    creditTerms: 'เครดิต 30 วัน',
    status: 'CANCELLED',
    books: [book(118, '978-616-0008-01', 'ดาวเคราะห์สีคราม', 'ภูริช สมบูรณ์', 'ดวงดาว', 220, 15)],
    editHistory: [],
    deactivation: {
      reason: 'เลิกกิจการ',
      note: 'ผู้จัดจำหน่ายแจ้งปิดกิจการตั้งแต่ไตรมาส 2',
      at: '2026-04-18T09:20:00.000Z',
      by: 'ปิยะพร วงศ์ทอง',
    },
  },
  {
    supplierId: 9,
    companyName: 'บริษัท เลิร์นนิ่งฮับ จำกัด',
    contactName: 'ณิชา รัตนพงษ์',
    phone: '02-902-4455',
    email: 'supply@learninghub.co.th',
    address: '1010 ถนนรามคำแหง แขวงหัวหมาก เขตบางกะปิ กรุงเทพฯ 10240',
    tradeTerms: 'ส่วนลดหน้าปก 36% เฉพาะหนังสือวิชาการ',
    creditTerms: 'เครดิต 60 วัน',
    status: 'ACTIVE',
    books: [
      book(119, '978-616-0009-01', 'สถิติสำหรับวิศวกร', 'ดร.วิชัย พงษ์ศิริ', 'เลิร์นนิ่งฮับ', 420, 11),
      book(120, '978-616-0009-02', 'การวิเคราะห์และออกแบบระบบ', 'ดร.อรพิน ชูเกียรติ', 'เลิร์นนิ่งฮับ', 450, 11),
    ],
    editHistory: [],
  },
  {
    supplierId: 10,
    companyName: 'สำนักพิมพ์ริมน้ำ',
    contactName: 'ศิริพร ทวีทรัพย์',
    phone: '087-006-4488',
    email: 'rimnam.books@gmail.com',
    address: '31 ถนนเลียบคลอง ตำบลบางกระสอ อำเภอเมือง นนทบุรี 11000',
    tradeTerms: 'ส่วนลดหน้าปก 27%',
    creditTerms: 'ชำระเงินสดเมื่อรับสินค้า',
    status: 'CANCELLED',
    books: [],
    editHistory: [],
    deactivation: {
      reason: 'จัดส่งล่าช้าบ่อยครั้ง',
      note: 'ล่าช้าเกิน 14 วันติดต่อกัน 3 ครั้ง',
      at: '2026-02-09T04:10:00.000Z',
      by: 'ปิยะพร วงศ์ทอง',
    },
  },
  {
    supplierId: 11,
    companyName: 'บริษัท เพจเทิร์นเนอร์ จำกัด',
    contactName: 'ธีรเดช อินทรสุวรรณ',
    phone: '02-330-7788',
    email: 'hello@pageturner.co.th',
    address: '400 ถนนศรีนครินทร์ แขวงหนองบอน เขตประเวศ กรุงเทพฯ 10250',
    tradeTerms: 'ส่วนลดหน้าปก 34%',
    creditTerms: 'เครดิต 45 วัน',
    status: 'ACTIVE',
    books: [book(121, '978-616-0011-01', 'ห้องสมุดเที่ยงคืน', 'Matt Haig', 'เพจเทิร์นเนอร์', 300, 16)],
    editHistory: [],
  },
  {
    supplierId: 12,
    companyName: 'สำนักพิมพ์ต้นกล้า',
    contactName: 'มณีรัตน์ บุญมี',
    phone: '081-559-2200',
    email: 'tonkla.press@gmail.com',
    address: '66 ถนนช้างคลาน ตำบลช้างคลาน อำเภอเมือง เชียงใหม่ 50100',
    tradeTerms: 'ส่วนลดหน้าปก 29% เน้นหนังสือเด็ก',
    creditTerms: 'เครดิต 30 วัน',
    status: 'ACTIVE',
    books: [
      book(122, '978-616-0012-01', 'นิทานก่อนนอนของหนูดี', 'มณีรัตน์ บุญมี', 'ต้นกล้า', 145, 8),
      book(123, '978-616-0012-02', 'ผจญภัยในป่าใหญ่', 'กานต์ พิมพ์ทอง', 'ต้นกล้า', 160, 8),
    ],
    editHistory: [],
  },
]
