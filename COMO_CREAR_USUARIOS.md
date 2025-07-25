# Cómo crear usuarios en OpMap

El sistema usa contraseñas simples (sin hash) para facilitar la administración.

## Para crear un nuevo usuario:

1. Ve a Supabase SQL Editor
2. Ejecuta este comando SQL:

```sql
INSERT INTO users (email, password, full_name, role, active) 
VALUES ('nuevo@email.com', 'lacontraseña', 'Nombre Completo', 'user', true);
```

## Ejemplos:

### Crear un usuario normal:
```sql
INSERT INTO users (email, password, full_name, role, active) 
VALUES ('juan@empresa.com', 'juan2024', 'Juan Pérez', 'user', true);
```

### Crear un administrador:
```sql
INSERT INTO users (email, password, full_name, role, active) 
VALUES ('maria@empresa.com', 'admin456', 'María García', 'admin', true);
```

### Desactivar un usuario:
```sql
UPDATE users SET active = false WHERE email = 'usuario@empresa.com';
```

### Cambiar contraseña:
```sql
UPDATE users SET password = 'nuevaclave' WHERE email = 'usuario@empresa.com';
```

## Usuarios por defecto:
- **admin@opmap.com** / contraseña: **admin123** (administrador)
- **usuario@opmap.com** / contraseña: **user123** (usuario normal)

## Roles disponibles:
- **admin**: Acceso completo
- **user**: Acceso limitado (solo ver y gestionar hospitales)