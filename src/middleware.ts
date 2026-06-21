import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that do not require authentication
const publicRoutes = ['/login', '/api/auth/login'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Se a rota é pública, permite o acesso
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Se for qualquer outra rota do painel (/dashboard) ou API (/api), verifica o cookie de sessão
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/api')) {
    const sessionCookie = req.cookies.get('nodecommander_session');

    if (!sessionCookie) {
      // Se for requisição de API, retorna 401 Unauthorized
      if (pathname.startsWith('/api')) {
        return NextResponse.json({ error: 'Não autorizado. Faça login novamente.' }, { status: 401 });
      }
      
      // Se for navegação normal, redireciona para a página de login
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

// Configura o middleware para interceptar apenas rotas específicas para performance
export const config = {
  matcher: [
    /*
     * Intercepta as rotas do painel e da API, ignorando caminhos estáticos
     * como arquivos _next/static, imagens, favicon, etc.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
