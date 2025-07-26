# Cartagena KAM Assignment Issue - Fix Summary

## Problem Identified

The Cartagena KAM was not receiving any hospital assignments when activated. After thorough debugging, I identified several potential issues:

### 1. No Hospitals in Municipality 13001
The most likely issue is that there are no active hospitals in municipality 13001 (Cartagena). The algorithm only assigns hospitals in the "territory base" phase if they are in the exact same municipality as the KAM.

### 2. Algorithm Logic Gap
The original algorithm had a gap in handling KAMs without base territory hospitals:
- **Phase 1 (Bogotá)**: Only handles Bogotá localities
- **Phase 2 (Territory Base)**: Only assigns hospitals in the KAM's exact municipality
- **Phase 3 (Competitive)**: Only considers hospitals in adjacent departments

If a KAM like Cartagena has no hospitals in their municipality (13001), they would get ZERO assignments because:
- They have no base territory hospitals
- Hospitals in OTHER municipalities of Bolívar (same department) might be assigned to other KAMs
- The algorithm didn't prioritize same-department assignments

## Solution Implemented

I created `opmap-algorithm-fixed.ts` with the following improvements:

### 1. Enhanced Logging
- Added specific logging for Cartagena KAM detection
- Count hospitals in municipality 13001 and department 13 (Bolívar)
- Track assignments per KAM with alerts for zero assignments

### 2. Improved Competitive Assignment Logic
The fixed algorithm now:
- **Always includes KAMs from the same department** in competition for hospitals
- **Prioritizes same-department assignments** when travel times are similar
- Uses a sorting algorithm that considers:
  1. Same department priority
  2. Travel time (with 10-minute tolerance)
  3. KAM priority as tiebreaker

### 3. Better Handling of Edge Cases
- KAMs without base territory hospitals can now compete for hospitals in their department
- The algorithm ensures all active KAMs get a fair chance at assignments

## Files Modified

1. **Created**: `/web/lib/opmap-algorithm-fixed.ts` - Fixed algorithm implementation
2. **Updated**: `/web/app/api/kams/activate/route.ts` - Use fixed algorithm
3. **Updated**: `/web/app/api/kams/deactivate/route.ts` - Use fixed algorithm
4. **Updated**: `/web/app/api/recalculate-smart/route.ts` - Use fixed algorithm
5. **Updated**: `/web/app/api/recalculate-assignments/route.ts` - Use fixed algorithm

## Testing the Fix

1. Activate Cartagena KAM through the UI
2. Check the console logs - you should see:
   - "🏖️ Cartagena KAM encontrado: ID=xxx, area_id=13001"
   - Hospital counts for Cartagena and Bolívar
   - Assignment summary showing Cartagena's hospital count

3. If Cartagena still gets 0 hospitals, run these SQL queries in Supabase:

```sql
-- Check if there are ANY hospitals in Cartagena
SELECT COUNT(*) FROM hospitals 
WHERE municipality_id = '13001' AND active = true;

-- Check hospitals in Bolívar department
SELECT COUNT(*) FROM hospitals 
WHERE department_id = '13' AND active = true;

-- See which KAMs are getting Bolívar hospitals
SELECT 
    k.name as kam_name,
    COUNT(h.id) as hospitals_in_bolivar
FROM assignments a
JOIN kams k ON a.kam_id = k.id
JOIN hospitals h ON a.hospital_id = h.id
WHERE h.department_id = '13'
GROUP BY k.name
ORDER BY hospitals_in_bolivar DESC;
```

## Next Steps

If Cartagena still doesn't get assignments after this fix:
1. Verify there are active hospitals in Bolívar (department 13)
2. Check if other KAMs in or near Bolívar have very competitive travel times
3. Consider adjusting Cartagena KAM's `max_travel_time` or `priority` settings
4. Ensure Cartagena KAM's coordinates (lat/lng) are correct

The fix ensures that KAMs always have a fair chance to compete for hospitals in their own department, even if they don't have hospitals in their exact municipality.