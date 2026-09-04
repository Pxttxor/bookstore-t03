// Delivery subsystem — the daily parcel summary (DeliverySummary in the class diagram:
// summaryId · summaryDate · totalParcels · totalByCarrier · generate()).
//
// A delivery record is one parcel on one summary day. Records come from two places:
// orders that have actually left the shop (status SHIPPED or DELIVERED, which always
// carry a Shipment), and a seed of earlier parcels whose orders are no longer in the
// demo order list — without them the report would be empty on a fresh browser.

import type { BadgeTone } from '../components/StatusBadge'
import { CARRIERS, formatOrderCode, type CustomerOrder } from '../orders/orders'

/** The carriers of ShippingCompany — the same list the delivery staff picks from. */
export type Carrier = (typeof CARRIERS)[number]

/** A summary only counts parcels that have left the shop. */
export type DeliveryStatus = 'SHIPPED' | 'DELIVERED'

export interface DeliveryRecord {
  id: string
  /** Present only for parcels whose order is still in the system, so the table knows
   *  whether it may link to the order detail screen. */
  orderId?: number
  orderCode: string
  customerName: string
  carrier: Carrier
  trackingNumber: string
  status: DeliveryStatus
  /** DeliverySummary.summaryDate — the day the parcel was handed to the carrier. */
  date: string
  /** Every parcel ships free in this prototype; the column stays so the report can show
   *  it and the total can be checked against the carrier invoice. */
  shippingFee: number
  /** Order.netAmount หน่วยเป็นบาท เท่ากับที่หน้าคำสั่งซื้อแสดง */
  orderValue: number
  shippingAddress: string
  itemCount: number
}

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  SHIPPED: 'จัดส่งแล้ว',
  DELIVERED: 'ส่งถึงแล้ว',
}

export const DELIVERY_STATUS_TONES: Record<DeliveryStatus, BadgeTone> = {
  SHIPPED: 'info',
  DELIVERED: 'success',
}

const isCarrier = (name: string | undefined): name is Carrier =>
  !!name && (CARRIERS as readonly string[]).includes(name)

