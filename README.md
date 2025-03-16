# M-Pesa Integration

This project provides an Express.js-based API for handling payments via Safaricom's M-Pesa API. It supports mobile money deposits and withdrawals while using Firebase Firestore for data persistence.

## Features
- **STK Push Payments**: Initiates mobile money deposits via M-Pesa STK push.
- **Callback Handling**: Processes M-Pesa payment responses.
- **Offline Payments**: Handles manual validation and confirmation.
- **B2C Withdrawals**: Supports user withdrawals from the system.
- **Balance Inquiry**: Allows users to check their available balance (for demo purposes).


## Installation
1. Clone the repository:
   ```sh
   git clone <repository-url>
   cd <project-directory>
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Configure Firebase and M-Pesa credentials in a `.env` file.

- You can use the template below for your environment variables
```sh
# M-Pesa API Credentials
CONSUMER_KEY=your_consumer_key
CONSUMER_SECRET=your_consumer_secret

# M-Pesa Payment Credentials
PASSKEY=your_passkey
SHORTCODE=your_shortcode
B2C_SHORTCODE=your_b2c_shortcode
INITIATOR_NAME=your_initiator_name
INITIATOR_PASSWORD=your_initiator_password

# URLs
BASE_URL=https://sandbox.safaricom.co.ke
CALLBACK_URL=https://yourdomain.com/callback
VALIDATION_URL=https://yourdomain.com/validation
CONFIRMATION_URL=https://yourdomain.com/confirmation
QUEUE_TIMEOUT_URL=https://yourdomain.com/queue-timeout
RESULT_URL=https://yourdomain.com/result

# Security Certificate Path (for encryption)
SECURITY_CERT_PATH=./cert/SandboxCertificate.cer
```

- Replace the placeholder values with your actual credentials. If you're working in a local development environment, ensure you use `ngrok` or another tunneling service to expose your local server for callbacks.

4. Run the server:
   ```sh
   node app.js
   ```

## API Endpoints
### 1. Payment Initiation
**Endpoint:** `POST /api/pay`
- **Request Body:**
  ```json
  {
    "phoneNumber": "254712345678",
    "amount": 1000
  }
  ```


### 2. STK Push Callback Handling
**Endpoint:** `POST /api/callback`
- **Request Body:** M-Pesa callback data.
- Contains callback data about the transaction showing whether it was successful or failed (cancelled).

- **Note:** When testing or developing, you need to use `ngrok` or any other tunneling service to tunnel your connection and receive callbacks from Safaricom.

### 3. Offline Payments
**Validation Endpoint:** `POST /api/validation`
- Used to validate offline payments.

**Confirmation Endpoint:** `POST /api/confirmation`
- Handles and stores offline payments.

### 4. Withdrawals (B2C Transactions)
**Endpoint:** `POST /api/withdraw`
- **Request Body:**
  ```json
  {
    "phoneNumber": "254712345678",
    "amount": 500
  }
  ```

### 5. Balance Inquiry
**Endpoint:** `GET /api/balance?phoneNumber=254712345678`
- **Response:**
  ```json
  {
    "balance": 1500
  }
  ```
### 5. Demo Frontend
- You can also test your the endpoints using the simple frontend [index.html](./index.html). Replace the `baseURL` with your base url.

**NB:** You can replace Firestore with your favorite database.

## Security Considerations
- The `ipWhitelist` [middleware](./middleware/whitelist.js) should be enforced in production to restrict access to sensitive endpoints.
- Use environment variables instead of hardcoding sensitive credentials.

## Useful Resources
- [Daraja API documentation](https://developer.safaricom.co.ke/)
- [Simplified unofficial M-pesa daraja documentation](https://mpesa-docs.vercel.app/)
