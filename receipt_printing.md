# Receipt Printing System Specification
## Version 1.0

---

## 1. EXECUTIVE SUMMARY

This document defines the technical specifications, requirements, and implementation details for a dual-format receipt printing system supporting both PDF (A4) and thermal paper (80mm/58mm) formats. The system enables automatic receipt generation upon sale completion with user-configurable preferences.

---

## 2. SYSTEM OVERVIEW

### 2.1 Objectives
- Provide professional receipt generation in two distinct formats
- Support automatic printing upon sale completion
- Enable user preference management for print settings
- Ensure compliance with receipt standards and legal requirements
- Maintain consistent branding across both formats

### 2.2 Scope
- PDF receipt generation (A4 format)
- Thermal receipt generation (80mm and 58mm widths)
- Settings interface for print configuration
- Auto-print functionality
- Print preview capabilities
- Manual print/reprint functionality

---

## 3. RECEIPT FORMATS SPECIFICATION

### 3.1 PDF Receipt (A4 Format)

#### 3.1.1 Page Specifications
- **Paper Size**: A4 (210mm × 297mm / 8.27" × 11.69")
- **Orientation**: Portrait
- **Margins**: 
  - Top: 20mm
  - Bottom: 20mm
  - Left: 15mm
  - Right: 15mm
- **Resolution**: 300 DPI minimum
- **Color Support**: Full color (RGB)

#### 3.1.2 Layout Structure

**Header Section** (0-60mm from top)
- Store/Business Logo (optional)
  - Maximum size: 150mm × 40mm
  - Centered or left-aligned
  - Supported formats: PNG, JPG, SVG
- Business Name
  - Font: Bold, 18-24pt
  - Centered
- Business Address
  - Font: Regular, 10-11pt
  - Multi-line, centered
- Contact Information
  - Phone, Email, Website
  - Font: Regular, 9-10pt
  - Centered
- Tax Registration Numbers
  - VAT/GST/Tax ID
  - Font: Regular, 9pt

**Receipt Information Bar** (65-85mm from top)
- Receipt Number/Invoice Number
  - Format: RCP-YYYYMMDD-XXXX
  - Font: Bold, 11pt
  - Left-aligned
- Date and Time
  - Format: DD/MM/YYYY HH:MM:SS
  - Font: Regular, 10pt
  - Right-aligned
- Cashier/Sales Rep Name
  - Font: Regular, 10pt
  - Left-aligned
- Payment Method
  - Font: Regular, 10pt
  - Right-aligned

**Separator Line** (88mm from top)
- Solid horizontal line
- Width: Full content width
- Thickness: 1pt
- Color: #333333

**Items Table** (95mm from top, variable height)

