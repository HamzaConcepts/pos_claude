import { DollarSign, TrendingDown, TrendingUp, Package, Wallet } from 'lucide-react'
import { StatCard } from './StatCard'

interface SummaryReportProps {
  reportData: any
  formatCurrency: (value: number) => string
}

export function SummaryReport({ reportData, formatCurrency }: SummaryReportProps) {
  if (!reportData) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <StatCard
        title="Total Revenue"
        value={formatCurrency(reportData.sales?.totalRevenue ?? 0)}
        icon={<DollarSign />}
        trend={reportData.sales?.totalSales ?? 0}
        trendLabel="sales"
      />
      <StatCard
        title="Total Expenses"
        value={formatCurrency(reportData.expenses?.totalAmount ?? 0)}
        icon={<TrendingDown />}
        trend={reportData.expenses?.totalExpenses ?? 0}
        trendLabel="expenses"
      />
      <StatCard
        title="Net Profit"
        value={formatCurrency(reportData.profit?.netProfit ?? 0)}
        icon={<TrendingUp />}
        trend={reportData.profit?.profitMargin ?? 0}
        trendLabel="% margin"
        isProfit
      />
      <StatCard
        title="Cash Present"
        value={formatCurrency(reportData.cashPresent ?? 0)}
        icon={<Wallet />}
        trend={reportData.sales?.totalCash ?? 0}
        trendLabel="cash in"
      />
      <StatCard
        title="Stock Value"
        value={formatCurrency(reportData.inventory?.totalStockValue ?? 0)}
        icon={<Package />}
        trend={reportData.inventory?.totalRemaining ?? 0}
        trendLabel="items"
      />
    </div>
  )
}
