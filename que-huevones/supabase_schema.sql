-- ============================================================================
-- QUÉ HUEVONES • ESQUEMA OFICIAL SUPABASE (POSTGRESQL + REALTIME)
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase
-- ============================================================================

-- 1. Tabla central de sincronización en tiempo real (Estado unificado + JSONB)
CREATE TABLE IF NOT EXISTS public.qh_cloud_store (
  id TEXT PRIMARY KEY DEFAULT 'production_v1',
  orders JSONB NOT NULL DEFAULT '[]'::jsonb,
  finances JSONB NOT NULL DEFAULT '{"partnerMovements": [], "supplierPayments": [], "users_store": []}'::jsonb,
  ambassadors JSONB NOT NULL DEFAULT '[]'::jsonb,
  users JSONB NOT NULL DEFAULT '[]'::jsonb,
  analytics JSONB NOT NULL DEFAULT '{"pageViews": 0, "totalClicks": 0, "addToCartEvents": 0, "whatsappCheckouts": 0, "productStats": {}, "buttonClicks": {}, "eventLog": []}'::jsonb,
  deleted_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  reset_at BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT 0,
  updated_by TEXT NOT NULL DEFAULT 'system'
);

ALTER TABLE public.qh_cloud_store ADD COLUMN IF NOT EXISTS users JSONB NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO public.qh_cloud_store (id, orders, finances, ambassadors, users, analytics, deleted_ids, reset_at, updated_at, updated_by)
VALUES (
  'production_v1',
  '[]'::jsonb,
  '{"partnerMovements": [], "supplierPayments": [], "users_store": []}'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '{"pageViews": 0, "totalClicks": 0, "addToCartEvents": 0, "whatsappCheckouts": 0, "productStats": {}, "buttonClicks": {}, "eventLog": []}'::jsonb,
  '[]'::jsonb,
  0,
  0,
  'system'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Tabla relacional de Embajadores (para ver cada embajador como fila individual en Supabase)
CREATE TABLE IF NOT EXISTS public.qh_ambassadors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  phone TEXT DEFAULT '',
  username TEXT DEFAULT '',
  password TEXT DEFAULT '',
  invited_by TEXT DEFAULT 'Directo',
  created_at TEXT DEFAULT '',
  updated_at BIGINT DEFAULT 0
);

-- 3. Tabla relacional de Usuarios y Credenciales (Socios, Encargada y Embajadores)
CREATE TABLE IF NOT EXISTS public.qh_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'embajador',
  ambassador_code TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  invited_by TEXT DEFAULT 'Directo',
  created_at TEXT DEFAULT '',
  updated_at BIGINT DEFAULT 0
);

-- 4. Tabla relacional de Pedidos
CREATE TABLE IF NOT EXISTS public.qh_orders (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  order_type TEXT DEFAULT 'Pedido Único',
  delivery_day TEXT DEFAULT '',
  items_summary TEXT DEFAULT '',
  trays_count INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending_payment',
  ambassador_code TEXT DEFAULT '',
  created_at TEXT DEFAULT '',
  updated_at BIGINT DEFAULT 0
);

-- Habilitar Row Level Security con acceso para lectura/escritura desde la SPA
ALTER TABLE public.qh_cloud_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qh_ambassadors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qh_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qh_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read write qh_cloud_store" ON public.qh_cloud_store;
CREATE POLICY "Allow public read write qh_cloud_store" ON public.qh_cloud_store FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read write qh_ambassadors" ON public.qh_ambassadors;
CREATE POLICY "Allow public read write qh_ambassadors" ON public.qh_ambassadors FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read write qh_users" ON public.qh_users;
CREATE POLICY "Allow public read write qh_users" ON public.qh_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read write qh_orders" ON public.qh_orders;
CREATE POLICY "Allow public read write qh_orders" ON public.qh_orders FOR ALL USING (true) WITH CHECK (true);
