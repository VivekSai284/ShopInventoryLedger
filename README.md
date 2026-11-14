# Shop Inventory Ledger

A full-stack inventory management application built with the MERN stack. It helps small shops manage products, track stock movements, monitor low-stock products, and maintain an auditable inventory ledger.

## Features

### Product management
- Create, view, update, archive, and restore products.
- Store SKU, product name, category, unit, selling price, and low-stock threshold.
- Search and filter products with pagination.
- Archived products are retained instead of permanently deleted.

### Stock management
- Record purchases, sales, returns, and stock adjustments.
- Store quantity, reason, reference, date, and the user responsible for each movement.
- View current stock and product movement history.
- Calculate stock from ledger movements instead of allowing users to edit stock directly.
- Link returns to their original sales and prevent returns from exceeding the remaining returnable quantity.

### Low-stock monitoring and reports
- Identify low-stock and out-of-stock products.
- View inventory summaries and movement reports.
- Filter and paginate report data.
- Export the currently displayed inventory report page as CSV.

### Authentication and authorization
- JWT-based authentication.
- Password hashing.
- Two roles: Owner and Staff.
- Owner can manage products, purchases, adjustments, and reports.
- Staff can view products and stock and record sales and returns.
- Role permissions are enforced by the backend API.

## Technology stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, React Router, Axios |
| Backend | Node.js, Express |
| Database | MongoDB, Mongoose |
| Authentication | JWT, bcrypt |
| Validation | Zod |
| Security | Helmet, CORS configuration, express-rate-limit |
| Testing | Jest, Supertest, mongodb-memory-server |

## Architecture

The application uses a React frontend, an Express REST API, and MongoDB for persistent storage.

```text
React Frontend
      |
      | HTTP requests / JWT
      v
Express REST API
      |
      +---- Authentication and authorization
      |
      +---- Request validation
      |
      +---- Controllers and services
      |
      +---- MongoDB transactions
                    |
                    v
                 MongoDB
          Users / Products /
          Stock Movements
```

The frontend does not calculate or directly modify authoritative stock balances. The backend validates and records stock movements, and the ledger is the source of truth.

## Project structure

```text
ShopInventoryLedger/
|
+-- backend/
|   +-- scripts/
|   |   +-- seed.js
|   +-- src/
|   |   +-- config/
|   |   +-- controllers/
|   |   +-- middleware/
|   |   +-- models/
|   |   +-- routes/
|   |   +-- services/
|   |   +-- utils/
|   |   +-- validators/
|   |   +-- app.js
|   |   +-- server.js
|   +-- tests/
|   +-- .env.example
|   +-- package.json
|
+-- frontend/
|   +-- src/
|   |   +-- api/
|   |   +-- components/
|   |   +-- context/
|   |   +-- layouts/
|   |   +-- pages/
|   |   +-- routes/
|   +-- .env.example
|   +-- package.json
|
+-- .gitignore
+-- README.md
```

## Prerequisites

Install the following before running the project:

- Node.js and npm
- MongoDB Atlas or a local MongoDB replica set
- Git
- A modern web browser

**Important:** Stock movements use MongoDB transactions. Use MongoDB Atlas or a local MongoDB deployment configured as a replica set. A standalone MongoDB server does not support the transactions required by this application.

## Local setup

Clone the repository:

```bash
git clone https://github.com/VivekSai284/ShopInventoryLedger.git
cd ShopInventoryLedger
```

### 1. Configure the backend

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Open `backend/.env` and configure the values:

```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/shop_inventory_ledger
FRONTEND_URL=http://localhost:5173
JWT_SECRET=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
JWT_EXPIRES_IN=1d

OWNER_NAME=Shop Owner
OWNER_EMAIL=owner@example.com
OWNER_PASSWORD=YOUR_OWNER_PASSWORD

STAFF_NAME=Shop Staff
STAFF_EMAIL=staff@example.com
STAFF_PASSWORD=YOUR_STAFF_PASSWORD
```

For MongoDB Atlas, replace `MONGO_URI` with your Atlas connection string and use the database name `shop_inventory_ledger`.

Never commit the real `.env` file or share production credentials.

### 2. Seed the database

From the `backend` directory:

```bash
npm run seed
```

The seed script creates the configured Owner and Staff accounts and sample inventory data. It is designed to be safe to run again without creating duplicate demo records.

Use the credentials configured in your backend `.env` file to sign in.

### 3. Start the backend

```bash
npm start
```

The API runs at:

```text
http://localhost:5000
```

For development, use:

```bash
npm run dev
```

### 4. Configure and start the frontend

Open a second terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
```

Configure `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

Start the frontend:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

## Demo login instructions

The seed script creates two accounts using the backend environment variables.

| Role | Email setting | Password setting |
|---|---|---|
| Owner | `OWNER_EMAIL` | `OWNER_PASSWORD` |
| Staff | `STAFF_EMAIL` | `STAFF_PASSWORD` |

For a local demo, configure these values in `backend/.env`, run the seed script, and sign in with those credentials.

For an online demonstration, configure dedicated demo accounts in the designated demo environment. Do not publish production passwords or database credentials in this README.

## Data models

### User
Stores account and authorization information:
- Name
- Email
- Hashed password
- Role: Owner or Staff

### Product
Stores product information:
- SKU
- Name
- Category
- Unit
- Selling price
- Low-stock threshold
- Archived status
- Internal stock version used for transaction coordination

### StockMovement
Stores the inventory ledger:
- Product reference
- Movement type
- Quantity
- Reason
- Reference information
- User who performed the movement
- Original sale reference for returns
- Timestamp

