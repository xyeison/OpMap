# Guía de Políticas RLS para Storage de Contratos

## Opción 1: Política Simple (RECOMENDADA)

En el dashboard de Supabase, después de crear el bucket `contracts`:

1. Ve a **Storage** → Click en el bucket `contracts`
2. Ve a la pestaña **Policies**
3. Click en **New Policy**
4. Selecciona **"Give users authenticated access"**
5. Esto creará automáticamente las políticas necesarias

## Opción 2: Política Personalizada

Si no aparece el template anterior, usa **"For full customization"**:

### Para INSERT (Subir archivos):
```sql
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'contracts' AND
    auth.role() = 'authenticated'
);
```

### Para SELECT (Ver archivos):
```sql
CREATE POLICY "Allow authenticated reads"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'contracts' AND
    auth.role() = 'authenticated'
);
```

### Para UPDATE (Actualizar archivos):
```sql
CREATE POLICY "Allow authenticated updates"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'contracts' AND
    auth.role() = 'authenticated'
);
```

### Para DELETE (Eliminar archivos):
```sql
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'contracts' AND
    auth.role() = 'authenticated'
);
```

## Opción 3: Política Todo-en-Uno

Si prefieres una sola política que cubra todo:

1. En **New Policy** → **For full customization**
2. **Policy name**: `Allow all operations for authenticated users`
3. **Target roles**: Selecciona `authenticated`
4. **WITH CHECK expression**: 
   ```sql
   bucket_id = 'contracts'
   ```
5. **USING expression**:
   ```sql
   bucket_id = 'contracts'
   ```
6. **Allowed operations**: Marca todas (SELECT, INSERT, UPDATE, DELETE)

## Verificación

Después de crear las políticas, verifica que funcionen:

1. En la consola del navegador:
```javascript
// Verificar diagnóstico
fetch('/api/diagnose-storage')
  .then(r => r.json())
  .then(console.log)
```

2. Intenta subir un PDF de prueba desde la aplicación

## Notas Importantes

- NO uses el template de "folder access" porque restringe a carpetas específicas
- El bucket debe llamarse exactamente `contracts` (minúsculas)
- Los usuarios deben estar autenticados para subir archivos
- El tamaño máximo es 10MB por archivo