// Earlier parcels, all on one summary day. Their order codes sit outside the range
// SEED_ORDERS uses, so a seeded row can never contradict a live order.
//
// orderValue เป็นบาท — ชุดนี้ตั้งไว้ตอนที่ทั้งแอปเป็นดอลลาร์ จึงคูณ 27 ตอนที่
// เปลี่ยนมาใช้ formatPrice ของ data/money.ts (อัตราเดียวกับ Atomic Habits $16.20 ↔ ฿438.00)
// ไม่งั้นแถวประวัตจะไปนั่ง ฿70.00 ข้างออเดอร์จริงหลักพันในรายงานเดียวกัน
export const SEED_DELIVERIES: DeliveryRecord[] = [
  {
    id: 'DEL-001',
    orderCode: 'SO-1004',
    customerName: 'ธนากร สุขเกษม',
    carrier: 'Flash Express',
    trackingNumber: 'TH-FL99201483',
    status: 'SHIPPED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 1890.0,
    shippingAddress: '120/15 ถ.พหลโยธิน แขวงลาดยาว เขตจตุจักร กรุงเทพฯ 10900',
    itemCount: 4,
  },
  {
    id: 'DEL-002',
    orderCode: 'SO-1005',
    customerName: 'ปวีณา อุดมศิลป์',
    carrier: 'Kerry Express',
    trackingNumber: 'KEX882910394',
    status: 'SHIPPED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 1296.0,
    shippingAddress: '78 หมู่ 2 ต.เสม็ด อ.เมือง จ.ชลบุรี 20000',
    itemCount: 3,
  },
  {
    id: 'DEL-003',
    orderCode: 'SO-1006',
    customerName: 'อภิสิทธิ์ วงศ์วิจิตร',
    carrier: 'Kerry Express',
    trackingNumber: 'KEX882910395',
    status: 'SHIPPED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 709.83,
    shippingAddress: '333 ถ.มิตรภาพ ต.ในเมือง อ.เมือง จ.ขอนแก่น 40000',
    itemCount: 2,
  },
  {
    id: 'DEL-004',
    orderCode: 'SO-1007',
    customerName: 'นริศรา ประเสริฐ',
    carrier: 'Flash Express',
    trackingNumber: 'TH-FL99201484',
    status: 'DELIVERED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 1118.61,
    shippingAddress: '55/9 ถ.รามคำแหง แขวงหัวหมาก เขตบางกะปิ กรุงเทพฯ 10240',
    itemCount: 2,
  },
  {
    id: 'DEL-005',
    orderCode: 'SO-1008',
    customerName: 'วรพล รัตนศิริ',
    carrier: 'ไปรษณีย์ไทย',
    trackingNumber: 'ED918237466TH',
    status: 'SHIPPED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 432.0,
    shippingAddress: '12 หมู่ 5 ต.ตลาด อ.เมือง จ.สุราษฎร์ธานี 84000',
    itemCount: 1,
  },
  {
    id: 'DEL-006',
    orderCode: 'SO-1009',
    customerName: 'สุภาวดี ทองแท้',
    carrier: 'Kerry Express',
    trackingNumber: 'KEX882910396',
    status: 'DELIVERED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 2468.61,
    shippingAddress: '99/4 ถ.ศรีนครินทร์ ต.บางเมือง อ.เมือง จ.สมุทรปราการ 10270',
    itemCount: 5,
  },
  {
    id: 'DEL-007',
    orderCode: 'SO-1010',
    customerName: 'ชัยวัฒน์ บุญลือ',
    carrier: 'J&T Express',
    trackingNumber: 'JNT928174620',
    status: 'SHIPPED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 609.39,
    shippingAddress: '88 ถ.เพชรเกษม ต.พระปฐมเจดีย์ อ.เมือง จ.นครปฐม 73000',
    itemCount: 1,
  },
  {
    id: 'DEL-008',
    orderCode: 'SO-1011',
    customerName: 'พิมพ์ชนก ชัยชนะ',
    carrier: 'Flash Express',
    trackingNumber: 'TH-FL99201485',
    status: 'SHIPPED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 848.61,
    shippingAddress: '24/1 ถ.แจ้งวัฒนะ ต.ปากเกร็ด อ.ปากเกร็ด จ.นนทบุรี 11120',
    itemCount: 2,
  },
  {
    id: 'DEL-009',
    orderCode: 'SO-1012',
    customerName: 'กิตติศักดิ์ พรหมมา',
    carrier: 'ไปรษณีย์ไทย',
    trackingNumber: 'ED918237467TH',
    status: 'DELIVERED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 1458.0,
    shippingAddress: '150 ถ.รอบเมือง ต.หมากแข้ง อ.เมือง จ.อุดรธานี 41000',
    itemCount: 3,
  },
  {
    id: 'DEL-010',
    orderCode: 'SO-1013',
    customerName: 'ลลิตา ธนภัทร',
    carrier: 'DHL Express',
    trackingNumber: 'DHL-481920381',
    status: 'SHIPPED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 3471.39,
    shippingAddress: '77/1 ถ.สาทรใต้ แขวงทุ่งมหาเมฆ เขตสาทร กรุงเทพฯ 10120',
    itemCount: 6,
  },
  {
    id: 'DEL-011',
    orderCode: 'SO-1014',
    customerName: 'พงศ์พิพัฒน์ ศิริพงษ์',
    carrier: 'Flash Express',
    trackingNumber: 'TH-FL99201486',
    status: 'SHIPPED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 493.83,
    shippingAddress: '14/2 ถ.สุขุมวิท 71 แขวงพระโขนงเหนือ เขตวัฒนา กรุงเทพฯ 10110',
    itemCount: 1,
  },
  {
    id: 'DEL-012',
    orderCode: 'SO-1015',
    customerName: 'ญาดา เลิศล้ำ',
    carrier: 'Kerry Express',
    trackingNumber: 'KEX882910397',
    status: 'SHIPPED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 1041.39,
    shippingAddress: '202 ถ.งามวงศ์วาน ต.บางเขน อ.เมือง จ.นนทบุรี 11000',
    itemCount: 2,
  },
  {
    id: 'DEL-013',
    orderCode: 'SO-1016',
    customerName: 'ศราวุธ วัฒนชัย',
    carrier: 'J&T Express',
    trackingNumber: 'JNT928174621',
    status: 'DELIVERED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 756.0,
    shippingAddress: '56 หมู่ 3 ต.บ้านคลอง อ.เมือง จ.พิษณุโลก 65000',
    itemCount: 2,
  },
  {
    id: 'DEL-014',
    orderCode: 'SO-1017',
    customerName: 'เบญจวรรณ พัฒนศิริ',
    carrier: 'ไปรษณีย์ไทย',
    trackingNumber: 'ED918237468TH',
    status: 'SHIPPED',
    date: '2026-08-29',
    shippingFee: 0,
    orderValue: 1658.61,
    shippingAddress: '89/1 ถ.ศรีจันทร์ ต.ในเมือง อ.เมือง จ.ขอนแก่น 40000',
    itemCount: 3,
  },
]

