# Software Update Specification: Signup & Store Creation Flow

**Document Version:** 1.0  
**Date:** January 31, 2026  
**Status:** Draft for Review

---

## 1. Executive Summary

This specification outlines the changes required to restructure the current signup and store creation flow. The update consolidates the process into a streamlined three-page workflow focused on store creation, eliminates separate cashier signup, and introduces cashier selection during sales transactions.

---

## 2. Current State vs. Proposed State

### 2.1 Current State
- Separate signup pages for different user types
- Individual cashier accounts with separate signup process
- Store creation may be decoupled from initial signup

### 2.2 Proposed State
- Single unified signup flow for store creation
- Three-page sequential process
- One shared cashier account per store
- Individual cashier profiles without separate login credentials
- Cashier selection via dropdown during sales

---

## 3. New User Flow

### 3.1 Page 1: Store Information
**Route:** `/signup` or `/store/create`

#### Fields Required:
| Field Name | Type | Validation | Required |
|------------|------|------------|----------|
| Store Name | Text input | Max 100 chars, alphanumeric + spaces | Yes (*) |
| Store Address | Text area | Max 500 chars | No |
| Owner/Manager Name | Text input | Max 100 chars, alphabetic + spaces | Yes (*) |

#### UI/UX Requirements:
- Page title: "Create Your Store"
- Clear heading and subheading explaining this is step 1 of 3
- Progress indicator showing current step (1/3)
- "Continue" button (enabled only when required fields are filled)
- Field validation on blur and form submission
- Error messages displayed inline below respective fields

#### Navigation:
- Forward: Proceeds to Page 2 (Owner/Manager Details)
- Back: Not applicable (first page)

---

### 3.2 Page 2: Owner/Manager Account Details
**Route:** `/signup/manager-details`

#### Fields Required:
| Field Name | Type | Validation | Required |
|------------|------|------------|----------|
| Email | Email input | Valid email format, unique in system | Yes (*) |
| Password | Password input | Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char | Yes (*) |
| Confirm Password | Password input | Must match Password field | Yes (*) |

#### UI/UX Requirements:
- Page title: "Manager Account Setup"
- Progress indicator showing current step (2/3)
- Password strength indicator
- Show/hide password toggle for both password fields
- Real-time password match validation for confirm password
- "Back" button to return to Page 1 (data preserved)
- "Continue" button to proceed to Page 3

#### Validation Rules:
- Email must not already exist in the system
- Password requirements clearly stated below field
- Confirm password must match exactly
- All validations performed client-side with server-side verification

#### Navigation:
- Forward: Proceeds to Page 3 (Cashier Setup)
- Back: Returns to Page 1 with data preserved in session/state

---

### 3.3 Page 3: Cashier Account & Staff Setup
**Route:** `/signup/cashier-setup`

#### Section A: Store Cashier Account
**Purpose:** Single shared account used by all cashiers for recording sales and expenses

| Field Name | Type | Validation | Required |
|------------|------|------------|----------|
| Cashier Account Name | Text input | Max 50 chars, default: "[Store Name] Cashier" | Yes |
| Cashier Account Password | Password input | Min 6 chars | Yes |

#### Section B: Individual Cashier Details
**Purpose:** Track individual cashier information for sales attribution and commission

**Dynamic Form (Add Multiple Cashiers):**

| Field Name | Type | Validation | Required |
|------------|------|------------|----------|
| Cashier Name | Text input | Max 100 chars | Yes |
| Commission Rate | Number input (%) | 0-100, up to 2 decimal places | Yes |
| Phone Number | Tel input | Valid phone format, 10-15 digits | Yes |

#### UI/UX Requirements:
- Page title: "Setup Cashier Access"
- Progress indicator showing current step (3/3)
- Two distinct sections with clear headings
- Section A: Single form for shared cashier account
- Section B: Repeatable form rows for individual cashiers
  - "Add Another Cashier" button to add new row
  - "Remove" button on each row (minimum 1 cashier required)
  - Table/list view showing all added cashiers
- "Back" button to return to Page 2 (data preserved)
- "Complete Setup" or "Create Store" button to submit
- Minimum 1 cashier must be added before submission

#### Validation Rules:
- At least one individual cashier must be added
- Phone numbers must be unique within the store
- Commission rate must be a valid percentage
- Cashier names must be unique within the store

