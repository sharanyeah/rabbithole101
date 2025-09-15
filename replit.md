# Overview

This is a modern hacker-themed search aggregation platform called "RabbitHole" that provides comprehensive learning plan generation and progress tracking. The platform generates structured learning plans for any topic and tracks user progress through daily learning goals. It features a dark, matrix-inspired aesthetic with neon green highlights and uses a monospace font family for an authentic hacker look.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **React 18 with TypeScript**: Modern component-based architecture using functional components and hooks
- **Vite Build Tool**: Fast development server and optimized production builds
- **Wouter Router**: Lightweight client-side routing instead of React Router
- **TanStack Query**: Server state management with caching, background updates, and optimistic updates
- **Shadcn/ui Component Library**: Radix UI primitives with custom theming for consistent, accessible components

## Styling and Design System
- **Tailwind CSS**: Utility-first CSS framework with custom configuration
- **CSS Variables**: Dynamic theming system supporting hacker aesthetic
- **Dark Theme**: Pure black background (#000) with neon green accents (#00FF41)
- **JetBrains Mono**: Monospace font for code/terminal aesthetic
- **Matrix Background**: Animated falling characters effect using HTML5 Canvas

## Backend Architecture
- **Express.js with TypeScript**: RESTful API server with type safety
- **Modular Storage Interface**: Abstracted storage layer supporting both in-memory and database persistence
- **Memory Storage**: Default in-memory implementation for development
- **Database Ready**: Drizzle ORM configuration for PostgreSQL production deployment

## Data Management
- **Drizzle ORM**: Type-safe database queries and migrations
- **PostgreSQL Schema**: Structured tables for users, search history, learning plans, and resources
- **JSON Storage**: Learning plan structure and progress stored as JSONB for flexibility
- **UUID Primary Keys**: Secure, scalable identifier system

## API Architecture
- **Search History Endpoints**: GET/DELETE operations for user search tracking
- **Learning Plan Generation**: POST endpoint integrating with OpenAI for structured plan creation
- **Progress Tracking**: PUT endpoints for updating daily completion status
- **Resource Management**: Endpoints for managing learning resources from external APIs

## External Service Integration
- **OpenAI GPT-5**: AI-powered learning plan generation with structured prompts
- **Python Scripts**: External API integration for Wikipedia, YouTube, Reddit, and Medium
- **API Rate Limiting**: Graceful handling of external service limitations
- **Fallback Systems**: Backup content generation when external APIs fail

## State Management
- **React Query**: Server state caching and synchronization
- **Local Storage Hooks**: Client-side persistence for user preferences and progress
- **Optimistic Updates**: Immediate UI feedback with server synchronization
- **Error Boundaries**: Graceful error handling and user feedback

## Development Environment
- **TypeScript Configuration**: Strict type checking with path mapping
- **ESM Modules**: Modern ES module syntax throughout the codebase
- **Vite Dev Server**: Hot module replacement and fast development builds
- **Replit Integration**: Development banner and cartographer plugin support

# External Dependencies

## Core Framework Dependencies
- **React 18**: Frontend framework with concurrent features
- **Express.js**: Backend web framework
- **TypeScript**: Type safety across frontend and backend
- **Vite**: Build tool and development server

## Database and ORM
- **Drizzle ORM**: Type-safe database toolkit
- **@neondatabase/serverless**: PostgreSQL connection for serverless environments
- **connect-pg-simple**: PostgreSQL session store

## UI and Styling
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Accessible component primitives
- **Shadcn/ui**: Pre-built component library
- **Lucide React**: Icon library
- **class-variance-authority**: Component variant management

## State Management and Data Fetching
- **TanStack React Query**: Server state management
- **React Hook Form**: Form state management
- **Zod**: Runtime type validation

## External APIs and Services
- **OpenAI API**: GPT-5 for learning plan generation
- **Wikipedia REST API**: Educational content aggregation
- **YouTube Data API v3**: Video content integration (requires API key)
- **Reddit JSON API**: Community content access
- **Medium**: Web scraping for article content

## Development and Build Tools
- **ESBuild**: Fast JavaScript bundler for production
- **PostCSS**: CSS processing with Autoprefixer
- **TSX**: TypeScript execution for development
- **Python 3**: External API integration scripts with requests and BeautifulSoup4

## Utilities and Helpers
- **date-fns**: Date manipulation and formatting
- **nanoid**: Unique identifier generation
- **clsx**: Conditional className utility
- **cmdk**: Command palette functionality