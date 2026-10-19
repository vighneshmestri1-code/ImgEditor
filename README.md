ImgEditor
A full-stack AI image-editing web application with a unified workspace, account authentication, credit-based tool usage, administration features, and Razorpay subscription billing.
Project status: The core workspace, authentication, admin features, and credit/subscription flows have been implemented and tested in development/Test Mode. Before accepting real payments, complete a separate Live Mode readiness review and end-to-end production checks.

Features
- Account access: Email OTP registration, login, and token-based protected routes.
- Image workspace: A unified workspace for image editing and AI-powered tools.
- Image tools: Background removal, text-to-image generation, image enhancement, and canvas expansion, subject to each provider's API availability and credentials.
- Credit ledger: Records signup credits, tool deductions, refunds, subscription grants, and administrative adjustments.
- Subscriptions: Free, Pro, and Premium plans with Razorpay integration.
- Admin panel: User management, credit adjustments, and credit transaction history for administrators.
- Live credit balance: The navigation bar refreshes the signed-in user's current credit balance from the backend.
- Webhook processing: Verifies Razorpay webhook signatures and uses idempotency keys to protect against duplicate credit grants.
Plans
Plan	Price	Credit allowance
Free	₹0	10 signup credits
Pro	₹299/month	100 credits per billing period
Premium	₹599/month	300 credits per billing period


Paid credits are granted by the server after it validates a successful subscription charge. Checkout authorization by itself should not be treated as proof of a successful recurring charge.
Technology stack
Frontend
- React
- Vite
- React Router
- Tailwind CSS
- Lucide React icons
Backend
- Node.js
- Express
- MongoDB and Mongoose
- JSON Web Tokens (JWT)
- Razorpay Node SDK
- Image-processing and AI-provider SDKs used by the configured tools
Repository structure
ImgEditor/
├── client/                  # React + Vite frontend
│   ├── public/
│   └── src/
│       ├── components/      # Navbar, Footer, Sidebar, credit UI, etc.
│       ├── context/         # Shared application state, if present
│       ├── pages/           # Home, Login, Register, Workspace, Admin, Pricing
│       ├── routes/          # Protected and admin route helpers, if present
│       └── services/        # Client API helpers, if present
└── server/                  # Express API
    ├── controllers/
    ├── middleware/
    ├── models/
    ├── routes/
    ├── scripts/             # Development and automated test scripts
    ├── services/
    └── utils/
Some folders may vary as the project evolves; the tree above shows the main organization rather than every file.
Requirements
- Node.js and npm
- A MongoDB database
- API credentials for the external services used by the tools you intend to run
- Razorpay Test Mode credentials and plan IDs to test subscriptions
Local setup
1. Clone the repository
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd ImgEditor
Replace the placeholder with the repository URL from your GitHub account.
2. Install backend dependencies
cd server
npm install
Create server/.env using the variables required by your local configuration. Do not commit this file.

Example placeholder configuration:
PORT=5000
MONGO_URI=<your_mongodb_connection_string>
JWT_SECRET=<long_random_secret>

# AI and image-tool providers — configure the services you use
GEMINI_API_KEY=<your_gemini_api_key>
REMOVE_BG_API_KEY=<your_remove_bg_api_key>
HF_TOKEN=<your_huggingface_token>
CLIPDROP_API_KEY=<your_clipdrop_api_key>

# Razorpay Test Mode
RAZORPAY_KEY_ID=<your_test_mode_key_id>
RAZORPAY_KEY_SECRET=<your_test_mode_key_secret>
RAZORPAY_WEBHOOK_SECRET=<your_webhook_secret>
RAZORPAY_PRO_PLAN_ID=<your_pro_plan_id>
RAZORPAY_PREMIUM_PLAN_ID=<your_premium_plan_id>
Configure any email-sender variables required by server/utils/sendEmail.js using that file's exact variable names. Keep API keys, database credentials, JWT secrets, and webhook secrets private. Never use angle-bracket placeholders as actual credentials.

