import {next, rewrite} from '@vercel/edge';
import {issueRoomPass} from './shared/invitations.js';

const roomHost = 'palm-hours-island.qstar0.workers.dev';
const privateHeaders = {'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};

export const config = {matcher:'/:path*'};

export default async function middleware(request) {
  const url = new URL(request.url);
  if (url.pathname === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n');
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null,{status:405});
  // The island is public. Old invitation links land on the front page.
  if (url.pathname === '/join' || url.pathname.startsWith('/join/')) return Response.redirect(new URL('/',url), 308);
  if (url.pathname === '/palm-hours-figures.zip') {
    return rewrite(new URL('/stripe-residency-figures.zip',url),{headers:privateHeaders});
  }
  if (url.pathname === '/api/members') {
    const directory=await fetch('https://' + roomHost + '/api/members',{
      headers:{Cookie:'__Host-palm_hours='+process.env.ISLAND_INVITE,'Accept-Encoding':'identity'},cache:'no-store'
    });
    if(!directory.ok)return new Response(null,{status:directory.status,headers:privateHeaders});
    return Response.json(await directory.json(),{headers:privateHeaders});
  }
  if (url.pathname === '/api/connection') {
    if (!process.env.ROOM_SIGNING_KEY) return new Response('Island is opening.', {status:503,headers:privateHeaders});
    const pass = await issueRoomPass(url.origin, process.env.ROOM_SIGNING_KEY);
    return Response.json({url:'wss://' + roomHost + '/live?admit=' + pass}, {headers:privateHeaders});
  }
  return next({headers:{'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'}});
}
