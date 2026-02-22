# Glance

A modern, secure, and beautiful web interface for managing your Samba (SMB) NAS Server. Built with Next.js 15, React, Tailwind CSS, and Framer Motion.

## Features

- **File Manager**: A Google Drive-like interface to browse, view, rename, delete, and organize your files.
  - Interactive file and folder uploads with pause/resume capabilities and progress indicators.
  - Smart conditional uploads that automatically skip transfers if the file already exists on the NAS and is equal/larger in size.
  - Built-in media viewer for images and videos.
  - Drag and drop support.
- **Shares Management**: Easily view, create, edit, and delete Samba shares (`smb.conf`) with a clean UI.
- **Security-First Architecture**: 
  - Token-based JWT Authentication.
  - Strict CSRF protection for all state-changing API routes.
  - Sandboxed path routing to prevent directory traversal attacks.
  - Server-side credential encryption vault.
  - Rate limiting to protect against brute force attacks.
- **Monitoring**: Built-in visual Audit Logger to track user actions across the app.

## Prerequisites

- A Linux server running Samba (`smbd`).
- SSH access enabled (`sshd`) on the server.
- Node.js >= 18.x

## Installation

1. Clone the repository:
```bash
git clone https://github.com/jodave911/glance.git
cd glance
```

2. Install dependencies:
```bash
npm install
```

3. Configure your environment variables:
```bash
cp .env.example .env.local
```

4. Edit `.env.local` to point to your Samba server. You **must** define:
- `SSH_HOST`: The IP address of your Samba server (e.g. `192.168.1.100`).

*(Note: Security keys like `JWT_SECRET` and `VAULT_KEY` will automatically generate securely upon first launch if left empty).*

5. Start the Application:
```bash
npm run build
npm start
```

## Security Notice

The application communicates with your Samba server entirely over SSH. It requires an initial login using valid SSH credentials for the server. Once authenticated, credentials are AES-256-GCM encrypted and stored temporarily in memory/session space to facilitate fast commands without repeatedly asking the user for authorization. It is highly recommended to deploy this behind a reverse proxy (like Nginx or Traefik) enforcing HTTPS/TLS.