#### Navigation:
- Forward: Submits entire signup flow, creates store and all accounts
- Back: Returns to Page 2 with data preserved

---

## 4. Data Model Changes

### 4.1 New/Modified Tables

#### `stores` table
```sql
- store_id (PK, UUID)
- store_name (VARCHAR, NOT NULL)
- store_address (TEXT, NULLABLE)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### `users` table (Modified)
```sql
- user_id (PK, UUID)
- store_id (FK, references stores.store_id)
- email (VARCHAR, UNIQUE, NOT NULL)
- password_hash (VARCHAR, NOT NULL)
- full_name (VARCHAR, NOT NULL)
- user_role (ENUM: 'owner', 'manager', 'cashier_account')
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### `cashier_accounts` table (New)
```sql
- cashier_account_id (PK, UUID)
- store_id (FK, references stores.store_id)
- account_name (VARCHAR, NOT NULL)
- password_hash (VARCHAR, NOT NULL)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

UNIQUE(store_id) -- One cashier account per store
```

#### `cashiers` table (New/Modified)
```sql
- cashier_id (PK, UUID)
- store_id (FK, references stores.store_id)
- cashier_name (VARCHAR, NOT NULL)
- commission_rate (DECIMAL(5,2), NOT NULL) -- e.g., 5.50 for 5.5%
- phone_number (VARCHAR, NOT NULL)
- is_active (BOOLEAN, DEFAULT TRUE)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

UNIQUE(store_id, phone_number)
UNIQUE(store_id, cashier_name)
```

#### `sales` table (Modified)
```sql
- sale_id (PK, UUID)
- store_id (FK, references stores.store_id)
- cashier_id (FK, references cashiers.cashier_id) -- MODIFIED: Now references cashier profile, not user account
- cashier_account_id (FK, references cashier_accounts.cashier_account_id) -- NEW: Account used to record sale
- sale_amount (DECIMAL)
- commission_earned (DECIMAL) -- Calculated based on cashier's commission_rate
- sale_date (TIMESTAMP)
- created_at (TIMESTAMP)
```

#### `expenses` table (Modified)
```sql
- expense_id (PK, UUID)
- store_id (FK, references stores.store_id)
- cashier_account_id (FK, references cashier_accounts.cashier_account_id) -- NEW: Account used to record expense
- recorded_by_cashier_id (FK, references cashiers.cashier_id, NULLABLE) -- Optional: which cashier recorded it
- expense_amount (DECIMAL)
- expense_category (VARCHAR)
- expense_date (TIMESTAMP)
- created_at (TIMESTAMP)
```

---

## 5. Backend API Changes

### 5.1 New Endpoints

#### POST `/api/v1/signup/store`
**Purpose:** Complete entire signup flow in single transaction

**Request Body:**
```json
{
  "store": {
    "name": "string (required)",
    "address": "string (optional)"
  },
  "manager": {
    "name": "string (required)",
    "email": "string (required)",
    "password": "string (required)"
  },
  "cashierAccount": {
    "accountName": "string (required)",
    "password": "string (required)"
  },
  "cashiers": [
    {
      "name": "string (required)",
      "commissionRate": "number (required, 0-100)",
      "phoneNumber": "string (required)"
    }
  ]
}
```

**Response (Success - 201):**
```json
{
  "success": true,
  "data": {
    "storeId": "uuid",
    "managerId": "uuid",
    "cashierAccountId": "uuid",
    "cashiers": [
      {
        "cashierId": "uuid",
        "name": "string",
        "commissionRate": "number",
        "phoneNumber": "string"
      }
    ]
  },
  "message": "Store created successfully"
}
```

**Response (Error - 400/422):**
```json
{
  "success": false,
  "errors": {
    "store.name": ["Store name is required"],
    "manager.email": ["Email already exists"],
    "cashiers.0.phoneNumber": ["Invalid phone number format"]
  }
}
```

**Business Logic:**
1. Validate all input data
2. Check email uniqueness
3. Hash both manager and cashier account passwords
4. Create database transaction:
   - Insert into `stores` table
   - Insert manager into `users` table
   - Insert into `cashier_accounts` table
   - Insert all cashiers into `cashiers` table
5. Commit transaction or rollback on error
6. Send welcome email to manager
7. Return success response with IDs

