type NumericLike = number | string | null | undefined

export interface StockQuantityShape {
  quantity_purchased?: NumericLike
  quantity_remaining?: NumericLike
}

function toNumber(value: NumericLike): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function getPurchasedQuantity(batch: StockQuantityShape): number {
  return toNumber(batch.quantity_purchased)
}

export function getRemainingQuantity(batch: StockQuantityShape): number {
  return toNumber(batch.quantity_remaining)
}
