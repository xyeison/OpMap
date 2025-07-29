#!/usr/bin/env python3
import sys
sys.path.append('src')
from src.utils.supabase_client import SupabaseClient

supabase = SupabaseClient()
all_times = supabase.get_all_travel_times()
google_times = [t for t in all_times if t.get('source') == 'google_maps']

print(f"✅ Total rutas en caché: {len(all_times):,}")
print(f"🗺️ Rutas de Google Maps: {len(google_times):,}")
print(f"📊 Otras fuentes: {len(all_times) - len(google_times):,}")

# Mostrar últimas 5 rutas añadidas
print("\n📍 Últimas rutas añadidas:")
sorted_times = sorted(all_times, key=lambda x: x.get('calculated_at', ''), reverse=True)[:5]
for t in sorted_times:
    print(f"   - {t.get('calculated_at', 'N/A')[:19]} - {t.get('travel_time')} min - {t.get('source')}")