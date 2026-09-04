import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { apiGet, apiPost } from '../../api/client'
import { useResource } from '../../api/useResource'
import { useAuth } from '../../auth/AuthContext'
import { useOrders } from '../orders/OrderContext'
import type { Bank, Payment, PaymentReport } from './payments'

const loadPayments = () => apiGet<Payment[]>('/api/payments')
const loadBanks = () => apiGet<Bank[]>('/api/banks')
const loadReports = () => apiGet<PaymentReport[]>('/api/payment-reports')

interface PaymentValue {
  payments: Payment[]
  banks: Bank[]
  reports: PaymentReport[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  findPayment: (paymentId: number) => Payment | undefined
  beginVerification: (paymentId: number) => Promise<void>
  verify: (paymentId: number) => Promise<void>
  reject: (paymentId: number, reason: string) => Promise<void>
  generateReport: (periodStart: string, periodEnd: string) => Promise<PaymentReport>
}

const PaymentContext = createContext<PaymentValue | null>(null)

export function PaymentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { reload: reloadOrders } = useOrders()
  const mayViewPayments = user?.role === 'sales' || user?.role === 'manager'
  const mayViewReports = user?.role === 'manager'

  const paymentResource = useResource(loadPayments, mayViewPayments)
  const bankResource = useResource(loadBanks, user !== null)
  const reportResource = useResource(loadReports, mayViewReports)

  const value = useMemo<PaymentValue>(() => {
    const payments = paymentResource.data ?? []

    const reload = async () => {
      const tasks: Promise<void>[] = []
      if (mayViewPayments) tasks.push(paymentResource.reload())
      if (user) tasks.push(bankResource.reload())
      if (mayViewReports) tasks.push(reportResource.reload())
      await Promise.all(tasks)
    }

    const paymentFor = (paymentId: number) => {
      const payment = payments.find((row) => row.paymentId === paymentId)
      if (!payment) throw new Error('ไม่พบรายการชำระเงิน')
      return payment
    }

    const refreshDecision = async () => {
      await Promise.all([paymentResource.reload(), reloadOrders()])
    }

    const verify = async (paymentId: number) => {
      const payment = paymentFor(paymentId)
      await apiPost(`/api/orders/${payment.orderId}/verify-payment`)
      await refreshDecision()
    }

    const beginVerification = async (paymentId: number) => {
      const payment = paymentFor(paymentId)
      if (!payment.slipImageUrl) throw new Error('รายการนี้ยังไม่มีสลิปการชำระเงิน')
      await apiPost(`/api/orders/${payment.orderId}/payment`, {
        slipFileName: payment.slipImageUrl,
        bankId: payment.bankId,
      })
      await refreshDecision()
    }

    const reject = async (paymentId: number, reason: string) => {
      const payment = paymentFor(paymentId)
      await apiPost(`/api/orders/${payment.orderId}/reject-payment`, { note: reason.trim() })
      await refreshDecision()
    }

    const generateReport = async (periodStart: string, periodEnd: string) => {
      const report = await apiPost<PaymentReport>('/api/payment-reports', {
        periodStart,
        periodEnd,
      })
      reportResource.apply((current) => [report, ...current])
      return report
    }

    return {
      payments,
      banks: bankResource.data ?? [],
      reports: reportResource.data ?? [],
      loading:
        (mayViewPayments && paymentResource.loading) ||
        (user !== null && bankResource.loading) ||
        (mayViewReports && reportResource.loading),
      error: paymentResource.error ?? bankResource.error ?? reportResource.error,
      reload,
      findPayment: (paymentId) => payments.find((row) => row.paymentId === paymentId),
      beginVerification,
      verify,
      reject,
      generateReport,
    }
  }, [
    user,
    mayViewPayments,
    mayViewReports,
    paymentResource,
    bankResource,
    reportResource,
    reloadOrders,
  ])

  return <PaymentContext.Provider value={value}>{children}</PaymentContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePayments(): PaymentValue {
  const ctx = useContext(PaymentContext)
  if (!ctx) throw new Error('usePayments must be used within a PaymentProvider')
  return ctx
}
