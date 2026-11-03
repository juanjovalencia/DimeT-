# Guía del Proyecto: Qué Huevones (CLAUDE.md)

Este documento define la arquitectura, reglas de negocio estrictas, credenciales e instrucciones operativas para **Claude Code** y cualquier agente de IA que trabaje en este repositorio.

---

## 🚨 REGLA DE ORO DE GIT (OBLIGATORIA)
1. **SIEMPRE que se realice cualquier cambio en el código, se debe commitear y pushear a GitHub en la rama `juanjo`.**
2. **NUNCA TOCAR NI PUSHEAR A LA RAMA `main`.**
3. Repositorio principal (Vercel): `git@github.com:juanjovalencia/que-huevones.git` (branch `juanjo`).

---

## 🛠️ Stack Tecnológico y Arquitectura
- **Frontend:** Single Page Application (HTML5 + Tailwind CSS v3 vía CDN + JavaScript ES6+ modular sin build step).
- **Backend / Nube:** Supabase PostgreSQL + Realtime Stream + REST API.
- **Hosting / Deploy:** Vercel (conectado automáticamente a GitHub `juanjo`).
- **Navegación / Rutas:** Integración directa móvil con **Waze** (`https://waze.com/ul?q=...&navigate=yes`) y **Google Maps**.
- **Servidor Local de Pruebas:** `python3 -m http.server 8090`.

---

## 🔒 Límite de Alcance (Scope Protection)
- **NO MODIFICAR, BORRAR NI ALTERAR** el catálogo público, el diseño estético general, el carrito de compras ni el flujo de pedido directo hacia WhatsApp (+56953930491), a menos que el usuario lo pida explícitamente.

---

## 💵 Reglas de Negocio Oficiales

### 1. Catálogo Oficial (Bandejas de 30 unidades)
- **Bandeja Huevo de Campo (Café - 30 un.):** Precio `$11.500 CLP`.
- **Bandeja Huevo Blanco Seleccionado (30 un.):** Precio `$9.000 CLP`.

### 2. Comisiones Oficiales de Embajadores
- **Bandeja Café (30 un.):** **$2.000** de comisión por bandeja vendida en pedidos pagados/aprobados.
- **Bandeja Blanco (30 un.):** **$1.000** de comisión por bandeja vendida en pedidos pagados/aprobados.
- **Bonos por Invitados reclutados:**
  - $10.000 por cada 10 bandejas Café vendidas por su red de invitados.
  - $8.000 por cada 10 bandejas Blancas vendidas por su red de invitados.
  - *Excepción de negocio:* Socios Fundadores (Juanjo y Mati) no generan bonos de reclutamiento para sí mismos por ser los dueños.

### 3. Modo "Partir a Repartir" y Despachos entre Socios
- Repartidores oficiales: **Juanjo** y **Mati (Moreno)**.
- El Modo Reparto pregunta quién va al volante, optimiza paradas por cercanía/sector en Santiago para ahorrar bencina y ofrece enlaces directos a Waze y Google Maps.
- Botón "✅ Entregado — Ir al siguiente" marca el pedido como completado y lo atribuye a quien despachó.
- Valor configurable por despacho/bencina por entrega (default: $2.000).

---

## ☁️ Conexión Supabase (Producción)
- **Project URL:** `https://zjvlpzywqwvghpuzlvbt.supabase.co`
- **Publishable Key:** `sb_publishable_78JknTIH_i-ZtHH8S4NG7w_P5Hs7i-N`
- **Tablas:**
  - `qh_cloud_store` (almacén JSON permanente de estado global `production_v1`)
  - `qh_orders`
  - `qh_ambassadors`
  - `qh_users`
  - `qh_finances`
