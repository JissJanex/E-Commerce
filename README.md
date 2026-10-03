# E-Commerce API

Node.js and Express backend for an e-commerce application. The API uses Supabase for authentication and PostgreSQL data, Razorpay for payments, Supabase Storage for product images, and Resend for order-confirmation email.

> This repository currently contains the backend API only. It does not include a frontend, database migration file, or `schema.sql`.

## Features

- Email/password signup and login through Supabase Auth
- Bearer-token authentication and admin authorization
- Product catalog with categories, search, filters, sorting, and pagination
- Product image uploads to Supabase Storage
- Per-user carts with stock checks
- Checkout and order history
- Razorpay order creation and signature-verified webhooks
- Stock deduction after successful payment confirmation
- Purchase-verified product reviews
- Admin order management and basic statistics
- Rate limiting on signup and login
- Cleanup endpoint for stale pending orders
- Order-confirmation email through Resend

## Technology

- **Runtime:** Node.js
- **Framework:** Express 5
- **Database and auth:** [Supabase](https://supabase.com) / PostgreSQL
- **Payments:** [Razorpay](https://razorpay.com)
- **Email:** [Resend](https://resend.com)
- **File uploads:** Multer and Supabase Storage
- **Development server:** Nodemon

## Repository layout

```text
.
├── ecommerce-backend/
│   ├── server.js
│   ├── package.json
│   └── src/
│       ├── config/
│       │   ├── razorpayClient.js
│       │   └── supabaseClient.js
│       ├── middleware/
│       │   ├── authMiddleware.js
│       │   ├── rateLimiter.js
│       │   ├── roleMiddleware.js
│       │   └── uploadMiddleware.js
│       ├── routes/
│       │   ├── addressRoutes.js
│       │   ├── adminRoutes.js
│       │   ├── authRoutes.js
│       │   ├── cartRoutes.js
│       │   ├── categoryRoutes.js
│       │   ├── cronRoutes.js
│       │   ├── orderRoutes.js
│       │   ├── productRoutes.js
│       │   ├── reviewRoutes.js
│       │   ├── userRoutes.js
│       │   └── webHookRoutes.js
│       └── services/
│           └── emailService.js
├── package.json
├── package-lock.json
└── README.md
```

## Requirements

- Node.js 18 or newer
- npm
- A Supabase project with the tables and functions described below
- Razorpay test credentials for payment testing
- A Resend API key if email notifications are enabled

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/JissJanex/E-Commerce.git
cd E-Commerce
```

### 2. Install dependencies

The repository has a root package and a separate backend package:

```bash
npm install
cd ecommerce-backend
npm install
```

The root `package.json` currently has no start or development scripts. Run the application commands from `ecommerce-backend/`.

### 3. Configure environment variables

Create `ecommerce-backend/.env`:

```env
# HTTP server
PORT=5000

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Resend
RESEND_API_KEY=re_xxxxx

# Scheduled cleanup endpoint
CRON_SECRET=use_a_long_random_value
```

The application loads this file through `dotenv`. A safe template is available at [`ecommerce-backend/.env.example`](./ecommerce-backend/.env.example). Copy it and replace every placeholder:

```bash
cp ecommerce-backend/.env.example ecommerce-backend/.env
```

> Never commit `.env`. The Supabase service-role key bypasses Row Level Security and must remain server-side.

### 4. Prepare Supabase

Create the database objects used by the API. The current code expects these tables or relations:

- `profiles`
- `categories`
- `products`
- `product_images`
- `addresses`
- `carts`
- `cart_items`
- `orders`
- `order_items`
- `payments`
- `reviews`

The API also calls these PostgreSQL functions:

- `checkout(p_user_id, p_address_id)`
- `confirm_payment(p_order_id)`
- `cancel_stale_orders(p_hours_old)`

The schema and functions are not included in this repository. Apply your database SQL in the Supabase SQL Editor before using the API. Create a public `product-images` Storage bucket if product image uploads are required.

### 5. Start the server

```bash
cd ecommerce-backend
npm run dev
```

The server uses port `5000` by default, or the value of `PORT`.

Check the health endpoint:

```bash
curl http://localhost:5000/health
```

Expected response:

```json
{ "status": "ok" }
```

## Authentication

Protected endpoints require a Supabase access token:

```http
Authorization: Bearer <access-token>
```

Signup and login are exposed by this API:

```http
POST /api/auth/signup
POST /api/auth/login
```

Signup body:

```json
{
  "name": "Jiss Janex",
  "email": "user@example.com",
  "password": "secret123"
}
```

Login body:

```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

Login returns `access_token`, `refresh_token`, and the Supabase user object. Logout is client-side token removal; this API does not expose a logout route.

## API reference

The base URL in local development is `http://localhost:5000`.

### Auth and users

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/signup` | Public | Create a Supabase user and customer profile |
| `POST` | `/api/auth/login` | Public | Authenticate and return tokens |
| `GET` | `/api/users/me` | Authenticated | Return the current user's profile |

Signup and login are rate-limited.

### Products and categories

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/api/products` | Public | List products |
| `GET` | `/api/products/:id` | Public | Return one product with images, category, and reviews |
| `POST` | `/api/products` | Admin | Create a product |
| `PUT` | `/api/products/:id` | Admin | Update a product |
| `DELETE` | `/api/products/:id` | Admin | Delete a product |
| `POST` | `/api/products/:id/images` | Admin | Upload a product image |
| `GET` | `/api/categories` | Public | List categories |

Product-list query parameters:

| Parameter | Default | Description |
| --- | --- | --- |
| `page` | `1` | Page number |
| `limit` | `12` | Results per page |
| `category_id` | — | Filter by category |
| `min_price` | — | Minimum price |
| `max_price` | — | Maximum price |
| `search` | — | Case-insensitive name search |
| `sort` | `created_at` | Database column to sort by |
| `order` | `desc` | Use `asc` or `desc` |

The list response has this shape:

```json
{
  "products": [],
  "pagination": {
    "total": 0,
    "page": 1,
    "limit": 12,
    "totalPages": 0
  }
}
```

Create-product body:

```json
{
  "name": "Wireless Mouse",
  "description": "Ergonomic mouse",
  "price": 799,
  "stock": 50,
  "category_id": 1
}
```

Images must be sent as `multipart/form-data` using the field name `image`. Only image MIME types are accepted, with a maximum file size of 5 MB.

### Cart and addresses

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/api/cart` | Authenticated | Get or create the current user's cart |
| `POST` | `/api/cart/items` | Authenticated | Add an item or increase its quantity |
| `PUT` | `/api/cart/items/:itemId` | Authenticated | Set an item's quantity |
| `DELETE` | `/api/cart/items/:itemId` | Authenticated | Remove an item |
| `GET` | `/api/addresses` | Authenticated | List the user's addresses |
| `POST` | `/api/addresses` | Authenticated | Create an address |

Add-to-cart body:

```json
{ "product_id": 1, "quantity": 2 }
```

Create-address body:

```json
{
  "line1": "123 MG Road",
  "city": "Kochi",
  "state": "Kerala",
  "zip": "682001",
  "is_default": true
}
```

### Orders and reviews

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/api/orders/checkout` | Authenticated | Create a pending order and Razorpay order |
| `GET` | `/api/orders` | Authenticated | List the current user's orders |
| `GET` | `/api/orders/:id` | Authenticated | Get one of the current user's orders |
| `GET` | `/api/products/:productId/reviews` | Public | List reviews for a product |
| `POST` | `/api/products/:productId/reviews` | Authenticated | Create a review after purchase |

Checkout body:

```json
{ "address_id": 1 }
```

Checkout returns a Razorpay order ID, amount in paise, currency, public key ID, and the internal order ID:

```json
{
  "message": "Order placed, proceed to payment",
  "order_id": 10,
  "razorpay_order_id": "order_example",
  "amount": 24000,
  "currency": "INR",
  "key_id": "rzp_test_xxxxx"
}
```

Review body:

```json
{ "rating": 5, "comment": "Great product!" }
```

Reviews require a paid order containing the product. A user can review a product only once.

### Admin

All admin endpoints require an authenticated user whose `profiles.role` is `admin`.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/admin/orders` | List orders with pagination and optional `status` filter |
| `GET` | `/api/admin/orders/:id` | View an order, address, items, and payment details |
| `PUT` | `/api/admin/orders/:id/status` | Change order status |
| `GET` | `/api/admin/stats` | Return order, revenue, product, user, and low-stock statistics |

Supported order statuses are `pending`, `paid`, `shipped`, `delivered`, and `cancelled`.

Update-status body:

```json
{ "status": "shipped" }
```

Admin order-list query parameters are `page` (default `1`), `limit` (default `20`), and optional `status`.

### Webhooks and scheduled cleanup

| Method | Endpoint | Authentication | Description |
| --- | --- | --- | --- |
| `POST` | `/api/webhooks/razorpay` | Razorpay signature | Process payment events |
| `POST` | `/api/cron/cleanup-stale-orders` | `x-cron-secret` header | Cancel pending orders older than one hour |

For local Razorpay webhook testing:

```bash
ngrok http 5000
```

Configure the public URL ending in `/api/webhooks/razorpay` in the Razorpay Dashboard and set the same webhook secret in `RAZORPAY_WEBHOOK_SECRET`.

The webhook handles `payment.captured` and `payment.failed`. The cleanup request must include:

```http
x-cron-secret: <value of CRON_SECRET>
```

## Checkout and payment flow

1. `POST /api/orders/checkout` validates the cart and calls `checkout`.
2. The API creates a pending Razorpay order and payment record.
3. The client completes payment using Razorpay Checkout.
4. Razorpay sends a signed event to `/api/webhooks/razorpay`.
5. For `payment.captured`, the API verifies the signature, updates the payment, and calls `confirm_payment`.
6. `confirm_payment` is responsible for marking the order paid and deducting stock. The cart is cleared by the database function.
7. A confirmation email is sent after successful confirmation.
8. Pending orders can be cancelled by calling the cleanup endpoint.

Stock is not deducted merely when checkout starts. If payment succeeds but `confirm_payment` cannot complete, the order remains pending and the application logs the failure; refund/compensation handling is not implemented yet.

## Error responses

Most errors use:

```json
{ "error": "Human-readable error message" }
```

Common status codes:

- `400` — Invalid input, invalid webhook signature, or business-rule failure
- `401` — Missing/invalid bearer token or cron secret
- `403` — Authenticated user is not allowed to perform the action
- `404` — Resource not found
- `409` — Duplicate review
- `500` — Server, storage, email, or database error

## Security and production notes

- Keep `SUPABASE_SERVICE_ROLE_KEY`, Razorpay secrets, `RESEND_API_KEY`, and `CRON_SECRET` private.
- Serve the API and webhook endpoint over HTTPS in production.
- Verify Razorpay webhook signatures before changing payment state.
- Use a verified Resend domain instead of the development sender address before production email delivery.
- Restrict CORS before exposing the API publicly; the current server allows all origins.
- Add centralized request validation and error handling before production use.
- Use Razorpay live credentials only after completing the provider's production requirements.

## Current limitations

- No automated tests are implemented. `npm test` is currently a placeholder that exits with an error.
- Database migrations and schema SQL are not included.
- Request validation is partial and is not centralized.
- The root package has dependencies but no application scripts.
- Razorpay payment-success failure handling does not automatically refund the customer.

## License

The backend package currently declares the `ISC` license in `ecommerce-backend/package.json`. Add a repository-level license file if this project will be distributed.
