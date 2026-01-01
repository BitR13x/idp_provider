export const config = {
  port: 5000,
  env: process.env.NODE_ENV || 'development',
  REGISTER_TOKEN: process.env.REGISTER_TOKEN || 'dev-register-token-change-me',
  database: {
    database: process.env.DB_DATABASE || 'idp',
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_USER: process.env.DB_USER || 'postgres',
    DB_PASS: process.env.DB_PASS || 'mysecretpassword',
  },
  oidc: {
    issuer: process.env.OIDC_ISSUER || 'http://localhost:5000/oidc',
    publicUrl: process.env.OIDC_PUBLIC_URL || 'http://localhost:5000',
    jwt: {
      accessTokenExpiration: '2h',
      idTokenExpiration: '1h',
      kid: process.env.JWT_KID || 'dev-jwtkid-change-me',
      sessionSecret: process.env.SESSION_SECRET || 'dev-session-secret-change-me',
    }
  },
  logging: {
    level: 'info',
  },
  demo: {
    seed: true,
    clientId: 'demo-client',
    clientSecret: 'demo-secret',
  }
};