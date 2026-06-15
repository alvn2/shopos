# ShopOS 🚀

ShopOS is a next-generation, multi-tenant inventory management system designed for auto parts shops (StepMotors & CarWorld Auto). It features an offline-first architecture, a modern glassmorphism UI, and a robust PostgreSQL backend.

## ✨ Features

- **🏢 Multi-Tenant Architecture:** Securely isolates data between different shops (e.g., StepMotors and CarWorld Auto) within the same application instance.
- **🔌 Offline-First Sync:** Continues to work without an internet connection using IndexedDB, automatically syncing changes (sales, inventory updates) back to the server when connection is restored.
- **💱 Dynamic Cost Calculator:** Built-in AED to KES currency converter with adjustable freight and markup percentages to instantly calculate Landed Costs.
- **🔒 Secure Authentication:** Features robust session management, role-based access control (Admin vs Worker), and Brute-force protection.
- **📱 Responsive & Modern UI:** A highly polished, responsive interface utilizing Tailwind CSS with sleek glassmorphism effects and smooth animations.
- **📊 Comprehensive Reporting:** Tracks inventory health, batch sales, and maintains an immutable audit log of all system actions.

## 🛠 Tech Stack

### Frontend
- **Framework:** React 18 (Vite)
- **Styling:** Tailwind CSS (Modern Glassmorphism)
- **Icons:** Lucide React
- **Routing:** React Router v6
- **Offline Storage:** IndexedDB (`idb`)

### Backend
- **Server:** Node.js with Express
- **Database:** PostgreSQL (Hosted on Neon DB)
- **ORM:** Prisma
- **Security:** bcryptjs (password hashing), Helmet, CORS
- **Session:** Custom Session Store

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL Database URL (Neon DB recommended)

### Installation

1. **Clone the repository:**
   ```bash
   git clone git@github.com:alvn2/shopos.git
   cd shopos
   ```

2. **Install Frontend Dependencies:**
   ```bash
   npm install
   ```

3. **Install Backend Dependencies:**
   ```bash
   cd server
   npm install
   ```

### Configuration

1. **Environment Variables (Backend):**
   Create a `.env` file in the `server/` directory:
   ```env
   PORT=5000
   DATABASE_URL="postgresql://user:password@host/db?sslmode=require"
   DIRECT_URL="postgresql://user:password@host/db?sslmode=require" # For Prisma Migrations
   PRISMA_CLIENT_ENGINE_TYPE="library"
   ```

2. **Environment Variables (Frontend):**
   Create a `.env` file in the root directory:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

### Database Setup

Run the following commands inside the `server/` directory to push the schema and generate the client:

```bash
npx prisma db push
npx prisma generate
```

*(Optional)* Run the seed script to create default admin accounts:
```bash
node seed.js
```

### Running the App

1. **Start the Backend:**
   ```bash
   cd server
   npm run dev
   ```

2. **Start the Frontend:**
   In a new terminal:
   ```bash
   npm run dev
   ```

## 🔐 Default Credentials

Default admin accounts are provisioned via `seed.js`:

- **Shop:** StepMotors
  - **Username:** `admin`
  - **Password:** `admin`

- **Shop:** CarWorld
  - **Username:** `admin`
  - **Password:** `admin`

## 📝 License

This project is proprietary and confidential. Unauthorized copying of this file, via any medium, is strictly prohibited.