---

#### GET `/api/v1/stores/{storeId}/cashiers`
**Purpose:** Retrieve all cashiers for a store (for dropdown in sales page)

**Headers:**
```
Authorization: Bearer {token}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "cashiers": [
      {
        "cashierId": "uuid",
        "name": "string",
        "commissionRate": "number",
        "phoneNumber": "string",
        "isActive": "boolean"
      }
    ]
  }
}
```

---

#### POST `/api/v1/stores/{storeId}/cashiers`
**Purpose:** Add new cashier to existing store

**Request Body:**
```json
{
  "name": "string (required)",
  "commissionRate": "number (required, 0-100)",
  "phoneNumber": "string (required)"
}
```

**Response:** Standard success/error response

---

#### PATCH `/api/v1/stores/{storeId}/cashiers/{cashierId}`
**Purpose:** Update cashier details

**Request Body:**
```json
{
  "name": "string (optional)",
  "commissionRate": "number (optional)",
  "phoneNumber": "string (optional)",
  "isActive": "boolean (optional)"
}
```

---

#### DELETE `/api/v1/stores/{storeId}/cashiers/{cashierId}`
**Purpose:** Soft delete cashier (set isActive = false)

**Response:** Standard success/error response

---

### 5.2 Modified Endpoints

#### POST `/api/v1/sales`
**Changes:** Add `cashierId` to request body

**Request Body (Modified):**
```json
{
  "storeId": "uuid",
  "cashierId": "uuid (required - selected from dropdown)",
  "items": [...],
  "totalAmount": "number",
  "paymentMethod": "string"
}
```

**Business Logic Changes:**
1. Fetch cashier's commission rate from `cashiers` table
2. Calculate commission: `commissionEarned = totalAmount * (commissionRate / 100)`
3. Store both `cashier_id` and `cashier_account_id` in sales record
4. Record commission earned

---

#### POST `/api/v1/expenses`
**Changes:** Add optional `recordedByCashierId`

**Request Body (Modified):**
```json
{
  "storeId": "uuid",
  "recordedByCashierId": "uuid (optional)",
  "expenseAmount": "number",
  "expenseCategory": "string",
  "notes": "string"
}
```

---

### 5.3 Deprecated Endpoints
- DELETE `/api/v1/signup/cashier` - No longer needed
- POST `/api/v1/cashiers/login` - Cashiers no longer have individual login

---

## 6. Frontend Changes

### 6.1 New Pages/Components

#### Page 1: StoreInformationForm
**File:** `src/pages/signup/StoreInformationForm.jsx`

**State Management:**
```javascript
{
  storeName: '',
  storeAddress: '',
  managerName: '',
  errors: {}
}
```

**Key Features:**
- Form validation
- Progress indicator component
- Data persistence to session/state on navigation
- Responsive design for mobile/tablet

---

#### Page 2: ManagerDetailsForm
**File:** `src/pages/signup/ManagerDetailsForm.jsx`

**State Management:**
```javascript
{
  email: '',
  password: '',
  confirmPassword: '',
  errors: {},
  passwordStrength: 'weak' | 'medium' | 'strong'
}
```

**Key Features:**
- Password strength meter
- Real-time password matching
- Email availability check (debounced)
- Show/hide password toggles

---

#### Page 3: CashierSetupForm
**File:** `src/pages/signup/CashierSetupForm.jsx`

**State Management:**
```javascript
{
  cashierAccount: {
    accountName: '[Store Name] Cashier',
    password: ''
  },
  cashiers: [
    {
      id: 'temp-uuid-1',
      name: '',
      commissionRate: '',
      phoneNumber: ''
    }
  ],
  errors: {}
}
```

**Key Features:**
- Dynamic form rows for cashiers
- Add/remove cashier functionality
- Inline validation
- Commission rate input with % symbol
- Phone number formatting
- Final submission with loading state

---

#### Component: CashierDropdown
**File:** `src/components/sales/CashierDropdown.jsx`

**Purpose:** Dropdown selector for sales page

**Props:**
```javascript
{
  storeId: string,
  selectedCashierId: string,
  onChange: function,
  required: boolean
}
```

**Features:**
- Fetches cashiers from API on mount
- Searchable/filterable dropdown
- Shows cashier name and commission rate
- Handles loading and error states
- Only shows active cashiers

