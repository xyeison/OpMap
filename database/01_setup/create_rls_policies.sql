-- Crear políticas de Row Level Security para permitir acceso público de lectura

-- Políticas para KAMs
CREATE POLICY "Allow public read access on kams" ON kams
  FOR SELECT
  USING (true);

CREATE POLICY "Allow anon insert on kams" ON kams
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow anon update on kams" ON kams
  FOR UPDATE
  USING (true);

-- Políticas para Hospitals
CREATE POLICY "Allow public read access on hospitals" ON hospitals
  FOR SELECT
  USING (true);

CREATE POLICY "Allow anon insert on hospitals" ON hospitals
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow anon update on hospitals" ON hospitals
  FOR UPDATE
  USING (true);

-- Políticas para Assignments
CREATE POLICY "Allow public read access on assignments" ON assignments
  FOR SELECT
  USING (true);

CREATE POLICY "Allow anon insert on assignments" ON assignments
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow anon update on assignments" ON assignments
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow anon delete on assignments" ON assignments
  FOR DELETE
  USING (true);

-- Políticas para Opportunities
CREATE POLICY "Allow public read access on opportunities" ON opportunities
  FOR SELECT
  USING (true);

CREATE POLICY "Allow anon insert on opportunities" ON opportunities
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow anon update on opportunities" ON opportunities
  FOR UPDATE
  USING (true);

-- Verificar que RLS está habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('kams', 'hospitals', 'assignments', 'opportunities');