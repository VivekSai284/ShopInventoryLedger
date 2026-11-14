# Shop Inventory Ledger

A full-stack MERN application for managing shop inventory through a movement-based stock ledger.

## Features

- JWT authentication
- Owner and Staff role-based authorization
- Product creation, editing, archiving and restoration
- Purchase, sale, return and stock adjustment records
- Stock calculated from ledger movements
- Protection against negative stock
- Return validation against original sales
- Low-stock and out-of-stock tracking
- Product movement history
- Inventory and movement reports
- Automated backend tests

## Technology Stack

**Frontend:** React, Vite, Axios, React Router  
**Backend:** Node.js, Express.js  
**Database:** MongoDB, Mongoose  
**Authentication:** JWT  
**Validation:** Zod  
**Testing:** Jest, Supertest, MongoDB Memory Server

## Project Structure

- `backend/` - Express API, models, controllers, services and tests
- `frontend/` - React application
- `backend/scripts/seed.js` - Initial user and sample data seeding

## Prerequisites

- Node.js and npm
- MongoDB Atlas or a local MongoDB replica set
- Git

MongoDB transactions require a replica set or sharded cluster.

## Backend Setup

```bash
cd backend
npm install
```

Copy backend/.env.example to backend/.env and configure:
- NODE_ENV
- PORT
- MONGO_URI
- FRONTEND_URL
- JWT_SECRET
- JWT_EXPIRES_IN
- OWNER_NAME, OWNER_EMAIL, OWNER_PASSWORD
- STAFF_NAME, STAFF_EMAIL, STAFF_PASSWORD
Use strong, unique passwords and a random JWT secret of at least 32 characters.

Seed the initial users and sample products:
npm run seed


Start the backend:
npm run dev


The default API address is http://localhost:5000/api.
Frontend Setup
Open another terminal:
cd frontend
npm install


Copy frontend/.env.example to frontend/.env.

Configure VITE_API_URL:
VITE_API_URL=http://localhost:5000/api


Start the frontend:
npm run dev


User Roles
Feature    Owner    Staff
View products and stock    Yes    Yes
Create and update products    Yes    No
Archive and restore products    Yes    No
Record purchases    Yes    No
Record sales    Yes    Yes
Record returns    Yes    Yes
Stock adjustments    Yes    No
View reports    Yes    No

Authorization is enforced on the backend.
Main API Endpoints
Authentication
- POST /api/auth/login
Products
- GET /api/products
- GET /api/products/:id
- POST /api/products
- PATCH /api/products/:id
- PATCH /api/products/:id/archive
- PATCH /api/products/:id/restore
Stock
- GET /api/stock/:id/stock
- GET /api/stock/:id/history
- GET /api/stock/:id/returnable-sales
- POST /api/stock/purchases
- POST /api/stock/sales
- POST /api/stock/returns
- POST /api/stock/adjustments
Reports
- GET /api/reports/summary
- GET /api/reports/inventory
- GET /api/reports/movements
Protected endpoints require a JWT bearer token in the Authorization header.
Stock Ledger Design
Stock is calculated from recorded stock movements rather than stored as an independently editable quantity.

Purchases and saleable returns increase stock. Sales decrease stock. Adjustments record authorized corrections.

Returns are linked to their original sales and validated against the remaining returnable quantity.
Testing
Run backend tests:
cd backend
npm test


Build the frontend:
cd frontend
npm run build


Notes and Limitations
- Inventory valuation uses current stock multiplied by the product selling price.
- Movement quantities are tracked, but monetary sales and purchase transaction totals are not stored.
- CSV export currently exports the displayed inventory or movement page.
- Production deployment requires correctly configured environment variables and MongoDB transaction support.
License
This project was developed for educational and portfolio purposes.
