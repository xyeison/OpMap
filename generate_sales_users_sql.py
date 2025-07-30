#!/usr/bin/env python3
"""
Genera script SQL para crear usuarios de ventas con contraseñas hasheadas
"""
import bcrypt

# Datos de los usuarios
users = [
    ("a.galvan@vgmedical.com.co", "Andrea Juliana Galvan Ramirez", "andrea901$"),
    ("carmenbarrios@vgmedical.com.co", "Carmen Edith Barrios Barrios", "carmen901$"),
    ("i.contreras@vgmedical.com.co", "Iván Rodolfo Contreras Prieto", "ivan901$"),
    ("katherinnesolano1@hotmail.com", "Katherinne Solano Escamilla", "katherinne901$"),
    ("m.buelvas@vgmedical.com.co", "Mileydis Amaparo Buelvas Castellar", "mileydis901$"),
    ("m.cobo@vgmedical.com.co", "Maria Alejandra Cobo Bulla", "alejandra901$"),
    ("mn@vgmedical.com.co", "Maryerith Aimee Núñez Padilla", "maryerith901$"),
    ("sramirez@vgmedical.com.co", "Sindy Lorena Ramirez de la Rosa", "sindy901$")
]

# Generar SQL
sql_script = """-- Script para crear usuarios del equipo de ventas
-- Fecha: 2025-01-30
-- IMPORTANTE: Ejecutar este script en Supabase SQL Editor

-- Primero verificamos que no existan usuarios con estos emails
DO $$ 
BEGIN
    -- Opcional: Eliminar usuarios existentes si los hay
    -- DELETE FROM users WHERE email IN (
"""

# Agregar emails a la lista de eliminación
for i, (email, _, _) in enumerate(users):
    if i < len(users) - 1:
        sql_script += f"    --     '{email}',\n"
    else:
        sql_script += f"    --     '{email}'\n"

sql_script += """    -- );
END $$;

-- Insertar nuevos usuarios de ventas
INSERT INTO users (email, password, full_name, role, active, created_at) VALUES
"""

# Generar INSERT para cada usuario
for i, (email, full_name, password) in enumerate(users):
    # Generar hash de la contraseña
    salt = bcrypt.gensalt(rounds=10)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    
    # Agregar al script SQL
    sql_script += f"    ('{email}',\n"
    sql_script += f"     '{hashed}',\n"
    sql_script += f"     '{full_name}',\n"
    sql_script += f"     'sales',\n"
    sql_script += f"     true,\n"
    sql_script += f"     NOW())"
    
    if i < len(users) - 1:
        sql_script += ","
    sql_script += f"\n    -- Contraseña: {password}\n"
    
    if i < len(users) - 1:
        sql_script += "\n"

sql_script += """
ON CONFLICT (email) DO UPDATE SET
    password = EXCLUDED.password,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    active = EXCLUDED.active,
    updated_at = NOW();

-- Verificar que los usuarios fueron creados
SELECT email, full_name, role, active, created_at 
FROM users 
WHERE email IN (
"""

# Agregar emails a la verificación
for i, (email, _, _) in enumerate(users):
    if i < len(users) - 1:
        sql_script += f"    '{email}',\n"
    else:
        sql_script += f"    '{email}'\n"

sql_script += """)
ORDER BY created_at DESC;

-- Mensaje de confirmación
DO $$ 
DECLARE
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count
    FROM users 
    WHERE role = 'sales' AND active = true;
    
    RAISE NOTICE 'Total de usuarios de ventas activos: %', user_count;
END $$;
"""

# Guardar el script SQL
with open('database/03_maintenance/create_sales_users_hashed.sql', 'w', encoding='utf-8') as f:
    f.write(sql_script)

print("Script SQL generado exitosamente: database/03_maintenance/create_sales_users_hashed.sql")
print("\nUsuarios a crear:")
for email, full_name, password in users:
    print(f"  - {full_name} ({email}) - Contraseña: {password}")
print(f"\nTotal: {len(users)} usuarios")