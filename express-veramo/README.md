## Veramo Express Server

Simple Express backend designed to intake requests to create Verifiable Credentials and Attestations.

## 💻 Getting Started

1. Install dependencies

```bash
yarn install
```

2. Create a .env file with an INFURA_PROJECT_ID, KMS_SECRET_KEY, and NODE_URL. You will need to create or use an existing Infura project for this to work. You can generate a value for your KMS-SECRET_KEY by running the following in a terminal:

```bash
npx @veramo/cli config create-secret-key
```

3. Generate decentralized identifiers for your Veramo agent by running the following in your terminal:

```bash
yarn ts-node --esm ./src/create-identifier.ts
```

4. Start your server:

```bash
yarn start
```

5. Once your server is started, you can boot up the frontend in the `client` directory

