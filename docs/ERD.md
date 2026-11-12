# SOON — Entity Relationship Diagram

Source of truth is the Drizzle schema in [`apps/server/src/db/schema`](../apps/server/src/db/schema).
Update this file whenever the schema changes.

**Conventions**
- Money is stored as integer **agorot** (`*_agorot`, 1 ₪ = 100).
- `user` / `session` / `account` / `verification` are owned by Better Auth.
- A **wedding is not a user**. Partners (and later a producer) are linked through `wedding_member`.
- A **lead** points to a registered `wedding` *or* holds contact details for a couple who isn't in the app.
- Booked slots on a vendor's calendar cannot overlap. A Postgres `EXCLUDE` constraint enforces this.

---

## 1. Schema v1: trial scope (built)

```mermaid
erDiagram
    user ||--o{ session : "has"
    user ||--o{ account : "signs in with"
    user ||--o{ wedding_member : "belongs to"
    wedding ||--o{ wedding_member : "has members"
    wedding ||--o{ wedding_category : "tracks"
    category ||--o{ wedding_category : ""
    user ||--o{ vendor : "owns"
    category ||--o{ vendor : "classifies"
    vendor ||--o{ vendor_region : "serves"
    vendor ||--o{ vendor_media : "portfolio"
    vendor ||--o{ vendor_package : "offers"
    vendor ||--o{ vendor_faq : "answers"
    vendor ||--o{ lead : "receives"
    wedding |o--o{ lead : "is the client of"
    vendor ||--o{ availability_entry : "calendar"
    lead |o--o{ availability_entry : "booked as"
    vendor ||--o{ conversation : ""
    wedding ||--o{ conversation : ""
    lead |o--o{ conversation : "context"
    conversation ||--o{ message : "contains"
    user ||--o{ message : "sends"
    wedding ||--o{ saved_vendor : "saves"
    vendor ||--o{ saved_vendor : "saved by"

    user {
        text id PK
        text name
        text email UK
        bool email_verified
        text image
        user_role role "couple | vendor | admin (null until chosen)"
        text phone
        timestamptz created_at
    }
    session {
        text id PK
        text user_id FK
        text token UK
        timestamptz expires_at
    }
    account {
        text id PK
        text user_id FK
        text provider_id "google | apple | ..."
        text account_id
    }
    verification {
        text id PK
        text identifier
        text value
        timestamptz expires_at
    }
    category {
        text slug PK
        text label_he
        int sort_order
        bool active
    }
    wedding {
        uuid id PK
        text partner1_name
        text partner2_name
        date wedding_date
        text region
        text venue_name
        int budget_total_agorot
        text cover_image_url
    }
    wedding_member {
        uuid wedding_id PK, FK
        text user_id PK, FK
        wedding_member_role role "partner | producer"
    }
    wedding_category {
        uuid wedding_id PK, FK
        text category_slug PK, FK
        wedding_category_status status "needed | closed"
    }
    vendor {
        uuid id PK
        text owner_user_id FK
        text business_name
        text slug UK
        text category_slug FK
        vendor_status status "pending | approved | suspended"
        text about
        text phone
        text logo_url
        text cover_url
        int price_from_agorot
        int price_to_agorot
        text cancellation_policy
        bool is_featured
    }
    vendor_region {
        uuid vendor_id PK, FK
        text region PK
    }
    vendor_media {
        uuid id PK
        uuid vendor_id FK
        media_kind kind "image | video"
        text url
        int sort_order
    }
    vendor_package {
        uuid id PK
        uuid vendor_id FK
        text name
        int price_agorot
        text_array includes
    }
    vendor_faq {
        uuid id PK
        uuid vendor_id FK
        text question
        text answer
    }
    lead {
        uuid id PK
        uuid vendor_id FK
        uuid wedding_id FK "nullable, unique per vendor"
        text client_name "for couples not in the app"
        text client_phone
        date event_date
        lead_status status "new > contacted > meeting > proposal > booked > completed | pending | lost | cancelled"
        int quoted_price_agorot
        text next_action
    }
    availability_entry {
        uuid id PK
        uuid vendor_id FK
        availability_status status "available | pending | booked | unavailable"
        timestamptz starts_at
        timestamptz ends_at
        uuid lead_id FK "nullable"
    }
    conversation {
        uuid id PK
        uuid vendor_id FK
        uuid wedding_id FK
        uuid lead_id FK "nullable"
        timestamptz last_message_at
    }
    message {
        uuid id PK
        uuid conversation_id FK
        text sender_user_id FK
        text body
        text attachment_url
        timestamptz read_at
    }
    saved_vendor {
        uuid wedding_id PK, FK
        uuid vendor_id PK, FK
        text saved_by_user_id FK
        text note
    }
```

