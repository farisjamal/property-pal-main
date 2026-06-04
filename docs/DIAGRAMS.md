# PropertyPal — System Diagrams

Generated from the current schema (`src/integrations/supabase/types.ts`,
`supabase/migrations/`) and app routing (`src/App.tsx`).

> View these in VS Code's built-in Markdown preview (Mermaid supported), or paste
> any block into <https://mermaid.live> to export PNG/SVG.

---

## 1. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    roles ||--o{ users        : "classifies"
    roles ||--o{ user_roles   : "assigned via"
    users ||--o{ user_roles   : "has"
    users ||--o| admin         : "profile"
    users ||--o| property_owner : "profile"
    users ||--o| tenant         : "profile"

    property_owner ||--o{ property    : "owns"
    property_owner ||--o{ appointment : "receives"
    property       ||--o{ appointment : "booked for"
    property       ||--o{ favorites   : "saved as"
    tenant         ||--o{ appointment : "requests"
    tenant         ||--o{ favorites   : "saves"

    roles {
        int    role_id PK
        string role
        ts     created_at
    }
    users {
        uuid   user_id PK "= auth.users.id"
        string email
        int    role_id FK
        ts     created_at
        ts     updated_at
    }
    user_roles {
        uuid id PK
        uuid user_id FK
        int  role_id FK
    }
    admin {
        int    admin_id PK
        uuid   user_id FK "unique"
        string name
        string email
        string contact_no "encrypted"
        string ic_no
        string gender
        date   date_of_birth
        int    age
    }
    property_owner {
        int    owner_id PK
        uuid   user_id FK "unique"
        string name
        string email
        string contact_no "encrypted"
        string ic_no
        string gender
        date   date_of_birth
        int    age
    }
    tenant {
        int    tenant_id PK
        uuid   user_id FK "unique"
        string name
        string email
        string contact_no "encrypted"
        string ic_no
        string gender
        date   date_of_birth
        int    age
    }
    property {
        int      property_id PK
        int      owner_id FK
        string   property_type
        string   location
        numeric  rental_price
        int      num_bedroom
        int      num_bathroom
        numeric  property_size
        string   description
        string[] images
        string   availability_status "Available/Rented"
        ts       created_at
    }
    appointment {
        int    appointment_id PK
        int    tenant_id FK
        int    owner_id FK
        int    property_id FK
        date   appointment_date
        time   appointment_time
        string status "Pending/Approved/Rejected"
        ts     created_at
    }
    favorites {
        uuid id PK
        int  tenant_id FK
        int  property_id FK
        ts   created_at
    }
    notifications {
        int    notification_id PK
        string recipient_email
        string recipient_type
        string type
        string subject
        string status
        ts     sent_at
    }
    audit_log {
        uuid   log_id PK
        uuid   user_id FK
        string action_type
        string resource_type
        string resource_id
        string status
        string severity
        json   metadata
        ts     timestamp
    }
    rate_limits {
        uuid   id PK
        string key
        string action
        int    attempts
        ts     window_start
    }
```

`notifications`, `audit_log`, and `rate_limits` are operational tables with no hard
FKs to the domain entities. Each role profile (`admin` / `property_owner` /
`tenant`) is a 1:1 extension of a `users` record.

---

## 2. Home (Landing Page) Flowchart

```mermaid
flowchart TD
    A([Visitor opens site /]) --> B[Landing Page: Navbar, Hero,<br/>Featured Properties, Features, CTA]
    B --> C{Action?}
    C -->|Browse featured| D[View Featured Properties]
    D --> C
    C -->|Open chatbot| E[PropertyPal Chatbot:<br/>ask about properties]
    E --> C
    C -->|Sign In / Get Started| F[/Navigate to /auth/]
    F --> G{Has account?}
    G -->|Yes| H[Login tab]
    G -->|No| I[Create Account tab]
    H --> J{Authenticated?}
    I --> J
    J -->|No| F
    J -->|Yes, by role_id| K{Role}
    K -->|1 Admin| L[/admin dashboard/]
    K -->|2 Owner| M[/owner dashboard/]
    K -->|3 Tenant| N[/tenant dashboard/]
```

---

## 3. User (Tenant) Flowchart

```mermaid
flowchart TD
    A([Tenant logs in]) --> B{role_id = 3?<br/>ProtectedRoute}
    B -->|No| X[Redirect / blocked]
    B -->|Yes| C[Tenant Dashboard]
    C --> D{Choose action}

    D -->|Browse Properties| E[Tenant Properties:<br/>view Available listings]
    E --> F{Interested?}
    F -->|Save| G[Add to Favorites]
    F -->|Book viewing| H[Create Appointment<br/>date + time, status=Pending]
    H --> I[Notification + email<br/>sent to owner]
    G --> E

    D -->|My Appointments| J[Tenant Appointments]
    J --> K{Manage}
    K -->|View status| L[See Pending/Approved/Rejected]
    K -->|Cancel| M[Delete appointment]

    D -->|Profile| N[Tenant Profile:<br/>view/edit personal info]
    D -->|Logout| Z([Sign out])
```

---

## 4. Property Owner Flowchart

```mermaid
flowchart TD
    A([Owner logs in]) --> B{role_id = 2?<br/>ProtectedRoute}
    B -->|No| X[Redirect / blocked]
    B -->|Yes| C[Owner Dashboard:<br/>stats, summary]
    C --> D{Choose action}

    D -->|My Properties| E[Owner Properties]
    E --> F{Manage listings}
    F -->|Add| G[Create property<br/>type, location, price, images]
    F -->|Edit| H[Update property details]
    F -->|Toggle status| I[Set Available / Rented]
    F -->|Delete| J[Remove property]

    D -->|Appointments| K[Owner Appointments:<br/>requests for my properties]
    K --> L{Review request}
    L -->|Approve| M[status = Approved]
    L -->|Reject| N[status = Rejected]
    M --> O[Email notification<br/>sent to tenant]
    N --> O

    D -->|Profile| P[Owner Profile:<br/>view/edit info]
    D -->|Logout| Z([Sign out])
```

---

## 5. Admin Flowchart

```mermaid
flowchart TD
    A([Admin logs in]) --> B{role_id = 1?<br/>ProtectedRoute}
    B -->|No| X[Redirect / blocked]
    B -->|Yes| C[Admin Dashboard:<br/>platform-wide stats]
    C --> D{Choose action}

    D -->|Manage Users| E[Admin Users]
    E --> F{Action}
    F -->|View all users| G[List tenants & owners]
    F -->|Edit / update| H[Modify user record]
    F -->|Delete| I[Remove user]

    D -->|Property Owners| J[Admin Property Owners:<br/>view & manage owners + properties]

    D -->|Reports| K[Admin Reports:<br/>analytics, audit log review]
    K --> L[View audit_log:<br/>logins, changes, denied access]

    D -->|Logout| Z([Sign out])
```
