// Contratos de la API (reflejan server/src/services/dto.js).

export type Role = 'user' | 'admin' | 'superadmin';
export type Status = 'active' | 'suspended';

export interface UserRef {
  id: number;
  username: string;
}

export interface User extends UserRef {
  role: Role;
  status: Status;
  bio: string;
  createdAt: string;
}

export interface Me extends User {
  email: string;
}

export interface AdminUser extends Me {
  projectCount: number;
  lastLoginAt: string | null;
}

export interface Photo {
  id: number;
  url: string;
  caption: string;
  position: number;
}

export interface ProjectSummary {
  id: number;
  title: string;
  description: string;
  category: string;
  coverUrl: string | null;
  photoCount: number;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  owner: UserRef;
}

export interface ProjectDetail extends ProjectSummary {
  photos: Photo[];
  coverPhotoId: number | null;
}

export interface Comment {
  id: number;
  content: string;
  createdAt: string;
  author: UserRef;
  project?: { id: number; title: string };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Category {
  name: string;
  count: number;
}

export interface MeStats {
  totals: { projects: number; photos: number; likes: number; comments: number };
  likesByDay: { date: string; count: number }[];
  topProjects: ProjectSummary[];
  recentComments: Comment[];
}

export type AdminRange = 7 | 30 | 90;

export interface AdminStats {
  range: AdminRange;
  totals: { users: number; projects: number; photos: number; comments: number; likes: number };
  deltas: { users: number | null; projects: number | null; comments: number | null };
  activity: { date: string; users: number; projects: number; comments: number }[];
  topCategories: Category[];
  topUsers: { id: number; username: string; projects: number; likes: number }[];
}

export type ProjectSort = 'recent' | 'popular' | 'commented';
