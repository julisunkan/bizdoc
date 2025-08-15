# Business Document Generator

## Overview

This is a Flask-based Progressive Web Application (PWA) for generating professional business documents including invoices, quotes, and receipts. The application features a dark-themed interface, client management, customizable business settings, and PDF export capabilities with logo and signature support.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- **2025-07-09**: Migration from Replit Agent to standard Replit environment completed
- **2025-07-09**: Enhanced PDF generation with logo and signature support
- **2025-07-09**: Added dynamic layout adjustment for business logos in PDF documents
- **2025-07-09**: Confirmed GBP (British Pound Sterling) currency support available
- **2025-07-09**: Redesigned PDF layout with professional typography and proper number alignment
- **2025-07-09**: Added NGN (Nigerian Naira) currency support with ₦ symbol
- **2025-07-09**: Implemented modern table design with right-aligned numbers and clean styling

## System Architecture

The application follows a traditional Flask web framework architecture with the following key characteristics:

- **Backend Framework**: Flask with SQLAlchemy ORM for database operations
- **Database**: SQLite by default with PostgreSQL support for production
- **Frontend**: Server-side rendered templates with Bootstrap 5 dark theme
- **PWA Features**: Service worker, manifest file, and offline capabilities
- **Document Generation**: Client-side PDF generation using jsPDF library with logo and signature image support

## Key Components

### Backend Structure
- **app.py**: Main Flask application setup with database configuration and initialization
- **main.py**: Application entry point for development server
- **models.py**: SQLAlchemy data models for business settings, clients, documents, and document items
- **routes.py**: Flask route handlers for web pages and API endpoints
- **utils.py**: Utility functions for document number generation and data export/import

### Frontend Structure
- **templates/**: Jinja2 HTML templates with base template and specialized pages
  - **base.html**: Base template with navigation and common layout
  - **index.html**: Homepage with feature showcase
  - **document_generator.html**: Main document creation interface
  - **client_management.html**: Client CRUD operations
  - **business_settings.html**: Business configuration form
- **static/**: Static assets including CSS, JavaScript, PWA files, and icons
  - **css/custom.css**: Custom styling for the application
  - **js/**: JavaScript modules for client-side functionality
  - **manifest.json**: PWA manifest for app installation
  - **sw.js**: Service worker for offline capabilities

### Data Models
- **BusinessSettings**: Stores company information, branding, tax rates, and document prefixes
- **Client**: Customer information including contact details and company data
- **Document**: Main document records with metadata and totals
- **DocumentItem**: Individual line items within documents

## Data Flow

1. **Document Creation Process**:
   - User selects document type (invoice/quote/receipt)
   - System generates sequential document number based on type prefix
   - User selects or creates client information
   - User adds line items with descriptions, quantities, and prices
   - System calculates subtotals, taxes, and final totals
   - Document is saved to database and PDF is generated client-side

2. **Business Configuration**:
   - Admin configures business details, branding, and document settings
   - Settings are stored in BusinessSettings model
   - Currency and tax rate configurations affect all document calculations

3. **Client Management**:
   - CRUD operations for client records
   - Client data is used to populate document recipient information
   - Integration with document generator for seamless workflow

## External Dependencies

### Backend Dependencies
- **Flask**: Web framework
- **Flask-SQLAlchemy**: Database ORM
- **Werkzeug**: WSGI utilities and proxy fix for deployment

### Frontend Dependencies (CDN-based)
- **Bootstrap 5**: UI framework with dark theme
- **Font Awesome**: Icon library
- **jsPDF**: Client-side PDF generation library

### Database Support
- **SQLite**: Default development database
- **PostgreSQL**: Production database support with automatic URL conversion

## Deployment Strategy

The application is designed for easy deployment with the following considerations:

1. **Environment Configuration**:
   - DATABASE_URL environment variable for database connection
   - SESSION_SECRET for Flask session security
   - Automatic PostgreSQL URL format conversion

2. **Database Initialization**:
   - Automatic table creation on application startup
   - Models define schema structure with proper relationships

3. **PWA Deployment**:
   - Service worker enables offline functionality
   - Manifest file allows installation as native app
   - Responsive design works across devices

4. **Static Asset Management**:
   - CDN-based external dependencies reduce bundle size
   - Local static files for custom functionality
   - Efficient caching strategy in service worker

5. **Production Considerations**:
   - ProxyFix middleware for proper header handling behind reverse proxies
   - Database connection pooling with recycle and ping settings
   - Configurable session secrets for security

The application architecture emphasizes simplicity, maintainability, and progressive enhancement, making it suitable for small to medium business document generation needs while providing professional-quality output.