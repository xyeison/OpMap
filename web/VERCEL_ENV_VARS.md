# Variables de Entorno necesarias en Vercel

Para que la aplicación funcione correctamente en Vercel, necesitas configurar las siguientes variables de entorno en el dashboard de Vercel:

## Variables Requeridas

1. **NEXT_PUBLIC_SUPABASE_URL**
   - Descripción: URL de tu proyecto de Supabase
   - Ejemplo: `https://xxxxxxxxxxxxx.supabase.co`
   - Dónde encontrarla: Supabase Dashboard > Settings > API

2. **NEXT_PUBLIC_SUPABASE_ANON_KEY**
   - Descripción: Clave pública (anon) de Supabase
   - Ejemplo: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Dónde encontrarla: Supabase Dashboard > Settings > API > anon public

3. **SUPABASE_SERVICE_ROLE_KEY**
   - Descripción: Clave de servicio (service_role) de Supabase - MANTENER SECRETA
   - Ejemplo: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Dónde encontrarla: Supabase Dashboard > Settings > API > service_role (secret)
   - ⚠️ IMPORTANTE: Esta clave da acceso completo a tu base de datos, nunca la expongas

4. **GOOGLE_MAPS_API_KEY** (Opcional, para cálculo de rutas)
   - Descripción: API Key de Google Maps
   - Ejemplo: `AIzaSy...`
   - Dónde encontrarla: Google Cloud Console > APIs & Services > Credentials

## Cómo configurar en Vercel

1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com/dashboard)
2. Click en "Settings"
3. Click en "Environment Variables" en el menú lateral
4. Agrega cada variable con su valor correspondiente
5. Asegúrate de marcar las casillas para Production, Preview y Development
6. Click en "Save" para cada variable
7. Redeploy tu aplicación para que tome los cambios

## Verificar configuración

Puedes verificar que las variables estén configuradas correctamente visitando:
`https://tu-dominio.vercel.app/api/auth/check-env`

Esto mostrará (sin exponer valores sensibles) si las variables están configuradas.

## Usuario de prueba

Una vez configuradas las variables, puedes usar:
- Email: `admin@opmap.com`
- Password: `admin123`

Si el usuario no existe, puedes crearlo ejecutando el script:
```bash
cd web
node scripts/create-admin-user.js
```