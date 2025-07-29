const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function cleanHaversineFromCache() {
  console.log('🧹 Limpiando cálculos Haversine de travel_time_cache...');
  console.log('='*70);

  try {
    // Primero, obtener estadísticas
    const { data: stats, error: statsError } = await supabase
      .rpc('get_travel_time_stats');
    
    if (statsError) throw statsError;
    
    console.log(`Total de registros en la tabla: ${stats[0].total_count}`);
    console.log(`Registros con tiempo: ${stats[0].with_time_count}`);
    console.log(`Registros sin tiempo (NULL): ${stats[0].null_time_count}`);

    // Identificar registros Haversine
    const query = `
      WITH calculated_times AS (
        SELECT 
          id,
          origin_lat,
          origin_lng,
          destination_lat,
          destination_lng,
          travel_time_minutes,
          6371 * 2 * ASIN(SQRT(
            POWER(SIN(RADIANS(destination_lat - origin_lat) / 2), 2) +
            COS(RADIANS(origin_lat)) * COS(RADIANS(destination_lat)) *
            POWER(SIN(RADIANS(destination_lng - origin_lng) / 2), 2)
          )) AS distance_km
        FROM travel_time_cache
        WHERE travel_time_minutes IS NOT NULL
      ),
      haversine_check AS (
        SELECT 
          *,
          (distance_km / 60) * 60 AS haversine_time_estimate,
          ABS(travel_time_minutes - (distance_km / 60) * 60) / ((distance_km / 60) * 60) * 100 AS diff_percent
        FROM calculated_times
      )
      SELECT 
        id,
        origin_lat,
        origin_lng,
        destination_lat,
        destination_lng,
        travel_time_minutes,
        haversine_time_estimate,
        diff_percent
      FROM haversine_check
      WHERE diff_percent <= 10
      ORDER BY diff_percent DESC
    `;

    const { data: haversineRecords, error: queryError } = await supabase
      .rpc('execute_sql', { query });

    if (queryError) throw queryError;

    console.log(`\nRegistros identificados como Haversine: ${haversineRecords.length}`);

    if (haversineRecords.length > 0) {
      // Mostrar algunos ejemplos
      console.log('\nEjemplos de registros a eliminar:');
      haversineRecords.slice(0, 5).forEach(record => {
        console.log(`  ID: ${record.id}`);
        console.log(`    Origen: ${record.origin_lat}, ${record.origin_lng}`);
        console.log(`    Destino: ${record.destination_lat}, ${record.destination_lng}`);
        console.log(`    Tiempo actual: ${record.travel_time_minutes.toFixed(1)} min`);
        console.log(`    Tiempo Haversine: ${record.haversine_time_estimate.toFixed(1)} min`);
        console.log(`    Diferencia: ${record.diff_percent.toFixed(1)}%\n`);
      });

      // Confirmar eliminación
      console.log('¿Desea eliminar estos registros? (s/n)');
      
      // Para ejecutar la eliminación automáticamente, descomentar:
      /*
      const ids = haversineRecords.map(r => r.id);
      const { error: deleteError } = await supabase
        .from('travel_time_cache')
        .delete()
        .in('id', ids);

      if (deleteError) throw deleteError;
      console.log(`✅ ${ids.length} registros eliminados`);
      */
    } else {
      console.log('✅ No se encontraron cálculos Haversine en la tabla');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// Función helper para obtener estadísticas
async function getStats() {
  const { count: totalCount } = await supabase
    .from('travel_time_cache')
    .select('*', { count: 'exact', head: true });

  const { count: withTimeCount } = await supabase
    .from('travel_time_cache')
    .select('*', { count: 'exact', head: true })
    .not('travel_time_minutes', 'is', null);

  const { count: nullTimeCount } = await supabase
    .from('travel_time_cache')
    .select('*', { count: 'exact', head: true })
    .is('travel_time_minutes', null);

  return { totalCount, withTimeCount, nullTimeCount };
}

cleanHaversineFromCache();