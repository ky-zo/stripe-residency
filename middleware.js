import {next, rewrite} from '@vercel/edge';
import {hasInvitation, invitationCookie, invitationPage, issueRoomPass} from './shared/invitations.js';

const roomHost = 'palm-hours-island.qstar0.workers.dev';
const privateHeaders = {'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};

export const config = {matcher:'/:path*'};

export default async function middleware(request) {
  const url = new URL(request.url);
  if (url.pathname === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n');
  const invitation = process.env.ISLAND_INVITE;
  const joining = Boolean(invitation) && url.pathname === '/join/' + invitation;
  if (!joining && !hasInvitation(request, invitation)) return invitationPage();
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null,{status:405});
  if (joining) {
    return rewrite(new URL('/index.html',url), {headers:{...privateHeaders,'Set-Cookie':invitationCookie(invitation)}});
  }
  if (url.pathname === '/api/invite') {
    return Response.json({path:'/join/'+invitation}, {headers:privateHeaders});
  }
  if (url.pathname === '/api/connection') {
    if (!process.env.ROOM_SIGNING_KEY) return new Response('Island is opening.', {status:503,headers:privateHeaders});
    const pass = await issueRoomPass(url.origin, process.env.ROOM_SIGNING_KEY);
    return Response.json({url:'wss://' + roomHost + '/live?admit=' + pass}, {headers:privateHeaders});
  }
  return next({headers:{'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'}});
}
