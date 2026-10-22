-- ============================================================================
-- QUÉ HUEVONES • ESQUEMA OFICIAL SUPABASE (POSTGRESQL + REALTIME)
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase
-- ============================================================================

-- 1. Tabla central de sincronización en tiempo real (Estado unificado + JSONB)
CREATE TABLE IF NOT EXISTS public.qh_cloud_store (
  id TEXT PRIMARY KEY DEFAULT 'production_v1',
  orders JSONB NOT NULL DEFAULT '[]'::jsonb,
  finances JSONB NOT NULL DEFAULT '{"partnerMovements": [], "supplierPayments": []}'::jsonb,
  ambassadors JSONB NOT NULL DEFAULT '[]'::jsonb,
  analytics JSONB NOT NULL DEFAULT '{"pageViews": 0, "totalClicks": 0, "addToCartEvents": 0, "whatsappCheckouts": 0, "productStats": {}, "buttonClicks": {}, "eventLog": []}'::jsonb,
  deleted_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  reset_at BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT 0,
  updated_by TEXT NOT NULL DEFAULT 'system'
);

-- Insertar registro inicial limpio en cero absoluto ($0 ventas, 0 pedidos, $0 saldos, $0 comisiones)
INSERT INTO public.qh_cloud_store (id, orders, finances, ambassadors, analytics, deleted_ids, reset_at, updated_at, updated_by)
VALUES (
  'production_v1',
  '[]'::jsonb,
  '{"partnerMovements": [], "supplierPayments": []}'::jsonb,
  '[]'::jsonb,
  '{"pageViews": 0, "totalClicks": 0, "addToCartEvents": 0, "whatsappCheckouts": 0, "productStats": {}, "buttonClicks": {}, "eventLog": []}'::jsonb,
  '[]'::jsonb,
  0,
  0,
  'system'
)
ON CONFLICT (id) DO NOTHING;

-- Habilitar Row Level Security con acceso para lectura/escritura desde la SPA
ALTER TABLE public.qh_cloud_store ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read write qh_cloud_store" ON public.qh_cloud_store;
CREATE POLICY "Allow public read write qh_cloud_store"
  ON public.qh_cloud_store
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Habilitar Realtime en la tabla para que Juanjo y Morensex vean cambios al instante
ALTER PUBLICATION supabase_realtime ADD TABLE public.qh_cloud_store;