Table Headers:
- Column 1: Item/Description (60% width)
- Column 2: Qty (10% width, center-aligned)
- Column 3: Unit Price (15% width, right-aligned)
- Column 4: Total (15% width, right-aligned)
- Font: Bold, 10pt
- Background: Light gray (#F5F5F5)
- Bottom border: 1pt solid #CCCCCC

Table Rows:
- Item Name/Description
  - Font: Regular, 10pt
  - Left-aligned
  - Support for line wrapping
- Quantity
  - Font: Regular, 10pt
  - Center-aligned
  - Format: Decimal (2 places for fractional)
- Unit Price
  - Font: Regular, 10pt
  - Right-aligned
  - Currency symbol + amount
  - Format: 0.00
- Line Total
  - Font: Regular, 10pt
  - Right-aligned
  - Currency symbol + amount
  - Format: 0.00
- Row Separator: Light gray line (#EEEEEE), 0.5pt
- Alternate row shading (optional): #FAFAFA

**Totals Section** (variable position, right-aligned)
- Subtotal
  - Label: "Subtotal"
  - Font: Regular, 11pt
  - Amount: Bold, 11pt
- Discount (if applicable)
  - Label: "Discount" or "Discount (X%)"
  - Font: Regular, 11pt, Red text
  - Amount: Bold, 11pt, Red text
- Tax/VAT (itemized if multiple rates)
  - Label: "VAT (X%)" or "Tax (X%)"
  - Font: Regular, 11pt
  - Amount: Bold, 11pt
- **Grand Total**
  - Top border: 2pt solid #333333
  - Label: "TOTAL"
  - Font: Bold, 14pt
  - Amount: Bold, 14pt
  - Background: Light highlight (#F0F0F0)
  - Padding: 5mm

**Payment Information** (below totals)
- Payment Method Used
  - Label + Method name
  - Font: Regular, 10pt
- Amount Paid
  - Font: Regular, 10pt
- Change Given (if cash)
  - Font: Bold, 10pt

**Footer Section** (bottom 40mm)
- Separator line (1pt solid)
- Customer Service Information
  - Return policy statement
  - Customer service contact
  - Font: Regular, 9pt, centered
- Thank You Message
  - Font: Bold, 11pt, centered
  - Example: "Thank you for your business!"
- Barcode/QR Code (optional)
  - Receipt verification code
  - Size: 40mm × 40mm
  - Centered
- Legal Text
  - Tax point statement
  - VAT registration details
  - Font: Regular, 8pt, centered
  - Color: Gray (#666666)

#### 3.1.3 Typography
- **Primary Font**: Arial, Helvetica, or similar sans-serif
- **Alternative Font**: Roboto, Open Sans
- **Monospace** (for amounts): Courier New, Consolas

#### 3.1.4 Color Scheme
- Primary Text: #000000 (Black)
- Secondary Text: #666666 (Dark Gray)
- Borders/Lines: #CCCCCC (Light Gray)
- Background Shading: #F5F5F5
- Highlight: #F0F0F0
- Negative/Discount: #D32F2F (Red)

---

### 3.2 Thermal Receipt (Point-of-Sale)

#### 3.2.1 Paper Specifications
- **Standard Widths**: 
  - 80mm (most common)
  - 58mm (compact alternative)
- **Length**: Variable (cut-to-size)
- **Paper Type**: Thermal paper (heat-sensitive)
- **Color**: Monochrome (black on white)
- **Resolution**: 203 DPI (8 dots/mm) or 180 DPI

#### 3.2.2 Character Specifications
**For 80mm width:**
- Standard characters per line: 48 (using 12×24 dots)
- Condensed: 64 characters (using 9×17 dots)
- Double width: 24 characters
- Double height: 24 lines visible

**For 58mm width:**
- Standard characters per line: 32
- Condensed: 42 characters
- Double width: 16 characters

#### 3.2.3 Layout Structure (80mm format)

**Header Section**
```
================================================
          [BUSINESS LOGO - ASCII Art]
          or
          [Business Name in Large Font]
================================================
           Business Name (if logo used)
        Complete Business Address
          City, State ZIP Code
     Phone: XXX-XXX-XXXX | Email: xxx
           VAT/Tax ID: XXXXXXXXX
================================================
```
- Logo: ASCII art representation (optional) or graphic logo (if printer supports)
- Business name: Double width, centered
- Address: Normal width, centered
- Contact: Condensed, centered
- Tax ID: Normal width, centered
- Separator: Dashed or solid line (48 characters)

**Receipt Header**
```
Receipt #: RCP-YYYYMMDD-XXXX
Date: DD/MM/YYYY          Time: HH:MM:SS
Cashier: [Name]
------------------------------------------------
```
- Receipt number: Left-aligned
- Date/Time: Split on same line or separate lines
- Cashier: Left-aligned
- Separator line

**Items Section**
```
Item Description               Qty  Price Total
------------------------------------------------
[Product Name - may wrap to
 multiple lines if needed]     X.XX XX.XX XXX.XX
[Another Product]              X.XX XX.XX XXX.XX
[Product with discount]        X.XX XX.XX XXX.XX
  - Discount 10%                         -XX.XX
------------------------------------------------
```
- Item name: Left-aligned, 30 characters max
- Quantity: Right-aligned, 4 characters
- Unit price: Right-aligned, 5 characters
- Total: Right-aligned, 6 characters
- Discounts: Indented, negative sign
- Separator between items section and totals

**Totals Section**
```
                         Subtotal:      XXX.XX
                         Discount:      -XX.XX
                      Tax (XX%):       XX.XX
------------------------------------------------
                    TOTAL:          XXX.XX
================================================
```
- Labels: Right-aligned
- Amounts: Right-aligned with decimal alignment
- Total: Double width or bold
- Double separator line after total

**Payment Section**
```
Payment Method: [Credit Card/Cash/etc]
Amount Paid:                        XXX.XX
Change:                              XX.XX
```
- Left-aligned labels
- Amounts: Right-aligned

**Footer Section**
```
================================================
      Thank you for your business!
         Please come again!
        
        Returns within 30 days
      Keep this receipt for returns
        
    Questions? Call: XXX-XXX-XXXX
       Email: support@business.com
================================================
        [QR Code - if printer supports]
              or
        Receipt Code: XXXXXXXXXXXXX
================================================
               [Timestamp]
          Tax Point: DD/MM/YYYY
```
- Thank you message: Centered, may use larger font
- Policies: Centered, normal font
- Contact: Centered, condensed font
- QR code: Centered graphic (if supported)
- Verification code: Centered
- Legal info: Centered, small font

#### 3.2.4 Formatting Commands (ESC/POS Standard)

**Text Formatting**
- Normal: ESC ! 0x00
- Bold: ESC E 1 or ESC ! 0x08
- Double width: ESC ! 0x20
- Double height: ESC ! 0x10
- Double width + height: ESC ! 0x30
- Underline: ESC - 1 (on) / ESC - 0 (off)
- Emphasized: ESC E 1

**Alignment**
- Left: ESC a 0
- Center: ESC a 1
- Right: ESC a 2

**Line Spacing**
- Default: ESC 2
- Custom: ESC 3 n (n = spacing in dots)

**Cutting**
- Full cut: GS V 0
- Partial cut: GS V 1
- Feed and cut: GS V 65 n (n = feed lines)

**Barcode/QR Code** (if supported)
- QR Code: GS ( k commands
- Barcode: GS k commands

#### 3.2.5 58mm Adaptation
For 58mm receipts, apply these modifications:
- Reduce characters per line to 32
- Simplify item table to 2 columns:
  ```
  Item Name + Qty         Total
  Unit Price             XX.XX
  ```
- Stack date and time on separate lines
- Reduce logo size or use text-only
- May omit ASCII art decorations
- Condense footer information

---

## 4. CONTENT REQUIREMENTS

### 4.1 Mandatory Information (Both Formats)

**Business Identification**
- Legal business name
- Physical business address
- Contact phone number
- Email address (recommended)
- Website (optional)
- Tax registration number (VAT/GST/EIN as applicable)

**Transaction Information**
- Unique receipt/invoice number
- Date of transaction (DD/MM/YYYY or locale-appropriate)
- Time of transaction (HH:MM:SS in 24-hour format)
- Cashier/employee identifier (name or ID)

**Line Items**
- Item description/name
- Quantity sold
- Unit price (including currency symbol)
- Line total
- Any discounts applied (per line or total)

**Financial Summary**
- Subtotal (before tax and discounts)
- Total discount amount
- Tax breakdown (VAT/GST/Sales Tax with rate)
- Grand total
- Payment method
- Amount tendered
- Change given (if cash transaction)

**Legal/Tax Information**
- Tax point date
- VAT/Tax breakdown by rate (if multiple rates)
- Receipt type indicator (Sale/Return/Exchange)

### 4.2 Optional Information

**Customer Information** (if provided)
- Customer name
- Customer account/loyalty number
- Loyalty points earned/balance
- Email address (for digital receipt)

**Product Details**
- SKU/Barcode number
- Product category
- Serial numbers (for tracked items)
- Warranty information

**Store/Transaction Details**
- Store branch name/code
- Register/terminal number
- Transaction type flags
- Original receipt reference (for returns)

**Marketing/Service**
- Promotional messages
- Return policy summary
- Survey/feedback QR code
- Social media handles
- Upcoming sales/events
- Customer service hours

### 4.3 Data Formatting Standards

**Currency**
- Format: Symbol + amount (e.g., $123.45, €123,45)
- Decimal places: 2 for most currencies
- Thousands separator: Locale-appropriate (comma or period)
- Negative amounts: Minus sign or parentheses

**Dates and Times**
- Date: Follow locale standard (DD/MM/YYYY or MM/DD/YYYY)
- Time: 24-hour format (HH:MM:SS)
- Timezone: Include if multi-location business

**Numbering**
- Receipt numbers: Sequential or hybrid format
  - Recommended: PREFIX-YYYYMMDD-SEQUENCE
  - Example: RCP-20260131-0001
- Line numbers: Optional for item listing

**Quantities**
- Whole numbers: No decimal (5)
- Fractional: 2-3 decimal places (2.50 kg)
- Units: Include unit of measure (kg, lbs, ea, box)

---

## 5. TECHNICAL IMPLEMENTATION

### 5.1 PDF Generation

#### 5.1.1 Technology Stack Options

**Option 1: JavaScript/Browser-based**
- Library: jsPDF or PDFKit
- Advantages: Client-side generation, no server load
- Use case: Web applications, Electron apps

**Option 2: Server-side (Python)**
- Library: ReportLab or WeasyPrint
- Advantages: Complex layouts, server control
- Use case: Backend processing, bulk generation

**Option 3: Server-side (Node.js)**
- Library: PDFKit or Puppeteer
- Advantages: HTML-to-PDF conversion
- Use case: Template-based generation

**Option 4: HTML + CSS to PDF**
- Tool: wkhtmltopdf, Puppeteer, or Chrome headless
- Advantages: Design with HTML/CSS
- Use case: Designer-friendly templates

#### 5.1.2 Implementation Requirements

**Template System**
- Support for customizable templates
- Variable injection (business info, items, totals)
- Conditional sections (show/hide based on data)
- Multi-language support

**Data Processing**
```javascript
// Example data structure
{
  "receipt_id": "RCP-20260131-0001",
  "date": "2026-01-31T14:30:00Z",
  "business": {
    "name": "ABC Store",
    "address": "123 Main St, City, State 12345",
    "phone": "+1-555-0100",
    "email": "info@abcstore.com",
    "tax_id": "VAT123456789",
    "logo_url": "/assets/logo.png"
  },
  "cashier": {
    "id": "EMP001",
    "name": "John Doe"
  },
  "items": [
    {
      "sku": "PROD001",
      "name": "Product Name",
      "quantity": 2,
      "unit_price": 19.99,
      "line_total": 39.98,
      "discount": 0,
      "tax_rate": 0.20
    }
  ],
  "subtotal": 39.98,
  "total_discount": 0,
  "tax_breakdown": [
    {"rate": 0.20, "amount": 8.00}
  ],
  "total": 47.98,
  "payment": {
    "method": "Credit Card",
    "amount_paid": 47.98,
    "change": 0
  }
}
```

**Generation Process**
1. Validate receipt data structure
2. Load business settings (logo, colors, template)
3. Calculate totals and tax
4. Render template with data
5. Generate PDF in memory
6. Return PDF blob/buffer or save to file

**File Handling**
- Filename format: `Receipt_[NUMBER]_[DATE].pdf`
- Storage: Temporary directory or cloud storage
- Retention: Define policy (30-90 days recommended)
- Auto-cleanup: Implement scheduled cleanup

**Performance Optimization**
- Cache business information and logo
- Reuse PDF generator instance
- Asynchronous generation for web apps
- Queue system for bulk generation

#### 5.1.3 Quality Assurance
- Test with various item counts (1, 10, 50+ items)
- Verify pagination for long receipts
- Test unicode/special characters
- Validate calculations accuracy
- Check alignment on different PDF viewers

### 5.2 Thermal Printing

#### 5.2.1 Printer Communication

**Connection Methods**
1. **USB**
   - Direct connection to POS terminal/computer
   - Driver: Generic ESC/POS or vendor-specific
   - Platform: Windows, Linux, macOS

2. **Serial (RS-232)**
   - Legacy POS systems
   - Baud rate: 9600-115200
   - Data bits: 8, Parity: None, Stop bits: 1

3. **Network (Ethernet/WiFi)**
   - IP address-based connection
   - Port: Typically 9100 (raw printing)
   - Protocol: Socket connection or LPR/LPD

4. **Bluetooth**
   - Mobile POS applications
   - Pairing required
   - Range: ~10 meters

**ESC/POS Protocol**
- Industry standard for thermal printers
- Command structure: ESC + command byte + parameters
- Supported by: Epson, Star, Citizen, and most brands
- Character encoding: ASCII, code pages for international

#### 5.2.2 Implementation Libraries

**JavaScript/Node.js**
- `escpos` or `node-thermal-printer`
- Example:
```javascript
const ThermalPrinter = require("node-thermal-printer").printer;
const PrinterTypes = require("node-thermal-printer").types;

const printer = new ThermalPrinter({
  type: PrinterTypes.EPSON,
  interface: 'tcp://192.168.1.100',
  characterSet: 'PC437_USA',
  width: 48,
});
```

**Python**
- `python-escpos` library
- Example:
```python
from escpos.printer import Network

printer = Network("192.168.1.100")
printer.set(align='center', text_type='B')
printer.text("Business Name\n")
printer.cut()
```

**C# / .NET**
- `ESCPOS_NET` library
- Platform: Windows POS systems

**Mobile (React Native / Flutter)**
- Platform-specific Bluetooth libraries
- ESC/POS command generation in app

#### 5.2.3 Print Data Preparation

**Text Formatting Engine**
```javascript
class ThermalReceiptFormatter {
  constructor(width = 48) {
    this.width = width;
  }
  
  center(text) {
    const padding = Math.floor((this.width - text.length) / 2);
    return ' '.repeat(padding) + text;
  }
  
  leftRight(left, right) {
    const spaces = this.width - left.length - right.length;
    return left + ' '.repeat(spaces) + right;
  }
  
  separator(char = '-') {
    return char.repeat(this.width);
  }
  
  formatItem(name, qty, price, total) {
    // Format item line with proper spacing
    const maxNameWidth = this.width - 18; // Reserve space for numbers
    const truncatedName = name.substring(0, maxNameWidth);
    return this.formatColumns([
      { text: truncatedName, width: maxNameWidth, align: 'left' },
      { text: qty.toFixed(2), width: 5, align: 'right' },
      { text: price.toFixed(2), width: 6, align: 'right' },
      { text: total.toFixed(2), width: 7, align: 'right' }
    ]);
  }
  
  formatColumns(columns) {
    let line = '';
    columns.forEach(col => {
      const text = col.text.substring(0, col.width);
      if (col.align === 'right') {
        line += text.padStart(col.width, ' ');
      } else if (col.align === 'center') {
        const padding = Math.floor((col.width - text.length) / 2);
        line += ' '.repeat(padding) + text + ' '.repeat(col.width - padding - text.length);
      } else {
        line += text.padEnd(col.width, ' ');
      }
    });
    return line;
  }
}
```

**Command Sequence Example**
```javascript
function printReceipt(data) {
  const formatter = new ThermalReceiptFormatter(48);
  
  // Initialize printer
  printer.alignCenter();
  printer.setTextDoubleHeight();
  printer.setTextDoubleWidth();
  printer.println(data.business.name);
  printer.setTextNormal();
  
  // Business info
  printer.println(data.business.address);
  printer.println(`Phone: ${data.business.phone}`);
  printer.println(formatter.separator('='));
  
  // Receipt header
  printer.alignLeft();
  printer.println(`Receipt: ${data.receipt_id}`);
  printer.println(formatter.leftRight(
    `Date: ${data.date}`,
    `Time: ${data.time}`
  ));
  printer.println(formatter.separator('-'));
  
  // Items
  data.items.forEach(item => {
    printer.println(formatter.formatItem(
      item.name,
      item.quantity,
      item.unit_price,
      item.line_total
    ));
  });
  
  printer.println(formatter.separator('-'));
  
  // Totals
  printer.alignRight();
  printer.println(formatter.leftRight('Subtotal:', formatCurrency(data.subtotal)));
  printer.println(formatter.leftRight('Tax:', formatCurrency(data.tax)));
  printer.setTextDoubleHeight();
  printer.println(formatter.leftRight('TOTAL:', formatCurrency(data.total)));
  printer.setTextNormal();
  
  printer.println(formatter.separator('='));
  
  // Footer
  printer.alignCenter();
  printer.println('Thank you!');
  
  // Cut paper
  printer.cut();
  
  // Execute print
  return printer.execute();
}
```

#### 5.2.4 Error Handling

**Common Issues**
1. **Paper Out**
   - Detect: Check printer status before printing
   - Handle: Queue job, notify user
   
2. **Printer Offline**
   - Detect: Connection timeout
   - Handle: Alert user, offer retry or save PDF

3. **Cover Open**
   - Detect: Status byte check
   - Handle: Display warning

4. **Paper Jam**
   - Detect: Printer error status
   - Handle: Instruct user, log error

**Implementation**
```javascript
async function safePrint(receiptData) {
  try {
    // Check printer status
    const status = await printer.getStatus();
    
    if (!status.online) {
      throw new Error('Printer is offline');
    }
    
    if (status.paperOut) {
      throw new Error('Paper out - please refill');
    }
    
    if (status.coverOpen) {
      throw new Error('Printer cover is open');
    }
    
    // Proceed with printing
    await printReceipt(receiptData);
    
    return { success: true };
    
  } catch (error) {
    console.error('Print error:', error);
    
    // Log to error tracking system
    logError('thermal_print_failed', error);
    
    // Notify user
    notifyUser('Print failed: ' + error.message);
    
    // Offer alternatives
    return {
      success: false,
      error: error.message,
      alternatives: ['retry', 'save_pdf', 'email']
    };
  }
}
```

#### 5.2.5 Multi-Printer Support

**Configuration**
```javascript
const printerConfig = {
  primary: {
    type: 'thermal_80mm',
    connection: 'network',
    ip: '192.168.1.100',
    port: 9100,
    enabled: true
  },
  backup: {
    type: 'thermal_58mm',
    connection: 'usb',
    vendorId: '0x04b8',
    productId: '0x0e15',
    enabled: true
  },
  pdf: {
    type: 'pdf_printer',
    name: 'Microsoft Print to PDF',
    enabled: false
  }
};
```

**Fallback Logic**
1. Attempt primary printer
2. If fails, try backup printer
3. If all fail, generate PDF
4. Log all attempts for debugging

---

## 6. SETTINGS PAGE SPECIFICATION

### 6.1 User Interface Layout

#### 6.1.1 Page Structure
```
┌─────────────────────────────────────────────┐
│  Settings > Receipt Printing                │
├─────────────────────────────────────────────┤
│                                             │
│  Receipt Settings                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                             │
│  [Tab: Print Preferences]                   │
│  [Tab: Receipt Content]                     │
│  [Tab: Printer Configuration]               │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Print Preferences Tab               │   │
│  │─────────────────────────────────────│   │
│  │                                     │   │
│  │ Receipt Format                      │   │
│  │ ○ PDF Receipt (A4)                  │   │
│  │ ○ Thermal Receipt (80mm)            │   │
│  │ ○ Thermal Receipt (58mm)            │   │
│  │ ○ Both (PDF + Thermal)              │   │
│  │                                     │   │
│  │ Auto-Print Settings                 │   │
│  │ ☑ Automatically print receipt       │   │
│  │   after completing sale             │   │
│  │                                     │   │
│  │ ☑ Show print preview before         │   │
│  │   printing                          │   │
│  │                                     │   │
│  │ Number of Copies: [1] [▼]           │   │
│  │                                     │   │
│  │ ☐ Ask for customer email for        │   │
│  │   digital receipt                   │   │
│  │                                     │   │
│  │ [Preview Receipt] [Test Print]      │   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  [Save Settings]  [Cancel]  [Reset Defaults]│
└─────────────────────────────────────────────┘
```

#### 6.1.2 Tab 1: Print Preferences

**Receipt Format Selection**
- Radio button group
- Options:
  1. PDF Receipt (A4)
  2. Thermal Receipt (80mm)
  3. Thermal Receipt (58mm)
  4. Both (PDF + Thermal)
- Default: Thermal Receipt (80mm)
- Description tooltip for each option

**Auto-Print Settings**
- Checkbox: "Automatically print receipt after completing sale"
  - Default: Enabled
  - Saves time in busy environments
  
- Checkbox: "Show print preview before printing"
  - Default: Disabled
  - Useful for training or verification
  
- Number input: "Number of copies"
  - Range: 1-5
  - Default: 1
  - Use case: Customer copy + merchant copy

**Digital Receipt Options**
- Checkbox: "Ask for customer email for digital receipt"
  - Default: Disabled
  - When enabled: Shows email input prompt after sale
  
- Checkbox: "Save PDF receipts automatically"
  - Default: Enabled
  - Location: Configurable path or cloud storage

**Action Buttons**
- "Preview Receipt": Opens preview with sample data
- "Test Print": Sends test receipt to configured printer

#### 6.1.3 Tab 2: Receipt Content

**Business Information Section**
```
Business Details
┌─────────────────────────────────────┐
│ Business Name: [________________]   │
│                                     │
│ Address Line 1: [________________]  │
│ Address Line 2: [________________]  │
│ City: [__________] State: [___]     │
│ ZIP: [_______] Country: [________]  │
│                                     │
│ Phone: [________________]           │
│ Email: [________________]           │
│ Website: [________________]         │
│                                     │
│ Tax/VAT ID: [________________]      │
│                                     │
│ Logo Upload: [Choose File]          │
│ Current: [logo-preview.png] ❌      │
│                                     │
└─────────────────────────────────────┘
```

**Content Display Options**
```
☑ Show business logo
☑ Show tax registration number
☑ Show return policy on receipt
☑ Show customer service information
☑ Show social media handles
☐ Show QR code for receipt verification
☐ Show promotional message
```

**Custom Messages**
```
Thank You Message:
┌─────────────────────────────────────┐
│ Thank you for your business!        │
│ Please come again!                  │
└─────────────────────────────────────┘
Character limit: 200

Return Policy Message:
┌─────────────────────────────────────┐
│ Returns accepted within 30 days     │
│ with original receipt.              │
└─────────────────────────────────────┘
Character limit: 300

Promotional Message (Optional):
┌─────────────────────────────────────┐
│ [Empty - add promotional text]      │
└─────────────────────────────────────┘
Character limit: 200
```

**Item Display Settings**
```
☑ Show SKU/product codes
☑ Show item discounts separately
☐ Show product categories
☐ Show tax breakdown per item
```

#### 6.1.4 Tab 3: Printer Configuration

**Thermal Printer Setup**
```
Printer Connection
┌─────────────────────────────────────┐
│ Connection Type:                    │
│ ○ Network (Ethernet/WiFi)           │
│ ○ USB                               │
│ ○ Bluetooth                         │
│ ○ Serial Port                       │
│                                     │
│ [Network Settings Panel]            │
│ IP Address: [192.168.1.100]         │
│ Port: [9100]                        │
│ [Test Connection]                   │
│                                     │
└─────────────────────────────────────┘

Printer Model/Type:
[Select Printer ▼]
- Auto-detect (ESC/POS Generic)
- Epson TM-T88
- Star TSP143
- Citizen CT-S310
- Custom...

Paper Width: ○ 80mm  ○ 58mm

Advanced Settings:
☑ Enable auto-cutter
☐ Print store copy automatically
Cut Type: ○ Full cut  ○ Partial cut
Character Set: [PC437_USA ▼]
```

**PDF Printer Setup**
```
PDF Settings
┌─────────────────────────────────────┐
│ Default PDF Printer:                │
│ [Select Printer ▼]                  │
│ - Microsoft Print to PDF            │
│ - Adobe PDF                         │
│ - Save to file                      │
│                                     │
│ Save Location:                      │
│ [C:\Receipts\] [Browse...]          │
│                                     │
│ Filename Pattern:                   │
│ Receipt_[NUMBER]_[DATE].pdf         │
│                                     │
│ ☑ Open PDF after generation         │
│ ☐ Auto-print PDF (no preview)       │
│                                     │
└─────────────────────────────────────┘
```

**Backup Printer** (Optional)
```
☑ Enable backup printer

Backup Printer:
[Select Printer ▼]
Connection: [Network ▼]
IP: [192.168.1.101]

Use backup when:
☑ Primary printer offline
☑ Primary printer out of paper
☑ Primary printer error
```

### 6.2 Data Model

#### 6.2.1 Settings Schema
```javascript
{
  "receipt_settings": {
    "version": "1.0",
    "last_updated": "2026-01-31T10:00:00Z",
    
    "print_preferences": {
      "format": "thermal_80mm", // pdf_a4, thermal_80mm, thermal_58mm, both
      "auto_print": true,
      "show_preview": false,
      "number_of_copies": 1,
      "ask_for_email": false,
      "auto_save_pdf": true,
      "pdf_save_location": "/receipts/"
    },
    
    "business_info": {
      "name": "ABC Store",
      "address_line1": "123 Main Street",
      "address_line2": "Suite 100",
      "city": "Springfield",
      "state": "IL",
      "zip": "62701",
      "country": "USA",
      "phone": "+1-555-0100",
      "email": "info@abcstore.com",
      "website": "www.abcstore.com",
      "tax_id": "VAT123456789",
      "logo_path": "/assets/logo.png"
    },
    
    "content_options": {
      "show_logo": true,
      "show_tax_id": true,
      "show_return_policy": true,
      "show_customer_service": true,
      "show_social_media": false,
      "show_qr_code": false,
      "show_promotional": false,
      "show_sku": true,
      "show_item_discounts": true,
      "show_categories": false,
      "show_item_tax": false
    },
    
    "custom_messages": {
      "thank_you": "Thank you for your business!\nPlease come again!",
      "return_policy": "Returns accepted within 30 days with original receipt.",
      "promotional": "",
      "customer_service": "Questions? Call us at +1-555-0100"
    },
    
    "printer_config": {
      "thermal": {
        "enabled": true,
        "connection_type": "network", // network, usb, bluetooth, serial
        "ip_address": "192.168.1.100",
        "port": 9100,
        "model": "epson_tm_t88",
        "paper_width": "80mm",
        "character_set": "PC437_USA",
        "enable_cutter": true,
        "cut_type": "full", // full, partial
        "print_store_copy": false
      },
      
      "pdf": {
        "enabled": false,
        "printer_name": "Microsoft Print to PDF",
        "save_location": "C:\\Receipts\\",
        "filename_pattern": "Receipt_[NUMBER]_[DATE].pdf",
        "open_after_generation": true,
        "auto_print": false
      },
      
      "backup": {
        "enabled": false,
        "connection_type": "network",
        "ip_address": "192.168.1.101",
        "port": 9100,
        "use_on_primary_offline": true,
        "use_on_paper_out": true,
        "use_on_error": true
      }
    }
  }
}
```

#### 6.2.2 Settings Validation Rules

**Print Preferences**
- format: Must be one of: pdf_a4, thermal_80mm, thermal_58mm, both
- number_of_copies: Integer between 1 and 5

**Business Info**
- name: Required, max 100 characters
- phone: Valid phone format
- email: Valid email format
- tax_id: Optional, max 50 characters
- logo_path: Valid file path, supported formats: PNG, JPG, SVG

**Printer Config**
- thermal.ip_address: Valid IP format (xxx.xxx.xxx.xxx)
- thermal.port: Integer between 1 and 65535
- thermal.paper_width: Must be "80mm" or "58mm"
- pdf.save_location: Valid directory path

### 6.3 Settings Persistence

#### 6.3.1 Storage Methods

**Option 1: Local Storage (Web App)**
```javascript
// Save settings
function saveSettings(settings) {
  localStorage.setItem('receipt_settings', JSON.stringify(settings));
}

// Load settings
function loadSettings() {
  const stored = localStorage.getItem('receipt_settings');
  return stored ? JSON.parse(stored) : getDefaultSettings();
}
```

**Option 2: Database (Backend)**
```sql
CREATE TABLE receipt_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_settings_user ON receipt_settings(user_id);
CREATE INDEX idx_settings_key ON receipt_settings(setting_key);
```

**Option 3: Configuration File (Desktop App)**
```json
// config/receipt_settings.json
{
  "print_preferences": { ... },
  "business_info": { ... },
  "printer_config": { ... }
}
```

#### 6.3.2 Default Settings

Provide sensible defaults for first-time setup:
```javascript
function getDefaultSettings() {
  return {
    print_preferences: {
      format: "thermal_80mm",
      auto_print: true,
      show_preview: false,
      number_of_copies: 1,
      ask_for_email: false,
      auto_save_pdf: true,
      pdf_save_location: getDefaultDocumentsPath()
    },
    content_options: {
      show_logo: true,
      show_tax_id: true,
      show_return_policy: true,
      show_customer_service: true,
      show_sku: true,
      show_item_discounts: true
    },
    custom_messages: {
      thank_you: "Thank you for your business!",
      return_policy: "Returns accepted within 30 days with receipt.",
      customer_service: "Questions? Contact customer service."
    },
    printer_config: {
      thermal: {
        enabled: false, // Requires configuration
        connection_type: "network",
        paper_width: "80mm",
        enable_cutter: true,
        cut_type: "full"
      }
    }
  };
}
```

### 6.4 Settings UI Behaviors

#### 6.4.1 Real-time Preview
When user changes settings, show live preview:
- Format selection → Update preview layout
- Content options → Show/hide sections in preview
- Custom messages → Display updated text
- Logo upload → Display new logo

#### 6.4.2 Validation and Feedback
```javascript
function validateSettings(settings) {
  const errors = [];
  
  // Business info validation
  if (!settings.business_info.name) {
    errors.push("Business name is required");
  }
  
  if (settings.business_info.email && !isValidEmail(settings.business_info.email)) {
    errors.push("Invalid email format");
  }
  
  // Printer validation
  if (settings.printer_config.thermal.enabled) {
    if (settings.printer_config.thermal.connection_type === "network") {
      if (!isValidIP(settings.printer_config.thermal.ip_address)) {
        errors.push("Invalid printer IP address");
      }
    }
  }
  
  // Show errors to user
  if (errors.length > 0) {
    showValidationErrors(errors);
    return false;
  }
  
  return true;
}
```

#### 6.4.3 Save Flow
1. User clicks "Save Settings"
2. Validate all inputs
3. If validation fails, highlight errors
4. If validation passes:
   - Show loading indicator
   - Save to storage/database
   - Test printer connection (if changed)
   - Show success message
   - Refresh preview

#### 6.4.4 Test Functions

**Test Print Button**
```javascript
async function testPrint() {
  const settings = getCurrentSettings();
  
  const testData = {
    receipt_id: "TEST-" + Date.now(),
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString(),
    business: settings.business_info,
    cashier: { name: "Test User" },
    items: [
      { name: "Test Item 1", quantity: 1, unit_price: 10.00, line_total: 10.00 },
      { name: "Test Item 2", quantity: 2, unit_price: 5.50, line_total: 11.00 }
    ],
    subtotal: 21.00,
    tax: 4.20,
    total: 25.20,
    payment: { method: "Cash", amount_paid: 30.00, change: 4.80 }
  };
  
  try {
    if (settings.print_preferences.format.includes('thermal')) {
      await printThermalReceipt(testData);
    }
    if (settings.print_preferences.format.includes('pdf')) {
      await generatePDFReceipt(testData);
    }
    showSuccess("Test print completed successfully");
  } catch (error) {
    showError("Test print failed: " + error.message);
  }
}
```

**Printer Connection Test**
```javascript
async function testPrinterConnection() {
  const config = getCurrentSettings().printer_config.thermal;
  
  showLoadingIndicator("Testing printer connection...");
  
  try {
    const printer = connectToPrinter(config);
    const status = await printer.getStatus();
    
    if (status.online) {
      showSuccess("✓ Printer connected successfully");
      return true;
    } else {
      showWarning("⚠ Printer is offline");
      return false;
    }
  } catch (error) {
    showError("✗ Connection failed: " + error.message);
    return false;
  } finally {
    hideLoadingIndicator();
  }
}
```

---

## 7. AUTO-PRINT WORKFLOW

### 7.1 Sale Completion Trigger

**Event Flow**
```
Sale Completed
     ↓
Check Auto-Print Setting
     ↓
   Enabled?
     ↓
  Yes → Generate Receipt Data
     ↓
Check Format Setting
     ↓
┌────┴────┬────────┬────────┐
│         │        │        │
PDF     Thermal  Both    None
│         │        │        ↓
↓         ↓        ↓      Skip Print
Generate  Print   Do Both
PDF     Thermal
│         │        │
↓         ↓        ↓
Save/    Cut      Complete
Print    Paper
│         │        │
└─────────┴────────┘
         ↓
   Show Success
         ↓
Optional: Email Receipt?
         ↓
     Complete
```

### 7.2 Implementation

```javascript
async function handleSaleCompletion(saleData) {
  const settings = loadSettings();
  
  // Generate receipt data
  const receiptData = formatReceiptData(saleData);
  
  // Save to database
  await saveReceiptRecord(receiptData);
  
  // Auto-print if enabled
  if (settings.print_preferences.auto_print) {
    
    // Show preview if configured
    if (settings.print_preferences.show_preview) {
      const confirmed = await showPrintPreview(receiptData);
      if (!confirmed) {
        return; // User cancelled
      }
    }
    
    // Execute print based on format
    const format = settings.print_preferences.format;
    const copies = settings.print_preferences.number_of_copies;
    
    try {
      if (format === 'pdf_a4' || format === 'both') {
        const pdf = await generatePDFReceipt(receiptData);
        
        if (settings.pdf.auto_print) {
          await printPDF(pdf);
        } else {
          await savePDF(pdf, settings.pdf.save_location);
        }
      }
      
      if (format === 'thermal_80mm' || format === 'thermal_58mm' || format === 'both') {
        for (let i = 0; i < copies; i++) {
          await printThermalReceipt(receiptData, settings.printer_config.thermal);
          
          // Small delay between copies
          if (i < copies - 1) {
            await sleep(500);
          }
        }
      }
      
      // Log success
      logPrintEvent('success', receiptData.receipt_id);
      
      // Show success notification
      showNotification('Receipt printed successfully', 'success');
      
    } catch (error) {
      // Log error
      logPrintEvent('failed', receiptData.receipt_id, error);
      
      // Show error with options
      const action = await showPrintErrorDialog(error);
      
      if (action === 'retry') {
        return handleSaleCompletion(saleData);
      } else if (action === 'save_pdf') {
        const pdf = await generatePDFReceipt(receiptData);
        await savePDF(pdf);
      }
    }
  }
  
  // Ask for email if configured
  if (settings.print_preferences.ask_for_email) {
    const email = await promptForEmail();
    if (email) {
      await emailReceipt(receiptData, email);
    }
  }
  
  return receiptData;
}
```

### 7.3 Error Recovery

**Automatic Fallback Chain**
1. Try primary thermal printer
2. If fails → Try backup printer (if configured)
3. If fails → Generate and save PDF
4. If fails → Save receipt data to queue for later

**User Interaction**
```javascript
async function showPrintErrorDialog(error) {
  return await showDialog({
    title: 'Print Failed',
    message: `Unable to print receipt: ${error.message}`,
    icon: 'error',
    buttons: [
      { label: 'Retry', value: 'retry', primary: true },
      { label: 'Save as PDF', value: 'save_pdf' },
      { label: 'Email Receipt', value: 'email' },
      { label: 'Print Later', value: 'queue' },
      { label: 'Skip', value: 'skip' }
    ]
  });
}
```

---

## 8. ADDITIONAL FEATURES

### 8.1 Receipt Reprinting

**User Interface**
- "Reprint Receipt" button in transaction history
- Search receipts by number, date, or customer
- Preview before reprinting
- Select format (PDF/Thermal) for reprint

**Implementation**
```javascript
async function reprintReceipt(receiptId) {
  // Load original receipt data
  const receiptData = await loadReceiptFromDatabase(receiptId);
  
  if (!receiptData) {
    showError('Receipt not found');
    return;
  }
  
  // Show format selection
  const format = await selectReprintFormat();
  
  // Show preview
  const confirmed = await showPrintPreview(receiptData);
  
  if (!confirmed) return;
  
  // Print based on selected format
  if (format === 'thermal') {
    await printThermalReceipt(receiptData);
  } else {
    const pdf = await generatePDFReceipt(receiptData);
    await printPDF(pdf);
  }
  
  // Log reprint event
  logEvent('receipt_reprinted', { receipt_id: receiptId, format });
}
```

### 8.2 Email Receipts

**Features**
- Send receipt as PDF attachment
- HTML email template with receipt details
- Customer email collection at checkout
- Email history tracking

**Email Template Structure**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    /* Responsive email styles */
  </style>
</head>
<body>
  <div style="max-width: 600px; margin: 0 auto;">
    <h1>Receipt from [Business Name]</h1>
    <p>Thank you for your purchase!</p>
    
    <table>
      <tr><td>Receipt #:</td><td>[Receipt Number]</td></tr>
      <tr><td>Date:</td><td>[Date]</td></tr>
      <tr><td>Total:</td><td>[Total Amount]</td></tr>
    </table>
    
    <p>Your complete receipt is attached as a PDF.</p>
    
    <p>Questions? Contact us at [Email/Phone]</p>
  </div>
</body>
</html>
```

**Implementation**
```javascript
async function emailReceipt(receiptData, customerEmail) {
  // Generate PDF
  const pdf = await generatePDFReceipt(receiptData);
  
  // Create email
  const email = {
    to: customerEmail,
    subject: `Receipt ${receiptData.receipt_id} from ${receiptData.business.name}`,
    html: renderEmailTemplate(receiptData),
    attachments: [
      {
        filename: `Receipt_${receiptData.receipt_id}.pdf`,
        content: pdf,
        contentType: 'application/pdf'
      }
    ]
  };
  
  // Send via email service
  await sendEmail(email);
  
  // Log email sent
  logEvent('receipt_emailed', {
    receipt_id: receiptData.receipt_id,
    email: customerEmail
  });
}
```

### 8.3 Receipt Templates

**Multiple Template Support**
- Default template
- Compact template (fewer details)
- Detailed template (more product info)
- Custom branded templates

**Template Selection in Settings**
```javascript
const templates = [
  {
    id: 'default',
    name: 'Standard Receipt',
    description: 'Default layout with all standard information'
  },
  {
    id: 'compact',
    name: 'Compact Receipt',
    description: 'Minimal layout for quick transactions'
  },
  {
    id: 'detailed',
    name: 'Detailed Receipt',
    description: 'Extended information including product descriptions'
  },
  {
    id: 'custom',
    name: 'Custom Template',
    description: 'Your customized receipt layout'
  }
];
```

### 8.4 Multi-Language Support

**Language Selection**
```javascript
const supportedLanguages = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ar: 'العربية' // Right-to-left support
};
```

**Localized Content**
```javascript
const translations = {
  en: {
    receipt: 'Receipt',
    date: 'Date',
    total: 'Total',
    subtotal: 'Subtotal',
    tax: 'Tax',
    thank_you: 'Thank you for your business!'
  },
  es: {
    receipt: 'Recibo',
    date: 'Fecha',
    total: 'Total',
    subtotal: 'Subtotal',
    tax: 'Impuesto',
    thank_you: '¡Gracias por su compra!'
  }
};
```

---

## 9. TESTING REQUIREMENTS

### 9.1 Unit Tests

**PDF Generation**
- Test with 1 item
- Test with 50+ items (pagination)
- Test with various discount scenarios
- Test with multiple tax rates
- Test with long product names
- Test with special characters
- Test logo rendering
- Test different currencies

**Thermal Printing**
- Test 80mm format
- Test 58mm format
- Test text alignment
- Test line wrapping
- Test separator lines
- Test printer commands (ESC/POS)
- Test character encoding

**Settings Management**
- Test save/load cycle
- Test validation rules
- Test default values
- Test settings migration
- Test concurrent updates

### 9.2 Integration Tests

**Print Workflow**
- Complete sale → Auto-print
- Sale → Manual print
- Sale → Email receipt
- Sale → Print preview → Cancel
- Sale → Print preview → Confirm

**Printer Communication**
- Network printer connection
- USB printer connection
- Bluetooth printer connection
- Connection timeout handling
- Printer offline handling
- Paper out detection

**Error Scenarios**
- Printer offline during print
- Network failure
- Invalid receipt data
- Corrupted settings
- Concurrent print requests

### 9.3 User Acceptance Testing

**Test Scenarios**
1. First-time setup wizard
2. Change from thermal to PDF
3. Enable auto-print
4. Configure backup printer
5. Customize receipt content
6. Test print thermal receipt
7. Test print PDF receipt
8. Reprint old receipt
9. Email receipt to customer
10. Handle printer jam gracefully

**Success Criteria**
- Settings save correctly
- Prints generate accurately
- Auto-print works consistently
- Error messages are clear
- Recovery options are available
- Performance is acceptable (<3 seconds)

---

## 10. DEPLOYMENT CHECKLIST

### 10.1 Pre-Deployment

- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] User acceptance testing complete
- [ ] Documentation complete
- [ ] Settings migration script ready
- [ ] Default settings configured
- [ ] Printer drivers documented
- [ ] Sample receipts generated

### 10.2 Deployment Steps

1. **Database Migration**
   - Create settings tables
   - Migrate existing receipt data
   - Set default settings for existing users

2. **File System Setup**
   - Create receipt storage directories
   - Set appropriate permissions
   - Configure backup location

3. **Printer Configuration**
   - Install printer drivers
   - Configure network printers
   - Test connectivity
   - Configure fallback printers

4. **User Training**
   - Create training materials
   - Provide setup guide
   - Demonstrate print functions
   - Explain error recovery

5. **Monitoring Setup**
   - Configure error logging
   - Set up print job monitoring
   - Configure alerts for failures
   - Track usage metrics

### 10.3 Post-Deployment

- [ ] Monitor error logs
- [ ] Collect user feedback
- [ ] Track print success rate
- [ ] Monitor printer connectivity
- [ ] Optimize performance based on metrics
- [ ] Update documentation as needed

---

## 11. MAINTENANCE AND SUPPORT

### 11.1 Regular Maintenance

**Daily**
- Monitor printer status
- Check error logs
- Verify auto-print functionality

**Weekly**
- Review print success rates
- Check receipt storage usage
- Clean up old PDF files
- Update printer firmware if needed

**Monthly**
- Review user feedback
- Optimize templates
- Update content as needed
- Test backup systems

### 11.2 Troubleshooting Guide

**Common Issues**

1. **Thermal printer not printing**
   - Check power and cables
   - Verify network connectivity
   - Test with printer status check
   - Restart printer
   - Check paper roll

2. **PDF not generating**
   - Check file permissions
   - Verify storage space
   - Check PDF library version
   - Review error logs

3. **Auto-print not working**
   - Verify settings are saved
   - Check printer configuration
   - Test manual print
   - Review event logs

4. **Receipt data incorrect**
   - Verify calculation logic
   - Check tax configuration
   - Review data formatting
   - Test with sample data

---

## 12. FUTURE ENHANCEMENTS

### 12.1 Planned Features

**Cloud Receipt Storage**
- Store receipts in cloud service
- Customer receipt portal
- Search and download past receipts
- Analytics and reporting

**Mobile Receipt Delivery**
- SMS receipt delivery
- WhatsApp integration
- Mobile app integration
- QR code for receipt download

**Advanced Customization**
- Drag-and-drop template designer
- Conditional content blocks
- Dynamic promotions based on purchase
- Customer segmentation messages

**Analytics**
- Print success rate tracking
- Paper usage monitoring
- Cost per receipt calculation
- Environmental impact tracking

### 12.2 Integration Opportunities

- Accounting software integration
- Inventory management sync
- Customer loyalty programs
- Marketing automation
- CRM systems
- E-commerce platforms

---

## APPENDIX A: Code Examples

### A.1 Complete PDF Generation Example

```javascript
const PDFDocument = require('pdfkit');
const fs = require('fs');

function generatePDFReceipt(receiptData, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(outputPath);
    
    doc.pipe(stream);
    
    // Header
    if (receiptData.business.logo_path) {
      doc.image(receiptData.business.logo_path, 50, 45, { width: 150 });
      doc.moveDown(3);
    }
    
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text(receiptData.business.name, { align: 'center' });
    
    doc.fontSize(10)
       .font('Helvetica')
       .text(receiptData.business.address_line1, { align: 'center' })
       .text(`${receiptData.business.city}, ${receiptData.business.state} ${receiptData.business.zip}`, { align: 'center' })
       .text(`Phone: ${receiptData.business.phone}`, { align: 'center' })
       .text(`Email: ${receiptData.business.email}`, { align: 'center' })
       .text(`Tax ID: ${receiptData.business.tax_id}`, { align: 'center' });
    
    doc.moveDown();
    doc.moveTo(50, doc.y)
       .lineTo(550, doc.y)
       .stroke();
    doc.moveDown();
    
    // Receipt info
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .text(`Receipt #: ${receiptData.receipt_id}`, 50, doc.y, { continued: true })
       .text(`Date: ${receiptData.date}`, { align: 'right' });
    
    doc.font('Helvetica')
       .text(`Cashier: ${receiptData.cashier.name}`, 50, doc.y, { continued: true })
       .text(`Time: ${receiptData.time}`, { align: 'right' });
    
    doc.moveDown();
    
    // Items table header
    const tableTop = doc.y;
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor('#000000')
       .rect(50, tableTop, 500, 20)
       .fillAndStroke('#F5F5F5', '#CCCCCC');
    
    doc.fillColor('#000000')
       .text('Item', 55, tableTop + 5, { width: 250 })
       .text('Qty', 320, tableTop + 5, { width: 50, align: 'center' })
       .text('Price', 380, tableTop + 5, { width: 70, align: 'right' })
       .text('Total', 460, tableTop + 5, { width: 80, align: 'right' });
    
    let yPosition = tableTop + 25;
    
    // Items
    doc.font('Helvetica');
    receiptData.items.forEach((item, index) => {
      if (yPosition > 700) {
        doc.addPage();
        yPosition = 50;
      }
      
      const bgColor = index % 2 === 0 ? '#FFFFFF' : '#FAFAFA';
      doc.rect(50, yPosition, 500, 20).fill(bgColor);
      
      doc.fillColor('#000000')
         .text(item.name, 55, yPosition + 5, { width: 250 })
         .text(item.quantity.toString(), 320, yPosition + 5, { width: 50, align: 'center' })
         .text(`$${item.unit_price.toFixed(2)}`, 380, yPosition + 5, { width: 70, align: 'right' })
         .text(`$${item.line_total.toFixed(2)}`, 460, yPosition + 5, { width: 80, align: 'right' });
      
      yPosition += 20;
    });
    
    yPosition += 10;
    doc.moveTo(50, yPosition)
       .lineTo(550, yPosition)
       .stroke();
    yPosition += 15;
    
    // Totals
    doc.fontSize(11)
       .text('Subtotal:', 380, yPosition, { width: 80, align: 'left' })
       .text(`$${receiptData.subtotal.toFixed(2)}`, 460, yPosition, { width: 80, align: 'right' });
    
    yPosition += 20;
    doc.text('Tax:', 380, yPosition, { width: 80, align: 'left' })
       .text(`$${receiptData.tax.toFixed(2)}`, 460, yPosition, { width: 80, align: 'right' });
    
    yPosition += 25;
    doc.rect(380, yPosition - 5, 170, 2).fill('#333333');
    
    yPosition += 5;
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('TOTAL:', 380, yPosition, { width: 80, align: 'left' })
       .text(`$${receiptData.total.toFixed(2)}`, 460, yPosition, { width: 80, align: 'right' });
    
    // Payment info
    yPosition += 30;
    doc.fontSize(10)
       .font('Helvetica')
       .text(`Payment Method: ${receiptData.payment.method}`, 380, yPosition);
    
    // Footer
    yPosition = 750;
    doc.moveTo(50, yPosition)
       .lineTo(550, yPosition)
       .stroke();
    
    yPosition += 10;
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .text('Thank you for your business!', 50, yPosition, { align: 'center' });
    
    yPosition += 20;
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor('#666666')
       .text('Returns accepted within 30 days with original receipt.', 50, yPosition, { align: 'center' })
       .text(`Questions? Contact us at ${receiptData.business.phone}`, { align: 'center' });
    
    doc.end();
    
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}
```

### A.2 Complete Thermal Printing Example

```javascript
const escpos = require('escpos');
escpos.Network = require('escpos-network');

async function printThermalReceipt(receiptData, printerConfig) {
  const device = new escpos.Network(printerConfig.ip_address, printerConfig.port);
  const printer = new escpos.Printer(device);
  
  return new Promise((resolve, reject) => {
    device.open(async (error) => {
      if (error) {
        reject(error);
        return;
      }
      
      try {
        // Header
        printer
          .align('CT')
          .style('B')
          .size(2, 2)
          .text(receiptData.business.name)
          .size(1, 1)
          .style('NORMAL')
          .text(receiptData.business.address_line1)
          .text(`${receiptData.business.city}, ${receiptData.business.state}`)
          .text(`Phone: ${receiptData.business.phone}`)
          .text(`Tax ID: ${receiptData.business.tax_id}`)
          .text('================================================')
          
          // Receipt info
          .align('LT')
          .text(`Receipt #: ${receiptData.receipt_id}`)
          .text(`Date: ${receiptData.date}    Time: ${receiptData.time}`)
          .text(`Cashier: ${receiptData.cashier.name}`)
          .text('------------------------------------------------')
          
          // Items header
          .text(padColumns([
            { text: 'Item', width: 24 },
            { text: 'Qty', width: 6, align: 'right' },
            { text: 'Price', width: 9, align: 'right' },
            { text: 'Total', width: 9, align: 'right' }
          ]))
          .text('------------------------------------------------');
        
        // Items
        receiptData.items.forEach(item => {
          const nameLine = padColumns([
            { text: truncate(item.name, 24), width: 24 },
            { text: item.quantity.toFixed(2), width: 6, align: 'right' },
            { text: item.unit_price.toFixed(2), width: 9, align: 'right' },
            { text: item.line_total.toFixed(2), width: 9, align: 'right' }
          ]);
          printer.text(nameLine);
        });
        
        printer
          .text('------------------------------------------------')
          
          // Totals
          .align('RT')
          .text(`Subtotal:        $${receiptData.subtotal.toFixed(2)}`)
          .text(`Tax:             $${receiptData.tax.toFixed(2)}`)
          .text('================================================')
          .size(2, 2)
          .style('B')
          .text(`TOTAL:       $${receiptData.total.toFixed(2)}`)
          .size(1, 1)
          .style('NORMAL')
          .text('================================================')
          
          // Payment
          .align('LT')
          .text(`Payment: ${receiptData.payment.method}`)
          .text(`Amount Paid:              $${receiptData.payment.amount_paid.toFixed(2)}`)
          .text(`Change:                   $${receiptData.payment.change.toFixed(2)}`)
          .text('================================================')
          
          // Footer
          .align('CT')
          .text('Thank you for your business!')
          .text('Please come again!')
          .text('')
          .text('Returns within 30 days with receipt')
          .text(`Questions? ${receiptData.business.phone}`)
          .text('================================================')
          .feed(2);
        
        // Cut paper
        if (printerConfig.enable_cutter) {
          printer.cut();
        } else {
          printer.feed(3);
        }
        
        printer.close(() => resolve());
        
      } catch (err) {
        reject(err);
      }
    });
  });
}

// Helper functions
function padColumns(columns) {
  let line = '';
  columns.forEach(col => {
    let text = col.text.substring(0, col.width);
    if (col.align === 'right') {
      line += text.padStart(col.width, ' ');
    } else if (col.align === 'center') {
      const padding = Math.floor((col.width - text.length) / 2);
      line += ' '.repeat(padding) + text + ' '.repeat(col.width - padding - text.length);
    } else {
      line += text.padEnd(col.width, ' ');
    }
  });
  return line;
}

function truncate(str, length) {
  return str.length > length ? str.substring(0, length - 3) + '...' : str;
}
```

---

## APPENDIX B: ESC/POS Command Reference

### Common Commands

| Command | Hex | Description |
|---------|-----|-------------|
| Initialize | 1B 40 | Reset printer to default state |
| Line feed | 0A | Print and feed one line |
| Align left | 1B 61 00 | Left alignment |
| Align center | 1B 61 01 | Center alignment |
| Align right | 1B 61 02 | Right alignment |
| Bold on | 1B 45 01 | Enable bold |
| Bold off | 1B 45 00 | Disable bold |
| Double width | 1B 21 20 | Double width characters |
| Double height | 1B 21 10 | Double height characters |
| Double both | 1B 21 30 | Double width and height |
| Normal size | 1B 21 00 | Normal size characters |
| Underline on | 1B 2D 01 | Enable underline |
| Underline off | 1B 2D 00 | Disable underline |
| Cut paper | 1D 56 00 | Full cut |
| Partial cut | 1D 56 01 | Partial cut |
| Feed and cut | 1D 56 41 n | Feed n lines and cut |

---

## DOCUMENT REVISION HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-31 | Claude | Initial specification document |

---

*End of Document*