---

### 6.2 Modified Pages/Components

#### SalesPage
**File:** `src/pages/sales/SalesPage.jsx`

**Changes:**
- Add CashierDropdown component above sales form
- Add `selectedCashierId` to form state
- Pass cashierId to sales API call
- Display commission earned after sale completion
- Validation: Cashier must be selected before sale submission

**Example Implementation:**
```javascript
<CashierDropdown
  storeId={currentStoreId}
  selectedCashierId={selectedCashierId}
  onChange={handleCashierChange}
  required={true}
/>
```

---

### 6.3 State Management

**Signup Flow State (Context/Redux):**
```javascript
{
  currentStep: 1 | 2 | 3,
  storeInfo: {
    storeName: '',
    storeAddress: '',
    managerName: ''
  },
  managerDetails: {
    email: '',
    password: ''
  },
  cashierSetup: {
    cashierAccount: {},
    cashiers: []
  },
  isSubmitting: false,
  errors: {}
}
```

**Actions:**
- `setCurrentStep(step)`
- `updateStoreInfo(data)`
- `updateManagerDetails(data)`
- `updateCashierSetup(data)`
- `submitSignup()`
- `goBack()`
- `goForward()`

---

### 6.4 Routing Updates

**New Routes:**
```javascript
/signup                    -> StoreInformationForm (Page 1)
/signup/manager-details    -> ManagerDetailsForm (Page 2)
/signup/cashier-setup      -> CashierSetupForm (Page 3)
/signup/success            -> SignupSuccessPage
```

**Route Guards:**
- Page 2 and 3 require Page 1 data to be completed
- Redirect to appropriate step if accessing out of sequence
- Clear signup state on success page

---

## 7. Authentication & Authorization

### 7.1 Login Changes

**Manager/Owner Login:**
- Uses email and password from Page 2
- Role: `owner` or `manager`
- Access: Full dashboard, reports, settings, cashier management

**Cashier Account Login:**
- Uses cashier account name and password from Page 3
- Role: `cashier_account`
- Access: Sales entry, expense entry, limited dashboard
- Must select individual cashier from dropdown when recording sales

### 7.2 Session Management

**Manager Session:**
```javascript
{
  userId: 'uuid',
  storeId: 'uuid',
  role: 'manager',
  email: 'user@example.com',
  storeName: 'Store Name'
}
```

**Cashier Account Session:**
```javascript
{
  cashierAccountId: 'uuid',
  storeId: 'uuid',
  role: 'cashier_account',
  accountName: 'Store Cashier'
}
```

---

## 8. Validation Rules

### 8.1 Page 1 Validation
| Field | Rules |
|-------|-------|
| Store Name | Required, 1-100 characters, no special characters except spaces and hyphens |
| Store Address | Optional, max 500 characters |
| Manager Name | Required, 1-100 characters, alphabetic characters and spaces only |

### 8.2 Page 2 Validation
| Field | Rules |
|-------|-------|
| Email | Required, valid email format, unique in system, max 255 characters |
| Password | Required, min 8 characters, must contain: 1 uppercase, 1 lowercase, 1 number, 1 special character |
| Confirm Password | Required, must exactly match Password field |

### 8.3 Page 3 Validation
| Field | Rules |
|-------|-------|
| Cashier Account Name | Required, 1-50 characters, alphanumeric and spaces |
| Cashier Account Password | Required, min 6 characters |
| Cashier Name | Required, 1-100 characters, unique within store |
| Commission Rate | Required, numeric, 0-100, up to 2 decimal places |
| Phone Number | Required, 10-15 digits, valid format, unique within store |

---

## 9. Error Handling

### 9.1 Client-Side Errors
- Display inline validation errors below each field
- Show summary of errors at top of form on submit attempt
- Highlight invalid fields with red border
- Prevent navigation to next step until current step is valid

### 9.2 Server-Side Errors
- Email already exists: Display on Page 2 email field
- Store name conflicts: Display on Page 1
- Database errors: Show generic error message and log details
- Network errors: Show retry option with error details

### 9.3 Transaction Failures
If signup transaction fails midway:
1. Rollback all database changes
2. Return specific error to user
3. Log error details for debugging
4. Allow user to retry submission
5. Preserve form data for retry

