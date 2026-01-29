# Cashier Management System

## Overview
The POS system includes a comprehensive cashier management system that allows managers to:
- Create **one shared cashier account** per store for login purposes only
- Add multiple **cashier records** (staff members) without individual login accounts
- Track which specific cashier processes each sale via sidebar selection
- Calculate commission for each cashier based on their sales
- Maintain proper permissions: cashiers have limited access compared to managers

### Important Distinction

**Two Types of "Cashier":**

1. **Cashier Account** (from `cashier_accounts` table):
   - ONE shared login account per store
   - Used for authentication and permissions only
   - Created during store setup with store code
   - All physical cashiers share this single login
   - Has limited permissions (no access to manager features)
   - Acts as a dummy/scaffold account for permission handling

2. **Cashier Records** (from `cashiers` table):
   - Multiple staff member records per store
   - NO individual login credentials
   - Contains: name, phone, commission rate
   - Manager selects which cashier is working via sidebar dropdown
   - Selected cashier's info is saved with each sale
   - Used for performance tracking and commission calculations

**Workflow Example:**
- All cashiers log in using the same shared cashier account (using store code)
- Manager selects "John Doe" from the sidebar dropdown
- John Doe processes sales
- Sales are recorded with John Doe's cashier_ref_id
- Manager can track John Doe's performance and calculate his commission

## Features

### 1. Cashier Management (Store Tab)
Managers can add and manage cashiers through the Store → Cashiers tab.

**Cashier Information:**
- Full Name
- Phone Number
- Commission Rate (%)
- Active/Inactive Status

**Operations:**
- Add new cashiers
- Edit existing cashiers
- Delete (soft delete) cashiers

### 2. Cashier Selection (Sidebar)
Managers can select which cashier is currently working using the dropdown in the sidebar.

**Features:**
- Dropdown shows all active cashiers
- Displays cashier name and phone number
- Selection is saved in localStorage
- Can clear selection (no cashier selected)

### 3. Sale Recording
When a sale is processed:
- Manager selects active cashier from sidebar dropdown (before processing sale)
- The selected cashier's ID (`cashier_ref_id`) is saved with the sale record
- If no cashier is selected, the sale is recorded without cashier reference
- Cashier information is displayed in sales history, receipts, and reports
- The `cashier_id` field stores the login account (manager or shared cashier account)
- The `cashier_ref_id` field stores the actual staff member who processed the sale

### 4. Store Info Display
In Store → Store Info tab:
- **Cashiers Information Card** shows:
  - Total count of active cashiers
  - List of all cashiers with names and phone numbers
  - Commission rate for each cashier
- Provides quick overview of store staff

## Database Schema

### Cashiers Table
```sql
CREATE TABLE cashiers (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
-- Two fields for tracking:
ALTER TABLE sales ADD COLUMN cashier_id TEXT; -- Login account (UUID for manager, ID for cashier account)
ALTER TABLE sales ADD COLUMN cashier_ref_id INTEGER REFERENCES cashiers(id); -- Actual staff member
```

