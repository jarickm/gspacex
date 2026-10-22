import app from '../server';

export default function handler(req: any, res: any) {
  // Normalize URL from Vercel's catch-all query parameter
  if (req.query?.all) {
    const subpath = Array.isArray(req.query.all)
      ? req.query.all.join('/')
      : String(req.query.all);
    req.url = '/api/' + subpath.replace(/^\/+/, '');
  }
  return app(req, res);
}