---

## 10. UI/UX Considerations

### 10.1 Progress Indication
- Visual progress bar or step indicator (1 of 3, 2 of 3, 3 of 3)
- Clear labeling of current and completed steps
- Clickable step indicators to navigate back (data preserved)

### 10.2 Data Persistence
- Store form data in session storage or state management
- Preserve data when navigating back
- Clear data after successful submission
- Warn user if attempting to leave mid-flow

### 10.3 Loading States
- Show loading spinner during API calls
- Disable submit buttons while processing
- Show progress feedback during signup submission

### 10.4 Success State
- Redirect to success page after completion
- Show confirmation message
- Provide link to login or automatic login
- Display store and cashier account details

### 10.5 Mobile Responsiveness
- All three pages must be mobile-friendly
- Touch-friendly form inputs
- Responsive layout for smaller screens
- Keyboard-friendly navigation

---

## 11. Security Considerations

### 11.1 Password Security
- Hash passwords using bcrypt or argon2
- Minimum password strength requirements enforced
- Never store plain text passwords
- Implement rate limiting on signup attempts

### 11.2 Input Validation
- Sanitize all user inputs server-side
- Prevent SQL injection through parameterized queries
- Validate data types and formats strictly
- Implement CSRF protection on forms

### 11.3 Email Verification
**Optional Enhancement:**
- Send verification email to manager after signup
- Require email verification before full access
- Include verification link with expiry

### 11.4 Rate Limiting
- Limit signup attempts per IP address
- Implement CAPTCHA if abuse detected
- Monitor for suspicious signup patterns

---

## 12. Migration Plan

### 12.1 Existing Data
**If there are existing cashier accounts with individual logins:**

1. **Data Migration Strategy:**
   - Create store cashier account for each store
   - Migrate existing cashier users to cashier profiles
   - Preserve commission rates and phone numbers
   - Set default cashier account password (require reset)

2. **Migration Script:**
```sql
-- For each store:
-- 1. Create cashier_account entry
INSERT INTO cashier_accounts (store_id, account_name, password_hash)
SELECT store_id, 
       CONCAT(store_name, ' Cashier'), 
       'default_hashed_password'
FROM stores;

-- 2. Migrate cashier users to cashier profiles
INSERT INTO cashiers (store_id, cashier_name, commission_rate, phone_number)
SELECT store_id, full_name, commission_rate, phone_number
FROM users
WHERE user_role = 'cashier';

-- 3. Update sales records to reference cashier profiles
-- (Maintain data integrity with existing sales)
```

3. **User Communication:**
   - Email all existing cashiers about the change
   - Provide new cashier account credentials to managers
   - Explain new login process
   - Offer support period for transition

### 12.2 Backward Compatibility
**During Transition Period:**
- Keep old cashier login active for 30 days
- Show migration notice on old login page
- Automatic redirect to new flow for new signups
- Deprecation warnings in API responses

---

## 13. Testing Requirements

### 13.1 Unit Tests

**Frontend:**
- Form validation logic for all three pages
- State management actions and reducers
- Component rendering and user interactions
- API integration mocks

**Backend:**
- Signup endpoint business logic
- Password hashing
- Data validation
- Transaction rollback scenarios

### 13.2 Integration Tests
- Complete signup flow end-to-end
- API endpoint integration
- Database transaction integrity
- Email sending (if implemented)

### 13.3 E2E Tests
1. Complete happy path: All fields valid, successful signup
2. Validation errors: Test each required field
3. Email uniqueness: Attempt duplicate email
4. Multiple cashiers: Add and remove cashiers dynamically
5. Navigation: Back/forward through steps with data persistence
6. Session timeout: Test abandoned signup flow
7. Network errors: Simulate API failures

### 13.4 Manual Testing Checklist
- [ ] Create store with minimum required fields
- [ ] Create store with all optional fields
- [ ] Test password strength indicators
- [ ] Test email uniqueness validation
- [ ] Add multiple cashiers (5+)
- [ ] Remove cashiers after adding
- [ ] Navigate back and forth between steps
- [ ] Submit with invalid data
- [ ] Test on mobile devices
- [ ] Test on different browsers
- [ ] Test cashier dropdown in sales page
- [ ] Verify commission calculation
- [ ] Test cashier account login
- [ ] Test manager account login
- [ ] Verify permissions for each role