**Key constraints**

| Table | Constraint | Why |
|---|---|---|
| `lead` | `UNIQUE (vendor_id, wedding_id)` | One lead per couple per vendor. A repeat inquiry reuses it. |
| `lead` | `CHECK (wedding_id IS NOT NULL OR client_name IS NOT NULL)` | A lead must identify a client. |
| `conversation` | `UNIQUE (vendor_id, wedding_id)` | One chat thread per couple–vendor pair. |
| `availability_entry` | `EXCLUDE ... WHERE status = 'booked'` | No double-booking. |
| `vendor` | `CHECK (price_from <= price_to)` | A valid price range. |

---

## 2. Planned entities: after the trial (not built yet)

These come from spec §19. Entities without a field list (`wedding`, `vendor`, `lead`, `category`, `user`) are the v1 tables above. Field lists are indicative.

```mermaid
erDiagram
    wedding ||--o{ task : "checklist (§7.1)"
    wedding ||--o{ budget_item : "budget (§7.2)"
    category |o--o{ budget_item : ""
    vendor |o--o{ budget_item : "SOON or external vendor"
    wedding ||--o{ guest : "guest list (§7.3)"
    wedding ||--o{ calendar_event : "wedding calendar (§7.3)"
    wedding ||--o{ timeline_item : "day-of timeline"
    wedding ||--o{ saved_board : "boards (§6)"
    saved_board ||--o{ saved_item : ""

    lead ||--o{ quote : "proposals"
    lead ||--o{ agreement : "contracts (§12)"
    vendor ||--o{ agreement_template : "templates"
    agreement_template |o--o{ agreement : "generated from"
    lead ||--o{ payment : "payments (§13)"
    agreement |o--o{ payment : ""
    lead ||--o{ document : "files"

    vendor ||--o{ review : "reviews (§17)"
    wedding ||--o{ review : "written by"
    lead |o--o| review : "verified via"

    vendor ||--o{ production : "producer files (§14)"
    production |o--o| wedding : "linked when couple joins"
    production ||--o{ production_vendor : "needed / candidate / negotiating / closed / cancelled"
    vendor |o--o{ production_vendor : "SOON vendor"
    production ||--o{ task : ""
    production ||--o{ budget_item : ""

    vendor ||--o| subscription : "Basic / Pro / Premium (§18)"
    user ||--o{ push_token : "notifications"
    vendor ||--o{ calendar_connection : "Google sync (§11)"

    task {
        uuid id PK
        uuid wedding_id FK "nullable"
        uuid production_id FK "nullable"
        text title
        date due_date
        bool done
    }
    budget_item {
        uuid id PK
        uuid wedding_id FK
        text category_slug FK
        uuid vendor_id FK "nullable"
        int budget_agorot
        int actual_agorot
        int paid_agorot
    }
    guest {
        uuid id PK
        uuid wedding_id FK
        text name
        text side "bride | groom"
        text rsvp_status "invited | confirmed | declined | waiting"
        int party_size
        text table_label
    }
    production {
        uuid id PK
        uuid producer_vendor_id FK
        uuid wedding_id FK "nullable until couple joins"
        text couple_names
        date event_date
        int budget_agorot
    }
    agreement {
        uuid id PK
        uuid lead_id FK
        uuid template_id FK
        text status "draft | sent | signed | cancelled"
        text pdf_url
    }
    payment {
        uuid id PK
        uuid lead_id FK
        int amount_agorot
        date due_date
        timestamptz paid_at "only set on user confirmation"
    }
    review {
        uuid id PK
        uuid vendor_id FK
        uuid wedding_id FK
        int rating
        bool verified
    }
```

> **Design note:** `task` and `budget_item` belong to either a wedding or a production. When a couple joins a producer's production, the production's `wedding_id` is set, and both sides then see the same rows according to their permissions. Nothing is copied (spec §14.3, §20).
