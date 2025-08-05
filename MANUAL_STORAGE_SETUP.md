# Configuración Manual del Storage para PDFs de Contratos

## Pasos para configurar el bucket en Supabase Dashboard

### 1. Crear el Bucket

1. Ingresa a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. En el menú lateral, ve a **Storage**
3. Click en el botón **"New Bucket"**
4. Completa los campos:
   - **Bucket name**: `contracts`
   - **Public bucket**: ⬜ Desactivado (dejar desmarcado)
   - **File size limit**: `10`
   - **Allowed MIME types**: `application/pdf`
5. Click en **"Save"**

### 2. Configurar las Políticas RLS

1. Click en el bucket `contracts` que acabas de crear
2. Ve a la pestaña **"Policies"**
3. Click en **"New Policy"**
4. Selecciona **"For full customization"**
5. Completa el formulario:

   **Nombre de la política**: `Allow authenticated users all operations`
   
   **Target roles**: `authenticated`
   
   **WITH CHECK (para INSERT)**: 
   ```sql
   true
   ```
   
   **USING (para SELECT, UPDATE, DELETE)**:
   ```sql
   true
   ```
   
   **Allowed operations**: 
   - ✅ SELECT
   - ✅ INSERT  
   - ✅ UPDATE
   - ✅ DELETE

6. Click en **"Save policy"**

### 3. Verificar la Configuración

Para verificar que todo está configurado correctamente:

1. En la consola del navegador de tu aplicación, ejecuta:
   ```javascript
   fetch('/api/check-storage')
     .then(r => r.json())
     .then(console.log)
   ```

2. Deberías ver:
   ```json
   {
     "success": true,
     "hasContractsBucket": true,
     "canListFiles": true
   }
   ```

### 4. Solución de Problemas

Si sigues teniendo errores al subir PDFs:

1. **Error 400**: El bucket no existe o el nombre está mal escrito
2. **Error 403**: Las políticas RLS no están configuradas correctamente
3. **Error 413**: El archivo es muy grande (máximo 10MB)

### Alternativa: Política más simple

Si la política anterior no funciona, puedes crear una política más simple:

1. En Policies, click en **"New Policy"**
2. Selecciona **"Give users access to own folder"**
3. Policy name: `Users can manage their own contract files`
4. Folder name: `{user_id}`
5. Operations: Selecciona todas

Esto permitirá que cada usuario suba archivos a su propia carpeta.