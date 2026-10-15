import { toComment } from './dto.js';
import { projectFilters, queryProjects } from './projects.js';

const DAY_MS = 24 * 60 * 60 * 1000;
export const ADMIN_RANGES = [7, 30, 90];

const isoDay = (date) => date.toISOString().slice(0, 10);

// Lista de `days` fechas (YYYY-MM-DD, UTC) que terminan en `now`, de la más antigua a la más reciente.
function lastDays(days, now) {
  return Array.from({ length: days }, (_, i) => isoDay(new Date(now.getTime() - (days - 1 - i) * DAY_MS)));
}

function countsByDay(db, sql, params) {
  const map = new Map();
  for (const row of db.prepare(sql).all(params)) map.set(row.day, Number(row.n));
  return map;
}

const count = (db, sql, params = {}) => Number(db.prepare(sql).get(params).n);

function percentChange(current, previous) {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function getMeStats(db, userId, now = new Date()) {
  const days = lastDays(30, now);
  const params = { userId };

  const totals = {
    projects: count(db, 'SELECT COUNT(*) AS n FROM projects WHERE owner_id = :userId', params),
    photos: count(
      db,
      'SELECT COUNT(*) AS n FROM photos ph JOIN projects p ON p.id = ph.project_id WHERE p.owner_id = :userId',
      params,
    ),
    likes: count(
      db,
      'SELECT COUNT(*) AS n FROM likes l JOIN projects p ON p.id = l.project_id WHERE p.owner_id = :userId',
      params,
    ),
    comments: count(
      db,
      'SELECT COUNT(*) AS n FROM comments c JOIN projects p ON p.id = c.project_id WHERE p.owner_id = :userId',
      params,
    ),
  };

  const likeMap = countsByDay(
    db,
    `SELECT date(l.created_at) AS day, COUNT(*) AS n
     FROM likes l JOIN projects p ON p.id = l.project_id
     WHERE p.owner_id = :userId AND date(l.created_at) >= :start
     GROUP BY day`,
    { userId, start: days[0] },
  );

  const { where, params: filterParams } = projectFilters({ ownerId: userId });
  const { items: topProjects } = queryProjects(db, {
    where,
    params: filterParams,
    orderBy: 'like_count DESC, p.created_at DESC, p.id DESC',
    pageSize: 5,
    viewerId: userId,
  });

  const recentComments = db
    .prepare(
      `SELECT c.*, u.username AS author_username, p.title AS project_title
       FROM comments c
       JOIN projects p ON p.id = c.project_id
       JOIN users u ON u.id = c.user_id
       WHERE p.owner_id = :userId AND c.user_id != :userId
       ORDER BY c.created_at DESC, c.id DESC
       LIMIT 5`,
    )
    .all({ userId })
    .map(toComment);

  return {
    totals,
    likesByDay: days.map((date) => ({ date, count: likeMap.get(date) ?? 0 })),
    topProjects,
    recentComments,
  };
}

export function getAdminStats(db, range, now = new Date()) {
  const days = lastDays(range, now);
  const start = days[0];
  const previousStart = isoDay(new Date(new Date(`${start}T00:00:00Z`).getTime() - range * DAY_MS));

  const totals = {
    users: count(db, 'SELECT COUNT(*) AS n FROM users'),
    projects: count(db, 'SELECT COUNT(*) AS n FROM projects'),
    photos: count(db, 'SELECT COUNT(*) AS n FROM photos'),
    comments: count(db, 'SELECT COUNT(*) AS n FROM comments'),
    likes: count(db, 'SELECT COUNT(*) AS n FROM likes'),
  };

  const tables = { users: 'users', projects: 'projects', comments: 'comments' };
  const deltas = {};
  const activityMaps = {};
  for (const [key, table] of Object.entries(tables)) {
    const current = count(db, `SELECT COUNT(*) AS n FROM ${table} WHERE date(created_at) >= :start`, { start });
    const previous = count(
      db,
      `SELECT COUNT(*) AS n FROM ${table} WHERE date(created_at) >= :previousStart AND date(created_at) < :start`,
      { start, previousStart },
    );
    deltas[key] = percentChange(current, previous);
    activityMaps[key] = countsByDay(
      db,
      `SELECT date(created_at) AS day, COUNT(*) AS n FROM ${table} WHERE date(created_at) >= :start GROUP BY day`,
      { start },
    );
  }

  const topCategories = db
    .prepare(
      `SELECT category AS name, COUNT(*) AS count FROM projects
       GROUP BY category ORDER BY count DESC, name COLLATE NOCASE LIMIT 8`,
    )
    .all()
    .map((r) => ({ name: r.name, count: Number(r.count) }));

  const topUsers = db
    .prepare(
      `SELECT u.id, u.username,
         COUNT(p.id) AS projects,
         (SELECT COUNT(*) FROM likes l JOIN projects p2 ON p2.id = l.project_id WHERE p2.owner_id = u.id) AS likes
       FROM users u JOIN projects p ON p.owner_id = u.id
       GROUP BY u.id
       ORDER BY projects DESC, likes DESC, u.username COLLATE NOCASE
       LIMIT 5`,
    )
    .all()
    .map((r) => ({ id: Number(r.id), username: r.username, projects: Number(r.projects), likes: Number(r.likes) }));

  return {
    range,
    totals,
    deltas,
    activity: days.map((date) => ({
      date,
      users: activityMaps.users.get(date) ?? 0,
      projects: activityMaps.projects.get(date) ?? 0,
      comments: activityMaps.comments.get(date) ?? 0,
    })),
    topCategories,
    topUsers,
  };
}
