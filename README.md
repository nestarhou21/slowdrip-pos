# ZenHouse POS & Portfolio

A modern, high-performance monorepo for ZenHouse, featuring a Matcha Café POS system, an Ordering Portal, and a Brand Portfolio website.

## Project Structure

This project is a Turborepo monorepo with the following applications:

- **apps/admin**: ZenHouse POS & Admin Management Portal.
- **apps/web**: ZenHouse Brand Portfolio & Marketing Website.

Shared packages are located in the `packages/` directory:

- **packages/ui**: Shared UI components built with shadcn/ui and Tailwind CSS.
- **packages/store**: Shared global state and data structures with localStorage synchronization.
- **packages/config-typescript**: Shared TypeScript configurations.
- **packages/config-tailwind**: Shared Tailwind CSS configurations.

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm

### Installation

1. Clone the repository:
   ```sh
   git clone <YOUR_GIT_URL>
   ```

2. Install dependencies:
   ```sh
   npm install
   ```

3. Start the development server:
   ```sh
   npm run dev
   ```

This will start all applications in parallel using Turbo.

### Development Ports

- **Admin Portal**: http://localhost:8080
- **Web Portfolio**: http://localhost:8082

## Technologies Used

- **Monorepo Management**: Turborepo
- **Build Tool**: Vite
- **Language**: TypeScript
- **Frontend Framework**: React
- **Styling**: Tailwind CSS / shadcn-ui
- **State Management**: useSyncExternalStore (Shared Store)

## Deployment

To build all applications for production:

```sh
npm run build
```

The production assets will be available in the `dist` directory of each application.
