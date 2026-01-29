# CSV Import Template - Instructions

## CSV Format

The CSV file should have the following columns (in this exact order):

1. **name** - Product name (required)
2. **description** - Product description (optional)
3. **category** - Product category (optional)
4. **price** - Selling price (required, must be positive number)
5. **cost_price** - Cost price (required, must be positive number)
6. **stock_quantity** - Initial stock quantity (optional, defaults to 0)
7. **low_stock_threshold** - Low stock alert threshold (optional, defaults to 10)

## Important Notes

- **SKU is NOT required** - It will be automatically generated in the format: `XXX-0000`
  - XXX = First 3 letters of your store name (uppercase)
  - 0000 = Sequential 4-digit number starting from 0001
  - Example: If your store is "Tech Store", SKUs will be: TEC-0001, TEC-0002, etc.

- **Store ID is automatically assigned** based on your login session

- Header row is required and will be skipped during import

- Values with commas should be enclosed in quotes

- Empty optional fields can be left blank

## Sample CSV Content

```csv
name,description,category,price,cost_price,stock_quantity,low_stock_threshold
Wireless Mouse,Ergonomic wireless mouse with 3 buttons,Electronics,25.99,15.50,50,10
Laptop Stand,Adjustable aluminum laptop stand,Electronics,45.00,28.00,30,5
Office Chair,Ergonomic office chair with lumbar support,Furniture,199.99,120.00,15,3
Desk Lamp,LED desk lamp with adjustable brightness,Electronics,35.50,22.00,40,8
Notebook A4,Spiral bound notebook 200 pages,Stationery,8.99,4.50,100,20
```

## Field Validation

- **name**: Cannot be empty
- **price**: Must be a positive number
- **cost_price**: Must be a positive number
- **stock_quantity**: Must be 0 or positive integer
- **low_stock_threshold**: Must be 0 or positive integer

## Example Use Cases

### Minimal CSV (only required fields)
```csv
name,description,category,price,cost_price,stock_quantity,low_stock_threshold
USB Cable,,,9.99,5.00,,
Phone Case,,,15.99,8.00,70,
```

### With Description and Category
```csv
name,description,category,price,cost_price,stock_quantity,low_stock_threshold
Wireless Mouse,Ergonomic wireless mouse with 3 buttons,Electronics,25.99,15.50,50,10
Coffee Mug,"Ceramic mug, dishwasher safe",Kitchen,12.50,7.00,60,12
```

## After Import

- Each product will receive a unique SKU automatically
- Products will be created in the inventory system
- Initial stock levels will be set based on the CSV data
- Low stock alerts will be configured as specified
