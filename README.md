# Utalk-Backend

## Estructura

```
utalk-backend/
├── package.json
├── src/
│   ├── constants.js
│   ├── server.js
│   ├── routes/
│   │   └── chat.routes.js
│   ├── controllers/
│   │   └── chat.controller.js
│   └── services/
│       ├── twilio.service.js
│       └── firestore.service.js
└── README.md
```

## Instalación

1. `npm install`
2. Configura variables de entorno:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_WHATSAPP_NUMBER`
   - `FIREBASE_SERVICE_ACCOUNT` (JSON stringificado)
   - `FIREBASE_DATABASE_URL`
3. `npm start`

La API escucha en `GET /` y `/api/chat`.
