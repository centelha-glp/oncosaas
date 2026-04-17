'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuthStore } from '@/stores/auth-store';
import { NavigationBar } from '@/components/shared/navigation-bar';
import {
  productFeedbackApi,
  type ProductFeedbackWithAuthor,
} from '@/lib/api/product-feedback';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ApiClientError } from '@/lib/api/client';

function FeedbackRow({ item }: { item: ProductFeedbackWithAuthor }) {
  const typeLabel = item.type === 'BUG' ? 'Bug' : 'Funcionalidade';
  return (
    <article
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      aria-label={`Feedback: ${item.title}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-2">
        <span className="text-sm font-medium text-slate-900">{item.title}</span>
        <time
          className="text-xs text-slate-500"
          dateTime={item.createdAt}
        >
          {format(new Date(item.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
        </time>
      </div>
      <p className="mt-2 text-xs text-slate-600">
        <span className="font-medium text-slate-700">{typeLabel}</span>
        {' · '}
        {item.user.name} ({item.user.email})
      </p>
      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800">
        {item.description}
      </p>
      {item.pageUrl ? (
        <p className="mt-2 text-xs">
          <span className="text-slate-500">Página: </span>
          <a
            href={item.pageUrl}
            className="break-all text-indigo-600 underline hover:text-indigo-800"
            target="_blank"
            rel="noopener noreferrer"
          >
            {item.pageUrl}
          </a>
        </p>
      ) : null}
    </article>
  );
}

export default function ProductFeedbackListPage() {
  const router = useRouter();
  const { user, isAuthenticated, isInitializing, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isInitializing) {
      if (!isAuthenticated) {
        router.replace('/login');
        return;
      }
      if (user && user.role !== 'ADMIN') {
        router.replace('/dashboard');
      }
    }
  }, [isAuthenticated, isInitializing, user, router]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['product-feedback', 'list'],
    queryFn: () => productFeedbackApi.list({ page: 1, limit: 50 }),
    enabled: Boolean(isAuthenticated && user?.role === 'ADMIN'),
  });

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-gray-600">Carregando...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  if (user.role !== 'ADMIN') {
    return null;
  }

  const isForbidden =
    error instanceof ApiClientError && error.statusCode === 403;

  return (
    <div className="flex min-h-screen w-full flex-col bg-gray-100">
      <NavigationBar />
      <main className="flex-1 p-6">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Feedback do produto
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Bugs e sugestões enviados pela equipa da sua instituição.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Últimos envios</CardTitle>
              <CardDescription>
                {data != null
                  ? `${data.total} registo(s) no total`
                  : 'Lista de feedbacks'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading && (
                <p className="text-sm text-gray-600">A carregar…</p>
              )}
              {isError && (
                <div
                  className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900"
                  role="alert"
                >
                  <p className="font-medium">Não foi possível carregar</p>
                  <p className="mt-1">
                    {isForbidden
                      ? 'Apenas administradores podem ver esta lista.'
                      : error instanceof Error
                        ? error.message
                        : 'Erro desconhecido'}
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-left text-sm underline"
                    onClick={() => refetch()}
                  >
                    Tentar novamente
                  </button>
                </div>
              )}
              {!isLoading && data && data.data.length === 0 && (
                <p className="text-sm text-gray-600">
                  Ainda não há feedbacks registados.
                </p>
              )}
              {data?.data.map((item) => (
                <FeedbackRow key={item.id} item={item} />
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
