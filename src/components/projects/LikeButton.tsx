import { useState } from 'react';
import type { MouseEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { projectsApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errorMessage, formatNumber } from '../../lib/format';
import { Icon } from '../ui/Icon';

interface LikeButtonProps {
  projectId: number;
  liked: boolean;
  count: number;
  onChange: (liked: boolean, count: number) => void;
  size?: 'sm' | 'md';
}

// Like optimista: se actualiza al instante y se revierte si el servidor falla.
export function LikeButton({ projectId, liked, count, onChange, size = 'md' }: LikeButtonProps) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);

  async function toggle(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    if (busy) return;
    setBusy(true);
    onChange(!liked, count + (liked ? -1 : 1));
    try {
      const result = await projectsApi.toggleLike(projectId);
      onChange(result.liked, result.likeCount);
    } catch (err) {
      onChange(liked, count);
      toast.error(errorMessage(err, 'No se pudo registrar el like'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`like-btn like-${size}${liked ? ' liked' : ''}`}
      onClick={toggle}
      aria-pressed={liked}
      aria-label={liked ? 'Quitar me gusta' : 'Me gusta'}
    >
      <Icon name="heart" size={size === 'sm' ? 15 : 18} filled={liked} />
      <span>{formatNumber(count)}</span>
    </button>
  );
}
