"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useState } from "react";
import {
  addKnowledgeComment,
  createKnowledgeArticle,
  fetchKnowledgeArticles,
  fetchKnowledgeComments,
  getErrorMessage,
  updateKnowledgeArticle,
} from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { CreateKnowledgeArticleInput, KnowledgeArticle, KnowledgeListQuery } from "@/lib/types";

type KnowledgeManagerProps = {
  role: "ADMIN" | "AGENT";
};

function csvToArray(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function KnowledgeManager({ role }: KnowledgeManagerProps) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"LATEST" | "OLDEST">("LATEST");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");

  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [galleryInput, setGalleryInput] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isPublished, setIsPublished] = useState(false);

  const deferredSearch = useDeferredValue(search);

  const listQuery = useMemo<KnowledgeListQuery>(
    () => ({
      search: deferredSearch || undefined,
      sort,
      page,
      pageSize: 12,
      publishedOnly: false,
    }),
    [deferredSearch, sort, page],
  );

  const articlesQuery = useQuery({
    queryKey: queryKeys.knowledgeArticles(listQuery),
    queryFn: () => fetchKnowledgeArticles(listQuery),
  });

  const selectedArticle = useMemo(
    () => articlesQuery.data?.data.find((article) => article.id === selectedArticleId) ?? null,
    [articlesQuery.data, selectedArticleId],
  );

  const commentsQuery = useQuery({
    queryKey: queryKeys.knowledgeComments(selectedArticleId ?? "none"),
    queryFn: () => fetchKnowledgeComments(selectedArticleId ?? ""),
    enabled: Boolean(selectedArticleId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateKnowledgeArticleInput) => createKnowledgeArticle(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["knowledge"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ articleId, payload }: { articleId: string; payload: Partial<CreateKnowledgeArticleInput> }) =>
      updateKnowledgeArticle(articleId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["knowledge"] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: ({ articleId, value }: { articleId: string; value: string }) =>
      addKnowledgeComment(articleId, value),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.knowledgeComments(variables.articleId),
      });
      await queryClient.invalidateQueries({ queryKey: ["knowledge"] });
    },
  });

  const errorMessage =
    getErrorMessage(articlesQuery.error, "") ||
    getErrorMessage(commentsQuery.error, "") ||
    getErrorMessage(createMutation.error, "") ||
    getErrorMessage(updateMutation.error, "") ||
    getErrorMessage(commentMutation.error, "");

  const isLoading = articlesQuery.isLoading;
  const articles = articlesQuery.data?.data ?? [];
  const totalPages = articlesQuery.data?.totalPages ?? 1;
  const currentPage = articlesQuery.data?.page ?? page;

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setExcerpt("");
    setBody("");
    setCoverImageUrl("");
    setGalleryInput("");
    setTagsInput("");
    setIsPublished(false);
  }

  function loadArticle(article: KnowledgeArticle) {
    setEditingId(article.id);
    setTitle(article.title);
    setExcerpt(article.excerpt ?? "");
    setBody(article.body);
    setCoverImageUrl(article.coverImageUrl ?? "");
    setGalleryInput(article.galleryImageUrls.join(", "));
    setTagsInput(article.tags.join(", "));
    setIsPublished(article.isPublished);
  }

  async function onSubmitArticle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const payload: CreateKnowledgeArticleInput = {
      title: title.trim(),
      excerpt: excerpt.trim() || undefined,
      body: body.trim(),
      coverImageUrl: coverImageUrl.trim() || undefined,
      galleryImageUrls: csvToArray(galleryInput),
      tags: csvToArray(tagsInput),
      isPublished,
    };

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ articleId: editingId, payload });
        setFeedback("Articulo actualizado.");
      } else {
        await createMutation.mutateAsync(payload);
        setFeedback("Articulo creado.");
      }
      resetForm();
    } catch {
      // handled by mutation state
    }
  }

  async function togglePublish(article: KnowledgeArticle) {
    setFeedback(null);
    try {
      await updateMutation.mutateAsync({
        articleId: article.id,
        payload: { isPublished: !article.isPublished },
      });
      setFeedback(article.isPublished ? "Articulo retirado de portal usuario." : "Articulo publicado.");
    } catch {
      // handled by mutation state
    }
  }

  async function onAddComment() {
    if (!selectedArticleId || commentBody.trim().length < 2) {
      return;
    }

    setFeedback(null);
    try {
      await commentMutation.mutateAsync({ articleId: selectedArticleId, value: commentBody.trim() });
      setCommentBody("");
      setFeedback("Comentario agregado.");
    } catch {
      // handled by mutation state
    }
  }

  return (
    <section className="space-y-5">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Knowledge Hub</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">Base de conocimiento</h2>
        <p className="mt-1 text-sm text-slate-600">
          Gestiona articulos y conversaciones internas/publicas. Perfil activo: {role}.
        </p>
      </article>

      {errorMessage && <p className="text-sm font-semibold text-red-700">{errorMessage}</p>}
      {feedback && <p className="text-sm font-semibold text-emerald-700">{feedback}</p>}

      <div className="grid gap-5 xl:grid-cols-[1.05fr_1.35fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">
              {editingId ? "Editar articulo" : "Nuevo articulo"}
            </h3>
            {editingId && (
              <button
                className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                onClick={resetForm}
                type="button"
              >
                Cancelar edicion
              </button>
            )}
          </div>
          <form className="grid gap-3" onSubmit={onSubmitArticle}>
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="Titulo"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
            <textarea
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="Extracto corto"
              value={excerpt}
              onChange={(event) => setExcerpt(event.target.value)}
              rows={2}
            />
            <textarea
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="Contenido (admite markdown de texto)"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={9}
              required
            />
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="URL de imagen portada (https://...)"
              value={coverImageUrl}
              onChange={(event) => setCoverImageUrl(event.target.value)}
            />
            <textarea
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="URLs de galeria separadas por coma"
              value={galleryInput}
              onChange={(event) => setGalleryInput(event.target.value)}
              rows={2}
            />
            <input
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="Tags separadas por coma (ej: redes, impresoras, vpn)"
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                checked={isPublished}
                onChange={(event) => setIsPublished(event.target.checked)}
                type="checkbox"
              />
              Publicar para portal usuario
            </label>
            <button
              className="rounded-md bg-gradient-to-r from-blue-700 to-cyan-600 px-4 py-2 font-semibold text-white"
              disabled={createMutation.isPending || updateMutation.isPending}
              type="submit"
            >
              {editingId ? "Guardar cambios" : "Crear articulo"}
            </button>
          </form>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-slate-900">Articulos y foro</h3>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Buscar por titulo o contenido"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
              <select
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as "LATEST" | "OLDEST");
                  setPage(1);
                }}
              >
                <option value="LATEST">Mas recientes</option>
                <option value="OLDEST">Mas antiguos</option>
              </select>
            </div>
          </div>

          {isLoading && <p className="text-slate-600">Cargando articulos...</p>}
          {!isLoading && articles.length === 0 && (
            <p className="text-slate-600">No hay articulos para este filtro.</p>
          )}
          {!isLoading && articles.length > 0 && (
            <div className="space-y-3">
              {articles.map((article) => (
                <article
                  key={article.id}
                  className={`rounded-xl border p-3 ${
                    selectedArticleId === article.id
                      ? "border-blue-300 bg-blue-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{article.title}</p>
                      <p className="text-xs text-slate-600">
                        {article.author.fullName} · {new Date(article.createdAt).toLocaleDateString("es-PE")}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                        article.isPublished
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {article.isPublished ? "PUBLICADO" : "BORRADOR"}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                    {article.excerpt || article.body}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                      onClick={() => loadArticle(article)}
                      type="button"
                    >
                      Editar
                    </button>
                    <button
                      className="rounded-md border border-blue-300 px-3 py-1 text-xs font-semibold text-blue-700"
                      onClick={() => setSelectedArticleId(article.id)}
                      type="button"
                    >
                      Foro ({article._count.comments})
                    </button>
                    <button
                      className="rounded-md border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-700"
                      onClick={() => togglePublish(article)}
                      type="button"
                    >
                      {article.isPublished ? "Despublicar" : "Publicar"}
                    </button>
                  </div>
                </article>
              ))}

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
            </div>
          )}
        </article>
      </div>

      {selectedArticle && (
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-slate-900">Foro: {selectedArticle.title}</h3>
            <button
              className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
              onClick={() => setSelectedArticleId(null)}
              type="button"
            >
              Cerrar
            </button>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedArticle.body}</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
            <div className="max-h-72 space-y-2 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
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
                <p className="text-sm text-slate-600">Sin comentarios todavia.</p>
              )}
            </div>
            <div className="space-y-2">
              <textarea
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                placeholder="Responder en el foro del articulo"
                rows={5}
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
              />
              <button
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                disabled={commentMutation.isPending}
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

