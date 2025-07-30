const bcrypt = require('bcryptjs');
const fs = require('fs');

// Datos de los usuarios
const users = [
    { email: "a.galvan@vgmedical.com.co", name: "Andrea Juliana Galvan Ramirez", password: "andrea901$" },
    { email: "carmenbarrios@vgmedical.com.co", name: "Carmen Edith Barrios Barrios", password: "carmen901$" },
    { email: "i.contreras@vgmedical.com.co", name: "Iván Rodolfo Contreras Prieto", password: "ivan901$" },
    { email: "katherinnesolano1@hotmail.com", name: "Katherinne Solano Escamilla", password: "katherinne901$" },
    { email: "m.buelvas@vgmedical.com.co", name: "Mileydis Amaparo Buelvas Castellar", password: "mileydis901$" },
    { email: "m.cobo@vgmedical.com.co", name: "Maria Alejandra Cobo Bulla", password: "alejandra901$" },
    { email: "mn@vgmedical.com.co", name: "Maryerith Aimee Núñez Padilla", password: "maryerith901$" },
    { email: "sramirez@vgmedical.com.co", name: "Sindy Lorena Ramirez de la Rosa", password: "sindy901$" }
];

async function generateSQL() {
    let sql = `-- Script para crear usuarios del equipo de ventas
-- Fecha: 2025-01-30
-- IMPORTANTE: Ejecutar este script en Supabase SQL Editor

-- Primero verificamos que no existan usuarios con estos emails (opcional)
-- DELETE FROM users WHERE email IN (
--     ${users.map(u => `'${u.email}'`).join(',\n--     ')}
-- );

-- Insertar nuevos usuarios de ventas
INSERT INTO users (email, password, full_name, role, active, created_at) VALUES
`;

    // Generar hashes para cada usuario
    const userInserts = await Promise.all(users.map(async (user, index) => {
        const hash = await bcrypt.hash(user.password, 10);
        const isLast = index === users.length - 1;
        return `    ('${user.email}',
     '${hash}',
     '${user.name}',
     'sales',
     true,
     NOW())${isLast ? '' : ','}
    -- Contraseña: ${user.password}`;
    }));

    sql += userInserts.join('\n\n');

    sql += `
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
    ${users.map(u => `'${u.email}'`).join(',\n    ')}
)
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
`;

    // Guardar el archivo
    fs.writeFileSync('../database/03_maintenance/create_sales_users_hashed.sql', sql);
    
    console.log('Script SQL generado exitosamente: database/03_maintenance/create_sales_users_hashed.sql');
    console.log('\nUsuarios a crear:');
    users.forEach(user => {
        console.log(`  - ${user.name} (${user.email}) - Contraseña: ${user.password}`);
    });
    console.log(`\nTotal: ${users.length} usuarios`);
}

generateSQL().catch(console.error);