Start the backend in one terminal:
npm run dev
The API is expected to use port 5000 locally unless PORT is configured differently.
3. Install frontend dependencies
Open a second PowerShell terminal:
cd client
npm install
For local development, the frontend defaults to http://localhost:5000 for its API. If you need a different backend URL, create client/.env.local with:
VITE_API_BASE_URL=http://localhost:5000
For a deployed frontend, set VITE_API_BASE_URL to the API's base URL in that frontend deployment's environment settings. Do not add /api to this variable if the frontend code appends API paths itself.

Start Vite:
npm run dev
Open the local URL printed by Vite, commonly http://localhost:5173.
Useful commands
Frontend production build
cd client
npm run build
Backend syntax checks
cd server
node --check controllers/authController.js
node --check routes/authRoutes.js
node --check controllers/subscriptionController.js
node --check middleware/authMiddleware.js
Credit-service test
cd server
node scripts/test-credit-service.js
Run other scripts only after reviewing their purpose and configuration. Use temporary test users and Test Mode data for payment-related verification.
Important API routes
The server mounts route groups under these prefixes:
- /api/auth — registration, OTP verification, login, and authenticated account data.
- /api/tools — protected image-tool operations.
- /api/admin — administrator operations.
- /api/subscriptions — plan catalogue, subscription creation/current status, checkout verification, and webhook processing.
- /health — service health check.
The Razorpay webhook destination must be the server's webhook route:
https://<YOUR_RENDER_SERVICE>.onrender.com/api/subscriptions/webhook
Do not point Razorpay webhooks at /api/subscriptions/plans. Keep the Test Mode and Live Mode webhook configurations and credentials separate.
Credits and payment safety
- New accounts receive 10 signup credits.
- Tool usage deducts credits through the backend credit service.
- Failed tool responses may trigger a credit refund through middleware; verify status handling when adding new tools.
- Administrative credit changes should be recorded in the credit ledger.
- Razorpay webhook signatures must be verified using the configured webhook secret and the raw request body.
- A duplicate webhook must not grant credits twice. Keep payment IDs and idempotency keys stable when handling webhook retries.
- Never add paid credits merely because the browser checkout callback ran. Validate payment status, amount, currency, and subscription association on the server.
- Test payments and webhook redeliveries in Test Mode before enabling Live Mode.
Security notes
- Do not commit .env, .env.local, secrets, private keys, database connection strings, customer payment details, or production logs.
- Use a strong JWT_SECRET; the server should not rely on fallback secrets in deployed environments.
- Configure CORS for the intended frontend origin before public production use.
- Keep payment-provider keys server-side. Only expose values explicitly designed for frontend use, such as a Razorpay public key ID.
- Before accepting real payments, review refunds, cancellations, chargebacks, subscription lifecycle events, rate limiting, logging, backup/recovery, and provider account settings.
Troubleshooting
Navbar shows an old balance
- Confirm the authenticated account endpoint returns the current user balance.
- Check the browser Network tab for the /api/auth/me request and its response.
- Verify the frontend is calling the intended backend (localhost versus the deployed API).
Subscription payment captured but credits are missing
- Check the Razorpay webhook URL and enabled event list.
- Confirm the real subscription.charged delivery reaches the deployed backend.
- Inspect the delivery response and backend logs; check the webhook signature, subscription ID, captured status, amount, currency, and credit transaction idempotency key.
- Do not manually add credits until checking whether the payment has already produced a credit-ledger entry.
Cannot GET /api/subscriptions/webhook in a browser
- The webhook endpoint is designed for signed POST requests. Opening it directly with a browser GET request is not a valid webhook test.
Contributing and project status
This repository is actively developed. Test changes locally, run the frontend build and relevant backend tests, and use Razorpay Test Mode for payment-related changes before merging or deploying.
License
No license is specified in this README. Add a LICENSE file before granting others formal permission to reuse or redistribute the project.