/** One parcel per order that has left the shop, followed by the seeded history. A seeded
 *  row is dropped as soon as an order with the same code exists for real, so the report
 *  can never disagree with the customer-order screens. */
export function buildDeliveryRecords(orders: CustomerOrder[]): DeliveryRecord[] {
  const live = orders
    .filter((order) => order.status === 'SHIPPED' || order.status === 'DELIVERED')
    .map((order): DeliveryRecord => ({
      id: `LIVE-${order.orderId}`,
      orderId: order.orderId,
      orderCode: formatOrderCode(order.orderId),
      customerName: order.customerName,
      // updateStatus() always writes a shipment on SHIPPED and already defaults the
      // carrier to ไปรษณีย์ไทย, so these fallbacks only cover hand-edited local storage.
      carrier: isCarrier(order.shipment?.carrier) ? order.shipment.carrier : 'ไปรษณีย์ไทย',
      trackingNumber: order.shipment?.trackingNumber ?? `TH-${order.orderId}`,
      status: order.status === 'DELIVERED' ? 'DELIVERED' : 'SHIPPED',
      date: order.shipment?.shippedDate ?? order.orderDate,
      shippingFee: 0,
      orderValue: order.netAmount,
      shippingAddress: order.shippingAddress,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    }))

  const liveCodes = new Set(orders.map((order) => formatOrderCode(order.orderId)))
  const history = SEED_DELIVERIES.filter((record) => !liveCodes.has(record.orderCode))

  return [...live, ...history]
}

/** Summary days that actually have parcels, newest first. */
export const summaryDates = (records: DeliveryRecord[]): string[] =>
  [...new Set(records.map((record) => record.date))].sort((a, b) => b.localeCompare(a))

export interface CarrierTotal {
  carrier: Carrier
  count: number
  totalValue: number
  shippingTotal: number
  /** Share of the day's parcels, to one decimal place. */
  percent: number
}

/** DeliverySummary.totalByCarrier — every carrier is listed, idle ones included, so the
 *  breakdown keeps the same rows from one day to the next. */
export function carrierBreakdown(records: DeliveryRecord[]): CarrierTotal[] {
  return CARRIERS.map((carrier) => {
    const own = records.filter((record) => record.carrier === carrier)
    return {
      carrier,
      count: own.length,
      totalValue: own.reduce((sum, record) => sum + record.orderValue, 0),
      shippingTotal: own.reduce((sum, record) => sum + record.shippingFee, 0),
      percent: records.length === 0 ? 0 : Math.round((own.length / records.length) * 1000) / 10,
    }
  })
}
