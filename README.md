# ReBites — Surplus Food Marketplace

<p align="center">
  <strong>Making Surplus Food More Valuable.</strong>
</p>

<p align="center">
  A web-based platform that connects food sellers with customers to make surplus food more accessible, affordable, and sustainable.
</p>

---

## About ReBites

**ReBites** is a surplus food marketplace designed to help food businesses reduce food waste by selling their remaining food products at more affordable prices.

The platform connects local food sellers with customers through a digital marketplace where customers can discover available food products, explore stores, and place orders.

ReBites aims to create a more sustainable food ecosystem by reducing food waste while providing economic opportunities for local food businesses.

## Key Features

### Customer
- User registration and authentication.
- Google authentication.
- Browse available food products.
- Search and explore food categories.
- View product and store details.
- Place food orders.
- Manage delivery information.
- Track order status.
- View order history.
- Follow favorite stores.
- Chat functionality.

### Seller
- Seller registration and authentication.
- Store profile management.
- Product management (Create, Read, Update, Delete).
- Manage product prices and stock.
- Schedule upcoming food products.
- Flash Sale management.
- Manage incoming orders.
- View sales information.

### Additional Features
- Email verification with a 6-digit code.
- Role-based access control.
- Location and delivery support.
- Notification system.
- Courier demonstration module.
- Administrative moderation and support features.

*Feature availability may depend on the current implementation and environment configuration.*

## Technology Stack

| Category | Technology |
|---|---|
| Frontend Framework | Next.js |
| UI Library | React |
| Programming Language | TypeScript |
| Styling | Tailwind CSS |
| Backend Services | Next.js Route Handlers |
| Database | PostgreSQL |
| Backend Platform | Supabase |
| Authentication | Supabase Auth |
| File Storage | Supabase Storage |
| Realtime | Supabase Realtime |
| Payment Integration | Xendit |
| Delivery Integration | Biteship |
| Maps | MapLibre GL |
| AI Integration | Google Gemini |

## System Architecture

ReBites uses a web-based architecture consisting of a frontend application, backend API services, database services, and external integrations.

```text
                USERS
          ┌──────┴──────┐
          │             │
       Customer       Seller
          │             │
          └──────┬──────┘
                 │
          NEXT.JS APPLICATION
                 │
        ┌────────┴────────┐
        │                 │
    Frontend          API Routes
        │                 │
        └────────┬────────┘
                 │
             SUPABASE
        ┌────────┼────────┐
        │        │        │
      Auth   PostgreSQL  Storage
        │        │        │
        └────────┼────────┘
                 │
        EXTERNAL SERVICES
        ┌────────┼────────┐
        │        │        │
      Xendit  Biteship  Gemini
```

*This is a simplified conceptual overview. Refer to the system architecture documentation for the complete implementation.*

## Project Structure

The project follows a Next.js App Router structure.

```text
ReBites/
├── app/
│   ├── components/
│   ├── auth/
│   ├── dashboard/
│   ├── home/
│   └── ...
├── hooks/
├── lib/
├── public/
├── docs/
├── supabase/
├── package.json
└── README.md
```

*The structure above is illustrative. Refer to the actual repository for the complete directory structure.*

## Getting Started

Follow these steps to run ReBites locally.

### Prerequisites

Make sure you have installed:

- Node.js
- npm
- Git
- A configured Supabase project

### 1. Clone the Repository

```bash
git clone YOUR_REPOSITORY_URL
```

### 2. Navigate to the Project

```bash
cd ReBites
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env.local` file in the project root.

Refer to `.env.example` for the required environment variable names and configuration.

Never expose private API keys, service role keys, or other sensitive credentials in your repository.

### 5. Run the Development Server

```bash
npm run dev
```

Open your browser and navigate to:

```text
http://localhost:3000
```

### 6. Available Commands

```bash
npm run dev
npm run build
npm run start
npm run lint
```

Check `package.json` for the complete list of available scripts.

## Documentation

Technical documentation and system diagrams are maintained in the `docs/` directory.

| Document | Description |
|---|---|
| System Architecture | Overview of system components and data flow |
| Database Architecture | Database tables and relationships |
| Full Database Schema | Detailed database structure |

## Project Goals

ReBites was developed with the following objectives:

- Reduce food waste through digital solutions.
- Support local food businesses and SMEs.
- Improve access to affordable food.
- Simplify food product and order management.
- Encourage a more sustainable food ecosystem.

## Future Development

Potential areas for future development include:

- Improved order management and automation.
- Enhanced delivery tracking.
- More advanced business analytics.
- Improved mobile experience.
- Additional marketplace capabilities.

## Project Information

| Information | Details |
|---|---|
| Project Name | ReBites |
| Category | Web Development |
| Project Type | Surplus Food Marketplace |
| Competition | GTNIC 2026 |
| Platform | Web Application |
| Primary Users | Customers and Sellers |

## Contributors

Developed as a collaborative project for digital innovation and web development.

## License

This project is developed for educational and innovation purposes. Licensing and usage permissions should follow the repository's designated license.

---

<p align="center">
  <strong>ReBites — Reduce Waste, Create Value.</strong>
</p>