---

## 14. Performance Considerations

### 14.1 Frontend
- Lazy load pages in signup flow
- Debounce email uniqueness check (500ms)
- Optimize form re-renders
- Minimize bundle size

### 14.2 Backend
- Index frequently queried columns:
  - `stores.store_id`
  - `users.email`
  - `cashiers.store_id`
  - `cashier_accounts.store_id`
- Use database transactions efficiently
- Optimize bulk cashier insertion
- Implement caching for cashier list endpoint

### 14.3 Database
- Ensure proper indexing on foreign keys
- Monitor transaction lock durations
- Use connection pooling
- Implement query timeouts

---

## 15. Monitoring & Analytics

### 15.1 Metrics to Track
- Signup completion rate by step
- Average time spent on each step
- Dropout rate per step
- Email validation failure rate
- Average number of cashiers added per store
- Signup errors by type
- API response times for signup endpoint

### 15.2 Logging
- Log all signup attempts (success and failure)
- Log validation errors with sanitized details
- Log transaction rollbacks
- Monitor for unusual patterns (potential abuse)

### 15.3 Alerts
- High signup failure rate
- Database transaction errors
- Slow API response times (>2 seconds)
- Unusual number of signup attempts from single IP

---

## 16. Documentation Requirements

### 16.1 User Documentation
- Update user guide with new signup flow
- Create video walkthrough of signup process
- FAQ section for common issues
- Cashier management guide for store owners

### 16.2 Developer Documentation
- API endpoint documentation (Swagger/OpenAPI)
- Database schema updates
- Migration guide
- Testing guide
- Deployment checklist

### 16.3 Support Documentation
- Troubleshooting guide for support team
- Common error messages and resolutions
- Account recovery procedures
- Data migration FAQ

---

## 17. Deployment Plan

### 17.1 Pre-Deployment
- [ ] Complete all unit and integration tests
- [ ] Perform security audit
- [ ] Review database migration scripts
- [ ] Backup production database
- [ ] Prepare rollback plan
- [ ] Update API documentation
- [ ] Notify stakeholders of deployment window

### 17.2 Deployment Steps
1. **Database Migration** (Maintenance window required)
   - Run migration scripts
   - Verify data integrity
   - Create backup after migration

2. **Backend Deployment**
   - Deploy new API endpoints
   - Deploy modified endpoints
   - Verify health checks
   - Monitor error rates

3. **Frontend Deployment**
   - Deploy new signup flow pages
   - Deploy updated sales page
   - Clear CDN cache
   - Verify all routes accessible

4. **Verification**
   - Test complete signup flow in production
   - Test cashier dropdown in sales page
   - Verify existing users can still log in
   - Check database logs for errors

### 17.3 Post-Deployment
- [ ] Monitor error rates for 24 hours
- [ ] Check signup completion metrics
- [ ] Review user feedback
- [ ] Address any critical issues immediately
- [ ] Document lessons learned

### 17.4 Rollback Plan
If critical issues arise:
1. Revert frontend to previous version
2. Revert backend to previous version
3. Restore database from backup (if migration issues)
4. Communicate status to users
5. Investigate issues in staging environment

---

## 18. Success Criteria

### 18.1 Functional Requirements Met
- [ ] All three signup pages implemented and functional
- [ ] Store, manager, and cashier data correctly saved
- [ ] Cashier dropdown working in sales page
- [ ] Commission calculation accurate
- [ ] Email and phone uniqueness enforced
- [ ] Password requirements enforced
- [ ] All validations working correctly

### 18.2 Performance Metrics
- [ ] Signup completion time < 3 minutes (average)
- [ ] API response time < 1 second for signup
- [ ] Page load time < 2 seconds for each step
- [ ] Zero data loss during transaction failures

### 18.3 User Experience
- [ ] Signup completion rate > 80%
- [ ] User satisfaction score > 4/5
- [ ] Dropout rate < 20% on any single step
- [ ] Mobile experience rated positively

### 18.4 Quality Metrics
- [ ] Test coverage > 80%
- [ ] Zero critical bugs in production
- [ ] < 5% error rate on signup endpoint
- [ ] All security requirements met

---

## 19. Timeline & Milestones

