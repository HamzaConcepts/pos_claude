export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <p className="text-text-secondary">Welcome to the POS System</p>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded border-2 border-black">
          <h3 className="text-sm text-text-secondary mb-2">Today's Sales</h3>
          <p className="text-2xl font-bold">$0.00</p>
        </div>
        <div className="bg-white p-6 rounded border-2 border-black">
          <h3 className="text-sm text-text-secondary mb-2">Monthly Sales</h3>
          <p className="text-2xl font-bold">$0.00</p>
        </div>
        <div className="bg-white p-6 rounded border-2 border-black">
          <h3 className="text-sm text-text-secondary mb-2">Monthly Expenses</h3>
          <p className="text-2xl font-bold">$0.00</p>
        </div>
        <div className="bg-white p-6 rounded border-2 border-black">
          <h3 className="text-sm text-text-secondary mb-2">Net Profit</h3>
          <p className="text-2xl font-bold">$0.00</p>
        </div>
      </div>
    </div>
  )
}
