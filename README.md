# IDP Provider (OIDC Service)

A lightweight, customizable Identity Provider (IDP) built with **Bun** and **ElysiaJS**. This service implements standard OpenID Connect (OIDC) protocols to handle user authentication, registration, and token management.

## Features

-   **Protocols:** OIDC (Identity) & OAuth 2.0 (Access).
-   **Flows:**
    -   Authorization Code Flow (for Frontends).
    -   Refresh Token Flow (for long-lived sessions).
-   **Security:**
    -   RS256 Token Signing (Asymmetric Keys).
    -   JWKS Endpoint for stateless validation.
    -   Argon2 Password Hashing.
    -   Secure Session Cookies (HttpOnly, SameSite).
    -   Open Redirect Protection.
-   **Database:** PostgreSQL (Production) / SQLite (Dev).
-   **Deployment:** Docker & Docker Compose ready.


## Tech Stack

- **Runtime**: Bun
- **Framework**: ElysiaJS
- **Database**: PostgreSQL / TypeORM
- **Auth Standards**: OIDC, OAuth2.0, JWT (JOSE)
- **Utilities**: Swagger, Argon2

## Quick Start

### 1. Prerequisites
-   [Bun](https://bun.sh/) (Runtime)
-   Docker & Docker Compose

### 2. Run with Docker (Recommended)
This sets up the IDP and a PostgreSQL database automatically.

```bash
docker-compose up --build
```

Access the IDP at: `http://localhost:5000`

### 3. Run Locally (Development)
If you prefer running without Docker (using SQLite by default):

1.  **Install Dependencies:**
    ```bash
    bun install
    ```
2.  **Generate Keys:**
    Ensure `src/config/private.pem` and `public.pem` exist. If not:
    ```bash
    mkdir -p src/config
    openssl genrsa -out src/config/private.pem 2048
    openssl rsa -in src/config/private.pem -pubout -out src/config/public.pem
    ```
3.  **Start Server:**
    ```bash
    bun run src/index.ts
    ```


## Configuration

Configuration is handled via `src/config/index.ts` and `docker-compose.yml` using `.env`.

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | Server port. |
| `OIDC_ISSUER` | `http://localhost:5000/oidc` | The issuer URL in tokens. |
| `DB_HOST` | `db` | Database hostname (use `localhost` for local dev). |

## Testing

Run the comprehensive test suite to verify OIDC flows and security:

```bash
bun test tests/oidc.test.ts
```

## Architecture

*   **Frontends:** Redirect users to `/oidc/authorize`.
*   **IDP:** Handles Login -> Issues `auth_code`.
*   **Frontends:** Exchange `auth_code` for `access_token` & `id_token`.
*   **APIs:** Validate `access_token` locally using the IDP's Public Key (JWKS).


## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/oidc/authorize` | Starts login flow. Redirects to Login UI if needed. |
| `POST` | `/oidc/token` | Exchanges Code for Tokens or Refreshes Tokens. |
| `GET` | `/oidc/userinfo` | Returns user profile (requires Access Token). |
| `GET` | `/oidc/.well-known/openid-configuration` | Discovery endpoint for OIDC metadata. |
| `GET` | `/oidc/jwks.json` | Public keys for validating tokens. |
| `POST` | `/login` | Authenticates user credentials. |
| `POST` | `/register` | Creates a new user account. |


## API Documentation

Once the server is running, access the interactive Swagger documentation at:

**[http://localhost:5000/swagger](http://localhost:5000/swagger)**


## Project Structure

```
├── src/
│   ├── config/         # Configuration & Key management
│   ├── database/       # TypeORM entities & connection
│   ├── plugins/        # Elysia plugins (Auth, etc.)
│   ├── routes/         # API & UI Routes (OIDC, Account)
│   ├── utils/          # Helpers (Keys, Logger, Tokens)
│   └── index.ts        # Entry point
├── public/             # Static assets (HTML, CSS for Login/Register)
├── tests/              # Unit & Integration tests
└── docker-compose.yml  # Docker infrastructure
```

## Default Demo Data

By default (in dev mode), the application seeds a demo client:

- **Client ID**: `demo-client`
- **Client Secret**: `demo-secret`
- **Redirect URIs**: `http://localhost:5000/callback`, `https://oauth.pstmn.io/v1/callback`