### Phase 1: Design & Planning (Week 1)
- Finalize specification
- Review with stakeholders
- Create UI/UX mockups
- Define API contracts

### Phase 2: Backend Development (Week 2-3)
- Database schema changes
- Implement new API endpoints
- Modify existing endpoints
- Write unit tests
- Code review

### Phase 3: Frontend Development (Week 3-4)
- Implement three signup pages
- Implement cashier dropdown
- Integrate with backend APIs
- Write unit tests
- UI/UX review

### Phase 4: Integration & Testing (Week 5)
- Integration testing
- E2E testing
- Security testing
- Performance testing
- Bug fixes

### Phase 5: Migration & Deployment (Week 6)
- Prepare migration scripts
- Staging deployment and testing
- Production deployment
- Monitoring and support

---

## 20. Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Data loss during migration | High | Low | Comprehensive backups, tested rollback plan |
| Transaction failure mid-signup | Medium | Medium | Atomic transactions, proper error handling |
| Email deliverability issues | Low | Medium | Use reliable email service, fallback options |
| Poor user adoption of new flow | Medium | Low | User education, clear documentation, support |
| Performance degradation | Medium | Low | Load testing, monitoring, scaling plan |
| Security vulnerabilities | High | Low | Security audit, penetration testing |
| Browser compatibility issues | Low | Medium | Cross-browser testing, polyfills |
| Mobile usability problems | Medium | Medium | Mobile-first design, responsive testing |

---

## 21. Dependencies

### 21.1 Internal Dependencies
- Frontend framework (React/Vue/Angular)
- Backend framework (Node.js/Django/Laravel)
- Database system (PostgreSQL/MySQL)
- State management library (Redux/Vuex)
- Authentication library
- Form validation library

### 21.2 External Dependencies
- Email service provider (SendGrid/Mailgun)
- SMS service (optional, for phone verification)
- CDN for asset delivery
- Monitoring service (Sentry/New Relic)
- Analytics platform (Google Analytics/Mixpanel)

---

## 22. Open Questions

1. **Email Verification:** Should we require email verification before allowing store access?
2. **Cashier Limit:** Is there a maximum number of cashiers per store?
3. **Commission Rate Changes:** How should we handle historical commission rates if they're changed later?
4. **Cashier Deactivation:** Should we soft delete or allow permanent deletion of cashiers?
5. **Manager vs Owner:** Should we differentiate between store owner and manager roles?
6. **Multi-Store Support:** Will a single manager be able to manage multiple stores in the future?
7. **Cashier Reports:** Should individual cashiers have access to their own sales reports?
8. **Audit Trail:** Do we need to track who added/modified cashier information?

---

## 23. Future Enhancements

### 23.1 Potential Features
- Multi-store support for managers
- Advanced cashier permissions
- Individual cashier performance dashboards
- Commission payout tracking
- Cashier shift scheduling
- Biometric login for cashier account
- Store branding customization during signup
- Bulk cashier import via CSV
- SMS notifications for cashiers
- Mobile app for cashier-only access

### 23.2 Technical Improvements
- GraphQL API alternative
- Real-time collaboration on signup
- Progressive web app for offline signup
- AI-powered form auto-completion
- Advanced fraud detection
- Blockchain-based transaction logging

---

## 24. Approval & Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Manager | | | |
| Engineering Lead | | | |
| UI/UX Designer | | | |
| QA Lead | | | |
| Security Officer | | | |
| CTO | | | |

---

## Appendix A: Wireframes

*[Include wireframes for all three pages here]*

---

## Appendix B: API Request/Response Examples

*[Detailed examples of all API calls with sample data]*

---

## Appendix C: Database Schema Diagrams

*[Include ERD showing relationships between tables]*

---

## Appendix D: Error Code Reference

| Code | Message | User Action |
|------|---------|-------------|
| SIGNUP_001 | Email already exists | Use different email or login |
| SIGNUP_002 | Invalid email format | Correct email format |
| SIGNUP_003 | Password too weak | Strengthen password |
| SIGNUP_004 | Store name required | Enter store name |
| SIGNUP_005 | Duplicate phone number | Use unique phone for each cashier |
| SIGNUP_006 | Transaction failed | Retry signup |
| SIGNUP_007 | Invalid commission rate | Enter rate between 0-100 |

---

**Document End**