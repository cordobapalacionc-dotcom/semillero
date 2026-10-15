import { useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Category } from '../../types';

interface CategoryInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  categories: Category[];
  invalid?: boolean;
}

// Campo de texto libre con sugerencias de categorías existentes (teclado: ↑ ↓ Enter Esc).
export function CategoryInput({ id, value, onChange, onBlur, categories, invalid }: CategoryInputProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const suggestions = useMemo(() => {
    const term = value.trim().toLocaleLowerCase('es');
    return categories
      .filter((c) => c.name.toLocaleLowerCase('es').includes(term) && c.name.toLocaleLowerCase('es') !== term)
      .slice(0, 8);
  }, [categories, value]);

  const exists = categories.some((c) => c.name.toLocaleLowerCase('es') === value.trim().toLocaleLowerCase('es'));
  const showList = open && suggestions.length > 0;

  function choose(name: string) {
    onChange(name);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showList) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(suggestions[highlight].name);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="combo">
      <input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
          onBlur();
        }}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        autoComplete="off"
        maxLength={40}
        placeholder="Ej. Robótica, Inteligencia Artificial…"
      />
      {showList && (
        <ul className="combo-list" id={`${id}-list`} role="listbox">
          {suggestions.map((c, i) => (
            <li
              key={c.name}
              role="option"
              aria-selected={i === highlight}
              className={i === highlight ? 'active' : ''}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(c.name);
              }}
              onMouseEnter={() => setHighlight(i)}
            >
              <span>{c.name}</span>
              <span className="muted">{c.count}</span>
            </li>
          ))}
        </ul>
      )}
      {value.trim().length >= 2 && !exists && <p className="field-hint">Se creará la categoría nueva «{value.trim()}».</p>}
    </div>
  );
}
