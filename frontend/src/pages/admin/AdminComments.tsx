import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api';
import { PageHeader } from '../../components/layout/SidebarLayout';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { EmptyState, ErrorState, Pagination, Spinner } from '../../components/ui/Feedback';
import { Icon } from '../../components/ui/Icon';
import { useConfirm } from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { useDebounce } from '../../hooks/useDebounce';
import { useQueryState } from '../../hooks/useQueryState';
import { errorMessage, plural, timeAgo } from '../../lib/format';
import type { Comment } from '../../types';

export function AdminComments() {
  const toast = useToast();
  const confirm = useConfirm();
  const [query, setQuery] = useQueryState({ q: '', page: '1' });
  const [search, setSearch] = useState(query.q);
  const debounced = useDebounce(search.trim(), 300);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const page = Math.max(1, Number(query.page) || 1);

  useEffect(() => {
    if (debounced !== query.q) setQuery({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const { data, loading, error, reload } = useAsync(() => adminApi.comments({ q: query.q, page }), [query.q, page]);
  useEffect(() => setSelected(new Set()), [query.q, page]);

  async function remove(ids: number[]) {
    const ok = await confirm({
      title: ids.length === 1 ? 'Eliminar comentario' : `Eliminar ${ids.length} comentarios`,
      message: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      if (ids.length === 1) await adminApi.deleteComment(ids[0]);
      else await adminApi.bulkDeleteComments(ids);
      toast.success(plural(ids.length, 'comentario eliminado', 'comentarios eliminados'));
      setSelected(new Set());
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const columns: Column<Comment>[] = [
    { key: 'content', header: 'Comentario', render: (c) => <p className="comment-cell">{c.content}</p> },
    { key: 'author', header: 'Autor', render: (c) => <Link className="link" to={`/admin/usuarios?q=${encodeURIComponent(c.author.username)}`}>{c.author.username}</Link> },
    {
      key: 'project',
      header: 'Proyecto',
      render: (c) =>
        c.project && (
          <Link className="link" to={`/proyectos/${c.project.id}`}>
            {c.project.title}
          </Link>
        ),
    },
    { key: 'date', header: 'Fecha', render: (c) => timeAgo(c.createdAt) },
  ];

  return (
    <>
      <PageHeader title="Comentarios" description={data ? plural(data.total, 'comentario', 'comentarios') : undefined} />

      <div className="toolbar">
        <div className="search-input">
          <Icon name="search" size={16} />
          <input className="input" type="search" placeholder="Buscar por texto, autor o proyecto…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar comentarios" />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="bulk-bar" role="region" aria-label="Acciones en lote">
          <span>{plural(selected.size, 'seleccionado', 'seleccionados')}</span>
          <div className="page-actions">
            <button className="btn btn-sm" onClick={() => setSelected(new Set())}>
              Deseleccionar
            </button>
            <button className="btn btn-sm" onClick={() => remove([...selected])}>
              <Icon name="trash" size={14} /> Eliminar seleccionados ({selected.size})
            </button>
          </div>
        </div>
      )}

      {loading && !data ? (
        <Spinner />
      ) : error || !data ? (
        <ErrorState message={error ?? 'Sin datos'} onRetry={reload} />
      ) : data.items.length === 0 ? (
        <EmptyState icon="comment" title="Sin comentarios">
          {query.q ? 'Ningún comentario coincide con la búsqueda.' : 'Todavía nadie ha comentado.'}
        </EmptyState>
      ) : (
        <DataTable
          columns={columns}
          rows={data.items}
          getId={(c) => c.id}
          selected={selected}
          onSelectChange={setSelected}
          actions={(c) => (
            <button className="icon-btn" onClick={() => remove([c.id])} title="Eliminar" aria-label="Eliminar comentario">
              <Icon name="trash" size={16} />
            </button>
          )}
        />
      )}

      {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={(p) => setQuery({ page: String(p) })} />}
    </>
  );
}
