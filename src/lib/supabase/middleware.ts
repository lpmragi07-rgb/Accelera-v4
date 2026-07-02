import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// Atualiza a sessão do Supabase a cada requisição e protege rotas privadas.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login");
  const isApiWebhook = path.startsWith("/api/api4com"); // webhooks públicos (validados por segredo)
  const isKeepAlive = path.startsWith("/api/keep-alive"); // ping de infraestrutura (cron externo)

  // Sem usuário e tentando acessar área privada -> manda para o login
  if (!user && !isAuthRoute && !isApiWebhook && !isKeepAlive) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Já logado tentando acessar o login -> manda para o painel
  if (user && isAuthRoute) {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = "/";
    return NextResponse.redirect(dashUrl);
  }

  return supabaseResponse;
}
