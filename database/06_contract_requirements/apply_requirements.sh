#!/bin/bash

# Database connection string
DATABASE_URL="postgresql://postgres.norvxqgohddgsdkggqzq:T@@2dWbD%!%234@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

# Apply the SQL script
echo "Aplicando cambios de requisitos financieros..."
psql "$DATABASE_URL" -f 01_add_financial_requirements.sql

echo "Proceso completado."