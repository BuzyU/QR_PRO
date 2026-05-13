# QR PRO - Hall Ticket Generator & Verifier

QR PRO is a comprehensive web-based application designed to streamline the process of generating, distributing, and verifying hall tickets or event passes. By allowing users to upload participant data in bulk (via CSV or Excel), configure event details, and automatically generate professional PDF tickets with embedded verifiable QR codes, QR PRO eliminates manual ticket creation and enhances security.

## Core Features

- **Bulk Data Upload**: Upload participant data seamlessly using CSV or Excel files.
- **Dynamic Data Mapping**: Intuitively map columns from your uploaded spreadsheet (e.g., Student Name, URN) to the required ticket fields.
- **Batch Processing**: Automatically split large participant lists into manageable batches with assigned time slots to ensure organized entry.
- **Automated PDF Generation**: Generate high-quality PDF hall tickets containing the institution's name, event details, participant information, and a unique QR code.
- **Google Forms Integration**: Headless automation via webhooks. Automatically generate tickets and queue email delivery the moment a participant submits a Google Form.
- **Automated Email Delivery**: Send beautifully designed, customizable HTML emails with embedded QR codes directly to attendees using Gmail OAuth or Resend.
- **ZIP Export**: Bundle all generated PDF tickets into a single ZIP file for easy downloading and distribution.
- **Real-time QR Verification**: Each generated ticket includes a unique QR code linked to a centralized database. Scanning the QR code opens a verification portal that authenticates the ticket in real-time, preventing fraud and fabricated tickets.

## Tech Stack

- **Frontend**: HTML5, CSS3 (Vanilla), JavaScript (ES Modules)
- **Bundler / Build Tool**: Vite
- **Libraries**:
  - `jspdf`: For rendering and generating PDF documents.
  - `jszip`: For creating the final downloadable ZIP bundle of all PDFs.
  - `qrcode`: For generating the unique verification QR codes.
  - `xlsx`: For parsing uploaded Excel and CSV files.
  - `file-saver`: For triggering the client-side download of the final ZIP file.
- **Backend / Database**: Supabase (PostgreSQL) for storing ticket records and handling real-time verification.

## Project Structure

- `/index.html`: The main entry point for the hall ticket generator application.
- `/verify.html`: The verification portal accessed when a ticket's QR code is scanned.
- `/js/`: Contains all JavaScript modules.
  - `/js/app.js`: Application router and state management.
  - `/js/pages/`: Page-specific logic (`landing.js`, `details.js`, `generator.js`, `download.js`).
  - `/js/utils/`: Utility functions for file parsing, PDF generation, QR generation, and ZIP building.
  - `/js/supabase.js`: Supabase client initialization.
  - `/js/verify.js`: Logic for the ticket verification portal.
- `/css/`: Stylesheets for the application's user interface.
- `setup.sql`: Database schema definition for the Supabase PostgreSQL database.
- `package.json` & `vite.config.js`: Project configuration and dependencies.

## Setup and Installation

Follow these steps to run the project locally.

### Prerequisites
- Node.js (v16 or higher recommended)
- A Supabase account

### 1. Clone and Install Dependencies
Navigate to the project directory and install the necessary npm packages:
```bash
npm install
```

### 2. Database Setup
1. Log in to your Supabase dashboard and create a new project.
2. Navigate to the SQL Editor in your Supabase dashboard.
3. Open the `setup.sql` file provided in this repository.
4. Copy the contents and execute them in the SQL Editor to create the necessary `students` table and configure Row Level Security (RLS) policies.

### 3. Environment Configuration
Create a `.env` file in the root of the project to store your Supabase credentials. Do not commit this file to version control.
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Run the Development Server
Start the local Vite development server:
```bash
npm run dev
```
The application will typically be accessible at `http://localhost:5173`.

## Usage Guide

### Manual Upload Flow
1. **Upload Data**: Start by uploading a `.csv` or `.xlsx` file containing the list of participants.
2. **Configure Details**: Enter the Institution Name, Event Name, and Year. Map the columns from your uploaded file to the 'Name' and 'URN' (Unique Roll Number or ID) fields.
3. **Configure Batches**: Specify the number of batches you want to divide the participants into, and assign a time slot for each batch.
4. **Generate**: The system will securely log the ticket records to the Supabase database and generate the PDF tickets with embedded QR codes.
5. **Download**: Once processing is complete, download the consolidated ZIP file containing all the individual PDF tickets.

### Google Forms Integration (Automated Flow)
1. **Create Event**: Create an event in the QR PRO dashboard.
2. **Column Mapping**: Define your custom fields (e.g., "Phone Number") and map the Google Form question titles to the required fields.
3. **Email Configuration**: Connect your Gmail account via OAuth or use Resend to enable automated ticket delivery.
4. **Install Apps Script**: Navigate to the Integrations tab, copy the auto-generated Google Apps Script, and paste it into your Google Form's Script Editor.
5. **Set Trigger**: Set an "On form submit" trigger in Google Apps Script. 
6. Whenever an attendee fills out the form, QR PRO will automatically intercept the webhook, generate the ticket, and email it to them instantly.

### Verification
- **Verify**: When attendees present their tickets, scan the QR code using any standard smartphone camera. It will direct you to the `/verify.html` portal, which will query the database and display a "Verified" or "Invalid" status.

## License

This project is open-source and available under the [MIT License](LICENSE).
