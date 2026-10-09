# GDN Style

**Tu belleza, nuestra prioridad.** Marketplace de reservas de belleza y
cuidado personal que conecta clientes con profesionales (barbería, cejas y
pestañas, piel, depilación, maquillaje y masaje).

Rebuild + modernización del sitio de referencia implementada sobre **Next.js 16
(App Router)**, **TypeScript**, **Tailwind CSS v4** y **Supabase Auth**.

---

## Stack

| Área          | Tecnología                                                    |
| ------------- | ------------------------------------------------------------- |
| Framework     | Next.js 16 (App Router, `cacheComponents`)                    |
| Estilos       | Tailwind CSS v4 + `tailwind-animations`                       |
| Animaciones   | CSS (fade/slide, marquee, float) con `prefers-reduced-motion` |
| Tipografía    | Cinzel (display), Cormorant Garamond (acento), Geist (sans)   |
| i18n          | i18next + react-i18next (`src/locales/es.json`, `en.json`)    |
| Validación    | Zod 4 (schemas localizados en `src/libs/validation`)           |
| Autenticación | Supabase Auth (`@supabase/ssr`)                               |

## Scripts

```bash
pnpm dev          # desarrollo (http://localhost:3000)
pnpm build        # producción
pnpm start        # servidor de producción
pnpm lint         # eslint
```

## Estructura

```
src/
├── app/                  # Rutas (App Router)
│   ├── (landing)         # / , /faq, /policies, /terms  (+ contacto como sección en home)
│   ├── auth/             # /auth/{login,signup,forgot-password,reset-password,verify-email,callback}
│   └── dashboard/        # Panel autenticado (cliente / profesional)
├── components/           # UI, landing, auth, legal, dashboard
├── constants/            # Categorías, enlaces, textos del sitio
├── hooks/                # useAuth, useScrolled, …
├── interfaces/           # Tipos compartidos (UserRole, Profile, …)
├── libs/
│   ├── i18n/             # Configuración de i18next
│   ├── supabase/         # Clientes browser/server, env, updateSession
│   └── validation/       # Schemas Zod
├── locales/              # Traducciones (es / en)
├── services/             # auth.service.ts (Supabase)
└── utils/                # cn, format, auth-error, zod helpers
```

## Configuración de Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Copia `.env.example` a `.env.local` y rellena:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
   ```

3. Aplica la migración `supabase/migrations/0001_init_profiles.sql` (CLI o SQL
   editor). Crea `public.profiles`, activa RLS y auto-genera el perfil al
   registrarse con el rol elegido.
4. En **Auth → URL Configuration**, apunta el *Site URL* al origen de la app
   para que los correos de confirmación y recuperación vuelvan por
   `/auth/callback`.

> Sin credenciales, la app sigue funcionando (landing, i18n, validación) y los
> formularios de auth muestran un estado "no configurado" claro.

## Flujos implementados

- **Landing** con nav, hero + carrusel de pantallas reales (`public/scrennshots`),
  marquee de categorías, secciones cliente/profesional, "cómo funciona", CTA,
  sección de contacto con formulario (Zod → cliente de correo) y footer.
- **Registro e inicio de sesión** por rol (`?role=customer|professional`),
  con validación Zod localizada, términos, mostrar/ocultar contraseña y
  errores traducidos de Supabase.
- **Recuperación y reseteo de contraseña** con callback PKCE.
- **Panel** protegido con saludo según el rol y tarjetas "Próximamente".
- **Contacto (sección en home), FAQ, Privacidad y Términos** (con aviso de marcador de posición).

## Consideraciones de accesibilidad

- Skip link, landmarks semánticos, un solo `<h1>` por página.
- Labels asociados, `aria-invalid`/`aria-describedby`, estados `role="status|alert"`.
- Foco visible dorado, soporte de `prefers-reduced-motion`, contraste AA.