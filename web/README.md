# OpMap Web - Sistema de Asignación Territorial

Versión web del sistema OpMap construida con Next.js, Supabase y TypeScript.

## 🚀 Inicio Rápido

### Prerequisitos
- Node.js 18+
- Cuenta de Supabase
- API Key de Google Maps (opcional para mapas)

### Instalación

1. Instala las dependencias:
```bash
cd web
npm install
```

2. Configura las variables de entorno:
```bash
cp .env.local.example .env.local
# Edita .env.local con tus credenciales de Supabase
```

3. Ejecuta el servidor de desarrollo:
```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## 📊 Configuración de Base de Datos

1. Crea un nuevo proyecto en [Supabase](https://supabase.com)

2. Ejecuta el script de esquema en el SQL Editor de Supabase:
```sql
-- Copia y pega el contenido de database/schema.sql
```

3. Importa los datos iniciales:
```sql
-- Copia y pega el contenido de database/seed.sql
```

4. Configura las políticas de RLS según tus necesidades

## 🏗️ Estructura del Proyecto

```
web/
├── app/                    # Rutas y páginas de Next.js
│   ├── kams/              # Gestión de KAMs
│   ├── hospitals/         # Gestión de hospitales
│   └── map/               # Visualización del mapa
├── components/            # Componentes reutilizables
├── lib/                   # Utilidades y servicios
│   └── supabase.ts       # Cliente y servicios de Supabase
├── types/                 # Definiciones de TypeScript
└── public/               # Assets estáticos
```

## 🔧 Características Principales

- **Dashboard**: Vista general con estadísticas clave
- **Gestión de KAMs**: CRUD completo para Key Account Managers
- **Gestión de Hospitales**: Búsqueda y administración de IPS
- **Oportunidades**: Registro de valor de contratos y proveedores
- **Mapa Interactivo**: Visualización de territorios y asignaciones
- **Tiempo Real**: Actualizaciones automáticas con Supabase Realtime

## 📝 Desarrollo

### Agregar una nueva página
```tsx
// app/nueva-pagina/page.tsx
export default function NuevaPagina() {
  return <div>Mi nueva página</div>
}
```

### Usar los servicios de Supabase
```tsx
import { kamService } from '@/lib/supabase'

const kams = await kamService.getAll()
```

## 🚀 Despliegue

### Vercel (Recomendado)
1. Conecta tu repositorio a Vercel
2. Configura las siguientes variables de entorno:
   ```
   NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_de_supabase
   ```
3. Configuración del proyecto:
   - Root Directory: `web`
   - Build Command: `npm run build`
   - Output Directory: `.next`
4. Deploy automático con cada push

### Manual
```bash
npm run build
npm start
```

### Notas Importantes para Producción
- Los archivos GeoJSON grandes no están incluidos en el repositorio
- La API de geojson requiere que los archivos estén disponibles localmente
- Actualiza la ruta en `app/api/geojson/[type]/[id]/route.ts` según tu entorno

## 🔒 Seguridad

- Habilita RLS en todas las tablas
- Usa autenticación de Supabase
- Valida permisos en el servidor
- Nunca expongas credenciales sensibles

## 🤝 Contribuir

1. Fork el proyecto
2. Crea tu rama (`git checkout -b feature/nueva-caracteristica`)
3. Commit tus cambios (`git commit -m 'Agrega nueva característica'`)
4. Push a la rama (`git push origin feature/nueva-caracteristica`)
5. Abre un Pull Request