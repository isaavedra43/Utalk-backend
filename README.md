# UTalk Backend Template

Backend básico para mensajería WhatsApp con Twilio y Firebase Firestore.

## Uso

1. Rellena `constants.js` con tus credenciales de Twilio y Firebase.
2. Instala dependencias:
   ```bash
   npm install
   ```
3. Arranca el servidor:
   ```bash
   npm start
   ```

## Endpoints

- **POST** `/webhook`  
  Webhook para Twilio. Guarda mensajes entrantes en Firestore.

- **POST** `/send`  
  Envía un mensaje. Body:
  ```json
  {
    "to": "+1234567890",
    "body": "Tu mensaje aquí"
  }
  ```

- **GET** `/messages`  
  Obtiene los últimos 50 mensajes (ordenados por fecha).
