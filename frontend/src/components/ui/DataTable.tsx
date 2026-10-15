import type { ReactNode } from 'react';
import { Icon } from './Icon';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
}

export interface SortState {
  sort: string;
  dir: 'asc' | 'desc';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getId: (row: T) => number;
  selected?: Set<number>;
  onSelectChange?: (next: Set<number>) => void;
  sort?: SortState;
  onSortChange?: (next: SortState) => void;
  actions?: (row: T) => ReactNode;
}

// Tabla con selección múltiple y columnas ordenables. En pantallas pequeñas el CSS
// la convierte en tarjetas usando data-label en cada celda.
export function DataTable<T>({
  columns,
  rows,
  getId,
  selected,
  onSelectChange,
  sort,
  onSortChange,
  actions,
}: DataTableProps<T>) {
  const selectable = Boolean(selected && onSelectChange);
  const allSelected = selectable && rows.length > 0 && rows.every((r) => selected!.has(getId(r)));

  function toggleAll() {
    if (!selected || !onSelectChange) return;
    const next = new Set(selected);
    if (allSelected) rows.forEach((r) => next.delete(getId(r)));
    else rows.forEach((r) => next.add(getId(r)));
    onSelectChange(next);
  }

  function toggleOne(id: number) {
    if (!selected || !onSelectChange) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectChange(next);
  }

  function clickHeader(col: Column<T>) {
    if (!col.sortable || !sort || !onSortChange) return;
    const dir = sort.sort === col.key && sort.dir === 'desc' ? 'asc' : 'desc';
    onSortChange({ sort: col.key, dir });
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {selectable && (
              <th className="col-check">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Seleccionar todo" />
              </th>
            )}
            {columns.map((col) => {
              const active = sort?.sort === col.key;
              return (
                <th
                  key={col.key}
                  className={`${col.className ?? ''}${col.sortable ? ' sortable' : ''}${active ? ' sorted' : ''}`}
                  aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {col.sortable ? (
                    <button type="button" onClick={() => clickHeader(col)}>
                      {col.header}
                      <span className="sort-icon">
                        {active ? <Icon name={sort!.dir === 'asc' ? 'arrowUp' : 'arrowDown'} size={12} /> : '↕'}
                      </span>
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
            {actions && <th className="col-actions">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = getId(row);
            const isSelected = selected?.has(id) ?? false;
            return (
              <tr key={id} className={isSelected ? 'selected' : undefined}>
                {selectable && (
                  <td className="col-check">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(id)}
                      aria-label="Seleccionar fila"
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td key={col.key} data-label={col.header} className={col.className}>
                    {col.render(row)}
                  </td>
                ))}
                {actions && (
                  <td className="col-actions" data-label="Acciones">
                    <div className="row-actions">{actions(row)}</div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
