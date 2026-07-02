# node-booking-front

Standalone user-facing frontend for the [node-booking](https://github.com/Nassif36/node-booking) API.

## Setup

1. Copy `config.example.js` to `config.js` and point `API_BASE_URL` at your running backend:

```js
window.BOOKING_APP_CONFIG = {
  API_BASE_URL: 'http://localhost:3000/api/v1',
};
```

2. Install the dev server:

```bash
npm install
```

3. Start the dev server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

## CORS

Make sure the backend has CORS enabled for the origin where this frontend is served. Set `CORS_ORIGIN=http://localhost:5173` in the backend `.env` file.
