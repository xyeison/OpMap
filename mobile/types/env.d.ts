// Tipos globales de Expo (process.env.EXPO_PUBLIC_*, require de Metro, CSS). Expo genera expo-env.d.ts al
// arrancar, pero ese archivo no se versiona: este sí, para que `tsc --noEmit` funcione igual en CI.
/// <reference types="expo/types" />

declare namespace NodeJS {
  interface ProcessEnv {
    /** URL del servidor de OpMap (sin barra final). Producción por defecto; en desarrollo http://localhost:3000. */
    EXPO_PUBLIC_API_URL?: string
  }
}
