import { useCallback, useEffect, useRef, useState } from 'react';
import type { DependencyList } from 'react';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  setData: (updater: T | ((prev: T | null) => T | null)) => void;
}

// Ejecuta `fn` cuando cambian las dependencias. Ignora respuestas de peticiones viejas
// para que una búsqueda lenta no pise el resultado de una más reciente.
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const callId = useRef(0);

  useEffect(() => {
    const id = ++callId.current;
    setLoading(true);
    setError(null);
    fn()
      .then((result) => {
        if (id === callId.current) setData(result);
      })
      .catch((err: unknown) => {
        if (id === callId.current) setError(err instanceof Error ? err.message : 'Ocurrió un error');
      })
      .finally(() => {
        if (id === callId.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload, setData: setData as AsyncState<T>['setData'] };
}
