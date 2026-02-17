"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useState } from "react";
import {
  addKnowledgeComment,
  fetchKnowledgeArticleDetail,
  fetchKnowledgeArticles,
  fetchKnowledgeComments,
  getErrorMessage,
} from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { KnowledgeListQuery } from "@/lib/types";

export function KnowledgeLibrary() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(1);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const deferredSearch = useDeferredValue(search);

  const listQuery = useMemo<KnowledgeListQuery>(
    () => ({
      search: deferredSearch || undefined,
      tag: tag.trim() || undefined,
      page,
      pageSize: 12,
      sort: "LATEST",
      publishedOnly: true,
    }),
    [deferredSearch, tag, page],
  );

  const articlesQuery = useQuery({
    queryKey: queryKeys.knowledgeArticles(listQuery),
    queryFn: () => fetchKnowledgeArticles(listQuery),
  });

  const selectedArticleQuery = useQuery({
    queryKey: queryKeys.knowledgeArticle(selectedArticleId ?? "none"),
    queryFn: () => fetchKnowledgeArticleDetail(selectedArticleId ?? ""),
    enabled: Boolean(selectedArticleId),
  });

  const commentsQuery = useQuery({
    queryKey: queryKeys.knowledgeComments(selectedArticleId ?? "none"),
    queryFn: () => fetchKnowledgeComments(selectedArticleId ?? ""),
    enabled: Boolean(selectedArticleId),
  });

  const addCommentMutation = useMutation({
    mutationFn: ({ articleId, body }: { articleId: string; body: string }) =>
      addKnowledgeComment(articleId, body),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.knowledgeComments(variables.articleId),
      });
      await queryClient.invalidateQueries({ queryKey: ["knowledge"] });
    },
  });

  const errorMessage =
    getErrorMessage(articlesQuery.error, "") ||
    getErrorMessage(selectedArticleQuery.error, "") ||
    getErrorMessage(commentsQuery.error, "") ||
    getErrorMessage(addCommentMutation.error, "");

  async function onAddComment() {
    if (!selectedArticleId || commentBody.trim().length < 2) {
      return;
    }

    setFeedback(null);
    try {
      await addCommentMutation.mutateAsync({ articleId: selectedArticleId, body: commentBody.trim() });
      setCommentBody("");
      setFeedback("Comentario agregado.");
    } catch {
      // handled by mutation state
    }
  }

  const articles = articlesQuery.data?.data ?? [];
  const totalPages = articlesQuery.data?.totalPages ?? 1;
  const currentPage = articlesQuery.data?.page ?? page;

  return (
    <section className="space-y-5">
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Knowledge</p>
        <h2 className="mt-2 text-3xl font-bold text-slate-900">Centro de conocimiento</h2>
        <p className="mt-1 text-sm text-slate-600">
          Guias, procedimientos y conversaciones de soporte compartidas por el equipo IT.
        </p>
        <div className="mt-4 grid gap-2 md:grid-cols-[1.2fr_0.8fr]">
          <input
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Buscar articulos"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <input
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Filtrar por tag (ej: vpn)"
            value={tag}
            onChange={(event) => {
              setTag(event.target.value);
              setPage(1);
            }}
          />
        </div>
      </article>

      {errorMessage && <p className="text-sm font-semibold text-red-700">{errorMessage}</p>}
      {feedback && <p className="text-sm font-semibold text-emerald-700">{feedback}</p>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {articles.map((article) => (
          <article key={article.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {article.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={article.title}
                className="h-40 w-full rounded-lg object-cover"
                src={article.coverImageUrl}
              />
            )}
            <h3 className="mt-3 text-lg font-semibold text-slate-900">{article.title}</h3>
            <p className="mt-1 line-clamp-3 text-sm text-slate-600">{article.excerpt || article.body}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {article.tags.map((item) => (
                <span
                  key={`${article.id}-${item}`}
                  className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-700"
                >
                  {item}
                </span>
              ))}
            </div>
            <button
              className="mt-4 rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
              onClick={() => setSelectedArticleId(article.id)}
              type="button"
            >
              Leer y comentar ({article._count.comments})
            </button>
          </article>
        ))}
      </div>

      {articles.length === 0 && <p className="text-slate-600">No hay articulos para este criterio.</p>}

      <div className="flex items-center justify-between border-t border-slate-200 pt-3">
        <p className="text-sm text-slate-600">
          Pagina {currentPage} de {totalPages}
        </p>
        <div className="flex gap-2">
          <button
            className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 disabled:opacity-40"
            disabled={currentPage <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            type="button"
          >
            Anterior
          </button>
          <button
            className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 disabled:opacity-40"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            type="button"
          >
            Siguiente
          </button>
        </div>
      </div>

      {selectedArticleId && selectedArticleQuery.data && (
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xl font-semibold text-slate-900">{selectedArticleQuery.data.title}</h3>
            <button
              className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
              onClick={() => setSelectedArticleId(null)}
              type="button"
            >
              Cerrar
            </button>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {selectedArticleQuery.data.body}
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
            <div className="max-h-80 space-y-2 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
              {(commentsQuery.data ?? []).map((comment) => (
                <article key={comment.id} className="rounded-md border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold text-slate-800">{comment.author.fullName}</p>
                  <p className="mt-1 text-sm text-slate-700">{comment.body}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {new Date(comment.createdAt).toLocaleString("es-PE")}
                  </p>
                </article>
              ))}
              {(commentsQuery.data ?? []).length === 0 && (
                <p className="text-sm text-slate-600">No hay comentarios todavia.</p>
              )}
            </div>
            <div className="space-y-2">
              <textarea
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                placeholder="Comparte tu experiencia o una mejora"
                rows={5}
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
              />
              <button
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                disabled={addCommentMutation.isPending}
                onClick={onAddComment}
                type="button"
              >
                Publicar comentario
              </button>
            </div>
          </div>
        </article>
      )}
    </section>
  );
}

