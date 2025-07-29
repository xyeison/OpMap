-- Ver usuarios existentes
SELECT id, email, full_name, role, active 
FROM users
ORDER BY created_at;

-- Si no hay usuarios, crear los de ejemplo:
-- INSERT INTO users (email, password_hash, full_name, role) VALUES
-- ('admin@opmap.com', '$2a$10$rBV2JDeWW3.vKyeQcM8fFO4777l4bVeQgDL6VZkqwerTHY5FGsbey', 'Administrador', 'admin'),
-- ('usuario@opmap.com', '$2a$10$4gPHqMZDL6Bfjo.kR3DYMuqbxrIasBjUKGsXJcY35HxjDJGGJL3Fy', 'Usuario', 'user')
-- ON CONFLICT (email) DO NOTHING;