import { SQLLiteDialect, sql, Kysely } from './sqlite';


interface Repo {
  repo_name: string,
  url: string,
  branch: string,
  stars: number
}
interface FluxHelmRelease {
  release_name?: string,
  chart_name?: string,
  repo_name?: string,
  hajimari_icon?: string,
  lines: number,
  url: string,
  timestamp: string
}
interface Database {
  repo: Repo,
  flux_helm_release: FluxHelmRelease
}

const dataPromise = fetch(`repos.db`).then(res => res.arrayBuffer());
const db =  new Kysely<Database>({
  dialect: new SQLLiteDialect(dataPromise),
});
export function searchQuery(query: string) {
  query = query.trim().replace(' ', '%');
  const s = db.selectFrom('flux_helm_release')
          .innerJoin('repo', 'flux_helm_release.repo_name', 'repo.repo_name')
          .select([
            'flux_helm_release.release_name as release_name', 
            'flux_helm_release.chart_name as chart_name', 
            'repo.repo_name as repo_name',
            'repo.url as repo_url',
            'flux_helm_release.url as url',
            'flux_helm_release.hajimari_icon as hajimari_icon',
            'flux_helm_release.lines as lines',
            'flux_helm_release.timestamp as timestamp',
            'repo.stars as stars'
          ]) // 'stars', 
          .where('chart_name', 'like', `%${query}%`)
          .orWhere('release_name', 'like', `%${query}%`)
          .groupBy('flux_helm_release.url')
          .orderBy('timestamp', 'desc');
  return s.execute();
}
export function wordcloud() {
  console.log("working")
  const st = db.selectFrom('flux_helm_release')
    .groupBy('chart_name')
    .select([
      'chart_name', 
      sql<number>`count(*)`.as('count'),
      sql<string>`
        (select ci.hajimari_icon from flux_helm_release ci
        where ci.chart_name = flux_helm_release.chart_name and 
          ci.hajimari_icon is not null and
          ci.hajimari_icon != ''
        group by ci.hajimari_icon
        order by count(ci.hajimari_icon) desc)`.as('icon'),
    ]).orderBy('count', 'desc');
  return st.execute();
}
export function topReposQuery() {
  const st = db.selectFrom('repo')
    .select([
      'repo.repo_name as name',
      'repo.url as url',
      'repo.stars as stars',
      sql<number>`
        (select count(distinct fr.release_name) from flux_helm_release fr
        where fr.repo_name = repo.repo_name)`.as('count'),
    ]).orderBy('count', 'desc');
  return st.execute();
}