**Field Explanation:**
- `cashier_id`: Who was logged in (manager UUID or shared cashier account ID)
- `cashier_ref_id`: Which physical cashier processed the sale (from cashiers table)hone_number TEXT NOT NULL,
  commission_rate DECIMAL(5,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Sales Table Update
```sql
ALTER TABLE sales ADD COLUMN cashier_ref_id INTEGER REFERENCES cashiers(id);
```

## API Endpoints

### GET /api/cashiers
Fetch all active cashiers for a store.

**Query Parameters:**
- `store_id` (required): The store ID

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "store_id": 1,
      "full_name": "John Doe",
      "phone_number": "03001234567",
      "commission_rate": 5.5,
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### POST /api/cashiers
Create a new cashier.

**Request Body:**
```json
{
  "store_id": 1,
  "full_name": "John Doe",
  "phone_number": "03001234567",
  "commission_rate": 5.5
}
```

### PUT /api/cashiers
Update an existing cashier.

**Request Body:**
```json
{
  "id": 1,
  "full_name": "John Doe",
  "phone_number": "03001234567",
  "commission_rate": 6.0
}
```

### DELETE /api/cashiers
Soft delete a cashier (sets is_active to false).

**Query Parameters:**
- `id` (required): The cashier ID

## Usage Guide

### For Managers

#### Adding Cashiers
1. Navigate to Store → Cashiers tab
2. Click "Add Cashier" button
3. Fill in cashier details:
   - Full Name (required)
   - Phone Number (required)
   - Commission Rate (optional, percentage)
4. Click "Create"

#### Selecting Active Cashier
1. Look at the sidebar (left side)
2. Find the "Active Cashier" dropdown above the navigation menu
3. Click to open and select a cashier
4. The selected cashier will be used for all sales until changed

#### Processing Sales with Cashier
1. Select the cashier in the sidebar
2. Process sales normally through the POS
3. Sales will automatically include the selected cashier's ID


**How It Works:**

1. **Account Creation**: During store setup, ONE cashier account is created
   - This account has login credentials (email/username and password)
   - This account has "Cashier" role with limited permissions
   - Cannot access: Store management, user management, full reports, etc.
   - Can access: POS, limited sales view, basic inventory view

2. **Shared Login**: All physical cashiers use the same login
   - Username: Usually store code or store email
   - Password: Shared among all cashiers (set by manager)
   - Example: All cashiers login as "cashier@store123.com"

3. **Cashier Selection**: After login, manager selects who's working
   - Manager uses sidebar dropdown to select "John Doe"
   - System remembers John Doe is the active cashier
   - All sales are attributed to John Doe

4. **Sales Attribution**: Sales track the actual cashier
   - `cashier_id`: The login account used (same for all)
   - `cashier_ref_id`: The selected cashier (John, Sarah, etc.)
   - Reports show sales by individual cashier, not by login account

**Benefits:**
- **Simple Management**: Only one set of credentials per store
- **No Security Concerns**: No individual passwords to manage/reset
- **Accurate Tracking**: Still know exactly who processed each sale
- **Flexible Staffing**: Easy to add/remove staff without account management
- **Commission Calculation**: Track performance per person, not per login
Each store has ONE cashier login account that all cashiers can use:
- Username/Email: Set by manager when creating store
- Password: Shared among all cashiers
- When cashiers log in, they use the shared account
- Managers select which physical cashier is working via the sidebar dropdown
- Sales are attributed to the selected cashier, not the login account

## Benefits

1. **Simplified Account Management**: No need to create separate accounts for each cashier
2. **Accurate Tracking**: Know exactly which cashier processed which sale
3. **Commission Calculation**: Track commission rates for performance-based pay
4. **Flexibility**: Easy to add/remove/update cashier records
5. **Security**: Managers control cashier access and permissions

## Future Enhancements

1. **Commission Reports**: Generate reports showing sales and commissions per cashier
2. **Sales Filtering**: Filter sales history by cashier
3. **Performance Metrics**: Dashboard showing top-performing cashiers
4. **Time Tracking**: Record login/logout times for each cashier shift
5. **Auto-Selection**: Remember last selected cashier and auto-select on login

## Security Notes

- Only managers can add, edit, or delete cashiers
- Row Level Security (RLS) ensures stores can only see their own cashiers
- Soft deletes preserve historical data while hiding inactive cashiers
- Cashier selection is stored locally and doesn't affect other users

## Troubleshooting

**Cashier dropdown not showing:**
- Make sure you're logged in as a Manager
- Verify that cashiers have been added in the Store tab
- Check that cashiers are marked as active

**Sales not showing cashier:**
- Ensure a cashier was selected before processing the sale
- Check that the selected cashier is still active
- Verify the sale was processed after selecting the cashier

**Can't add cashier:**
- Verify you have Manager role
- Check that all required fields are filled
- Ensure phone number is in correct format