Stock movements are retained as the historical record. The application does not rely on a manually editable stock quantity field.

## Stock calculation rules

Current stock is calculated from stock movements:

```text
Current Stock =
Purchases
+ Valid Returns
+ Positive Adjustments
- Sales
- Negative Adjustments
```

The exact movement direction is stored and validated by the backend.

- Purchase increases stock.
- Sale decreases stock.
- A valid return increases stock.
- An adjustment records a stock correction with a reason.

A product's stock is never directly edited through the product form.

## Transaction and concurrency design

Stock-changing operations are handled by a backend service using MongoDB transactions.

The service coordinates stock updates through a product-level write lock/version update and records the corresponding movement within the transaction.

This is important when two users try to sell the final available item at the same time. The operations are serialized through the product write, and the stock balance is checked before a movement is committed. An operation that would make stock negative is rejected.

Returns are linked to their original sale. The backend checks the remaining returnable quantity so that the total quantity returned cannot exceed the original sale quantity.

## Authentication and authorization

The backend verifies JWT tokens and identifies the authenticated user.

Authorization is enforced on protected API routes, not just by hiding frontend buttons.

| Action | Owner | Staff |
|---|---:|---:|
| View products and stock | Yes | Yes |
| Create and update products | Yes | No |
| Archive and restore products | Yes | No |
| Record purchases | Yes | No |
| Record sales | Yes | Yes |
| Record returns | Yes | Yes |
| Record adjustments | Yes | No |
| View reports | Yes | No |

The backend validates request data using Zod before processing business operations.

## API overview

Base URL:

```text
/api
```

### Authentication
Authentication routes are registered under:

```text
/api/auth
```

### Products

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/products` | Owner, Staff |
| GET | `/api/products/:id` | Owner, Staff |
| POST | `/api/products` | Owner |
| PATCH | `/api/products/:id` | Owner |
| PATCH | `/api/products/:id/archive` | Owner |
| PATCH | `/api/products/:id/restore` | Owner |

### Stock movements

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/stock/:id/stock` | Owner, Staff |
| GET | `/api/stock/:id/history` | Owner, Staff |
| GET | `/api/stock/:id/returnable-sales` | Owner, Staff |
| POST | `/api/stock/purchases` | Owner |
| POST | `/api/stock/sales` | Owner, Staff |
| POST | `/api/stock/returns` | Owner, Staff |
| POST | `/api/stock/adjustments` | Owner |

### Reports

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/reports/summary` | Owner |
| GET | `/api/reports/inventory` | Owner |
| GET | `/api/reports/movements` | Owner |

All protected endpoints require a valid authentication token. Request bodies and query parameters are validated by the backend.

## Automated tests

The backend test suite uses Jest, Supertest, and an in-memory MongoDB replica set.

Run the tests:

```bash
cd backend
npm test
```

The tests cover important backend behavior, including:

- Authentication and authorization
- Product creation, validation, updates, and archival
- Purchases and sales
- Rejection of sales that exceed available stock
- Returns and return quantity limits
- Stock adjustments
- Concurrent stock-changing operations
- Report access and role restrictions

The tests use a separate test database and should never run against production data.

## Environment variables

The backend and frontend have separate environment example files.

- `backend/.env.example` documents backend configuration.
- `frontend/.env.example` documents the frontend API URL.

Copy each example file to `.env` in its respective folder and supply local values.

The backend settings include the database URI, JWT configuration, frontend origin, server port, and Owner/Staff seed account settings.

The frontend only needs the public API base URL. Never put database credentials or JWT signing secrets in frontend environment variables.

## Deployment

The backend has been deployed on Render:

```text
https://shop-inventory-ledger-api.onrender.com
```

The frontend should be deployed as a static site with:

```text
Root directory: frontend
Build command: npm ci && npm run build
Publish directory: dist
```

Configure the frontend environment variable:

```env
VITE_API_URL=https://shop-inventory-ledger-api.onrender.com/api
```

Configure the backend `FRONTEND_URL` with the actual deployed frontend origin.

**Live frontend:** Add the final public frontend URL here after deployment.

## Known limitations and unfinished work

- Supplier management and purchase orders are not implemented.
- CSV export currently exports the displayed report page rather than the entire filtered dataset.
- Inventory valuation uses current stock multiplied by selling price; it is not a purchase-cost or profit calculation.
- The application does not currently store detailed monetary transaction values for calculating sales revenue or purchase costs.
- Production demo accounts and access should be configured separately from local development credentials.
- Mobile layouts should be checked on common phone screen sizes before final submission.

## Future improvements

- Add supplier records and purchase orders.
- Add purchase-order receiving workflows that create stock movements.
- Support complete filtered CSV exports.
- Add purchase-cost tracking and more detailed financial reports.
- Add more extensive audit logging and operational monitoring.
- Improve mobile usability and accessibility.
- Add deployment and integration checks to CI.

## AI tools used

ChatGPT was used as a development assistant during this project for:

- Breaking down the assignment into implementation phases.
- Explaining backend architecture, validation, authentication, and authorization.
- Helping reason through inventory ledger design and MongoDB transaction handling.
- Debugging implementation and test failures.
- Planning automated tests and reviewing edge cases.
- Improving project documentation and preparing the demonstration.

The application was implemented and tested as a project. AI assistance does not replace understanding the code: the developer should be able to explain the design, implementation, and testing decisions.

## License

This project was developed as an inventory management assignment. Add a license if the project is intended for reuse or distribution.