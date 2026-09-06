// banks.ts — รายชื่อธนาคารในประเทศไทย รูปแบบเลขบัญชี และระบบจัดรูปแบบอัตโนมัติ (Auto-formatting)

export interface ThaiBank {
  code: string
  name: string
  shortName: string
  digits: number
  placeholder: string
  formatPattern: (raw: string) => string
}

export const THAI_BANKS: ThaiBank[] = [
  {
    code: 'KBANK',
    name: 'ธนาคารกสิกรไทย (Kasikornbank)',
    shortName: 'ธ.กสิกรไทย',
    digits: 10,
    placeholder: '000-0-00000-0',
    formatPattern: (raw: string) => format3_1_5_1(raw),
  },
  {
    code: 'SCB',
    name: 'ธนาคารไทยพาณิชย์ (Siam Commercial Bank)',
    shortName: 'ธ.ไทยพาณิชย์',
    digits: 10,
    placeholder: '000-0-00000-0',
    formatPattern: (raw: string) => format3_1_5_1(raw),
  },
  {
    code: 'BBL',
    name: 'ธนาคารกรุงเทพ (Bangkok Bank)',
    shortName: 'ธ.กรุงเทพ',
    digits: 10,
    placeholder: '000-0-00000-0',
    formatPattern: (raw: string) => format3_1_5_1(raw),
  },
  {
    code: 'KTB',
    name: 'ธนาคารกรุงไทย (Krungthai Bank)',
    shortName: 'ธ.กรุงไทย',
    digits: 10,
    placeholder: '000-0-00000-0',
    formatPattern: (raw: string) => format3_1_5_1(raw),
  },
  {
    code: 'BAY',
    name: 'ธนาคารกรุงศรีอยุธยา (Bank of Ayudhya)',
    shortName: 'ธ.กรุงศรีฯ',
    digits: 10,
    placeholder: '000-0-00000-0',
    formatPattern: (raw: string) => format3_1_5_1(raw),
  },
  {
    code: 'TTB',
    name: 'ธนาคารทหารไทยธนชาต (ttb bank)',
    shortName: 'ทีทีบี (ttb)',
    digits: 10,
    placeholder: '000-0-00000-0',
    formatPattern: (raw: string) => format3_1_5_1(raw),
  },
  {
    code: 'GSB',
    name: 'ธนาคารออมสิน (Government Savings Bank)',
    shortName: 'ธ.ออมสิน',
    digits: 12,
    placeholder: '0000-0000-0000',
    formatPattern: (raw: string) => format4_4_4(raw),
  },
  {
    code: 'BAAC',
    name: 'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร (ธ.ก.ส.)',
    shortName: 'ธ.ก.ส.',
    digits: 12,
    placeholder: '0000-0000-0000',
    formatPattern: (raw: string) => format4_4_4(raw),
  },
  {
    code: 'UOB',
    name: 'ธนาคารยูโอบี (UOB)',
    shortName: 'ธ.ยูโอบี',
    digits: 10,
    placeholder: '000-0-00000-0',
    formatPattern: (raw: string) => format3_1_5_1(raw),
  },
  {
    code: 'KKP',
    name: 'ธนาคารเกียรตินาคินภัทร (Kiatnakin Phatra)',
    shortName: 'ธ.เกียรตินาคินภัทร',
    digits: 10,
    placeholder: '000-0-00000-0',
    formatPattern: (raw: string) => format3_1_5_1(raw),
  },
  {
    code: 'CIMB',
    name: 'ธนาคารซีไอเอ็มบี ไทย (CIMB Thai)',
    shortName: 'ซีไอเอ็มบี ไทย',
    digits: 10,
    placeholder: '000-0-00000-0',
    formatPattern: (raw: string) => format3_1_5_1(raw),
  },
  {
    code: 'TISCO',
    name: 'ธนาคารทิสโก้ (TISCO)',
    shortName: 'ธ.ทิสโก้',
    digits: 10,
    placeholder: '000-0-00000-0',
    formatPattern: (raw: string) => format3_1_5_1(raw),
  },
  {
    code: 'PROMPTPAY',
    name: 'พร้อมเพย์ (PromptPay)',
    shortName: 'พร้อมเพย์',
    digits: 10,
    placeholder: '000-000-0000',
    formatPattern: (raw: string) => formatPromptPay(raw),
  },
]

// รูปแบบ 3-1-5-1 (xxx-x-xxxxx-x)
function format3_1_5_1(raw: string): string {
  const d = raw.slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 4) return `${d.slice(0, 3)}-${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}-${d.slice(3, 4)}-${d.slice(4)}`
  return `${d.slice(0, 3)}-${d.slice(3, 4)}-${d.slice(4, 9)}-${d.slice(9, 10)}`
}

// รูปแบบ 4-4-4 (xxxx-xxxx-xxxx)
function format4_4_4(raw: string): string {
  const d = raw.slice(0, 12)
  if (d.length <= 4) return d
  if (d.length <= 8) return `${d.slice(0, 4)}-${d.slice(4)}`
  return `${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8, 12)}`
}

// พร้อมเพย์: รับเบอร์โทรศัพท์ 10 หลัก จัดรูปแบบ 000-000-0000 (3-3-4)
function formatPromptPay(raw: string): string {
  const d = raw.slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 10)}`
}

export function cleanDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export function findBank(bankIdentifier: string): ThaiBank | undefined {
  if (!bankIdentifier) return undefined
  const cleaned = bankIdentifier.trim().toLowerCase()
  return THAI_BANKS.find(
    (b) =>
      b.code.toLowerCase() === cleaned ||
      b.name.toLowerCase() === cleaned ||
      b.shortName.toLowerCase() === cleaned ||
      b.name.toLowerCase().includes(cleaned) ||
      cleaned.includes(b.code.toLowerCase()),
  )
}

export function formatBankAccount(bankIdentifier: string, rawInput: string): string {
  const digits = cleanDigits(rawInput)
  const bank = findBank(bankIdentifier)
  if (bank) {
    return bank.formatPattern(digits)
  }
  // Default 10 digits pattern: xxx-x-xxxxx-x
  return format3_1_5_1(digits)
}
