import { json, qs, request, uploadWithProgress } from './client';
import type {
  AdminRange,
  AdminStats,
  AdminUser,
  Category,
  Comment,
  Me,
  MeStats,
  Paginated,
  ProjectDetail,
  ProjectSort,
  ProjectSummary,
  Role,
  Status,
  User,
} from '../types';

export interface ProjectListParams {
  q?: string;
  category?: string;
  sort?: ProjectSort;
  page?: number;
}

export interface AdminListParams {
  q?: string;
  category?: string;
  featured?: 'true' | 'false';
  role?: Role;
  status?: Status;
  sort?: string;
  dir?: 'asc' | 'desc';
  page?: number;
}

type Session = { token: string; user: Me };
type Progress = (percent: number) => void;

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

export const authApi = {
  register: (data: RegisterData) => request<Session>('/api/auth/register', json('POST', data)),
  login: (identifier: string, password: string) =>
    request<Session>('/api/auth/login', json('POST', { identifier, password })),
  check: (params: { username?: string; email?: string }) =>
    request<{ usernameAvailable?: boolean; emailAvailable?: boolean }>(`/api/auth/check${qs(params)}`),
  me: () => request<{ user: Me }>('/api/auth/me'),
  updateMe: (data: { username?: string; email?: string; bio?: string }) =>
    request<{ user: Me }>('/api/auth/me', json('PATCH', data)),
  changePassword: (data: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    request<void>('/api/auth/me/password', json('POST', data)),
};

export const projectsApi = {
  list: (params: ProjectListParams) => request<Paginated<ProjectSummary>>(`/api/projects${qs({ ...params })}`),
  featured: () => request<ProjectSummary[]>('/api/projects/featured'),
  categories: () => request<Category[]>('/api/projects/categories'),
  get: (id: number) => request<ProjectDetail>(`/api/projects/${id}`),
  toggleLike: (id: number) =>
    request<{ liked: boolean; likeCount: number }>(`/api/projects/${id}/like`, json('POST')),
  comments: (id: number) => request<Comment[]>(`/api/projects/${id}/comments`),
  addComment: (id: number, content: string) =>
    request<Comment>(`/api/projects/${id}/comments`, json('POST', { content })),
  deleteComment: (commentId: number) => request<void>(`/api/projects/comments/${commentId}`, json('DELETE')),
  user: (username: string) =>
    request<{ user: User; projects: ProjectSummary[]; projectCount: number }>(
      `/api/users/${encodeURIComponent(username)}`,
    ),
};

export const meApi = {
  stats: () => request<MeStats>('/api/me/stats'),
  projects: (params: ProjectListParams) => request<Paginated<ProjectSummary>>(`/api/me/projects${qs({ ...params })}`),
  create: (form: FormData, onProgress: Progress) =>
    uploadWithProgress<ProjectDetail>('/api/me/projects', form, 'POST', onProgress),
  update: (id: number, data: { title?: string; description?: string; category?: string; coverPhotoId?: number }) =>
    request<ProjectDetail>(`/api/me/projects/${id}`, json('PATCH', data)),
  remove: (id: number) => request<void>(`/api/me/projects/${id}`, json('DELETE')),
  addPhotos: (id: number, form: FormData, onProgress: Progress) =>
    uploadWithProgress<ProjectDetail>(`/api/me/projects/${id}/photos`, form, 'POST', onProgress),
  reorder: (id: number, photoIds: number[]) =>
    request<ProjectDetail>(`/api/me/projects/${id}/photos/order`, json('PATCH', { photoIds })),
  updateCaption: (id: number, photoId: number, caption: string) =>
    request<ProjectDetail>(`/api/me/projects/${id}/photos/${photoId}`, json('PATCH', { caption })),
  removePhoto: (id: number, photoId: number) =>
    request<ProjectDetail>(`/api/me/projects/${id}/photos/${photoId}`, json('DELETE')),
};

export const adminApi = {
  stats: (range: AdminRange) => request<AdminStats>(`/api/admin/stats${qs({ range })}`),
  projects: (params: AdminListParams) =>
    request<Paginated<ProjectSummary>>(`/api/admin/projects${qs({ ...params })}`),
  project: (id: number) => request<ProjectDetail>(`/api/admin/projects/${id}`),
  setFeatured: (id: number, featured: boolean) =>
    request<ProjectDetail>(`/api/admin/projects/${id}/featured`, json('PATCH', { featured })),
  deleteProject: (id: number) => request<void>(`/api/admin/projects/${id}`, json('DELETE')),
  bulkDeleteProjects: (ids: number[]) =>
    request<{ deleted: number }>('/api/admin/projects/bulk-delete', json('POST', { ids })),
  comments: (params: AdminListParams) => request<Paginated<Comment>>(`/api/admin/comments${qs({ ...params })}`),
  deleteComment: (id: number) => request<void>(`/api/admin/comments/${id}`, json('DELETE')),
  bulkDeleteComments: (ids: number[]) =>
    request<{ deleted: number }>('/api/admin/comments/bulk-delete', json('POST', { ids })),
  users: (params: AdminListParams) => request<Paginated<AdminUser>>(`/api/admin/users${qs({ ...params })}`),
  setStatus: (id: number, status: Status) =>
    request<AdminUser>(`/api/admin/users/${id}/status`, json('PATCH', { status })),
  setRole: (id: number, role: 'user' | 'admin') =>
    request<AdminUser>(`/api/admin/users/${id}/role`, json('PATCH', { role })),
  deleteUser: (id: number) => request<void>(`/api/admin/users/${id}`, json('DELETE')),
};
