# Feature Specification: Product Label Printing

## 1. Overview
This feature enables users to print barcode labels for products directly from the Inventory page. Labels can include a custom title, optional price, and a barcode. For mobile phones, labels are generated per unit using each device’s IMEI. For all other products, labels are generated using the product’s assigned barcode/SKU.

The feature is designed to be simple, flexible, and compatible with common thermal label printers, while also being testable without specialized hardware.

---

## 2. Goals
- Allow users to print product labels directly from the Inventory page.
- Support printing multiple copies of labels based on stock quantity or user input.
- Support per-unit label printing for IMEI-based products (e.g., mobile phones).
- Allow basic customization of label content (title, price visibility).
- Ensure predictable and consistent barcode generation.

---

## 3. Non-Goals
- Advanced label design or drag-and-drop editors.
- Printer driver management or hardware configuration.
- Multi-language label layouts (can be added later).
- Inventory stock mutation (printing labels does not change stock).

---

## 4. User Roles & Permissions
- **Eligible Users:** Users with inventory read access and label printing permission.
- **Restricted Users:** Users without inventory access or print permission cannot see or use the “Print Labels” action.

---

## 5. Entry Point & UI Placement

### Inventory Page
- Each row in the **Products Table** includes an action button: **“Print Labels”**.
- The button is visible for all products but behaves differently based on product type.

---

## 6. Print Labels Dialog (UI Specification)

When the user clicks **Print Labels**, a modal/dialog opens with the following fields:

### 6.1 Fields
1. **Label Title (Text Input)**
   - Optional
   - Displayed as plain text on the label (e.g., product name, short descriptor)
   - If empty, defaults to product name

2. **Show Price (Toggle / Yes–No)**
   - Default: Yes
   - If enabled, prints the product’s selling price on the label
   - If disabled, price is omitted

3. **Quantity (Number Input)**
   - Optional
   - Minimum value: 1
   - If left empty:
     - For non-IMEI products → defaults to current stock quantity
     - For IMEI products → ignored (quantity is derived from IMEI count)

4. **Print Button**
   - Validates input and initiates label generation

5. **Cancel Button**
   - Closes the dialog without action

---

## 7. Product Type Logic

### 7.1 IMEI-Based Products (Mobile Phones)
- Each unit has a **unique IMEI** stored in the system.
- Label printing behavior:
  - One label per IMEI
  - Quantity field is ignored or disabled
  - Each label contains:
    - Title
    - Optional price
    - Barcode generated from the IMEI
    - Human-readable IMEI text

Example:
- Stock: 10 phones
- IMEIs: 10 unique values
- Result: 10 labels printed (one per IMEI)

### 7.2 Non-IMEI Products
- Product has a single barcode/SKU
- Label printing behavior:
  - Barcode is generated from product barcode/SKU
  - Quantity determines how many copies are printed
  - Each label is identical

Example:
- Stock: 50 units
- Quantity field empty → 50 labels printed
- Quantity field = 5 → 5 labels printed

---

## 8. Label Content Specification

Each label may include the following elements:

- **Title** (Text)
- **Price** (Optional, formatted currency)
- **Barcode**
- **Barcode Text** (Human-readable)

### Barcode Standards
- Default barcode format: **Code 128** (broad compatibility)
- IMEI values must be encoded without modification
- Product barcodes/SKUs must match stored values exactly

---

## 9. Data Requirements

### Product Entity (Relevant Fields)
- `id`
- `name`
- `sku / barcode`
- `price`
- `stock_quantity`
- `product_type` (IMEI / NON_IMEI)

### IMEI Entity (For Mobile Phones)
- `id`
- `product_id`
- `imei`
- `status` (optional: available/sold)

---

## 10. Backend Flow

1. User clicks **Print Labels**
2. Frontend collects dialog input
3. Frontend sends request to label-generation endpoint
4. Backend:
   - Validates permissions
   - Determines product type
   - Resolves label count and barcode values
   - Generates printable label data (PDF or printer-ready format)
5. Printable output is returned to frontend or sent directly to printer

---

## 11. Printing & Output

### Supported Output Types
- PDF (default, for preview and testing)
- Direct thermal printer output (future or optional)

### Label Size (Configurable)
- Default: 50mm x 25mm (thermal label standard)
- Must be configurable at system or printer level

---

## 12. Error Handling & Edge Cases

- **Stock = 0:**
  - Disable printing or show warning

- **IMEI Missing:**
  - Show error: “No IMEIs available for this product”

- **Invalid Quantity:**
  - Prevent submission and show validation error

- **Printer Not Available:**
  - Allow PDF download instead

---

## 13. Testing Strategy

### Without Printer Hardware
- Generate and preview PDF labels
- Verify:
  - Correct label count
  - Correct barcode values
  - Price visibility toggle
  - IMEI-specific labels

### With Printer Hardware (Optional)
- Test thermal printer compatibility
- Verify alignment and scannability

---

## 14. Future Enhancements
- Custom label templates
- Multiple barcode formats (EAN-13, QR)
- Batch label printing
- Per-store printer configuration
- Logo or brand printing on labels

---

## 15. Acceptance Criteria

- User can print labels from Inventory page
- IMEI products generate one label per IMEI
- Non-IMEI products respect quantity logic
- Labels display correct title, price, and barcode
- Feature works without requiring printer hardware during development

