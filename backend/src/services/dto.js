// Convierte filas de SQLite (snake_case) en los objetos que expone la API.

const uploadUrl = (filename) => (filename ? `/uploads/${filename}` : null);

export function toUserRef(id, username) {
  return { id: Number(id), username };
}

export function toUser(row) {
  return {
    id: Number(row.id),
    username: row.username,
    role: row.role,
    status: row.status,
    bio: row.bio ?? '',
    createdAt: row.created_at,
  };
}

export function toMe(row) {
  return { ...toUser(row), email: row.email };
}

export function toAdminUser(row) {
  return {
    ...toMe(row),
    projectCount: Number(row.project_count ?? 0),
    lastLoginAt: row.last_login_at ?? null,
  };
}

export function toProjectSummary(row) {
  return {
    id: Number(row.id),
    title: row.title,
    description: row.description,
    category: row.category,
    coverUrl: uploadUrl(row.cover_path),
    photoCount: Number(row.photo_count ?? 0),
    likeCount: Number(row.like_count ?? 0),
    commentCount: Number(row.comment_count ?? 0),
    likedByMe: Boolean(row.liked_by_me),
    featured: Boolean(row.featured),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    owner: toUserRef(row.owner_id, row.owner_username),
  };
}

export function toPhoto(row) {
  return {
    id: Number(row.id),
    url: uploadUrl(row.image_path),
    caption: row.caption ?? '',
    position: Number(row.position),
  };
}

export function toComment(row) {
  const comment = {
    id: Number(row.id),
    content: row.content,
    createdAt: row.created_at,
    author: toUserRef(row.user_id, row.author_username),
  };
  if (row.project_title !== undefined) {
    comment.project = { id: Number(row.project_id), title: row.project_title };
  }
  return comment;
}
